# LeetCode Interview Scraper

A powerful, automated tool to scrape, filter, and analyze interview experiences from the LeetCode Discuss section.

## 🚀 Features

*   **Targeted Scraping**: Filter posts by Company (e.g., "Google", "Amazon") and Time Range (e.g., "Last Month").
*   **LLM-Powered Analysis**: Uses **Ollama** (or compatible LLMs) to intelligently parse posts, verify they are actual interview experiences/questions, and filter out spam or irrelevant "Status Update" posts.
*   **Smart Deduplication**: Automatically skips posts that have already been scraped.
*   **Modern UI**: Clean React-based interface to control the scraper and view results.
*   **Browser Automation**: Uses Puppeteer to navigate LeetCode, handling dynamic content, "Newest" sorting, and scrolling automatically.

## 📸 Visual Workflow

**1. Search & Filter**
The main dashboard allows you to target specific companies and time ranges. The AI Agent handles the scraping and deduplication automatically.
  !(https://github.com/user-attachments/assets/79d1ff20-f5fd-40ca-a1ed-355a8ffae0dc)
  
**2. Deep Dive & Analysis**
Clicking on a result opens the detailed view, where you can read the full experience and save your own solution notes.
  <img width="1309" height="681" alt="image" src="https://github.com/user-attachments/assets/9cc91a80-e0f2-4612-93f7-a0564ca68b6a" />


## 🛠️ Tech Stack

*   **Frontend**: React, Vite, TailwindCSS (assumed style), Lucide Icons
*   **Backend**: Node.js, Express
*   **Database**: SQLite (`questions.db`)
*   **Scraping**: Puppeteer (Chrome Automation)
*   **AI/ML**: Ollama (Local LLM) or OpenAI API

## 📋 Prerequisites

1.  **Node.js**: Installed on your machine.
2.  **Google Chrome**: Installed (used for scraping).
3.  **Ollama**: Installed and running (for local LLM analysis).
    *   Recommended Model: `qwen2.5:3b` (or update `config.js` with your preferred model).

## ⚡ Quick Start

Run each component in a separate terminal:

**1. Backend Server:**
```bash
cd server
npm install
npm start
# Runs on http://localhost:3000
```

**2. Frontend Client:**
```bash
cd client
npm install
npm run dev
# Runs on http://localhost:5173
```

**3. LLM Service:**
Ensure Ollama is running:
```bash
ollama serve
```

**4. Chrome Debugger:**
Launch Chrome with remote debugging enabled (required for scraping):
*   **Windows**:
    ```powershell
    Start-Process "chrome.exe" -ArgumentList "about:blank", "--remote-debugging-port=9222"
    ```
*   **Mac/Linux**:
    ```bash
    google-chrome --remote-debugging-port=9222
    ```

## ⚙️ Configuration

Check `server/config.js` or create a `.env` file in the `server` directory to configure:
*   `LLM_MODEL`: Model name (default: `qwen2.5:3b`)
*   `LLM_BASE_URL`: URL for LLM service (default: `http://localhost:11434/v1`)
*   `PORT`: Backend port.

## 📝 Usage

1.  Open the **Frontend** URL.
2.  Enter a **Target Company** (e.g., "Microsoft").
3.  Select a **Time Filter** (e.g., "Last Month").
4.  Click **Start Scraping**.
5.  Watch the backend terminal for real-time progress as it navigates, scrolls, and parses posts.

## 🔧 Troubleshooting

*   **Browser Crashes?** The scraper manages Chrome automatically. If issues stick, kill all `chrome.exe` processes and restart.
*   **Infinite Scrolling?** Ensure the page structure hasn't changed. The scraper looks for specific date selectors (`text-xs`, `text-sm`).
*   **LLM Errors?** Ensure Ollama is running and the model is pulled (`ollama pull qwen2.5:3b`).
