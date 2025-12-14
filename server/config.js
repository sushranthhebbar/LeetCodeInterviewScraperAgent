require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_PATH: path.join(__dirname, 'database', 'questions.db'),
  LLM: {
    API_KEY: process.env.OPENAI_API_KEY, // Optional if using local
    BASE_URL: process.env.LLM_BASE_URL || 'http://localhost:11434/v1', // Default to Ollama
    MODEL: process.env.LLM_MODEL || 'qwen2.5:3b', // Default model
  }
};
