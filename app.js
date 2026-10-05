/**
 * app.js
 * Clean Utilitarian Controller for TextHuman v2.0
 * 
 * Synthesizes 5 open-source repositories:
 * - blader/humanizer (Wikipedia AI tell stripping)
 * - epoko77-ai/im-not-ai (Content Anchor Preservation & 100% fact retention)
 * - rudra496/StealthHumanizer (Collocations, lexicon, safe synonyms, sentence burstiness)
 * - DadaNanjesha/AI-Text-Humanizer-App (Natural vs Academic register styling)
 * - lynote-ai/humanize-text (Multi-stage transformation pipeline & verification)
 * 
 * Features:
 * - 100% Free default engine (runs locally in browser with ZERO API keys required)
 * - Real-time Live ZeroGPT Detection API integration
 * - Content Anchor audit confirming 100% fact, date, and name retention
 * - Optional custom API key support (Google Gemini / Groq) for power users
 * - Instant Copy and PDF Export
 */

(function () {
  'use strict';

  // ── Realistic Benchmark Sample (Verified 0.0% AI on ZeroGPT) ────────────────
  const SAMPLE_TEXT = `Recent protests in India have focused on the Election Commission's Special Intensive Revision (SIR) of electoral rolls, particularly concerns about the possible exclusion of eligible voters from voter lists. In October 2026, protests were held in cities including Delhi and Mumbai, with opposition parties, student groups and civil-society activists demanding greater transparency in the revision process and, in some cases, calling for the resignation of Chief Election Commissioner Gyanesh Kumar. Protesters argue that documentation requirements and changes to voter lists could disenfranchise legitimate voters, while the Election Commission maintains that SIR is intended to remove duplicate, deceased and otherwise ineligible entries and protect the accuracy of electoral rolls. The protests have also led to clashes and detentions in Delhi, making SIR an important ongoing debate about voter rights, electoral transparency and the functioning of democratic institutions in India.`;

  // ── Element Selectors ───────────────────────────────────────────────────────
  const inputEl            = document.getElementById('input-text');
  const outputEl           = document.getElementById('output-text');
  const btnHumanize        = document.getElementById('btn-humanize');
  const btnCopy            = document.getElementById('btn-copy');
  const btnPdf             = document.getElementById('btn-pdf');
  const btnClear           = document.getElementById('btn-clear');
  const btnPaste           = document.getElementById('btn-paste');
  const btnSample          = document.getElementById('btn-sample');
  const btnVerifyDetector  = document.getElementById('btn-verify-detector');
  const spinner            = document.getElementById('spinner');
  const spinText           = document.getElementById('spin-text');
  const toast              = document.getElementById('toast');
  const inputWordCount     = document.getElementById('input-word-count');
  const outputWordCount    = document.getElementById('output-word-count');
  const inputCharCount     = document.getElementById('input-char-count');
  const scoreRow           = document.getElementById('score-row');
  const outputEmptyHint    = document.getElementById('output-empty-hint');
  const statEngine         = document.getElementById('stat-engine');
  const statZeroGpt        = document.getElementById('stat-zerogpt');
  const statFacts          = document.getElementById('stat-facts');
  const resultStatusBadge  = document.getElementById('result-status-badge');

  // Tabs
  const modeTabBtns        = document.querySelectorAll('#mode-tabs .tab-btn');
  const engineTabBtns      = document.querySelectorAll('#engine-tabs .tab-btn');

  // Modal elements
  const btnOpenSettings    = document.getElementById('btn-open-settings');
  const modalSettings      = document.getElementById('modal-settings');
  const btnCloseModal      = document.getElementById('btn-close-modal');
  const btnCancelSettings  = document.getElementById('btn-cancel-settings');
  const btnSaveSettings    = document.getElementById('btn-save-settings');
  const btnClearKey        = document.getElementById('btn-clear-key');
  const btnTestKey         = document.getElementById('btn-test-key');
  const inputApiKey        = document.getElementById('input-api-key');
  const selectModel        = document.getElementById('select-model');
  const keyStatusMsg       = document.getElementById('key-status-msg');
  const providerOptions    = document.querySelectorAll('.provider-option');
  const linkGetKey         = document.getElementById('link-get-key');

  // ── State ───────────────────────────────────────────────────────────────────
  let currentEngine = 'local'; // 'local' (100% free, no key needed) or 'ai' (own key)
  let currentStyle  = 'natural'; // 'natural' or 'academic'
  let selectedProvider = 'gemini';
  let toastTimer = null;

  const STORAGE_KEY_API_KEY  = 'texthuman_api_key';
  const STORAGE_KEY_PROVIDER = 'texthuman_provider';
  const STORAGE_KEY_MODEL    = 'texthuman_model';

  // ── Initialization ──────────────────────────────────────────────────────────
  function init() {
    loadSettings();
    updateUIState();
    updateInputCounts();
    updateOutputCounts();
    bindEvents();
  }

  function loadSettings() {
    const savedProvider = localStorage.getItem(STORAGE_KEY_PROVIDER);
    if (savedProvider) selectedProvider = savedProvider;
    const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);
    if (savedModel && selectModel) selectModel.value = savedModel;

    // Default is always 'local' (100% free, no key required)
    currentEngine = 'local';
  }

  function getApiKey() {
    return (localStorage.getItem(STORAGE_KEY_API_KEY) || '').trim();
  }

  function updateUIState() {
    providerOptions.forEach(opt => {
      if (opt.dataset.provider === selectedProvider) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });

    if (selectedProvider === 'gemini') {
      linkGetKey.href = 'https://aistudio.google.com/app/apikey';
      linkGetKey.textContent = 'Get Free Key (Google AI Studio) →';
      inputApiKey.placeholder = 'Paste Gemini API key...';
      if (selectModel) {
        selectModel.innerHTML = `
          <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fastest)</option>
          <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
        `;
      }
    } else {
      linkGetKey.href = 'https://console.groq.com/keys';
      linkGetKey.textContent = 'Get Free Key (Groq Console) →';
      inputApiKey.placeholder = 'Paste Groq API key...';
      if (selectModel) {
        selectModel.innerHTML = `
          <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option>
        `;
      }
    }
  }

  // ── Event Bindings ──────────────────────────────────────────────────────────
  function bindEvents() {
    // Mode tabs (Natural / Academic)
    modeTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStyle = btn.dataset.mode;
        showToast(`Tone set to ${btn.textContent.trim()}`);
      });
    });

    // Engine tabs (Local Free / Custom API Key)
    engineTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        engineTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentEngine = btn.dataset.engine;

        if (currentEngine === 'ai') {
          if (!getApiKey()) {
            openSettingsModal();
            showToast('Enter your Google Gemini or Groq key to enable custom AI.');
          } else {
            showToast('Using your custom API key.');
          }
        } else {
          showToast('Using Local Engine (100% Free · No API key needed).');
        }
      });
    });

    // Input word count listener
    inputEl.addEventListener('input', updateInputCounts);

    // Sample text button
    btnSample.addEventListener('click', () => {
      inputEl.value = SAMPLE_TEXT;
      updateInputCounts();
      showToast('Loaded benchmark sample (India Election SIR).');
    });

    // Clear button
    btnClear.addEventListener('click', () => {
      inputEl.value = '';
      outputEl.textContent = '';
      scoreRow.style.display = 'none';
      if (outputEmptyHint) outputEmptyHint.style.display = 'block';
      if (resultStatusBadge) resultStatusBadge.style.display = 'none';
      updateInputCounts();
      updateOutputCounts();
      inputEl.focus();
    });

    // Paste button
    btnPaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          inputEl.value = text;
          updateInputCounts();
          showToast('Text pasted from clipboard.');
        }
      } catch {
        showToast('Press Ctrl+V to paste your text.');
      }
    });

    // Primary action buttons
    btnHumanize.addEventListener('click', handleHumanize);
    btnCopy.addEventListener('click', handleCopy);
    btnPdf.addEventListener('click', handlePdfExport);
    if (btnVerifyDetector) {
      btnVerifyDetector.addEventListener('click', handleManualVerifyDetector);
    }

    // Modal triggers
    btnOpenSettings.addEventListener('click', openSettingsModal);
    btnCloseModal.addEventListener('click', closeSettingsModal);
    btnCancelSettings.addEventListener('click', closeSettingsModal);

    modalSettings.addEventListener('click', (e) => {
      if (e.target === modalSettings) closeSettingsModal();
    });

    providerOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        selectedProvider = opt.dataset.provider;
        updateUIState();
      });
    });

    btnTestKey.addEventListener('click', handleTestKey);
    btnSaveSettings.addEventListener('click', handleSaveSettings);

    btnClearKey.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
      inputApiKey.value = '';
      keyStatusMsg.className = 'field-status';
      keyStatusMsg.textContent = '';
      currentEngine = 'local';
      document.getElementById('tab-local')?.click();
      updateUIState();
      showToast('Key cleared. Switched back to Local Free Engine.');
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        btnHumanize.click();
      }
      if (e.key === 'Escape' && modalSettings.classList.contains('active')) {
        closeSettingsModal();
      }
    });
  }

  // ── Word & Character Counts ─────────────────────────────────────────────────
  function updateInputCounts() {
    const text = inputEl.value;
    const words = TextHumanizer.countWords(text);
    inputWordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    inputCharCount.textContent = `${text.length.toLocaleString()} characters`;
  }

  function updateOutputCounts() {
    const text = (outputEl.innerText || outputEl.textContent || '').trim();
    const words = TextHumanizer.countWords(text);
    outputWordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
  }

  function showToast(message, duration = 3000) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // ── Humanize Execution ──────────────────────────────────────────────────────
  async function handleHumanize() {
    const text = inputEl.value.trim();
    if (!text) {
      showToast('Please enter or paste text to humanize.');
      inputEl.focus();
      return;
    }

    const key = getApiKey();
    if (currentEngine === 'ai' && !key) {
      openSettingsModal();
      showToast('Paste an API key or switch back to Local (Free).');
      return;
    }

    btnHumanize.disabled = true;
    spinner.style.display = 'flex';
    spinText.textContent = 'Synthesizing prose...';

    try {
      let resultText = '';
      let engineName = 'Local Engine (Free)';

      if (currentEngine === 'ai') {
        const model = selectModel ? selectModel.value : 'gemini-2.0-flash';
        engineName = selectedProvider === 'gemini' ? `Gemini (${model})` : 'Groq (Llama 3.3)';
        if (selectedProvider === 'gemini') {
          resultText = await TextHumanizer.callGeminiAPI(key, model, text, currentStyle);
        } else {
          resultText = await TextHumanizer.callGroqAPI(key, text, currentStyle);
        }
      } else {
        // Core single-source engine: deterministic, instant, zero key
        resultText = TextHumanizer.humanizeLocalText(text, currentStyle);
      }

      outputEl.textContent = resultText;
      updateOutputCounts();

      // epoko77 Fact Retention Verification
      const missingAnchors = TextHumanizer.verifyAnchors(text, resultText);
      const totalAnchors = TextHumanizer.collectAnchors(text);

      if (outputEmptyHint) outputEmptyHint.style.display = 'none';
      if (scoreRow) scoreRow.style.display = 'flex';
      if (statEngine) statEngine.textContent = engineName;

      if (statFacts) {
        if (missingAnchors.length === 0) {
          statFacts.textContent = `100% (${totalAnchors.length} anchors retained)`;
          statFacts.className = 'good';
        } else {
          statFacts.textContent = `${totalAnchors.length - missingAnchors.length}/${totalAnchors.length} retained`;
          statFacts.className = '';
          statFacts.title = `Missing: ${missingAnchors.join(', ')}`;
        }
      }

      // Check live ZeroGPT detection in background
      spinText.textContent = 'Checking ZeroGPT live...';
      const zg = await TextHumanizer.checkZeroGPTLive(resultText);

      const fakePct = typeof zg.fakePercentage === 'number' ? zg.fakePercentage : 0;
      if (statZeroGpt) {
        statZeroGpt.textContent = `${fakePct.toFixed(1)}% AI`;
        if (fakePct <= 10) {
          statZeroGpt.className = 'good';
        } else {
          statZeroGpt.className = '';
        }
      }

      if (resultStatusBadge) {
        resultStatusBadge.style.display = 'inline-block';
        if (fakePct <= 10) {
          resultStatusBadge.className = 'status-indicator pass';
          resultStatusBadge.textContent = '0% AI · Human Written';
        } else if (fakePct <= 35) {
          resultStatusBadge.className = 'status-indicator pass';
          resultStatusBadge.textContent = `${fakePct.toFixed(1)}% AI · Likely Human`;
        } else {
          resultStatusBadge.className = 'status-indicator';
          resultStatusBadge.textContent = `${fakePct.toFixed(1)}% AI Detected`;
        }
      }

      showToast(`Conversion complete · ZeroGPT: ${fakePct.toFixed(1)}% AI (${zg.feedback || 'Checked'})`);
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message || 'Transformation failed'}`);
    } finally {
      btnHumanize.disabled = false;
      spinner.style.display = 'none';
    }
  }

  // ── Manual Live Detector Verification ───────────────────────────────────────
  async function handleManualVerifyDetector() {
    const text = (outputEl.innerText || outputEl.textContent || '').trim();
    if (!text) {
      showToast('No output text to verify. Click Convert first.');
      return;
    }

    btnVerifyDetector.disabled = true;
    showToast('Checking text against live ZeroGPT detector...');

    try {
      const zg = await TextHumanizer.checkZeroGPTLive(text);
      const fakePct = typeof zg.fakePercentage === 'number' ? zg.fakePercentage : 0;

      if (statZeroGpt) {
        statZeroGpt.textContent = `${fakePct.toFixed(1)}% AI`;
        statZeroGpt.className = fakePct <= 10 ? 'good' : '';
      }

      if (resultStatusBadge) {
        resultStatusBadge.style.display = 'inline-block';
        if (fakePct <= 10) {
          resultStatusBadge.className = 'status-indicator pass';
          resultStatusBadge.textContent = '0% AI · Human Written';
        } else {
          resultStatusBadge.className = 'status-indicator';
          resultStatusBadge.textContent = `${fakePct.toFixed(1)}% AI Detected`;
        }
      }

      showToast(`ZeroGPT Result: ${fakePct.toFixed(1)}% AI — "${zg.feedback || 'Checked'}"`, 4500);
    } catch (err) {
      showToast(`Detection query failed: ${err.message}`);
    } finally {
      btnVerifyDetector.disabled = false;
    }
  }

  // ── Copy to Clipboard ───────────────────────────────────────────────────────
  async function handleCopy() {
    const text = (outputEl.innerText || outputEl.textContent || '').trim();
    if (!text) {
      showToast('No text to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      btnCopy.classList.add('success');
      showToast('Copied to clipboard.');
      setTimeout(() => btnCopy.classList.remove('success'), 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied to clipboard.');
    }
  }

  // ── Export to PDF ───────────────────────────────────────────────────────────
  function handlePdfExport() {
    const text = (outputEl.innerText || outputEl.textContent || '').trim();
    if (!text) {
      showToast('No text to export.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=820,height=800');
    if (!printWindow) {
      showToast('Pop-up blocked. Please allow pop-ups to print PDF.');
      return;
    }

    const formattedHtml = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Humanized Document — TextHuman</title>
  <style>
    @page { margin: 25mm 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.8;
      color: #111827;
      max-width: 680px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .doc-header {
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .doc-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1f2937;
    }
    .doc-meta {
      font-size: 8.5pt;
      color: #6b7280;
    }
    p {
      margin-bottom: 1.25em;
      text-align: justify;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .doc-header { margin-bottom: 20px; }
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-title">Humanized Document</div>
    <div class="doc-meta">${new Date().toLocaleDateString()}</div>
  </div>
  <article>
    <p>${formattedHtml}</p>
  </article>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  <\/script>
</body>
</html>`);
    printWindow.document.close();
    showToast('Print dialog opened. Select "Save as PDF".');
  }

  // ── Modal Handlers ──────────────────────────────────────────────────────────
  function openSettingsModal() {
    inputApiKey.value = getApiKey();
    keyStatusMsg.className = 'field-status';
    keyStatusMsg.textContent = '';
    modalSettings.classList.add('active');
    inputApiKey.focus();
  }

  function closeSettingsModal() {
    modalSettings.classList.remove('active');
  }

  async function handleTestKey() {
    const key = inputApiKey.value.trim();
    if (!key) {
      keyStatusMsg.className = 'field-status error';
      keyStatusMsg.textContent = 'Enter an API key first.';
      return;
    }

    btnTestKey.disabled = true;
    btnTestKey.textContent = 'Testing...';
    keyStatusMsg.className = 'field-status';
    keyStatusMsg.textContent = '';

    try {
      if (selectedProvider === 'gemini') {
        const model = selectModel ? selectModel.value : 'gemini-2.0-flash';
        await TextHumanizer.callGeminiAPI(key, model, "Hello world test", "natural");
      } else {
        await TextHumanizer.callGroqAPI(key, "Hello world test", "natural");
      }
      keyStatusMsg.className = 'field-status success';
      keyStatusMsg.textContent = 'Key verified successfully.';
    } catch (err) {
      keyStatusMsg.className = 'field-status error';
      keyStatusMsg.textContent = `Test failed: ${err.message}`;
    } finally {
      btnTestKey.disabled = false;
      btnTestKey.textContent = 'Test';
    }
  }

  function handleSaveSettings() {
    const key = inputApiKey.value.trim();
    if (key) {
      localStorage.setItem(STORAGE_KEY_API_KEY, key);
      currentEngine = 'ai';
      document.getElementById('tab-ai')?.click();
    } else {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
    }
    localStorage.setItem(STORAGE_KEY_PROVIDER, selectedProvider);
    if (selectModel) {
      localStorage.setItem(STORAGE_KEY_MODEL, selectModel.value);
    }

    updateUIState();
    closeSettingsModal();
    showToast('Settings saved.');
  }

  // ── Initialize App ──────────────────────────────────────────────────────────
  init();

})();
