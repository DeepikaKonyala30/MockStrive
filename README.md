# MockStrive

**Practice Smart. Interview Confidently.**

MockStrive is an AI-powered interview preparation platform designed to help candidates perform at their best. By analysing your professional profile and optionally matching it against a specific job description, MockStrive provides tailored, realistic interview scenarios powered by **Meta Llama 3.3 70B Instruct** via **IBM watsonx.ai**.

---

## 🌟 Features

- **Profile Analysis:** Submit your background and let the AI infer your candidate level, difficulty tier, strengths, weaknesses, and a personalized interview strategy.
- **Job Description (JD) Matching:** Paste a JD to receive a capability-level gap analysis with key strengths, skill gaps, and interview readiness.
- **Dynamic Interview Plans:** Every session generates a fully personalised plan — question count, estimated duration, and category breakdown are all AI-determined.
- **7 Interview Questions Per Session:** Each interview asks exactly 7 questions, calibrated to your level and mode.
- **6 Interview Modes:** HR, Technical, DSA, Behavioral, Mixed (AI-determined distribution), and Job-Specific.
- **Real-Time Evaluation & Coaching:** After each answer receive an AI Coach Tip, score breakdown, strengths, and improvement areas.
- **Personalised Learning Roadmap:** A curated learning plan generated from your specific performance gaps.
- **Persistent Sessions:** Profile and JD analyses are stored in your browser — multiple interview runs without re-uploading.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Framer Motion, Vanilla CSS |
| Backend | Node.js, Express.js |
| AI Platform | IBM watsonx.ai (`@ibm-cloud/watsonx-ai` SDK) |
| Primary Model | `meta-llama/llama-3-3-70b-instruct` |
| Fallback Model | `ibm/granite-8b-code-instruct` (auto-activated by circuit-breaker) |
| Region | `au-syd` (`https://au-syd.ml.cloud.ibm.com`) |

---

## 🧠 Architecture & AI Workflow

### Frontend (Client)
- React SPA with React Router v6 for navigation.
- `localStorage` stores the candidate's profile, JD text, and AI analyses to avoid redundant LLM calls across sessions.
- `sessionStorage` stores the active interview report and evaluations during a single interview run.

### Backend (Server)
- Express.js REST API with in-memory session store for the active interview flow.
- **Profile and JD Analysis are cached in-session** — the AI is not re-called between questions.

### AI Coaching Loop
1. **Profile Analysis** (`POST /api/profile`): Llama 3.3 70B analyses the candidate holistically and returns `candidateLevel`, `difficulty`, `strengths`, `weaknesses`, `focusTopics`, and `questionDistribution`.
2. **JD Analysis** (`POST /api/prep/jd/analyze`): Llama 3.3 70B performs a capability-gap analysis and returns `keyStrengths`, `skillGaps`, `interviewReadiness`, `technologiesToImprove`, and `jdFocusTopics`.
3. **Interview Start** (`POST /api/interview/start`): The category sequence for all 7 questions is pre-planned using the cached profile analysis. The first question is generated.
4. **Answer Submission** (`POST /api/interview/answer`): The current answer is evaluated, then the next question is generated using the pre-planned sequence and the last 3 asked questions (for deduplication). This is sequential to ensure state consistency.
5. **Final Report** (`POST /api/interview/answer` on the last question): All evaluations are synthesised into a comprehensive report with scores, strengths, weaknesses, and a learning roadmap.

### Circuit-Breaker (Automatic Fallback)
- After 3 consecutive JSON validation failures, the system automatically switches to `ibm/granite-8b-code-instruct`.
- A successful response resets the counter.
- The application behaves identically regardless of which model is serving requests.

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18+)
- IBM Cloud account with watsonx.ai access
- IBM Cloud API Key and watsonx Project ID
- Access to the `au-syd` region (Sydney) on IBM watsonx.ai

### Environment Variables

**Frontend (`client/.env.production`)**
```env
# Production URL of the backend (Render or similar)
VITE_API_URL=https://your-backend-url.onrender.com
```

**Backend (`server/.env`)**
```env
NODE_ENV=production
PORT=5001

# CORS: production URL of the frontend (Vercel or similar)
CLIENT_URL=https://your-frontend-url.vercel.app

# IBM watsonx.ai Configuration — au-syd region
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_URL=https://au-syd.ml.cloud.ibm.com

# Model configuration
WATSONX_MODEL_ID=meta-llama/llama-3-3-70b-instruct
WATSONX_MODEL_FALLBACK=ibm/granite-8b-code-instruct
```

### Installation

1. Clone the repository and install all dependencies:
```bash
npm run install:all
```

2. Start both development servers:
```bash
npm run dev
```

3. Open `http://localhost:5173` in your browser.

---

## 📡 API Endpoints

### Profile & Preparation
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/profile` | Analyses the candidate profile and returns AI-inferred interview strategy. |
| `POST` | `/api/prep/jd/analyze` | Capability-gap analysis against a Job Description. |

### Interview Flow
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/interview/start` | Initializes session, pre-plans the 7-question sequence, returns Q1. |
| `POST` | `/api/interview/answer` | Evaluates current answer sequentially, then generates the next question (or final report). |

---

## 📁 Folder Structure

```
MockStrive/
├── client/
│   ├── src/
│   │   ├── components/        # Button, Card, Loader, ProgressBar, Navbar
│   │   ├── pages/
│   │   │   ├── Home/          # Landing page
│   │   │   ├── CandidateProfile/  # Profile form + JD analysis
│   │   │   ├── InterviewPlan/ # Dynamic interview plan display
│   │   │   ├── InterviewMode/ # Mode selection
│   │   │   ├── Interview/     # Live interview Q&A + coach tips
│   │   │   ├── FinalReport/   # Post-interview report
│   │   │   └── About/         # About page
│   │   ├── utils/
│   │   │   ├── api.js         # apiFetch helper
│   │   │   └── storage.js     # localStorage/sessionStorage helpers
│   │   └── App.jsx            # Router + page transitions
│   └── index.html
├── server/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── profile.routes.js   # POST /api/profile
│   │   │   ├── prep.routes.js      # POST /api/prep/jd/analyze
│   │   │   └── interview.routes.js # POST /api/interview/start & /answer
│   │   ├── services/
│   │   │   ├── watsonx.js          # IBM watsonx.ai client, circuit-breaker, retry
│   │   │   ├── profileService.js   # Profile analysis prompt & validation
│   │   │   ├── jdService.js        # JD gap analysis prompt & validation
│   │   │   ├── interviewService.js # Question generation & category sequencing
│   │   │   └── evaluationService.js# Answer evaluation & final report
│   │   ├── store/
│   │   │   └── session.js          # In-memory session store
│   │   └── index.js                # Express server entry point
└── package.json                    # Root workspace management
```

---

## 🔮 Future Scope

- **Audio/Video Interviews:** WebRTC + Speech-to-Text for a fully conversational experience.
- **Historical Tracking:** Database integration (MongoDB/PostgreSQL) to chart progress over time.
- **PDF Export:** Download Final Report as a formatted PDF.
- **Community Questions:** Share and practice company-specific interview questions.
- **Multi-User Support:** Authentication and per-user session management.

---

*Built to help you practice smart and interview confidently.*
