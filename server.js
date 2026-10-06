/**
 * server.js
 * Lightweight zero-dependency local server and ZeroGPT proxy for TextHuman.
 * 
 * Why this is needed:
 * Browsers forbid web pages from setting custom 'Origin' or 'Referer' headers.
 * ZeroGPT's API returns HTTP 403 ("Please make a purchase") unless the request
 * originates from https://www.zerogpt.com.
 * This proxy relays the detection request with the proper headers so live
 * ZeroGPT verification works directly inside the browser UI.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function relayZeroGPT(bodyText, res) {
  const payload = JSON.stringify({ input_text: bodyText });
  const options = {
    hostname: 'api.zerogpt.com',
    port: 443,
    path: '/api/detect/detectText',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Origin': 'https://www.zerogpt.com',
      'Referer': 'https://www.zerogpt.com/'
    }
  };

  const req = https.request(options, (upstreamRes) => {
    let data = '';
    upstreamRes.on('data', (chunk) => { data += chunk; });
    upstreamRes.on('end', () => {
      res.writeHead(upstreamRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });

  req.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, feedback: 'Proxy error: ' + err.message }));
  });

  req.write(payload);
  req.end();
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ZeroGPT relay endpoint
  if (req.url === '/api/zerogpt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        relayZeroGPT(parsed.input_text || '', res);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, feedback: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Static file serving
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath.split('?')[0]);

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
});

server.listen(PORT, () => {
  console.log(`TextHuman running at: http://localhost:${PORT}`);
  console.log(`Live ZeroGPT proxy available at: http://localhost:${PORT}/api/zerogpt`);
});
