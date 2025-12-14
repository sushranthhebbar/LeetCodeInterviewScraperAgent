const { chromium } = require('playwright');

/**
 * Scraper Service
 * Connects to an existing browser session to avoid login issues.
 * Refactored to support batch processing by separating link discovery from content scraping.
 */
class ScraperService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async connect() {
        try {
            // connecting to default remote debugging port
            this.browser = await chromium.connectOverCDP('http://localhost:9222');
            this.context = this.browser.contexts()[0];
            this.page = this.context.pages()[0] || await this.context.newPage();
            console.log('Connected to existing browser session.');
        } catch (error) {
            console.error('Failed to connect to browser. Make sure Chrome is running with --remote-debugging-port=9222');
            throw error;
        }
    }

    /**
     * Closes the current page and opens a new one to free up memory.
     */
    async restartPage() {
        try {
            console.log('Refreshing browser page to cleanup memory...');
            const oldPage = this.page;

            if (this.context) {
                this.page = await this.context.newPage();
            } else if (this.browser) {
                this.context = this.browser.contexts()[0];
                this.page = await this.context.newPage();
            } else {
                await this.connect();
            }

            // Close old page only after new one is ready
            if (oldPage) {
                try {
                    await oldPage.close();
                } catch (e) {
                    console.warn('Failed to close old page (ignoring):', e.message);
                }
            }
        } catch (error) {
            console.error('Failed to restart page:', error);
            // Attempt full reconnect if we lost the page/connection
            try {
                if (!this.page || this.page.isClosed()) {
                    await this.connect();
                }
            } catch (connErr) {
                console.error('Critical: Could not reconnect to browser.', connErr.message);
                throw connErr;
            }
        }
    }

    /**
     * Parses LeetCode relative date strings into a Date object.
     * Formats: "2 hours ago", "Oct 24, 2024", "Oct 24" (current year), "just now"
     */
    parseRelativeDate(dateStr) {
        if (!dateStr) return new Date();
        const now = new Date();
        const text = dateStr.trim().toLowerCase();

        if (text === 'just now') return now;

        // Relative Parsing
        const relativeParts = text.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/);
        if (relativeParts) {
            const amount = parseInt(relativeParts[1]);
            const unit = relativeParts[2];
            const d = new Date(now);

            switch (unit) {
                case 'minute': d.setMinutes(now.getMinutes() - amount); break;
                case 'hour': d.setHours(now.getHours() - amount); break;
                case 'day': d.setDate(now.getDate() - amount); break;
                case 'week': d.setDate(now.getDate() - (amount * 7)); break;
                case 'month': d.setMonth(now.getMonth() - amount); break;
                case 'year': d.setFullYear(now.getFullYear() - amount); break;
            }
            return d;
        }

        // Absolute Parsing (e.g., "Oct 24, 2023", "Oct 24")
        try {
            // Append current year if missing
            let dateText = text;
            if (!dateText.includes(',')) {
                dateText += `, ${now.getFullYear()}`;
            }
            return new Date(dateText);
        } catch (e) {
            console.warn(`Date parsing failed for '${dateStr}', assuming new.`);
            return now;
        }
    }

    /**
     * Navigates to the discuss page and collects post links filtered by time.
     * @param {string} timeFilter - '1d', '1w', '1m', '3m', 'all', 'custom'
     * @param {string} [customFrom] - YYYY-MM-DD
     * @param {string} [customTo] - YYYY-MM-DD
     */
    async getLinks(pagesToScrape = 50, timeFilter = '1m', customFrom = null, customTo = null, companyFilter = null) {
        if (!this.browser) {
            await this.connect();
        }

        let baseUrl = 'https://leetcode.com/discuss/interview-question';
        let isSearchMode = false;

        if (companyFilter && companyFilter.trim()) {
            // Slugify: "Goldman Sachs" -> "goldman-sachs"
            const slug = companyFilter.trim().toLowerCase().replace(/\s+/g, '-');
            baseUrl = `https://leetcode.com/discuss/topic/${slug}/`;
            isSearchMode = true; // Still treat as specific mode to avoid some defaults if needed
            console.log(`Topic Mode Active: ${companyFilter} -> ${baseUrl}`);
        }

        // Date Window Calculation
        const now = new Date();
        // Set Max (End) Date
        let maxDate = new Date(now);
        // Set Min (Start/Cutoff) Date
        let minDate = new Date(now);

        if (timeFilter === 'custom' && customFrom && customTo) {
            minDate = new Date(customFrom);
            maxDate = new Date(customTo);
            // Include the entire 'To' day
            maxDate.setHours(23, 59, 59, 999);
            // Start of 'From' day
            minDate.setHours(0, 0, 0, 0);
        } else {
            // Standard filters end "now"
            maxDate = new Date();

            switch (timeFilter) {
                case '5m': minDate.setMinutes(now.getMinutes() - 5); break;
                case '15m': minDate.setMinutes(now.getMinutes() - 15); break;
                case '30m': minDate.setMinutes(now.getMinutes() - 30); break;
                case '1h': minDate.setHours(now.getHours() - 1); break;
                case '6h': minDate.setHours(now.getHours() - 6); break;
                case '1d': minDate.setDate(now.getDate() - 1); break;
                case '1w': minDate.setDate(now.getDate() - 7); break;
                case '1m': minDate.setMonth(now.getMonth() - 1); break;
                case '3m': minDate.setMonth(now.getMonth() - 3); break;
                case 'all': minDate = new Date(0); break;
                default: minDate.setMonth(now.getMonth() - 1);
            }
        }

        console.log(`Navigating to ${isSearchMode ? 'Search Results' : 'Discuss Feed'}... Window: ${minDate.toISOString()} to ${maxDate.toISOString()}`);

        await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

        // Wait for results. Search results might take a moment.
        // Standard feed uses a[href^='/discuss/post/'], search results might be same or similar.
        // We'll wait for a generic container or specific anchor.
        try {
            await this.page.waitForSelector("a[href^='/discuss/post/']", { timeout: 10000 });
        } catch (e) {
            console.warn("Timeout waiting for posts. Might be 0 results.");
        }

        // Click "Newest" (Dynamic Sort) - ONLY if not in search mode (Search URL already handles sort)
        // Click "Newest" (Dynamic Sort) - ONLY if not in search mode (Search URL already handles sort)
        if (!isSearchMode) {
            console.log('Switching to "Newest" sort order...');
            try {
                // Robustly click "Newest" button
                await this.page.evaluate(() => {
                    // Try 1: Button containing span with 'Newest'
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const newestBtn = buttons.find(b => b.innerText.includes('Newest'));
                    if (newestBtn) {
                        newestBtn.click();
                        return;
                    }

                    // Try 2: Span with 'Newest' (which bubbles click)
                    const spans = Array.from(document.querySelectorAll('span'));
                    const newestSpan = spans.find(el => el.innerText.trim() === 'Newest');
                    if (newestSpan) {
                        newestSpan.click();
                        return;
                    }
                });
                // Wait for sort to apply (network request)
                await this.page.waitForTimeout(3000);
            } catch (e) {
                console.warn('Failed to click "Newest" button:', e.message);
            }
        }

        let stopScrolling = false;
        let validLinks = [];

        // Infinite Scroll Logic
        for (let i = 0; i < pagesToScrape; i++) {
            if (stopScrolling) break;

            const rawPosts = await this.page.$$eval("a[href^='/discuss/post/']", (anchors) => {
                return anchors.map(a => {
                    const href = a.href;
                    let dateText = '';

                    // Strategy: The date is likely in a sibling or parent container.
                    // We traverse up to find a container that includes the date string.
                    // Common structure: Post Row > [User, Date, Title(Link)]

                    let current = a;
                    // Traverse up up to 5 levels to find the "row"
                    for (let i = 0; i < 5; i++) {
                        if (!current.parentElement) break;
                        current = current.parentElement;

                        // Check if this container has the date
                        // UPDATE: Added text-xs and generic text-gray selectors
                        const timeSpan = current.querySelector('span.text-sd-gray-400, span.text-xs, span.text-sm, span.text-gray-400, span.text-gray-500');
                        if (timeSpan && (timeSpan.innerText.includes('ago') || /\d{4}/.test(timeSpan.innerText))) {
                            dateText = timeSpan.innerText;
                            break;
                        }

                        // Fallback: Check full text of row for "X ago"
                        // Robust regex for "16 minutes ago", "1 hour ago", etc.
                        const match = current.innerText.match(/(\d+\s+(minute|hour|day|week|month|year)s?\s+ago)/i);
                        if (match) {
                            dateText = match[0];
                            break;
                        }

                        // Fallback 2: Check for "Oct 14, 2025" format
                        const dateMatch = current.innerText.match(/([A-Z][a-z]{2}\s\d{1,2},\s\d{4})/);
                        if (dateMatch) {
                            dateText = dateMatch[0];
                            break;
                        }
                    }

                    return { href, dateText };
                });
            });

            console.log("Raw posts found in batch:", rawPosts.length);

            // Process current batch
            let lastParsedDate = null;

            for (const post of rawPosts) {
                const postDate = this.parseRelativeDate(post.dateText);
                lastParsedDate = postDate;

                if (postDate > maxDate) {
                    // Too new, skip but don't stop (we seek older)
                    continue;
                } else if (postDate < minDate) {
                    // Too old, we went past the window
                    console.log(`Found post older than window (${post.dateText} -> ${postDate.toISOString()}). Stopping scroll.`);
                    stopScrolling = true;
                } else {
                    // In window
                    validLinks.push(post.href);
                }
            }

            if (rawPosts.length > 0) {
                console.log(`Check Result: Last post in batch was '${rawPosts[rawPosts.length - 1].dateText}' -> Parsed: ${lastParsedDate ? lastParsedDate.toISOString() : 'N/A'}`);
            }

            if (stopScrolling) break;

            console.log(`Scroll action ${i + 1}/${pagesToScrape}... (Collected ${validLinks.length} valid links so far)`);
            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await this.page.waitForTimeout(2000);
        }

        // Deduplicate
        validLinks = [...new Set(validLinks)];

        console.log(`Found ${validLinks.length} posts matching filter.`);
        return validLinks;
    }

    /**
     * Scrapes the content of a single post given its URL.
     */
    async scrapePostContent(url) {
        if (!this.browser) {
            await this.connect();
        }

        console.log(`Scraping post: ${url}`);

        try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded' });
            // Small wait to ensure dynamic content loads
            //await this.page.waitForTimeout(2000);

            //console.log("USING ROBUST TEXT EXTRACTION (body.innerText)"); // Debug log to prove update

            // Robust Content Extraction: get full body text and slice by known markers
            const bodyText = await this.page.evaluate(() => document.body.innerText);
            const title = await this.page.title();

            // console.log(bodyText);
            let content = '';

            // Strategy: Target the specific container "div.break-words" which holds the main content
            // found via manual inspection / subagent.
            try {
                content = await this.page.evaluate(() => {
                    const contentDiv = document.querySelector('div.break-words');
                    return contentDiv ? contentDiv.innerText : '';
                });
            } catch (err) {
                console.log('Specific selector failed, falling back to body text');
            }

            // Fallback to body scan if selector missed
            if (!content || content.length < 50) {
                const fullBody = await this.page.evaluate(() => document.body.innerText);
                content = fullBody; // Will be cleaned below
            }

            let cleanTitle = title.split(' - ')[0].trim();

            // We still need to remove the Title string itself from the start if it appears
            if (content.includes(cleanTitle)) {
                content = content.replace(cleanTitle, '').trim();
            }

            // Normalize
            let lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Basic Metadata Skipping (Lighter touch since selector excludes most nav/sidebar)
            // But 'break-words' likely includes the Header (User/Time) which is right above text.
            const metadataPatterns = [
                /^Anonymous User$/i,
                /^[0-9]+$/,
                /^[0-9]+ (hour|minute|day|week|month|year)s? ago/i,
                /^(an|a) (hour|minute|day|week|month|year) ago/i,
                /^Compensation$/i,
            ];

            while (lines.length > 0) {
                const firstLine = lines[0];
                const isNoise = metadataPatterns.some(p => p.test(firstLine));
                if (isNoise || firstLine.length < 3) { // Skip very short artifacts
                    lines.shift();
                } else {
                    break;
                }
            }

            content = lines.join('\n');

            // Fallback: if content is suspiciously short or empty, just take a reasonable chunk
            if (content.length < 50) {
                console.warn(`Content likely missing/short for ${url} (Length: ${content.length})`);
                if (content.length === 0) content = bodyText.substring(0, 2500);
            }

            return { url, title: cleanTitle, content };
        } catch (e) {
            console.error(`Failed to scrape ${url}:`, e.message);
            return null; // Return null on failure
        }
    }
}

module.exports = new ScraperService();
