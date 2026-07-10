/**
 * smoke-test.mjs
 * End-to-end smoke test for all three agents.
 * Run: node smoke-test.mjs
 * Requires the server to be running on PORT 5001.
 */

const BASE = 'http://localhost:5001/api';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

// ── 1. Profile Analysis ─────────────────────────────────────────────────────
console.log('\n── 1. POST /api/profile ─────────────────────────────────────────');
const profileRes = await post('/profile', {
  fullName:        'Jane Smith',
  targetRole:      'Backend Software Engineer',
  experienceLevel: '3 years',
  education:       'B.Sc. Computer Science',
  skills:          'Node.js, Python, PostgreSQL, REST APIs, Docker',
  resumeSummary:   'Built and deployed microservices for a fintech startup. Led migration from monolith to containers.',
});
console.log('candidateLevel:', profileRes.analysis.candidateLevel);
console.log('difficulty:    ', profileRes.analysis.difficulty);
console.log('strengths:     ', profileRes.analysis.strengths);
console.log('weaknesses:    ', profileRes.analysis.weaknesses);
console.log('focusTopics:   ', profileRes.analysis.focusTopics);

// ── 2. Start Interview ──────────────────────────────────────────────────────
console.log('\n── 2. POST /api/interview/start ─────────────────────────────────');
const startRes = await post('/interview/start', {});
console.log(`Q1 (${startRes.questionIndex}/${startRes.totalQuestions}):`, startRes.question);

// ── 3. Answer loop (5 questions) ────────────────────────────────────────────
const ANSWERS = [
  'I use environment variables and a config module that reads them at startup to avoid hardcoding secrets.',
  'At my last job I broke a monolith into Docker containers using Compose. I isolated the database, API, and worker services separately.',
  'I prioritise tasks by urgency and impact, communicate delays early, and break work into smaller deliverables.',
  'I ensure idempotency with unique keys, use retry with exponential backoff, and log failures to a dead-letter queue.',
  'I value clean code, good test coverage, and open communication in a team.',
];

let currentQuestion = startRes.question;
let questionIndex   = 1;

for (let i = 0; i < 5; i++) {
  console.log(`\n── ${i + 3}. POST /api/interview/answer (Q${questionIndex}) ─────────────────`);
  console.log('Answering:', ANSWERS[i].slice(0, 70) + '…');

  const ansRes = await post('/interview/answer', { answer: ANSWERS[i] });

  console.log(`Evaluation Q${questionIndex} — Overall: ${ansRes.evaluation.overallScore} | Technical: ${ansRes.evaluation.technicalScore} | Communication: ${ansRes.evaluation.communicationScore}`);
  console.log('Feedback:', ansRes.evaluation.feedback?.slice(0, 120));

  if (ansRes.finished) {
    console.log('\n── Final Report ──────────────────────────────────────────────────');
    const r = ansRes.report;
    console.log('Overall Score:       ', r.overallScore);
    console.log('Technical Score:     ', r.technicalScore);
    console.log('Communication Score: ', r.communicationScore);
    console.log('Strengths:           ', r.strengths);
    console.log('Weaknesses:          ', r.weaknesses);
    console.log('Learning Topics:     ', r.learningTopics);
    console.log('Summary:             ', r.summary);
    break;
  } else {
    questionIndex = ansRes.questionIndex;
    currentQuestion = ansRes.question;
    console.log(`Q${questionIndex}: ${currentQuestion}`);
  }
}

// ── GET /api/report ─────────────────────────────────────────────────────────
console.log('\n── GET /api/report ───────────────────────────────────────────────');
const reportRes = await get('/report');
console.log('Report summary:', reportRes.report.summary?.slice(0, 200));
console.log('\n✓ All smoke tests passed.');
