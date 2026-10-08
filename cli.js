#!/usr/bin/env node

/**
 * cli.js
 * TextHuman — Command Line Interface
 * Fast, offline, private AI cadence transformer and bypass engine.
 * 
 * Usage:
 *   texthuman [file] [options]
 *   cat article.txt | texthuman --stream
 *   texthuman -t "Artificial intelligence is rapidly transforming..." --lock "AI,PyTorch"
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const humanizer = require('./humanizer.js');

const VERSION = '2.0.0';

// ANSI Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  white: '\x1b[37m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function printHelp() {
  console.log(`
${C.bold}${C.white}TextHuman CLI${C.reset} v${VERSION} — Precision AI Cadence Transformer

${C.bold}USAGE:${C.reset}
  texthuman [file] [options]
  node cli.js [file] [options]
  cat file.txt | texthuman [options]

${C.bold}OPTIONS:${C.reset}
  -t, --text <str>          Input text string directly
  -f, --file <path>         Input file path (.txt, .md, .docx, .pdf)
  -o, --out <path>          Save humanized output to file
  -m, --mode <mode>         Transformation engine: local | localllm | ai (default: local)
  -s, --style <style>       Register tone: natural | academic (default: natural)
  -l, --lock <terms>        Glossary Guard: comma-separated locked terms to preserve 100%
      --stream              Enable real-time token streaming to stdout (for localllm)
      --model <name>        Model name for Local LLM (default: llama3.2)
      --endpoint <url>      Runner endpoint (default: http://localhost:11434)
      --score               Run local perplexity and live ZeroGPT verification check
  -v, --version             Show version
  -h, --help                Show this help message

${C.bold}EXAMPLES:${C.reset}
  texthuman article.txt --style academic
  texthuman -t "Effective time management is essential..." --lock "Eisenhower Matrix"
  texthuman draft.txt --mode localllm --model llama3.2 --stream
  cat input.txt | texthuman --score
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log(`TextHuman v${VERSION}`);
    process.exit(0);
  }

  // Parse arguments
  let inputFilePath = null;
  let inputText = null;
  let outputPath = null;
  let mode = 'local';
  let style = 'natural';
  let lockedTerms = [];
  let isStream = false;
  let model = 'llama3.2';
  let endpoint = 'http://localhost:11434';
  let showScore = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-t' || a === '--text') {
      inputText = args[++i];
    } else if (a === '-f' || a === '--file') {
      inputFilePath = args[++i];
    } else if (a === '-o' || a === '--out') {
      outputPath = args[++i];
    } else if (a === '-m' || a === '--mode') {
      mode = (args[++i] || 'local').toLowerCase();
    } else if (a === '-s' || a === '--style' || a === '--tone') {
      style = (args[++i] || 'natural').toLowerCase();
    } else if (a === '-l' || a === '--lock') {
      const rawLock = args[++i] || '';
      lockedTerms = rawLock.split(',').map(s => s.trim()).filter(Boolean);
    } else if (a === '--stream') {
      isStream = true;
    } else if (a === '--model') {
      model = args[++i] || 'llama3.2';
    } else if (a === '--endpoint') {
      endpoint = args[++i] || 'http://localhost:11434';
    } else if (a === '--score') {
      showScore = true;
    } else if (!a.startsWith('-') && !inputFilePath) {
      inputFilePath = a;
    }
  }

  // Acquire input content
  let sourceText = '';

  if (inputText) {
    sourceText = inputText;
  } else if (inputFilePath) {
    const fullPath = path.resolve(process.cwd(), inputFilePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`${C.red}Error: File not found:${C.reset} ${fullPath}`);
      process.exit(1);
    }

    const ext = path.extname(fullPath).toLowerCase();
    if (ext === '.docx' || ext === '.pdf') {
      // Send to local server parser or read buffer
      console.error(`${C.yellow}Reading binary document (${ext})...${C.reset}`);
      const buf = fs.readFileSync(fullPath);
      // Try local server parser
      try {
        const payload = JSON.stringify({ filename: path.basename(fullPath), base64: buf.toString('base64') });
        const resData = await new Promise((resolve, reject) => {
          const req = http.request('http://localhost:3000/api/parse-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          }, res => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => resolve(JSON.parse(b)));
          });
          req.on('error', reject);
          req.write(payload);
          req.end();
        });
        if (resData.success) sourceText = resData.text;
        else throw new Error(resData.error);
      } catch (err) {
        console.error(`${C.red}Error: Start 'node server.js' to parse .docx/.pdf documents via CLI.${C.reset}`);
        process.exit(1);
      }
    } else {
      sourceText = fs.readFileSync(fullPath, 'utf8');
    }
  } else if (!process.stdin.isTTY) {
    // Read from standard input pipe
    sourceText = await new Promise((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => resolve(data));
    });
  }

  sourceText = sourceText.trim();

  if (!sourceText) {
    console.error(`${C.yellow}No input text provided.${C.reset} Use --text, specify a file, or pipe via stdin.`);
    printHelp();
    process.exit(1);
  }

  const wordCount = humanizer.countWords(sourceText);
  if (process.stderr.isTTY) {
    process.stderr.write(`${C.dim}[TextHuman] Transforming ${wordCount} words (${mode} mode, ${style} style)...${C.reset}\n`);
    if (lockedTerms.length > 0) {
      process.stderr.write(`${C.dim}[Glossary Guard] Locked terms: ${lockedTerms.join(', ')}${C.reset}\n`);
    }
  }

  let humanizedOutput = '';

  if (mode === 'localllm') {
    if (isStream && process.stdout.isTTY) {
      humanizedOutput = await humanizer.streamLocalLLMAPI({
        endpoint,
        model,
        text: sourceText,
        style,
        lockedTerms
      }, (token) => {
        process.stdout.write(token);
      });
      process.stdout.write('\n');
    } else {
      const raw = await humanizer.callLocalLLMAPI({
        endpoint,
        model,
        text: sourceText,
        style,
        lockedTerms
      });
      humanizedOutput = humanizer.polishText(raw, style);
      if (!outputPath) console.log(humanizedOutput);
    }
  } else {
    // Local Heuristics mode
    humanizedOutput = humanizer.humanizeLocalText(sourceText, style, { lockedTerms });
    if (!outputPath) console.log(humanizedOutput);
  }

  // Save to output file if requested
  if (outputPath) {
    const fullOut = path.resolve(process.cwd(), outputPath);
    fs.writeFileSync(fullOut, humanizedOutput, 'utf8');
    if (process.stderr.isTTY) {
      process.stderr.write(`${C.green}✓ Saved output to:${C.reset} ${fullOut}\n`);
    }
  }

  // Score evaluation
  if (showScore) {
    const sents = humanizer.splitIntoSentences(humanizedOutput);
    const burstiness = Math.round(humanizer.calculateBurstiness(sents));
    const missing = humanizer.verifyAnchors(sourceText, humanizedOutput, lockedTerms);

    process.stderr.write(`\n${C.bold}--- CADENCE & VERIFICATION REPORT ---${C.reset}\n`);
    process.stderr.write(`Burstiness: ${C.cyan}${burstiness}% organic rhythm${C.reset}\n`);
    process.stderr.write(`Glossary / Anchors Preserved: ${missing.length === 0 ? C.green + '100% (Zero Drift)' : C.red + missing.join(', ')}${C.reset}\n`);

    process.stderr.write(`Checking ZeroGPT live detector...\n`);
    const zg = await humanizer.checkZeroGPTLive(humanizedOutput);
    if (zg && zg.fakePercentage !== null) {
      const scoreColor = zg.fakePercentage <= 20 ? C.green : (zg.fakePercentage <= 50 ? C.yellow : C.red);
      process.stderr.write(`ZeroGPT AI Score: ${scoreColor}${zg.fakePercentage}% AI${C.reset} (${zg.isHuman}% Human)\n`);
    } else {
      process.stderr.write(`ZeroGPT: ${C.dim}Offline or unverified${C.reset}\n`);
    }
  }
}

main().catch(err => {
  console.error(`${C.red}Error:${C.reset} ${err.message}`);
  process.exit(1);
});
