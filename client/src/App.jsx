import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import ScraperControls from './components/ScraperControls';
import QuestionsTable from './components/QuestionsTable';
import QuestionDetail from './components/QuestionDetail';
import './App.css';

function Dashboard() {
  const [questions, setQuestions] = useState([]);

  const fetchQuestions = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/questions');
      setQuestions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQuestions();
    const interval = setInterval(fetchQuestions, 5000); // Poll for updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      <header className="main-header">
        <h1>LeetCode Interview Scraper Agent</h1>
      </header>

      <ScraperControls onScrapeStart={fetchQuestions} />

      <div className="results-section">
        <h2>Your Knowledge Base ({questions.length})</h2>
        <QuestionsTable questions={questions} onRefresh={fetchQuestions} />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/question/:id" element={<QuestionDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
