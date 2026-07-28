const express = require('express');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('crypto');

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const app = express();
const port = process.env.PORT || 3000;
const inputLimits = { name: 25, comment: 100 };
const commentsPageSize = 10;
const unsafeControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

const db = new DatabaseSync(
  process.env.DATABASE_PATH || path.join(__dirname, 'comments.db')
);

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    datetime TEXT NOT NULL,
    comment TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS comments_datetime_id_idx
    ON comments (datetime DESC, id DESC);
`);

const getFirstComments = db.prepare(`
  SELECT id, name, datetime AS time, comment
  FROM comments
  ORDER BY datetime DESC, id DESC
  LIMIT ?
`);
const getCommentsBefore = db.prepare(`
  SELECT id, name, datetime AS time, comment
  FROM comments
  WHERE (datetime, id) < (?, ?)
  ORDER BY datetime DESC, id DESC
  LIMIT ?
`);
const addComment = db.prepare(`
  INSERT INTO comments (id, name, datetime, comment)
  VALUES (?, ?, ?, ?)
`);

function validateComment(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const value = {};
  for (const [field, maxLength] of Object.entries(inputLimits)) {
    if (typeof body[field] !== 'string') {
      return { error: `${field} must be text` };
    }

    const text = body[field].replace(/\r\n?/g, '\n').trim();
    if (!text) return { error: `${field} is required` };
    if (text.length > maxLength) {
      return { error: `${field} must be ${maxLength} characters or fewer` };
    }
    if (unsafeControlCharacters.test(text)) {
      return { error: `${field} contains unsupported control characters` };
    }

    value[field] = text;
  }

  return { value };
}

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff'
  });
  next();
});
app.use(express.json({ limit: '2kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* Get comments */
app.get('/api/comments', (req, res) => {
  const beforeTime = req.query.beforeTime;
  const beforeId = req.query.beforeId;
  const hasCursor = beforeTime !== undefined || beforeId !== undefined;
  if (hasCursor && (
    typeof beforeTime !== 'string' ||
    typeof beforeId !== 'string' ||
    !beforeTime ||
    !beforeId ||
    beforeTime.length > 100 ||
    beforeId.length > 100
  )) {
    res.status(400).json({ error: 'Invalid comments cursor' });
    return;
  }

  try {
    const rows = hasCursor
      ? getCommentsBefore.all(beforeTime, beforeId, commentsPageSize + 1)
      : getFirstComments.all(commentsPageSize + 1);
    const hasMore = rows.length > commentsPageSize;
    const comments = hasMore ? rows.slice(0, commentsPageSize) : rows;
    const last = comments.at(-1);
    res.json({
      comments,
      nextCursor: hasMore ? { time: last.time, id: last.id } : null
    });
  } catch (err) {
    res.status(500).json({ error: 'DB read error' });
  }
});

/* Add comments */
app.post('/api/comments', (req, res) => {
  const result = validateComment(req.body);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }

  const { name, comment } = result.value;
  const id = randomUUID();
  const datetime = new Date().toISOString();

  try {
    addComment.run(id, name, datetime, comment);
    res.status(201).send('Comment added');
  } catch (err) {
    res.status(500).send('Insert error');
  }
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    res.status(400).json({ error: 'Request body must be valid JSON' });
    return;
  }
  next(err);
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
