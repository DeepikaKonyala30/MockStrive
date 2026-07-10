/**
 * watsonx.js
 * Low-level IBM watsonx.ai communication layer.
 *
 * Exposes a single generic function — queryWatsonx — that sends a prompt
 * to the specified Granite model and returns the raw text response.
 * All higher-level services (profileService, interviewService, …) build on top
 * of this function; they own prompting logic and JSON parsing.
 */

import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from 'ibm-cloud-sdk-core';

// ─── Singleton client ─────────────────────────────────────────────────────────
let _client = null;

function getClient() {
  if (_client) return _client;

  const apiKey    = process.env.WATSONX_API_KEY;
  const serviceUrl = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';

  if (!apiKey) {
    throw new Error(
      '[watsonx] WATSONX_API_KEY is not set. ' +
      'Add it to server/.env before making AI calls.'
    );
  }

  _client = WatsonXAI.newInstance({
    serviceUrl,
    authenticator: new IamAuthenticator({ apikey: apiKey }),
  });

  return _client;
}

// ─── Default generation parameters ───────────────────────────────────────────
const DEFAULT_PARAMS = {
  max_new_tokens: 800,
  min_new_tokens: 1,
  temperature: 0.1,
  repetition_penalty: 1.05
};

/**
 * queryWatsonx
 * Sends a plain-text prompt to IBM Granite and returns the generated text.
 *
 * @param {string} prompt          — the full prompt string
 * @param {object} [overrides]     — optional TextGenParameters overrides
 * @returns {Promise<string>}      — raw text content of the first response
 */
export const queryWatsonx = async (prompt, overrides = {}) => {
  const client    = getClient();
  const projectId = process.env.WATSONX_PROJECT_ID;
  const modelId   = process.env.WATSONX_MODEL_ID || 'ibm/granite-3-3-8b-instruct';

  if (!projectId) {
    throw new Error(
      '[watsonx] WATSONX_PROJECT_ID is not set. ' +
      'Add it to server/.env before making AI calls.'
    );
  }

  const response = await client.generateText({
    input:     prompt,
    modelId,
    projectId,
    parameters: { ...DEFAULT_PARAMS, ...overrides },
  });

  // SDK returns: response.result.results[0].generated_text
  const result = response?.result?.results?.[0];
  const text = result?.generated_text;

  if (typeof text !== 'string') {
    throw new Error('[watsonx] Unexpected response shape from generateText API.');
  }

  return text.trim();
};
