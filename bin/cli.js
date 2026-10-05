#!/usr/bin/env node

/**
 * humanize-text CLI
 * Zero-dependency command-line interface for humanize-text.
 * Supports pipe/stdin, direct arguments, and file path processing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const enginePath = path.resolve(__dirname, '../humanizer.js');

// Load humanizer engine in a cross-compatible environment
const engineCode = fs.readFileSync(enginePath, 'utf8')
  .replace('window.TextHumanizer', 'globalThis.TextHumanizer');

// Execute engine definition
eval(engineCode);
const humanizer = globalThis.TextHumanizer;

function printHelp() {
  console.log(`
humanize-text CLI (v1.0.0)

USAGE:
  humanize-text "<input text>" [options]
  humanize-text <input-file> [options]
  cat input.txt | humanize-text [options]

OPTIONS:
  -s, --style <style>     Tone variant: natural (default), academic, creative
  -o, --output <file>     Write humanized text to specified file
  -v, --verify            Perform live detection verification via ZeroGPT API
  -h, --help              Show help information
  --version               Show version

EXAMPLES:
  humanize-text "Effective time management is a cornerstone..." -s natural
  humanize-text draft.txt -o humanized.txt --verify
  echo "Python is a high-level language..." | humanize-text
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 && process.stdin.isTTY) {
    printHelp();
    process.exit(0);
  }

  let style = 'natural';
  let outputPath = null;
  let verifyLive = false;
  let inputText = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--version') {
      console.log('humanize-text v1.0.0');
      process.exit(0);
    }
    if (arg === '-s' || arg === '--style') {
      style = args[++i] || 'natural';
    } else if (arg === '-o' || arg === '--output') {
      outputPath = args[++i];
    } else if (arg === '-v' || arg === '--verify') {
      verifyLive = true;
    } else if (!arg.startsWith('-')) {
      if (!inputText) {
        if (fs.existsSync(arg)) {
          inputText = fs.readFileSync(arg, 'utf8');
        } else {
          inputText = arg;
        }
      }
    }
  }

  // If no positional argument, read from stdin
  if (!inputText && !process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    inputText = Buffer.concat(chunks).toString('utf8');
  }

  if (!inputText || !inputText.trim()) {
    console.error('Error: No input text provided.');
    process.exit(1);
  }

  const result = humanizer.humanizeLocalText(inputText, style);

  if (outputPath) {
    fs.writeFileSync(outputPath, result, 'utf8');
    console.error(`Wrote humanized output to ${outputPath}`);
  } else {
    process.stdout.write(result + '\n');
  }

  if (verifyLive) {
    console.error('\n[Live Verification] Querying detector API...');
    try {
      const check = await humanizer.checkZeroGPTLive(result);
      console.error(`Score: ${check.fakePercentage}% AI | Feedback: ${check.feedback}`);
    } catch (err) {
      console.error(`Verification notice: ${err.message}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
