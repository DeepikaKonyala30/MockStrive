# InterviewIQ

**Practice Smart. Interview Confidently.**

InterviewIQ is an AI-powered interview preparation platform designed to help candidates perform at their best. By analysing your professional profile and matching it against specific job descriptions, InterviewIQ provides tailored, hyper-realistic interview scenarios driven by IBM's Granite foundation models via watsonx.ai.

## 🌟 Features

- **Profile Analysis:** Upload your professional background and let the AI extract key skills, experience levels, and strengths.
- **Job Description (JD) Matching:** Paste a JD to see your match percentage, missing skills, and readiness score.
- **Dynamic Interview Modes:** Practice across multiple dimensions including HR, Technical, DSA, Behavioral, Mixed, and Job-Specific modes.
- **Real-Time Evaluation & Coaching:** Receive instant, granular feedback on your answers with scoring on technical depth and communication clarity.
- **Personalised Learning Roadmap:** Get a curated list of topics to study based on your interview performance.
- **Persistent Sessions:** Your profile and analysis are securely stored in your browser, enabling multiple seamless interview runs without re-uploading your details.

## 🛠 Tech Stack

- **Frontend:** React 18, Vite, Framer Motion for animations, Vanilla CSS with custom design tokens.
- **Backend:** Node.js, Express.js.
- **AI Integration:** IBM watsonx.ai (using the `ibm-watsonx-ai` SDK).
- **Foundation Model:** `ibm/granite-3-8b-instruct` (or user-configurable).
- **Styling:** Custom fluid typography, glassmorphism, responsive CSS variables.

## 🧠 Architecture & AI Workflow

1. **Client State (Persistent):** The frontend stores the candidate's profile, JD, and AI analyses (`interviewIQState`) in `localStorage`. This avoids redundant calls to the LLM and creates a snappy user experience.
2. **Session Context:** The Node.js backend maintains lightweight, in-memory session stores for active interview flows to ensure context is maintained across question-answer pairs.
3. **AI Coaching Loop:** 
   - A prompt is constructed containing the candidate's profile, mode, past Q&A, and JD context.
   - IBM Granite generates a tailored question.
   - The user submits an answer.
   - IBM Granite evaluates the answer against the profile and role, returning a JSON evaluation with strengths, weaknesses, and a score out of 100.
4. **Final Report:** The backend consolidates the session data and asks the AI to synthesize a comprehensive report and a personalised learning roadmap.

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v18+)
- IBM Cloud Account with watsonx.ai access
- IBM Cloud API Key and watsonx Project ID

### Environment Variables

**Frontend (Vercel / `client/.env.production`)**
```env
# The production URL of the Render backend
VITE_API_URL=your_render_url
```

**Backend (Render / `server/.env`)**
```env
NODE_ENV=production
PORT=5001

# The production URL of the Vercel frontend (for CORS)
CLIENT_URL=your_vercel_url

# IBM watsonx.ai Configuration
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Optional: Override the default model
# WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
```

### Installation

1. Clone the repository and install dependencies concurrently:
```bash
npm run install:all
```
2. Start the development servers (Client + Server):
```bash
npm run dev
```
3. Open `http://localhost:5173` in your browser.

## 📡 API Endpoints

### Profile & Prep
- `POST /api/profile` - Analyses the candidate profile.
- `POST /api/prep/jd/analyze` - Performs gap analysis against a Job Description.

### Interview Flow
- `POST /api/interview/start` - Initializes a session and returns the first question.
- `POST /api/interview/answer` - Submits an answer, evaluates it, and generates a coach tip and the next question (or finishes the interview).

## 📁 Folder Structure

```
InterviewIQ/
├── client/
│   ├── src/
│   │   ├── components/      # Reusable UI components (Button, Card, Loader)
│   │   ├── pages/           # Route views (Home, CandidateProfile, Interview, FinalReport)
│   │   ├── utils/           # Utilities (e.g. storage.js)
│   │   └── App.jsx          # Main application routing
│   └── index.html
├── server/
│   ├── src/
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic (aiService, jdService, interviewService)
│   │   ├── store/           # In-memory session management
│   │   └── index.js         # Express server entry point
└── package.json             # Root workspace management
```

## 🔮 Future Scope
- **Audio/Video Interviews:** Integration with Speech-to-Text and WebRTC for a fully conversational mock interview experience.
- **Historical Tracking:** Database integration (e.g. MongoDB/PostgreSQL) to chart progress over time.
- **Export to PDF:** Allow candidates to download their Final Report.
- **Community Questions:** Allow users to share and practice specific company interview questions.

---
*Built to help you practice smart and interview confidently.*
