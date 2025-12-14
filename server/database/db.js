const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');
const fs = require('fs');

// Ensure DB directory exists
const dbPath = config.DB_PATH;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize DB
const db = new Database(dbPath);

// 1. Create table if not exists (Original Schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS questions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT,
  title TEXT,
  question_text TEXT,
  original_post_url TEXT,
  status TEXT DEFAULT 'New',
  answer TEXT,
  leetcode_link TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// 2. Migration Helper
function addColumnIfNotExists(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(c => c.name === column)) {
    console.log(`Migrating: Adding column ${column} to ${table}...`);
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// 3. Apply Column Migrations
try {
  addColumnIfNotExists('questions', 'title', 'TEXT');
  addColumnIfNotExists('questions', 'status', "TEXT DEFAULT 'New'");
  addColumnIfNotExists('questions', 'answer', 'TEXT');
  addColumnIfNotExists('questions', 'leetcode_link', 'TEXT');
} catch (error) {
  console.error('Migration Error:', error.message);
}

// 4. Add Unique Index for Deduplication
console.log('Ensuring Unique Index on original_post_url...');
try {
  // CLEANUP: Remove duplicates before indexing
  db.exec(`
    DELETE FROM questions 
    WHERE id NOT IN (
      SELECT MIN(id) 
      FROM questions 
      GROUP BY original_post_url
    )
  `);
  console.log('Duplicates cleaned up.');

  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_url ON questions(original_post_url)`);
} catch (error) {
  console.error('Index Creation Error:', error.message);
}

module.exports = db;
