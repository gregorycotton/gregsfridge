const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuid } = require('uuid');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const db = new sqlite3.Database('comments.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      name TEXT,
      datetime TEXT,
      comment TEXT
    )
  `);
});

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* Get comments */
app.get('/api/comments', (req, res) => {
  db.all(
    `SELECT id, name, datetime AS time, comment 
     FROM comments 
     ORDER BY datetime ASC`,
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: 'DB read error' });
        return;
      }
      res.json(rows);
    }
  );
});

/* Add comments */
app.post('/api/comments', (req, res) => {
  const { name, comment } = req.body;
  const id = uuid();
  const datetime = new Date().toISOString();

  db.run(
    `INSERT INTO comments (id, name, datetime, comment)
     VALUES (?, ?, ?, ?)`,
    [id, name, datetime, comment],
    err => {
      if (err) {
        res.status(500).send('Insert error');
        return;
      }
      res.status(201).send('Comment added');
    }
  );
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
