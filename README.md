# humanize-text

A lightweight, zero-dependency text transformation engine engineered to bypass statistical AI detection models (GPTZero Model 4o, ZeroGPT, QuillBot v7, Turnitin) by optimizing token perplexity and sentence-level burstiness while strictly preserving structural paragraph boundaries and technical precision.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](test/engine.test.js)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-black.svg)](package.json)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)

---

## Overview

AI detectors identify generated text by measuring two statistical properties: **perplexity** (token probability under an autoregressive model) and **burstiness** (variance in sentence length and rhythm). Raw LLM outputs consistently exhibit low perplexity and flat sentence rhythm, triggering detection thresholds.

`humanize-text` addresses this by re-architecting predictable sentence sequences into high-variance human syntactic structures—injecting authentic discourse anchors, varying sentence lengths (mixing 5-word punches with 25+ word compound clauses), and dismantling formulaic corporate boilerplate—without dropping entities, technical libraries, dates, or paragraph formatting (`\n\n`).

---

## Key Features

- **Strict Paragraph & Structure Preservation:** Never collapses multi-paragraph essays into a single block. Paragraphs separated by double line breaks (`\n\n`) remain distinct.
- **100% Semantic & Fact Retention:** Retains technical terms, framework names (e.g., NumPy, PyTorch, Django), dates, numbers, and logical arguments intact.
- **Dual-Engine Architecture:**
  - **Local Engine (Default):** Runs 100% client-side in pure JavaScript with zero external network dependencies, zero latency, and complete privacy.
  - **Stealth AI API (Optional):** Supports Google Gemini 2.0 Flash and Groq (Llama 3.3 70B) for specialized long-form prose rewriting.
- **Zero Obfuscation Tricks:** Uses zero hidden unicode characters, zero-width spaces (`\u200b`), or homoglyphs that modern enterprise detectors (Turnitin, GPTZero) flag as cheating.
- **Built-in CLI & Web Interface:** Works out of the box via command line, standalone browser file (`file:///`), or local development server.
- **Export Capabilities:** 1-click clipboard copy and print-ready formatted PDF generation.

---

## Quick Start

### 1. Web Application (Standalone)

No build steps required. Simply open `index.html` in any modern web browser:

```bash
# Clone the repository
git clone https://github.com/keshav-x/humanize-text.git
cd humanize-text

# Open directly in your browser
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

Or run the modern development server via Vite:

```bash
npm install
npm run dev
```

### 2. Command Line Interface (CLI)

```bash
# Transform text directly
node bin/cli.js "Effective time management is a cornerstone of professional success..."

# Transform a file and save the output
node bin/cli.js input.txt -o humanized.txt

# Pipe input from stdin with live detection check
cat article.txt | node bin/cli.js --verify
```

### 3. Programmatic Usage (Node.js / Browser)

```javascript
import { humanizeLocalText, checkZeroGPTLive } from './humanizer.js';

const input = `Artificial intelligence is revolutionizing healthcare by enhancing diagnostic accuracy...`;

// Humanize with desired tone: 'natural' | 'academic' | 'creative'
const result = humanizeLocalText(input, 'natural');

console.log(result);

// Optional: verify score against live detection model
const check = await checkZeroGPTLive(result);
console.log(`Detector Score: ${check.fakePercentage}% AI`);
```

---

## Empirical Benchmarks

Tested directly against production endpoints of **ZeroGPT** and **GPTZero (Model 4o)**:

| Discipline | Sample Words | Paragraphs | Input AI Score | Output AI Score | Status |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Computer Science** (Python Ecosystem) | 478 | 5 + Title | 100.0% | **0.0%** | Passed (0 flagged) |
| **Public Policy** (Electoral Commission SIR) | 126 | 1 | 100.0% | **0.0%** | Passed (0 flagged) |
| **Productivity** (Eisenhower Matrix / Deep Work) | 200 | 2 | 100.0% | **0.0%** | Passed (0 flagged) |
| **Clean Energy** (Renewables & Power Grids) | 115 | 1 | 100.0% | **0.0%** | Passed (0 flagged) |
| **Clinical Medicine** (Neural Network Diagnostics) | 95 | 1 | 100.0% | **0.0%** | Passed (0 flagged) |
| **Distributed Systems** (Remote Work Infrastructure) | 101 | 1 | 100.0% | **0.0%** | Passed (0 flagged) |
| **Aerospace** (Autonomous Mars Exploration) | 89 | 1 | 100.0% | **0.0%** | Passed (0 flagged) |
| **Fintech** (Decentralized Consensus Protocols) | 89 | 1 | 100.0% | **0.0%** | Passed (0 flagged) |
| **Information Security** (Perimeter Threat Defense) | 90 | 1 | 100.0% | **0.0%** | Passed (0 flagged) |
| **Quantum Computing** (Superconducting Qubits) | 95 | 1 | 100.0% | **0.0%** | Passed (0 flagged) |

For comprehensive input/output comparisons, see [docs/BENCHMARKS.md](docs/BENCHMARKS.md).

---

## Architecture & Mechanics

Detailed analysis of detection mathematics (perplexity calculation, sliding window burstiness, and syntactic transformation algorithms) is available in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
Raw LLM Text ──► Markdown Sanitizer ──► Entity Preserver ──► Syntactic Restructurer ──► Lexical Perturbation ──► Verified Output (0% AI)
```

---

## Running Automated Tests

Run the built-in test suite using Node's native test runner:

```bash
npm test
```

Expected output:

```text
✔ API exports validation
✔ Markdown sanitation strips symbols while retaining text
✔ Word counter handles edge cases
✔ Python benchmark retains all 5 technical paragraphs and libraries
✔ Effective Time Management benchmark retains core concepts and structure
✔ Arbitrary unseen text receives syntactic perturbation and phrase replacement
ℹ tests 6 | pass 6 | fail 0
```

---

## Project Structure

```text
humanize-text/
├── bin/
│   └── cli.js            # Zero-dependency command-line interface
├── docs/
│   ├── ARCHITECTURE.md   # Mathematical breakdown of detection & mitigation
│   └── BENCHMARKS.md     # Empirical dataset and verification logs
├── test/
│   └── engine.test.js    # Unit test suite (Node test runner)
├── app.js                # Web application controller
├── humanizer.js          # Core transformation & detection engine
├── index.html            # Utilitarian two-pane editor interface
├── style.css             # Neutral dark design system
├── package.json          # Project metadata & npm scripts
├── LICENSE               # MIT License
└── README.md             # Project documentation
```

---

## License

MIT License. Copyright (c) 2026 Keshav Chaudhary.
