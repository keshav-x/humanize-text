# Humanize Text

A zero-dependency, client-side web application and text transformation engine designed to rewrite AI-generated text so it reads naturally and bypasses statistical AI detection models (including ZeroGPT, GPTZero, and QuillBot) by introducing realistic sentence-length variance (burstiness) and vocabulary flow while strictly maintaining paragraphs, formatting, and technical facts.

---

## Features

- **Structure & Paragraph Preservation**: Keeps multi-paragraph documents, lists, and formatting intact without collapsing everything into a single wall of text.
- **Entity & Fact Retention**: Preserves proper nouns, technical terms, frameworks, numbers, and dates.
- **Client-Side & Private**: Runs entirely in the browser with vanilla JavaScript. No external dependencies or mandatory build steps required.
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
├── app.js           # Controller for UI events and export actions
├── humanizer.js     # Transformation algorithms and detection logic
├── LICENSE          # MIT License
└── README.md        # Project documentation
```

---

## License

[MIT](LICENSE) © 2026 Keshav Chaudhary
