const OpenAI = require('openai');
const config = require('../config');

class ParserService {
    constructor() {
        this.client = new OpenAI({
            apiKey: config.LLM.API_KEY || 'dummy', // 'dummy' needed for local models if no key
            baseURL: config.LLM.BASE_URL,
        });
    }

    /**
     * Analyze post to check validity and extract company name.
     * @param {string} text - The raw text content of the post.
     * @returns {Promise<Object>} - { isValid: boolean, company: string }
     */
    async parsePost(title, text) {
        const prompt = `
    You are a data extractor for an Interview Question Board.
    
    Task 1: **Filter Logic**
    Determine if the post *might* contain interview-related content.
    
    **BIAS INSTRUCTION**: When in doubt, mark it as **VALID (true)**. We prefer false positives over missing data.
    
    **Mark as VALID (true) if**:
    - The post mentions "Round 1", "Round 2", "OA", "Phone Screen", "DSA", "System Design", or "Behavioral".
    - The post mentions a specific problem (e.g., "Two Sum", "Graph", "DP").
    - The post describes an interview timeline (e.g., "Applied > OA > Phone > Onsite").
    - The post is a "Compensation" or "Offer" post that *also* includes a breakdown of rounds (e.g. "R1: Hard, R2: Easy").
    
    **Mark as INVALID (false) ONLY if**:
    - The content is **purely** numbers with no text description of the process (e.g. just a list "Base: X, Bonus: Y").
    - It is a generic question like "How do I apply?" or "Is X hiring?".
    - It is a strict tutorial with no personal context.
    
    Task 2: **Extract Company**
    If the post is valid, extract the Company Name explicitly mentioned.
    - If multiple, pick the main one.
    - If none mentioned, use "Unknown".
    
    Respond with a JSON object:
    {
      "is_valid": boolean,
      "company": string
    }
    
    POST TITLE: "${title}"
    POST CONTENT:
    ${text.substring(0, 15000)} -- TRUNCATED
    `;

        try {
            const response = await this.client.chat.completions.create({
                model: config.LLM.MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            const parsed = JSON.parse(content);
            return {
                isValid: parsed.is_valid === true,
                company: parsed.company || 'Unknown'
            };
        } catch (error) {
            console.error('LLM Parsing failed:', error);
            // Default to invalid on error to avoid junk
            return { isValid: false, company: 'Unknown' };
        }
    }
}

module.exports = new ParserService();
