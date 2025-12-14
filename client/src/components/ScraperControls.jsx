import { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Loader, Square } from 'lucide-react';
import './ScraperControls.css';

function ScraperControls({ onScrapeStart }) {
    const [timeFilter, setTimeFilter] = useState('1m');
    const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default 1 week ago
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]); // Default Today

    // Debug Mode State
    const [debugMode, setDebugMode] = useState(() => {
        const saved = localStorage.getItem('scraper_debug_mode');
        return saved === 'true';
    });
    const [maxPosts, setMaxPosts] = useState(() => {
        const saved = localStorage.getItem('scraper_debug_max_posts');
        return saved ? parseInt(saved, 10) : 50;
    });

    // Company Filter State
    const [companyFilter, setCompanyFilter] = useState(() => {
        return localStorage.getItem('scraper_company_filter') || '';
    });

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [progress, setProgress] = useState(0);

    // Check status on mount to restore state if reloading
    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await axios.get('http://localhost:3000/api/status');
                if (res.data.isScraping) {
                    setLoading(true);
                    setStatus(res.data.status);
                }
            } catch (e) {
                console.error("Failed to check status", e);
            }
        };
        checkStatus();
    }, []);

    // Poll for status when loading or processing
    useEffect(() => {
        let interval;
        if (loading) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get('http://localhost:3000/api/status');
                    const { isScraping, total, current, status } = res.data;

                    setStatus(status);

                    if (total > 0) {
                        const pct = Math.round((current / total) * 100);
                        setProgress(pct);
                    }

                    // Auto-stop loading if backend says finished
                    if (!isScraping && status !== 'Starting...') {
                        setLoading(false);
                        setProgress(100);
                        if (onScrapeStart) onScrapeStart(); // Refresh table when done
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [loading, onScrapeStart]);

    // Persist Debug Settings
    useEffect(() => {
        localStorage.setItem('scraper_debug_mode', debugMode);
    }, [debugMode]);

    useEffect(() => {
        localStorage.setItem('scraper_debug_max_posts', maxPosts);
    }, [maxPosts]);

    useEffect(() => {
        localStorage.setItem('scraper_company_filter', companyFilter);
    }, [companyFilter]);


    const startScraping = async () => {
        setLoading(true);
        setProgress(0);
        setStatus('Initializing agent...');

        // Notify parent to refresh logs/status or just wait for poll
        if (onScrapeStart) onScrapeStart();

        try {
            const payload = {
                timeFilter,
                customFrom: timeFilter === 'custom' ? dateFrom : null,
                customTo: timeFilter === 'custom' ? dateTo : null,
                companyFilter: companyFilter.trim(),
                // Only send maxPosts if in debug mode? Or always if set.
                // Let's send it if debugMode is true, otherwise let backend rely on time.
                maxPosts: debugMode ? maxPosts : 0
            };
            await axios.post('http://localhost:3000/api/scrape', payload);
        } catch (err) {
            if (err.response && err.response.status === 409) {
                // Already running, just attach listener
                setLoading(true);
            } else {
                setStatus('Failed: ' + err.message);
                setLoading(false);
            }
        }
    };

    const stopScraping = async () => {
        try {
            await axios.post('http://localhost:3000/api/scrape/stop');
            setStatus('Stopping agent...');
        } catch (err) {
            alert('Failed to stop: ' + err.message);
        }
    };

    return (
        <div className="scraper-controls-card">

            {/* Debug Toggle (Hidden Trigger: Click 'Scraper Controls' title or small icon?) */}
            {/* Let's make it explicit but small */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
                <label style={{ fontSize: '0.7rem', color: '#4b5563', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="checkbox" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} />
                    Debug Mode
                </label>
            </div>

            <div className="control-group">
                <label>
                    <span className="label-text">Target Company (Optional)</span>
                    <input
                        type="text"
                        placeholder="e.g. Google"
                        value={companyFilter}
                        onChange={(e) => setCompanyFilter(e.target.value)}
                        className="control-input"
                        style={{ width: '100%' }}
                    />
                </label>
            </div>

            <div className="control-group">
                <label>
                    <span className="label-text">Time Range</span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                            value={timeFilter}
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="control-select"
                        >
                            {/* Debug Options */}
                            {debugMode && (
                                <>
                                    <option value="5m">Last 5 Mins</option>
                                    <option value="15m">Last 15 Mins</option>
                                    <option value="30m">Last 30 Mins</option>
                                    <option value="1h">Last 1 Hour</option>
                                    <option value="6h">Last 6 Hours</option>
                                    <option disabled>──────────</option>
                                </>
                            )}

                            <option value="1d">Last 24 Hours</option>
                            <option value="1w">Last Week</option>
                            <option value="1m">Last Month</option>
                            <option value="3m">Last 3 Months</option>
                            <option value="all">All Time</option>
                            <option value="custom">Custom Range</option>
                        </select>

                        {timeFilter === 'custom' && (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>From</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="control-input"
                                        max={dateTo}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>To</span>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="control-input"
                                        min={dateFrom}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </label>

                {/* Debug Max Posts Input */}
                {debugMode && (
                    <label>
                        <span className="label-text" style={{ color: '#ef4444' }}>Max Posts (Debug)</span>
                        <input
                            type="number"
                            value={maxPosts}
                            onChange={(e) => setMaxPosts(e.target.value)}
                            className="control-input"
                            style={{ borderColor: '#ef4444', width: '80px' }}
                        />
                    </label>
                )}

                {!loading ? (
                    <button className="start-btn" onClick={startScraping}>
                        <Play size={18} /> Start Agent
                    </button>
                ) : (
                    <button className="stop-btn" onClick={stopScraping}>
                        <Square size={18} fill="currentColor" /> Stop
                    </button>
                )}
            </div>

            {loading && (
                <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
            )}

            {status && <div className="status-message">{status}</div>}
        </div>
    );
}

export default ScraperControls;
