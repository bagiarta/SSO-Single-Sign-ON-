const express = require('express');
const path = require('path');
const proxy = require('express-http-proxy');
const app = express();
const port = 3000;

console.log('Starting SSO Frontend Static Production Server...');

// Proxy sso-api requests to SSO backend (port 3003)
app.use('/sso-api', proxy('http://localhost:3003', {
  proxyReqPathResolver: function (req) {
    return '/api' + req.url;
  }
}));

// Serve static assets under /sso prefix (React was built with homepage=/sso)
// This maps /sso/static/js/... → build/static/js/...
app.use('/sso', express.static(path.join(__dirname, 'build')));

// Redirect root / to /sso/ for direct port-3000 access
app.get('/', (req, res) => res.redirect('/sso/'));

// Fallback: any /sso/* path returns index.html for React Router to handle
app.get('/sso*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Catch-all for anything else
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SSO Frontend Production Server running successfully on port ${port}`);
});
