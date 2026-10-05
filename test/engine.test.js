import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const enginePath = path.resolve(__dirname, '../humanizer.js');

const engineCode = fs.readFileSync(enginePath, 'utf8')
  .replace('window.TextHumanizer', 'globalThis.TextHumanizer');

eval(engineCode);
const humanizer = globalThis.TextHumanizer;

test('API exports validation', () => {
  assert.equal(typeof humanizer.countWords, 'function');
  assert.equal(typeof humanizer.cleanMarkdown, 'function');
  assert.equal(typeof humanizer.humanizeLocalText, 'function');
  assert.equal(typeof humanizer.checkZeroGPTLive, 'function');
  assert.ok(Array.isArray(humanizer.BENCHMARK_SAMPLES));
  assert.ok(humanizer.BENCHMARK_SAMPLES.length >= 10);
});

test('Markdown sanitation strips symbols while retaining text', () => {
  const md = '### Title Here\n\nThis is **bold** and *italic* text with [link](https://example.com).';
  const cleaned = humanizer.cleanMarkdown(md);
  assert.ok(!cleaned.includes('###'));
  assert.ok(!cleaned.includes('**'));
  assert.ok(cleaned.includes('bold'));
  assert.ok(cleaned.includes('italic'));
});

test('Word counter handles edge cases', () => {
  assert.equal(humanizer.countWords(''), 0);
  assert.equal(humanizer.countWords('   '), 0);
  assert.equal(humanizer.countWords('One two three'), 3);
  assert.equal(humanizer.countWords('Multi\n\nline\t\ttokens'), 3);
});

test('Python benchmark retains all 5 technical paragraphs and libraries', () => {
  const input = `### Python Programming Language
Python is a high-level, interpreted, general-purpose programming language that was created by Guido van Rossum and first released in 1991.
One of Python’s major advantages is its extensive standard library and large ecosystem of third-party packages. Libraries such as NumPy and Pandas are widely used for numerical computing, while Matplotlib and Seaborn are used for data visualization. Frameworks such as TensorFlow, PyTorch, and Scikit-learn lead in AI. Web frameworks like Django and Flask help developers.
Beyond data science, Python is used on Windows, macOS, and Linux.
It has some limitations compared to C, C++, or Java.
In conclusion, Python is a versatile language.`;

  const output = humanizer.humanizeLocalText(input, 'natural');
  const paragraphs = output.split(/\n\s*\n+/);

  assert.ok(paragraphs.length >= 5, `Expected >= 5 paragraphs, got ${paragraphs.length}`);
  assert.ok(output.includes('Guido van Rossum'));
  assert.ok(output.includes('1991'));
  assert.ok(output.includes('NumPy'));
  assert.ok(output.includes('Pandas'));
  assert.ok(output.includes('PyTorch'));
  assert.ok(output.includes('TensorFlow'));
  assert.ok(output.includes('Django'));
  assert.ok(output.includes('Flask'));
  assert.ok(output.includes('Windows'));
  assert.ok(output.includes('macOS'));
  assert.ok(output.includes('Linux'));
  assert.ok(output.includes('C, C++, or Java') || output.includes('C, C++'));
});

test('Effective Time Management benchmark retains core concepts and structure', () => {
  const input = `Effective time management is a cornerstone of professional success.
Strategic Prioritization: Adopting structured frameworks such as the Eisenhower Matrix empowers teams.
Reduction of Context Switching: Multitasking frequently creates the illusion of speed.
Proactive Boundary Setting: Establishing firm operational limits on calendar availability protects mental energy.
Systematic Review Cycles: Pairing a short morning alignment session with weekly retrospection.`;

  const output = humanizer.humanizeLocalText(input, 'natural');
  assert.ok(output.includes('Eisenhower Matrix'));
  assert.ok(output.includes('context switching'));
  assert.ok(output.includes('calendar defense') || output.includes('calendar blocks'));
  assert.ok(output.includes('retrospective'));
});

test('Arbitrary unseen text receives syntactic perturbation and phrase replacement', () => {
  const input = `Artificial intelligence plays a crucial role in modern logistics. In conclusion, utilizing predictive models facilitates seamless routing.`;
  const output = humanizer.humanizeLocalText(input, 'natural');
  assert.ok(!output.includes('plays a crucial role'));
  assert.ok(!output.includes('In conclusion'));
  assert.ok(!output.includes('utilizing'));
  assert.ok(!output.includes('seamlessly'));
});
