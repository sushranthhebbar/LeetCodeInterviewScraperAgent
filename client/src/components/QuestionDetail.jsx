import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Save, CheckCircle } from 'lucide-react';
import axios from 'axios';
import './QuestionDetail.css';

function QuestionDetail() {
    const { id } = useParams();
    const [question, setQuestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [status, setStatus] = useState('New');
    const [answer, setAnswer] = useState('');
    const [leetcodeLink, setLeetcodeLink] = useState('');

    useEffect(() => {
        fetchQuestion();
    }, [id]);

    const fetchQuestion = async () => {
        try {
            // In a real app we'd have GET /api/questions/:id
            // For now, fetch all and filter client-side
            const res = await axios.get('http://localhost:3000/api/questions');
            const found = res.data.find(q => q.id === Number(id));

            if (found) {
                setQuestion(found);
                setStatus(found.status || 'New');
                setAnswer(found.answer || '');
                setLeetcodeLink(found.leetcode_link || '');
            }
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put(`http://localhost:3000/api/questions/${id}`, {
                status,
                answer,
                leetcode_link: leetcodeLink
            });
            setSaving(false);
        } catch (err) {
            alert('Failed to save: ' + err.message);
            setSaving(false);
        }
    };

    if (loading) return <div className="loading-screen">Loading...</div>;
    if (!question) return <div className="error-screen">Question not found!</div>;

    return (
        <div className="detail-container">
            <header className="detail-header">
                <div className="header-left">
                    <Link to="/" className="back-link"><ArrowLeft size={20} /> Back to Dashboard</Link>
                    <div className="title-section">
                        <span className="company-badge-large">{question.company}</span>
                        <h1>{question.title || 'Untitled Question'}</h1>
                    </div>
                </div>
                <div className="header-right">
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={`status-select status-${status.toLowerCase().replace(' ', '-')}`}
                    >
                        <option value="New">New</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Solved">Solved</option>
                    </select>
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                    </button>
                </div>
            </header>

            <div className="detail-grid">
                <div className="left-panel">
                    <section className="info-card">
                        <h3>Problem Description</h3>
                        <div className="description-text">
                            {question.question_text}
                        </div>

                        <div className="meta-links">
                            <a href={question.original_post_url} target="_blank" rel="noopener noreferrer" className="meta-link">
                                <ExternalLink size={16} /> Original Discuss Post
                            </a>
                            <div className="lc-link-input-group">
                                <label>LeetCode URL:</label>
                                <input
                                    type="text"
                                    value={leetcodeLink}
                                    onChange={(e) => setLeetcodeLink(e.target.value)}
                                    placeholder="https://leetcode.com/problems/..."
                                />
                                {leetcodeLink && (
                                    <a href={leetcodeLink} target="_blank" rel="noopener noreferrer" className="icon-btn">
                                        <ExternalLink size={16} />
                                    </a>
                                )}
                            </div>
                        </div>
                    </section>


                </div>

                <div className="right-panel">
                    <section className="editor-card">
                        <h3>Your Solution / Notes</h3>
                        <textarea
                            className="answer-editor"
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Write your intuition, approach, or code here..."
                        />
                    </section>
                </div>
            </div>
        </div>
    );
}

export default QuestionDetail;
