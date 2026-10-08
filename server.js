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
const zlib = require('zlib');

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
  const isStream = Boolean(payload.stream);

  if (isStream) {
    return handleStreamLocalLLM(targetUrl, payload, isOllama, res);
  }

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

function handleStreamLocalLLM(targetUrl, payload, isOllama, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const client = targetUrl.protocol === 'https:' ? https : http;
  let reqPath;
  let bodyData;

  if (isOllama && !payload.useOpenAICompat) {
    // For Ollama streaming, /api/generate with prompt works across 100% of models
    reqPath = '/api/generate';
    bodyData = JSON.stringify({
      model: payload.model || 'llama3.2',
      prompt: payload.prompt || (payload.messages?.map(m => `${m.role}: ${m.content}`).join('\n\n') || ''),
      stream: true,
      options: {
        temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.85,
        top_p: 0.9
      }
    });
  } else {
    // OpenAI-compatible format (LM Studio, LocalAI, vLLM)
    const basePath = targetUrl.pathname.replace(/\/+$/, '');
    reqPath = (basePath.endsWith('/v1') ? basePath : (basePath ? basePath + '/v1' : '/v1')) + '/chat/completions';
    bodyData = JSON.stringify({
      model: payload.model || 'local-model',
      messages: payload.messages || [{ role: 'user', content: payload.prompt || '' }],
      stream: true,
      temperature: typeof payload.temperature === 'number' ? payload.temperature : 0.85
    });
  }

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
    timeout: 180000
  };

  const req = client.request(options, (upstreamRes) => {
    let buffer = '';

    upstreamRes.on('data', chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (isOllama) {
          try {
            const data = JSON.parse(trimmed);
            const token = data.response || data.message?.content || '';
            const thinking = data.thinking || data.message?.thinking || '';
            const done = Boolean(data.done);
            res.write(`data: ${JSON.stringify({ token, thinking, done })}\n\n`);
            if (done) {
              res.end();
            }
          } catch (e) {}
        } else {
          if (trimmed.startsWith('data:')) {
            const raw = trimmed.replace(/^data:\s*/, '');
            if (raw === '[DONE]') {
              res.write(`data: ${JSON.stringify({ token: '', done: true })}\n\n`);
              return res.end();
            }
            try {
              const data = JSON.parse(raw);
              const token = data.choices?.[0]?.delta?.content || '';
              const finish = data.choices?.[0]?.finish_reason;
              res.write(`data: ${JSON.stringify({ token, done: Boolean(finish) })}\n\n`);
              if (finish) res.end();
            } catch (e) {}
          }
        }
      }
    });

    upstreamRes.on('end', () => {
      res.write(`data: ${JSON.stringify({ token: '', done: true })}\n\n`);
      res.end();
    });
  });

  req.on('timeout', () => {
    req.destroy();
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream timed out' })}\n\n`);
    res.end();
  });

  req.on('error', (err) => {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
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

// ── Document Parsing Utilities (DOCX, PDF, TXT) ──────────────────────────────
function extractDocxText(buffer) {
  let offset = 0;
  while (offset < buffer.length - 30) {
    // Check for ZIP local file header signature 0x04034b50 (PK\x03\x04)
    if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4B && buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;

      if (name === 'word/document.xml') {
        let xml = '';
        if (compMethod === 8) {
          const raw = buffer.subarray(dataStart, dataStart + compSize);
          xml = zlib.inflateRawSync(raw).toString('utf8');
        } else if (compMethod === 0) {
          xml = buffer.toString('utf8', dataStart, dataStart + compSize);
        }
        return convertDocxXmlToText(xml);
      }
      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }
  return null;
}

function convertDocxXmlToText(xml) {
  let text = xml.replace(/<\/w:p>/gi, '\n\n');
  text = text.replace(/<w:br[^>]*\/>/gi, '\n');
  text = text.replace(/<w:tab[^>]*\/>/gi, '\t');
  text = text.replace(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi, '$1');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&apos;/g, "'");
  return text.trim();
}

function extractPdfText(buffer) {
  const str = buffer.toString('binary');
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  let fullText = '';

  while ((match = streamRegex.exec(str)) !== null) {
    const rawStream = Buffer.from(match[1], 'binary');
    let decompressed;
    try {
      decompressed = zlib.inflateSync(rawStream);
    } catch (e) {
      try {
        decompressed = zlib.inflateRawSync(rawStream);
      } catch (e2) {
        decompressed = rawStream;
      }
    }
    const decStr = decompressed.toString('latin1');
    const tjMatches = decStr.match(/\(([^()]+)\)\s*Tj/g);
    if (tjMatches) {
      for (const m of tjMatches) {
        const t = m.replace(/^\(/, '').replace(/\)\s*Tj$/, '');
        fullText += t + ' ';
      }
      fullText += '\n';
    }
  }

  if (!fullText.trim()) {
    const rawMatches = str.match(/\(([^()]{3,})\)/g);
    if (rawMatches) {
      fullText = rawMatches.map(m => m.slice(1, -1)).filter(s => /^[a-zA-Z0-9\s.,!?'"()-]+$/.test(s)).join(' ');
    }
  }

  return fullText.replace(/\s+/g, ' ').trim();
}

function handleParseDocument(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const filename = parsed.filename || 'document.txt';
      const base64Data = parsed.base64 || '';
      const rawBuffer = Buffer.from(base64Data, 'base64');
      const ext = path.extname(filename).toLowerCase();

      let extracted = '';
      if (ext === '.docx') {
        extracted = extractDocxText(rawBuffer);
        if (!extracted) {
          throw new Error('Unable to extract text from DOCX file. File may be corrupted or encrypted.');
        }
      } else if (ext === '.pdf') {
        extracted = extractPdfText(rawBuffer);
        if (!extracted) {
          throw new Error('Unable to extract text from PDF. The PDF may be a scanned document.');
        }
      } else {
        extracted = rawBuffer.toString('utf8');
      }

      const words = extracted.trim().split(/\s+/).filter(Boolean).length;
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: true,
        filename,
        text: extracted,
        wordCount: words
      }));
    } catch (err) {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: false,
        error: err.message || 'Failed to parse document'
      }));
    }
  });
}

// ── Zero-Dependency DOCX Generation ──────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  crcTable[i] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function createZipBuffer(files) {
  const fileEntries = [];
  let offset = 0;

  for (const f of files) {
    const data = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, 'utf8');
    const nameBuf = Buffer.from(f.name, 'utf8');
    const deflated = zlib.deflateRawSync(data);
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(deflated.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    fileEntries.push({
      nameBuf,
      localHeader,
      deflated,
      offset,
      crc,
      compSize: deflated.length,
      uncompSize: data.length
    });

    offset += localHeader.length + deflated.length;
  }

  const cdChunks = [];
  let cdSize = 0;
  for (const e of fileEntries) {
    const cd = Buffer.alloc(46 + e.nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(e.crc, 16);
    cd.writeUInt32LE(e.compSize, 20);
    cd.writeUInt32LE(e.uncompSize, 24);
    cd.writeUInt16LE(e.nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(e.offset, 42);
    e.nameBuf.copy(cd, 46);
    cdChunks.push(cd);
    cdSize += cd.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(fileEntries.length, 8);
  eocd.writeUInt16LE(fileEntries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const parts = [];
  for (const e of fileEntries) {
    parts.push(e.localHeader, e.deflated);
  }
  parts.push(...cdChunks, eocd);
  return Buffer.concat(parts);
}

function buildDocxBuffer(text) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const paragraphs = text.split(/\\n\\s*\\n+/);
  const pTags = paragraphs.map(p => {
    const lines = p.split('\\n');
    const runs = lines.map((line, idx) => {
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return (idx > 0 ? '<w:br/>' : '') + `<w:t xml:space="preserve">${escaped}</w:t>`;
    }).join('');
    return `<w:p><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/></w:rPr>${runs}</w:r></w:p>`;
  }).join('');

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${pTags}</w:body>
</w:document>`;

  return createZipBuffer([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rels },
    { name: 'word/_rels/document.xml.rels', content: docRels },
    { name: 'word/document.xml', content: docXml }
  ]);
}

function handleExportDocx(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const text = parsed.text || '';
      const filename = (parsed.filename || 'humanized_document.docx').replace(/[^a-zA-Z0-9._-]/g, '_');
      const docxBuf = buildDocxBuffer(text);

      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(docxBuf);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, error: err.message || 'Export failed' }));
    }
  });
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

  // Document Parse endpoint (.docx, .pdf, .txt, .md)
  if (req.url === '/api/parse-document' && req.method === 'POST') {
    handleParseDocument(req, res);
    return;
  }

  // Document DOCX Export endpoint
  if (req.url === '/api/export-docx' && req.method === 'POST') {
    handleExportDocx(req, res);
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
