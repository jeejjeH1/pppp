// Local dev server: serves the static site and the /api/espn proxy. Run: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const espn = require('./api/espn');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PORT = process.env.PORT || 8080;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/espn') return espn.handler(req, res);
  const file = path.join(__dirname, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(__dirname)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
