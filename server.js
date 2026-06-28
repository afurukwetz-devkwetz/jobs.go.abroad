require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Request logging for debugging on Render
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
  next();
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts/styles for UI simplicity
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // strict limit for auth routes
  message: { error: 'Too many attempts, please try again after 15 minutes.' }
});

app.use(globalLimiter);

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

app.use('/api/register', authLimiter, require('./routes/register'));
app.use('/api/track',    require('./routes/track'));
app.use('/api/admin',    authLimiter, require('./routes/admin'));
app.use('/api/verify',   require('./routes/verify'));

// Serve uploaded CVs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files robustly from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve main frontend pages explicitly for cleaner URLs
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Catch-all: Redirect any other unknown routes to index.html
app.use((req, res) => {
  // Only fallback to index.html for navigation requests
  if (req.method === 'GET' && req.accepts('html') && !req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // If it's a static file request that missed (like style.css), return a plain 404 text instead of JSON
    // to prevent strict MIME checking errors in the browser console.
    res.status(404).type('text/plain').send('Not found');
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

      // ⏰ Keep Render free tier awake — self-ping every 10 minutes
      const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
      setInterval(() => {
        fetch(`${RENDER_URL}/api/health`)
          .then(() => console.log('🏓  Self-ping: server is awake'))
          .catch(err => console.log('⚠️  Self-ping failed:', err.message));
      }, 10 * 60 * 1000); // every 10 minutes
    });
  })
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });
