# Humanize Text

A zero-dependency, client-side web application and multi-stage text transformation engine engineered to rewrite AI-generated text so it reads naturally and bypasses statistical AI detection models (including GPTZero Model 4o, ZeroGPT, and QuillBot) by introducing authentic sentence-length variance (burstiness) and natural vocabulary flow while strictly maintaining paragraphs, formatting, and technical facts.

---

## Core Technologies & Architecture

This project synthesizes techniques and algorithms from established open-source text humanization and anti-detection engines:

1. **Wikipedia "Signs of AI Writing" Elimination** (inspired by [`blader/humanizer`](https://github.com/blader/humanizer)):
   - Eliminates AI staging patterns like `"not only X, but also Y"` and `"not X, rather Y"`.
   - Strips formulaic one-line closers (`"In conclusion, mastering X is key to Y"`).
   - Removes artificial rhetorical questions (`"What's driving the momentum? Basically..."`).
   - Purges forced triads (adjectives or clauses strung together in threes by rule).
   - Eliminates excessive em-dashes (`—`) used as universal connectors.

2. **Content Anchor Preservation & Do-NOT List** (inspired by [`epoko77-ai/im-not-ai`](https://github.com/epoko77-ai/im-not-ai)):
   - Extracts and protects proper nouns, framework names, acronyms, dates, numbers, and quoted text into a secure token map before transformations occur.
   - Guarantees that key domain entities (e.g., *Guido van Rossum*, *Eisenhower Matrix*, *NumPy*, *PyTorch*, *Django*) and numeric metrics remain 100% accurate and are never corrupted or swapped.

3. **Deterministic Non-LLM Post-Processing & Burstiness** (inspired by [`rudra496/StealthHumanizer`](https://github.com/rudra496/StealthHumanizer)):
   - **Abbreviation & Decimal Aware Splitter**: Splits sentences accurately without breaking numbers (`3.14`), version strings (`3.x`), or common abbreviations (`Dr.`, `e.g.`, `i.e.`).
   - **Collocation Replacements**: 200+ curated multi-word phrases replace predictable AI-favored collocations with diverse human idioms.
   - **AI Lexicon Purge**: Removes 80+ high-frequency AI tells (`moreover`, `furthermore`, `delve into`, `tapestry`, `multifaceted`, `seamlessly`, `leverage`, `utilize`, `pivotal`).
   - **Burstiness Injection**: Detects flat, uniform sentence lengths across paragraphs and manipulates syntax (splitting run-ons >28 words, merging short clauses with semicolons) to break the flat perplexity curve that AI detectors flag.

4. **Dual-Register Tone Adaptation** (inspired by [`DadaNanjesha/AI-Text-Humanizer-App`](https://github.com/DadaNanjesha/AI-Text-Humanizer-App)):
   - **Natural / Creative Mode**: Applies conversational contractions (`don't`, `it's`, `they're`) and active voice.
   - **Academic Mode**: Expands contractions (`do not`, `it is`), preserves academic rigor, and uses formal transitional phrasing.

5. **Multi-Stage Pipeline Orchestration** (inspired by [`lynote-ai/humanize-text`](https://github.com/lynote-ai/humanize-text)):
   - Sequential pipeline: Input Sanitization ➔ Entity Protection ➔ AI Tell Purge ➔ Collocation & Lexicon Replacement ➔ Sentence Boundary Analysis ➔ Sentence Length & Burstiness Engineering ➔ Register Adjustment ➔ Entity Restoration ➔ Output Verification.
   - Strict paragraph preservation: Multi-paragraph essays separated by double line breaks (`\n\n`) always retain their original boundaries.

---

## Features

- **Strict Paragraph & Structure Preservation**: Keeps multi-paragraph documents, lists, and formatting intact without collapsing everything into a single wall of text.
- **100% Fact & Entity Retention**: Preserves proper nouns, technical terms, frameworks, numbers, and dates.
- **Client-Side & Private**: Runs entirely in the browser with vanilla JavaScript. No external dependencies or mandatory build steps required.
- **Dual Engine Options**:
  - **Local Engine (Default)**: Pure client-side JavaScript execution with zero latency and complete privacy.
  - **Stealth AI API (Optional)**: Free Google Gemini 2.0 Flash or Groq (Llama 3.3 70B) integration using advanced anti-detection prompt engineering.
- **Live AI Detection Check**: Optional live verification against detection endpoints to check AI probability on the fly.
- **Export Ready**: Includes one-click clipboard copy and formatted PDF export.

---

## Getting Started

Because the app is built with standard HTML, CSS, and JavaScript, no build step or package installation is needed.

### Run in Browser

Clone the repository and open `index.html` directly in your browser:

```bash
git clone https://github.com/keshav-x/humanize-text.git
cd humanize-text
```

Then open `index.html` with your browser:
- **macOS**: `open index.html`
- **Linux**: `xdg-open index.html`
- **Windows**: `start index.html`

Or serve it with any local static server:

```bash
# Using Python
python -m http.server 8000

# Using Node
npx serve .
```

---

## Project Structure

```text
humanize-text/
├── index.html       # Web UI layout
├── style.css        # Responsive styling and theme
├── app.js           # Controller for UI events, state, and exports
├── humanizer.js     # Integrated multi-stage transformation engine
├── LICENSE          # MIT License
└── README.md        # Project documentation
```

---

## License

[MIT](LICENSE) © 2026 Keshav Chaudhary
