require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const app = express();

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Request logging for debugging on Render
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      has_mongo: !!process.env.MONGO_URI,
      has_jwt: !!process.env.JWT_SECRET,
      has_admin_email: !!process.env.ADMIN_EMAIL,
      port: process.env.PORT || 3000
    }
  });
});

app.use('/api/register', require('./routes/register'));
app.use('/api/track',    require('./routes/track'));
app.use('/api/admin',    require('./routes/admin'));

// Serve uploaded CVs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files robustly
app.use(express.static(path.join(__dirname, './')));

// Serve main frontend pages explicitly for cleaner URLs
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Catch-all: Redirect any other unknown routes to index.html
app.use((req, res) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Connect MongoDB then start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀  Server running → http://localhost:${PORT}`);
      console.log(`📋  Batch size     → ${process.env.BATCH_SIZE || 20} applicants per batch`);
    });
  })
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });
