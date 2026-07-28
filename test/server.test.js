const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const testDirectory = mkdtempSync(path.join(tmpdir(), 'gregsfridge-'));
process.env.DATABASE_PATH = path.join(testDirectory, 'comments.db');

const app = require('../server');
let server;
const listening = new Promise((resolve, reject) => {
  server = app.listen(0, '127.0.0.1', resolve);
  server.once('error', reject);
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
  });
  rmSync(testDirectory, { recursive: true, force: true });
});

test('serves the site and safely validates comments', async () => {
  await listening;
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Greg's Fridge/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);

  const created = await fetch(`${baseUrl}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test', comment: 'SQLite works' })
  });
  assert.equal(created.status, 201);

  const comments = await fetch(`${baseUrl}/api/comments`).then(res => res.json());
  assert.equal(comments.length, 1);
  assert.equal(comments[0].name, 'Test');
  assert.equal(comments[0].comment, 'SQLite works');

  const xss = {
    name: '<img src=x>',
    comment: '<script>alert(1)</script>'
  };
  const xssCreated = await fetch(`${baseUrl}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(xss)
  });
  assert.equal(xssCreated.status, 201);

  const stored = await fetch(`${baseUrl}/api/comments`).then(res => res.json());
  assert.equal(stored.length, 2);
  assert.equal(stored[1].name, xss.name);
  assert.equal(stored[1].comment, xss.comment);

  const invalidInputs = [
    { name: '', comment: 'Empty name' },
    { name: 123, comment: 'Wrong type' },
    { name: 'a'.repeat(26), comment: 'Long name' },
    { name: 'Test', comment: 'a'.repeat(101) },
    { name: 'Test', comment: 'Null\u0000character' }
  ];
  for (const body of invalidInputs) {
    const response = await fetch(`${baseUrl}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 400);
  }

  const afterInvalidInputs = await fetch(`${baseUrl}/api/comments`).then(res => res.json());
  assert.equal(afterInvalidInputs.length, 2);

  const client = readFileSync(path.join(__dirname, '../public/client.js'), 'utf8');
  assert.doesNotMatch(client, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/);
  assert.match(client, /\.textContent\s*=/);
});
