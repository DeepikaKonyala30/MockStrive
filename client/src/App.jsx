import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar/index.jsx';
import Home from './pages/Home/index.jsx';
import CandidateProfile from './pages/CandidateProfile/index.jsx';
import InterviewPlan from './pages/InterviewPlan/index.jsx';
import ModeSelect from './pages/ModeSelect/index.jsx';
import Interview from './pages/Interview/index.jsx';
import FinalReport from './pages/FinalReport/index.jsx';
import About from './pages/About/index.jsx';

function App() {
  const location = useLocation();

  return (
    <>
      <Navbar />
      <main>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/"               element={<Home />} />
            <Route path="/profile"        element={<CandidateProfile />} />
            <Route path="/interview/plan" element={<InterviewPlan />} />
            <Route path="/interview/mode" element={<ModeSelect />} />
            <Route path="/interview"      element={<Interview />} />
            <Route path="/report"         element={<FinalReport />} />
            <Route path="/about"          element={<About />} />
          </Routes>
        </AnimatePresence>
      </main>
    </>
  );
}

export default App;
