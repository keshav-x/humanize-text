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

function relayLocalLLMChat(payload, res) {
  let targetUrl;
  try {
    targetUrl = new URL(payload.endpoint || 'http://localhost:11434');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Invalid local LLM endpoint URL' }));
  }

  const isOllama = payload.runner === 'ollama' || targetUrl.port === '11434';
  let reqPath;
  let bodyData;

  if (isOllama && !payload.useOpenAICompat) {
    reqPath = '/api/chat';
    bodyData = JSON.stringify({
      model: payload.model || 'llama3.2',
      messages: payload.messages || [{ role: 'user', content: payload.prompt || '' }],
      stream: false,
      options: {
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.85,
        top_p: 0.9
      }
    });
  } else {
    // OpenAI-compatible format (LM Studio, LocalAI, vLLM, text-gen-webui)
    const basePath = targetUrl.pathname.replace(/\/+$/, '');
    reqPath = (basePath.endsWith('/v1') ? basePath : (basePath ? basePath + '/v1' : '/v1')) + '/chat/completions';
    bodyData = JSON.stringify({
      model: payload.model || 'local-model',
      messages: payload.messages || [{ role: 'user', content: payload.prompt || '' }],
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.85
    });
  }

  const client = targetUrl.protocol === 'https:' ? https : http;
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: reqPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyData),
      ...(payload.apiKey ? { 'Authorization': `Bearer ${payload.apiKey}` } : {})
    },
    timeout: 120000 // 2 minutes timeout for local inference
  };

  const req = client.request(options, (upstreamRes) => {
    let data = '';
    upstreamRes.on('data', chunk => { data += chunk; });
    upstreamRes.on('end', () => {
      // If Ollama /api/chat returned empty message content, fallback seamlessly to /api/generate
      if (isOllama && reqPath === '/api/chat' && payload.prompt) {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.message?.content || !parsed.message.content.trim()) {
            return executeOllamaGenerate(targetUrl, payload, res);
          }
        } catch (e) {}
      }

      res.writeHead(upstreamRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });

  req.on('timeout', () => {
    req.destroy();
    res.writeHead(504, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Local LLM generation timed out after 120s' }));
  });

  req.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: `Could not connect to Local LLM at ${targetUrl.origin}: ${err.message}` }));
  });

  req.write(bodyData);
  req.end();
}

function executeOllamaGenerate(targetUrl, payload, res) {
  const client = targetUrl.protocol === 'https:' ? https : http;
  const genBody = JSON.stringify({
    model: payload.model || 'llama3.2',
    prompt: payload.prompt,
    stream: false,
    options: {
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.85,
      top_p: 0.9
    }
  });

  const genReq = client.request({
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: '/api/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(genBody)
    },
    timeout: 120000
  }, (upstreamRes) => {
    let data = '';
    upstreamRes.on('data', chunk => { data += chunk; });
    upstreamRes.on('end', () => {
      res.writeHead(upstreamRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
  });

  genReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: `Fallback generate failed: ${err.message}` }));
  });

  genReq.write(genBody);
  genReq.end();
}

function relayLocalLLMModels(endpointStr, res) {
  let targetUrl;
  try {
    targetUrl = new URL(endpointStr || 'http://localhost:11434');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'Invalid URL' }));
  }

  const client = targetUrl.protocol === 'https:' ? https : http;

  // 1. Try Ollama /api/tags
  const tryOllama = new Promise(resolve => {
    const req = client.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port || 11434,
      path: '/api/tags',
      method: 'GET',
      timeout: 3000
    }, resp => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.models && Array.isArray(j.models)) {
            return resolve({
              runner: 'ollama',
              models: j.models.map(m => ({ id: m.name, name: m.name, size: m.size }))
            });
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });

  // 2. Try OpenAI-compatible /v1/models (LM Studio, LocalAI)
  const tryOpenAI = new Promise(resolve => {
    const basePath = targetUrl.pathname.replace(/\/+$/, '');
    const modelPath = (basePath.endsWith('/v1') ? basePath : (basePath ? basePath + '/v1' : '/v1')) + '/models';
    const req = client.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port || 1234,
      path: modelPath,
      method: 'GET',
      timeout: 3000
    }, resp => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.data && Array.isArray(j.data)) {
            return resolve({
              runner: 'lmstudio',
              models: j.data.map(m => ({ id: m.id, name: m.id }))
            });
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });

  Promise.all([tryOllama, tryOpenAI]).then(([ollama, openAi]) => {
    const found = ollama || openAi;
    if (found) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, ...found }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        success: false,
        error: `No running local LLM found at ${targetUrl.origin}. Please start Ollama ('ollama serve') or LM Studio ('Start Server').`
      }));
    }
  });
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

  // Local LLM Chat Proxy endpoint
  if (req.url === '/api/local-llm/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        relayLocalLLMChat(parsed, res);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Local LLM Models Discovery endpoint
  if (req.url.startsWith('/api/local-llm/models') && req.method === 'GET') {
    try {
      const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
      const endpoint = parsedUrl.searchParams.get('endpoint') || 'http://localhost:11434';
      relayLocalLLMModels(endpoint, res);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
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
