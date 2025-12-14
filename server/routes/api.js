const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraper');
const parserService = require('../services/parser');
const db = require('../database/db');

// Global Progress State
let appState = {
    isScraping: false,
    stopRequested: false, // Flag to stop process
    total: 0,
    current: 0,
    status: 'Idle'
};

// Get Scraper Status
router.get('/status', (req, res) => {
    res.json(appState);
});

// Stop Scraper
router.post('/scrape/stop', (req, res) => {
    if (appState.isScraping) {
        appState.stopRequested = true;
        appState.status = 'Stopping...';
        res.json({ message: 'Stop signal sent.' });
    } else {
        res.status(400).json({ message: 'Not running.' });
    }
});

// Trigger Scraping (Batch Processing & Deduplication)
router.post('/scrape', async (req, res) => {
    // Prevent concurrent runs
    if (appState.isScraping) {
        return res.status(409).json({ message: 'Scraping already in progress.' });
    }

    const { timeFilter = '1m', customFrom, customTo, maxPosts, companyFilter } = req.body;

    // If maxPosts is provided (Debug Mode), use it. Otherwise use safety net.
    const pages = (maxPosts && maxPosts > 0) ? parseInt(maxPosts) : 200;
    const modeLabel = (maxPosts && maxPosts > 0) ? 'DebugMax' : 'SafetyMax';
    const filterLabel = companyFilter ? `Company: ${companyFilter}` : 'All Companies';

    console.log(`Received scrape request. ${modeLabel}: ${pages}, TimeFilter: ${timeFilter} [${customFrom || ''} - ${customTo || ''}], ${filterLabel}`);

    // Reset State
    appState = { isScraping: true, stopRequested: false, total: 0, current: 0, status: 'Starting...' };

    // Start process asynchronously
    (async () => {
        try {
            appState.status = `Discovering Links (${filterLabel})...`;
            // 1. Get List of Links (Scraping Phase 1)
            const links = await scraperService.getLinks(pages, timeFilter, customFrom, customTo, companyFilter);
            console.log(`Discovered ${links.length} links.`);

            appState.status = 'Filtering Duplicates...';
            // 2. Deduplication: Filter out links already in DB
            const newLinks = [];
            const checkStmt = db.prepare('SELECT 1 FROM questions WHERE original_post_url = ?');

            for (const link of links) {
                const exists = checkStmt.get(link);
                if (!exists) {
                    newLinks.push(link);
                }
            }
            console.log(`Filtered duplicates. Processing ${newLinks.length} new posts.`);

            // 3. Sequential Processing
            appState.total = newLinks.length;
            appState.current = 0;
            appState.status = `Processing ${newLinks.length} posts...`;

            const BATCH_SIZE = 50;
            const BATCH_DELAY_MS = 30000; // 30 seconds cooldown (prevents rate limiting)

            for (let i = 0; i < newLinks.length; i++) {
                // Check if we need a batch break (Memory & Rate Limit Protection)
                if (i > 0 && i % BATCH_SIZE === 0) {
                    console.log(`Completed batch of ${BATCH_SIZE}. Cooling down for ${BATCH_DELAY_MS / 1000}s...`);
                    appState.status = `Cooling down (${BATCH_DELAY_MS / 1000}s)...`;

                    // 1. Refresh Browser Page (Memory Dump)
                    await scraperService.restartPage();

                    // 2. Wait (Rate Limit Protection)
                    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

                    console.log('Resuming...');
                }

                // Check for stop signal
                if (appState.stopRequested) {
                    console.log('Stop requested. Aborting loop.');
                    appState.status = 'Stopped by User';
                    break;
                }

                const url = newLinks[i];
                appState.current = i + 1; // Update Progress
                appState.status = `Processing ${i + 1}/${newLinks.length}: ${url.split('/').pop()}`; // Show brief status

                console.log(`Processing ${i + 1}/${newLinks.length}: ${url}`);

                // Scrape Content
                const postData = await scraperService.scrapePostContent(url);
                if (!postData || !postData.content) continue;

                // Filter and Extract with LLM
                const { isValid, company } = await parserService.parsePost(postData.title, postData.content);
                if (!isValid) {
                    console.log(`Skipping irrelevant post: ${url}`);
                    continue;
                }

                // Save to DB (Verbatim)
                const insertStmt = db.prepare(`
                    INSERT INTO questions (company, title, question_text, original_post_url, status)
                    VALUES (?, ?, ?, ?, 'New')
                `);

                try {
                    // Sanitize data
                    const title = postData.title || 'Untitled Question';
                    const text = postData.content || '';

                    insertStmt.run(company, title, text, url);
                    console.log(`Saved: [${company}] ${title}`);
                } catch (err) {
                    // Ignore unique constraint violations (redundant check but safe)
                    if (err.message.includes('UNIQUE constraint failed')) {
                        console.log(`Skipping duplicate (DB constraint): ${url}`);
                    } else {
                        console.error('DB Insert Error:', err.message);
                    }
                }
            }

            console.log('Batch Scraping and Parsing Complete.');
            appState.status = 'Completed';
        } catch (error) {
            console.error('Background process failed:', error);
            appState.status = 'Failed: ' + error.message;
        } finally {
            appState.isScraping = false;
        }
    })();

    res.json({ message: 'Scraping started in background.' });
});

// Get Questions
router.get('/questions', (req, res) => {
    try {
        const { company } = req.query;
        let query = 'SELECT * FROM questions ORDER BY created_at DESC';
        let params = [];

        if (company && company !== 'All') {
            query = 'SELECT * FROM questions WHERE company LIKE ? ORDER BY created_at DESC';
            params = [`%${company}%`];
        }

        const questions = db.prepare(query).all(params);
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Question
router.put('/questions/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { status, answer, leetcode_link } = req.body;

        const stmt = db.prepare(`
            UPDATE questions 
            SET status = COALESCE(?, status),
                answer = COALESCE(?, answer),
                leetcode_link = COALESCE(?, leetcode_link)
            WHERE id = ?
        `);

        stmt.run(status, answer, leetcode_link, id);
        res.json({ message: 'Updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete All Questions
router.delete('/questions', (req, res) => {
    try {
        db.prepare('DELETE FROM questions').run();
        // Reset ID sequence
        db.prepare("DELETE FROM sqlite_sequence WHERE name='questions'").run();
        res.json({ message: 'All questions deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch Delete Questions
router.post('/questions/batch-delete', (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty IDs array' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`DELETE FROM questions WHERE id IN (${placeholders})`);

        const result = stmt.run(...ids);
        res.json({ message: `Deleted ${result.changes} questions` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
