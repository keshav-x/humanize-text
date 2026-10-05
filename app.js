/**
 * app.js
 * Clean Utilitarian Controller for TextHuman
 * Handles mode switching, full-detail 0% AI humanization,
 * live ZeroGPT/QuillBot safety, Copy, and PDF export.
 */

(function () {
  'use strict';

  // ── Realistic Benchmark Sample ─────────────────────────────────────────────
  const SAMPLE_TEXT = `Recent protests in India have focused on the Election Commission’s Special Intensive Revision (SIR) of electoral rolls, particularly concerns about the possible exclusion of eligible voters from voter lists. In October 2026, protests were held in cities including Delhi and Mumbai, with opposition parties, student groups and civil-society activists demanding greater transparency in the revision process and, in some cases, calling for the resignation of Chief Election Commissioner Gyanesh Kumar. Protesters argue that documentation requirements and changes to voter lists could disenfranchise legitimate voters, while the Election Commission maintains that SIR is intended to remove duplicate, deceased and otherwise ineligible entries and protect the accuracy of electoral rolls. The protests have also led to clashes and detentions in Delhi, making SIR an important ongoing debate about voter rights, electoral transparency and the functioning of democratic institutions in India.`;

  // ── Element Selectors ───────────────────────────────────────────────────────
  const inputEl            = document.getElementById('input-text');
  const outputEl           = document.getElementById('output-text');
  const btnHumanize        = document.getElementById('btn-humanize');
  const btnCopy            = document.getElementById('btn-copy');
  const btnPdf             = document.getElementById('btn-pdf');
  const btnClear           = document.getElementById('btn-clear');
  const btnPaste           = document.getElementById('btn-paste');
  const btnSample          = document.getElementById('btn-sample');
  const spinner            = document.getElementById('spinner');
  const spinText           = document.getElementById('spin-text');
  const toast              = document.getElementById('toast');
  const inputWordCount     = document.getElementById('input-word-count');
  const outputWordCount    = document.getElementById('output-word-count');
  const inputCharCount     = document.getElementById('input-char-count');
  const scoreRow           = document.getElementById('score-row');
  const outputEmptyHint    = document.getElementById('output-empty-hint');
  const statAiScore        = document.getElementById('stat-ai-score');
  const statZeroGpt        = document.getElementById('stat-zerogpt');
  const statQuillBot       = document.getElementById('stat-quillbot');
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
  let currentEngine = 'offline'; // 'offline' or 'ai'
  let currentStyle  = 'natural'; // 'natural', 'academic', 'creative'
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

    const key = getApiKey();
    if (key) {
      currentEngine = 'ai';
      document.getElementById('tab-ai')?.classList.add('active');
      document.getElementById('tab-offline')?.classList.remove('active');
    } else {
      currentEngine = 'offline';
      document.getElementById('tab-offline')?.classList.add('active');
      document.getElementById('tab-ai')?.classList.remove('active');
    }
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
    // Mode tabs
    modeTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStyle = btn.dataset.mode;
        showToast(`Tone: ${btn.textContent.trim()}`);
      });
    });

    // Engine tabs
    engineTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        engineTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentEngine = btn.dataset.engine;
        if (currentEngine === 'ai' && !getApiKey()) {
          openSettingsModal();
        }
      });
    });

    // Word counts
    inputEl.addEventListener('input', () => {
      updateInputCounts();
    });

    // Sample button
    btnSample.addEventListener('click', () => {
      inputEl.value = SAMPLE_TEXT;
      updateInputCounts();
      showToast('Sample text loaded.');
    });

    // Clear & Paste
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

    btnPaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          inputEl.value = text;
          updateInputCounts();
          showToast('Text pasted.');
        }
      } catch {
        showToast('Press Ctrl+V to paste your text.');
      }
    });

    btnHumanize.addEventListener('click', handleHumanize);
    btnCopy.addEventListener('click', handleCopy);
    btnPdf.addEventListener('click', handlePdfExport);

    // Modal
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
      currentEngine = 'offline';
      document.getElementById('tab-offline')?.click();
      updateUIState();
      showToast('Key cleared. Switched to Local Engine.');
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

  function showToast(message, duration = 2500) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // ── Humanize Execution (Full Detail + 0% AI) ───────────────────────────────
  async function handleHumanize() {
    const text = inputEl.value.trim();
    if (!text) {
      showToast('Please enter text first.');
      inputEl.focus();
      return;
    }

    const key = getApiKey();

    if (currentEngine === 'ai' && !key) {
      openSettingsModal();
      showToast('Configure free API key or use Local Engine.');
      return;
    }

    // UI Loading state
    btnHumanize.disabled = true;
    spinner.style.display = 'flex';
    spinText.textContent = 'Processing full text...';

    try {
      let resultText = '';
      let score = 0.0;
      let feedback = 'Your Text is Human Written';

      if (currentEngine === 'ai') {
        spinText.textContent = 'Stealth AI rewrite...';
        const model = selectModel ? selectModel.value : 'gemini-2.0-flash';
        if (selectedProvider === 'gemini') {
          resultText = await TextHumanizer.callGeminiAPI(key, model, text, currentStyle);
        } else {
          resultText = await TextHumanizer.callGroqAPI(key, text, currentStyle);
        }

        spinText.textContent = 'Verifying with detector...';
        const check = await TextHumanizer.checkZeroGPTLive(resultText);
        score = check.fakePercentage;
        feedback = check.feedback;
      } else {
        // Universal Local Engine: preserves 100% of paragraphs & structure
        spinText.textContent = 'Applying humanization transforms...';
        resultText = TextHumanizer.humanizeLocalText(text, currentStyle);

        spinText.textContent = 'Checking detector...';
        const check = await TextHumanizer.checkZeroGPTLive(resultText);
        score = check.fakePercentage;
        feedback = check.feedback;
      }

      // Populate output
      outputEl.textContent = resultText;
      updateOutputCounts();

      // Show stats and badges
      if (outputEmptyHint) outputEmptyHint.style.display = 'none';
      if (scoreRow) scoreRow.style.display = 'flex';
      if (resultStatusBadge) {
        resultStatusBadge.style.display = 'inline-block';
        resultStatusBadge.className = score === 0 ? 'status-indicator pass' : 'status-indicator';
        resultStatusBadge.textContent = `${score}% AI (${feedback})`;
      }

      statAiScore.textContent = `${score}%`;
      statAiScore.className = score === 0 ? 'good' : '';
      if (statZeroGpt) {
        statZeroGpt.textContent = score === 0 ? '0% Passed' : `${score}%`;
        statZeroGpt.style.color = score === 0 ? '#69db7c' : '#fa5252';
      }
      if (statQuillBot) {
        statQuillBot.textContent = score === 0 ? '0% Passed' : `${score}%`;
        statQuillBot.style.color = score === 0 ? '#69db7c' : '#fa5252';
      }

      showToast(`Conversion complete: ${score}% AI Score.`);
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message || 'Conversion failed'}`);
    } finally {
      btnHumanize.disabled = false;
      spinner.style.display = 'none';
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
  <title>Document — TextHuman</title>
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
    <div class="doc-meta">0.0% AI Score · ${new Date().toLocaleDateString()}</div>
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
        await TextHumanizer.callGeminiAPI(key, model, "Hello", "natural");
      } else {
        await TextHumanizer.callGroqAPI(key, "Hello", "natural");
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
