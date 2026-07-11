/**
 * watsonx.js
 * Low-level IBM watsonx.ai communication layer.
 *
 * Exposes two functions:
 *   queryWatsonx     — sends a prompt to the active model, returns raw text.
 *   queryWatsonxJson — adds JSON extraction, validation, retry, and circuit-breaker.
 *
 * Model strategy:
 *   Primary : WATSONX_MODEL_ID      (env)   → meta-llama/llama-3-3-70b-instruct
 *   Fallback: WATSONX_MODEL_FALLBACK (env)   → ibm/granite-8b-code-instruct
 *
 * Region: au-syd (https://au-syd.ml.cloud.ibm.com) — verified working in this project.
 * The hardcoded default is intentionally au-syd; no us-south reference anywhere.
 *
 * Circuit-breaker:
 *   If the primary model fails JSON validation 3 consecutive times the circuit
 *   opens and ALL subsequent calls are routed to the fallback model for the
 *   remainder of the process lifetime.  A successful parse resets the counter.
 *   The fallback ALWAYS points to ibm/granite-8b-code-instruct — the only model
 *   confirmed available in au-syd for this project.
 *
 * Prompt format:
 *   Step 1 — existing <|system|>/<|user|>/<|assistant|> tags are kept unchanged.
 *   If live testing shows Llama requires its own header tokens, only this file's
 *   buildPrompt wrapper needs updating; all service files remain untouched.
 */

import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from 'ibm-cloud-sdk-core';

// ─── Singleton client ─────────────────────────────────────────────────────────
let _client = null;

function getClient() {
  if (_client) return _client;

  const apiKey     = process.env.WATSONX_API_KEY;
  // Default region is au-syd — the region confirmed for this project.
  const serviceUrl = process.env.WATSONX_URL || 'https://au-syd.ml.cloud.ibm.com';

  if (!apiKey) {
    throw new Error(
      '[watsonx] WATSONX_API_KEY is not set. Add it to server/.env before making AI calls.'
    );
  }

  _client = WatsonXAI.newInstance({
    serviceUrl,
    authenticator: new IamAuthenticator({ apikey: apiKey }),
  });

  return _client;
}

// ─── Model resolver ───────────────────────────────────────────────────────────

// Primary  : Meta Llama 3.3 70B Instruct (available in au-syd via IBM watsonx.ai)
// Fallback : ibm/granite-8b-code-instruct — verified working in au-syd for this project
const PRIMARY_MODEL  = process.env.WATSONX_MODEL_ID       || 'meta-llama/llama-3-3-70b-instruct';
const FALLBACK_MODEL = process.env.WATSONX_MODEL_FALLBACK  || 'ibm/granite-8b-code-instruct';

// ─── Circuit-breaker ──────────────────────────────────────────────────────────
const FAILURE_THRESHOLD  = 3;   // consecutive JSON failures before circuit opens
let _consecutiveFailures = 0;
let _circuitOpen         = false;

function getActiveModel() {
  return _circuitOpen ? FALLBACK_MODEL : PRIMARY_MODEL;
}

function recordSuccess() {
  _consecutiveFailures = 0;
}

function recordFailure() {
  _consecutiveFailures += 1;
  if (!_circuitOpen && _consecutiveFailures >= FAILURE_THRESHOLD) {
    _circuitOpen = true;
    console.warn(
      `[watsonx] ⚠️  Circuit breaker OPEN after ${FAILURE_THRESHOLD} consecutive JSON failures. ` +
      `Switching to fallback model: ${FALLBACK_MODEL}`
    );
  }
}

// ─── Default generation parameters ───────────────────────────────────────────
const DEFAULT_PARAMS = {
  max_new_tokens:     800,
  min_new_tokens:     1,
  temperature:        0.2,
  repetition_penalty: 1.05,
};

// ─── Low-level text generation ────────────────────────────────────────────────

/**
 * queryWatsonx
 * Sends a plain-text prompt to the active model and returns the generated text.
 *
 * @param {string} prompt        — full prompt string
 * @param {object} [overrides]   — optional TextGenParameters overrides
 * @param {string} [forceModel]  — bypass model resolution and use this model ID directly
 * @returns {Promise<string>}    — raw generated text (trimmed)
 */
export const queryWatsonx = async (prompt, overrides = {}, forceModel) => {
  const client    = getClient();
  const projectId = process.env.WATSONX_PROJECT_ID;
  const modelId   = forceModel ?? getActiveModel();

  if (!projectId) {
    throw new Error(
      '[watsonx] WATSONX_PROJECT_ID is not set. Add it to server/.env before making AI calls.'
    );
  }

  console.log(`[watsonx] model=${modelId} max_tokens=${overrides.max_new_tokens ?? DEFAULT_PARAMS.max_new_tokens}`);

  const response = await client.generateText({
    input:      prompt,
    modelId,
    projectId,
    parameters: { ...DEFAULT_PARAMS, ...overrides },
  });

  const result = response?.result?.results?.[0];
  const text   = result?.generated_text;

  if (typeof text !== 'string') {
    throw new Error('[watsonx] Unexpected response shape from generateText API.');
  }

  return text.trim();
};

// ─── Robust JSON extractor ────────────────────────────────────────────────────

/**
 * extractJsonRobust
 * Attempts to extract a valid JSON object from a raw model response.
 * Handles: clean JSON, markdown fences, trailing prose, leading explanation text.
 *
 * @param {string} raw
 * @param {string} [label]  — service name for error messages
 * @returns {object}
 */
export const extractJsonRobust = (raw, label = 'watsonx') => {
  // 1. Direct parse (ideal: model returned only JSON)
  try { return JSON.parse(raw); } catch (_) { /* continue */ }

  // 2. Markdown fenced block  ```json ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch (_) { /* continue */ }
  }

  // 3. First balanced { … } block (handles leading explanation text)
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { /* continue */ }
  }

  throw new Error(
    `[${label}] Could not extract valid JSON from model response.\nRaw: ${raw.slice(0, 400)}`
  );
};

// ─── JSON-safe wrapper with retry + circuit-breaker ───────────────────────────

/**
 * queryWatsonxJson
 *
 * Strategy per attempt:
 *   Attempt 0 — normal call at base temperature (produces JSON ~95% of the time with Llama)
 *   Attempt 1 — temperature +0.15; retry instruction appended to prompt
 *   Attempt 2 — temperature +0.30; retry instruction appended; circuit-breaker check
 *
 * Each failure increments the circuit-breaker counter.
 * A successful parse resets the counter so transient failures don't accumulate.
 *
 * @param {string}   prompt
 * @param {function} extractFn   — raw string → parsed object (throws on bad JSON)
 * @param {function} validateFn  — parsed object → validated object (throws on bad schema)
 * @param {object}   [overrides] — TextGenParameters overrides
 * @returns {Promise<object>}
 */
export const queryWatsonxJson = async (prompt, extractFn, validateFn, overrides = {}) => {
  let lastErr;
  const maxRetries = 2;

  // Retry suffix appended on attempt ≥ 1 to nudge the model toward clean JSON
  const jsonReminder = '\n\nIMPORTANT: Output valid JSON only. No prose, no markdown, no explanation.';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const temperature  = parseFloat(((overrides.temperature || 0.2) + attempt * 0.15).toFixed(2));
    const activePrompt = attempt === 0 ? prompt : prompt + jsonReminder;

    try {
      const text   = await queryWatsonx(activePrompt, { ...overrides, temperature });
      const parsed = extractFn(text);
      const result = validateFn(parsed);

      recordSuccess();
      if (attempt > 0) console.log(`[watsonx] JSON succeeded on retry attempt ${attempt + 1}.`);
      return result;

    } catch (err) {
      console.warn(
        `[watsonx] Attempt ${attempt + 1}/${maxRetries + 1} failed ` +
        `(model: ${getActiveModel()}, temp: ${temperature}): ${err.message}`
      );
      recordFailure();
      lastErr = err;

      if (_circuitOpen && attempt < maxRetries) {
        console.log(`[watsonx] Circuit open — next retry uses fallback: ${FALLBACK_MODEL}`);
      }
    }
  }

  throw lastErr;
};
