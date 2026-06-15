// Configuration File
// Frontend is hosted on GitHub Pages; backend is on Render.
// All API calls must use the full Render URL.
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3000' 
  : 'https://jobs-go-abroad-3pbi.onrender.com';
