import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import './QuestionsTable.css';

function QuestionsTable({ questions, onRefresh }) {
    const [filterCompany, setFilterCompany] = useState('All');
    const [showDescription, setShowDescription] = useState(false);

    // Extract unique companies for filter dropdown
    const companies = useMemo(() => {
        const raw = questions.map(q => q.company);
        const unique = [...new Set(raw)].sort();
        return ['All', ...unique];
    }, [questions]);

    // Filter logic
    const filteredQuestions = useMemo(() => {
        if (filterCompany === 'All') return questions;
        return questions.filter(q => q.company === filterCompany);
    }, [questions, filterCompany]);

    const [selectedIds, setSelectedIds] = useState(new Set());

    // Toggle specific row selection
    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    // Toggle Select All
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
        }
    };

    const handleBatchDelete = async () => {
        if (!selectedIds.size) return;
        if (window.confirm(`Delete ${selectedIds.size} selected questions?`)) {
            try {
                await axios.post('http://localhost:3000/api/questions/batch-delete', {
                    ids: Array.from(selectedIds)
                });
                setSelectedIds(new Set());
                onRefresh();
            } catch (err) {
                alert('Failed to delete: ' + err.message);
            }
        }
    };



    return (
        <div className="table-container">
            <div className="table-actions">
                <div className="filters">
                    <label>
                        Filter by Company:
                        <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </label>
                </div>

                <div className="view-options">
                    {selectedIds.size > 0 && (
                        <button className="delete-selected-btn" onClick={handleBatchDelete}>
                            <Trash2 size={16} /> Delete Selected ({selectedIds.size})
                        </button>
                    )}

                    <button
                        className={`toggle-btn ${showDescription ? 'active' : ''}`}
                        onClick={() => setShowDescription(!showDescription)}
                    >
                        {showDescription ? <Eye size={16} /> : <EyeOff size={16} />} Desc
                    </button>
                </div>
            </div>

            <table className="questions-table">
                <thead>
                    <tr>
                        <th style={{ width: '40px' }}>
                            <input
                                type="checkbox"
                                checked={filteredQuestions.length > 0 && selectedIds.size === filteredQuestions.length}
                                onChange={toggleSelectAll}
                            />
                        </th>
                        <th style={{ width: '60px' }}>#</th>
                        <th>Title</th>
                        {showDescription && <th>Description</th>}
                        <th style={{ width: '120px' }}>Company</th>
                        <th style={{ width: '100px' }}>Status</th>
                        <th style={{ width: '80px' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredQuestions.map((q, index) => (
                        <tr key={q.id} className={q.status === 'Solved' ? 'row-solved' : ''}>
                            <td>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(q.id)}
                                    onChange={() => toggleSelection(q.id)}
                                />
                            </td>
                            <td>{index + 1}</td>
                            <td className="title-cell">
                                <Link to={`/question/${q.id}`} className="question-link">
                                    {q.title || 'Untitled Question'}
                                </Link>
                            </td>
                            {showDescription && <td className="desc-cell">{q.question_text?.substring(0, 100)}...</td>}
                            <td><span className="company-badge">{q.company}</span></td>
                            <td>
                                <span className={`status-badge status-${q.status?.toLowerCase().replace(' ', '-')}`}>
                                    {q.status}
                                </span>
                            </td>

                            <td>
                                <a href={q.original_post_url} target="_blank" rel="noopener noreferrer" className="icon-link" title="Original Post">
                                    <ExternalLink size={18} />
                                </a>
                            </td>
                        </tr>
                    ))}
                    {filteredQuestions.length === 0 && (
                        <tr>
                            <td colSpan="7" className="empty-state">No questions found. Start the agent!</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default QuestionsTable;
