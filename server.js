const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

process.emitWarning = (warning, type, ...args) => {
    if (type === 'DeprecationWarning' && warning.includes('punycode')) {
      return;
    }
    return process.emitWarning(warning, type, ...args);
  };

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();

app.use(express.json());
app.use(express.static('public'));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/encode-domain', (req, res) => {
    const domain = req.query.domain;
    const encoded = encodeDomain(domain);
    res.json({ original: domain, encoded: encoded });
  });
  
  app.get('/decode-domain', (req, res) => {
    const domain = req.query.domain;
    const decoded = decodeDomain(domain);
    res.json({ original: domain, decoded: decoded });
  });

// API endpoint to add a comment
app.post('/api/comments', async (req, res) => {
  try {
    const { name, comment } = req.body;
    await db.collection('comments').add({
      name,
      comment,
      time: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(201).send('Comment added successfully');
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).send('Error adding comment');
  }
});

// API endpoint to get all comments
app.get('/api/comments', async (req, res) => {
    try {
      const snapshot = await db.collection('comments').orderBy('time', 'asc').get();
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        time: doc.data().time.toDate().toISOString()
      }));
      res.json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Error fetching comments', details: error.message });
    }
  });

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
