/**
 * app.js
 * Utilitarian Controller for TextHuman v2.0
 * 
 * Features:
 * - 100% Free default engine (runs locally in browser with ZERO API keys required)
 * - Multi-stage deterministic linguistic transformation pipeline
 * - Real-time Live ZeroGPT Detection API integration
 * - Content Anchor audit confirming 100% fact, date, and name retention
 * - Dual tone styling: Natural conversational vs Academic formal
 * - Optional custom API key support (Google Gemini / Groq) for power users
 * - Instant Copy and PDF Export
 */

(function () {
  'use strict';

  // ── Sample inputs (plain AI-style text to try the tool with) ──
  const SAMPLES = [
    {
      name: 'Effective Time Management',
      text: `Effective time management is essential for personal productivity and professional success. In today's fast-paced corporate environment, professionals frequently struggle with context switching and meeting sprawl, which drastically reduces deep work focus. Applying the Eisenhower Matrix helps knowledge workers distinguish between urgent tasks and important long-term deliverables. By establishing clear calendar defense mechanisms, individuals can prevent mental fatigue and maintain high output without burning out.`
    },
    {
      name: 'Python Programming Language',
      text: `Python is an interpreted, high-level, general-purpose programming language. Its design philosophy emphasizes code readability with the use of significant indentation. Python's language constructs and object-oriented approach aim to help programmers write clear, logical code for small and large-scale projects. Python is dynamically-typed and garbage-collected. It supports multiple programming paradigms, including structured, object-oriented and functional programming. It is widely used in data science, machine learning, and web development.`
    },
    {
      name: 'India Election (SIR)',
      text: `Recent protests in India have focused on the Election Commission's Special Intensive Revision (SIR) of electoral rolls, particularly concerns about the possible exclusion of eligible voters from voter lists. In October 2026, protests were held in cities including Delhi and Mumbai, with opposition parties, student groups and civil-society activists demanding greater transparency in the revision process and, in some cases, calling for the resignation of Chief Election Commissioner Gyanesh Kumar. Protesters argue that documentation requirements and changes to voter lists could disenfranchise legitimate voters, while the Election Commission maintains that SIR is intended to remove duplicate, deceased and otherwise ineligible entries and protect the accuracy of electoral rolls. The protests have also led to clashes and detentions in Delhi, making SIR an important ongoing debate about voter rights, electoral openness and the health of India's democratic institutions.`
    },
    {
      name: 'Renewable Energy & Climate',
      text: `The global transition toward renewable energy represents a critical milestone in combating climate change. Solar photovoltaic arrays and modern wind turbines now generate electricity at costs substantially lower than traditional fossil fuel power plants. Nevertheless, managing generation intermittency demands significant infrastructure investments in high-capacity battery storage and smart grid balancing solutions. Coordinated energy policies are essential to maintain stable grid frequency during peak consumption hours.`
    },
    {
      name: 'Remote Work & Modern Teams',
      text: `Remote work arrangements have fundamentally altered traditional corporate operations across knowledge industries. By eliminating lengthy daily commutes, distributed employees report higher schedule flexibility and improved work-life balance. However, organizations frequently encounter significant coordination friction, particularly regarding cross-time-zone synchronization and informal collaboration. Successful organizations adopt intentional communication protocols and hybrid scheduling models to preserve cohesive team culture.`
    },
    {
      name: 'Healthcare & Clinical AI',
      text: `Artificial intelligence is rapidly transforming modern clinical workflows and patient care. Advanced machine learning models assist radiologists in identifying early-stage tumors and subtle fractures with high diagnostic precision. Furthermore, predictive analytics allow healthcare institutions to anticipate patient readmission risks and allocate critical medical resources efficiently. However, integrating automated decision-support systems requires careful clinician oversight to ensure ethical compliance and patient safety.`
    },
    {
      name: 'Cybersecurity & Zero Trust',
      text: `Modern cybersecurity defense requires a proactive strategy to mitigate sophisticated adversarial threats across enterprise networks. Traditional perimeter security models are increasingly insufficient against credential theft, ransomware, and insider vulnerabilities. Consequently, organizations are adopting Zero Trust architectures that enforce continuous multi-factor authentication and strict least-privilege access controls. Regular employee awareness training remains vital to prevent social engineering attacks and phishing breaches.`
    },
    {
      name: 'Blockchain & Decentralized Ledgers',
      text: `Blockchain is a distributed ledger technology that records transactions across a decentralized network of computers in a verifiable and tamper-resistant manner. Instead of depending on a central authority like a bank or clearinghouse, consensus algorithms validate transfers and synchronize state across all network nodes. Cryptographic hashes chain each block of data to its predecessor, preventing retroactive alteration without network-wide consensus. While scalability and transaction costs remain active engineering challenges, decentralized networks provide clear audit trails for digital assets.`
    }
  ];
  let sampleIndex = 0;

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

  // Prompt Kit modal
  const modalPrompt        = document.getElementById('modal-prompt');
  const promptBox          = document.getElementById('prompt-box');
  const replyBox           = document.getElementById('reply-box');
  const btnFinishReply     = document.getElementById('btn-finish-reply');

  // ── State ───────────────────────────────────────────────────────────────────
  let currentEngine = 'prompt'; // 'prompt' (Prompt Kit) | 'local' | 'ai' (own key)
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

    // Default is Prompt Kit (no key required)
    currentEngine = 'prompt';
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
          showToast(currentEngine === 'prompt' ? 'Prompt Kit: get a prompt for your own AI chat. No key needed.' : 'Local Engine: instant and private, no key needed.');
        }
      });
    });

    // Input word count listener
    inputEl.addEventListener('input', updateInputCounts);

    // Sample text button (cycles through verified multi-detector samples)
    btnSample.addEventListener('click', () => {
      const s = SAMPLES[sampleIndex % SAMPLES.length];
      inputEl.value = s.text;
      sampleIndex++;
      updateInputCounts();
      showToast(`Loaded sample: ${s.name} (Click Convert to test)`);
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

    // Prompt Kit
    document.getElementById('btn-close-prompt').addEventListener('click', closePromptModal);
    modalPrompt.addEventListener('click', (e) => { if (e.target === modalPrompt) closePromptModal(); });
    document.getElementById('btn-copy-prompt').addEventListener('click', async () => { await copyText(promptBox.value); showToast('Prompt copied.'); });
    document.getElementById('btn-reroll-prompt').addEventListener('click', () => { renderPrompt(); showToast('New prompt variant generated.'); });
    document.getElementById('btn-copy-refine').addEventListener('click', async () => { await copyText(TextHumanizer.buildRefinePrompt(currentStyle)); showToast('2nd-pass prompt copied. Send it in the same chat.'); });
    document.querySelectorAll('[data-open-ai]').forEach(b => b.addEventListener('click', () => openAiChat(b.dataset.openAi)));
    btnFinishReply.addEventListener('click', handleFinishReply);

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
      if (e.key === 'Escape' && modalPrompt.classList.contains('active')) {
        closePromptModal();
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

  // ── Result Presentation (honest: shows real detector output or "Unverified") ──
  function setDetectorUI(zg) {
    const pct = zg && typeof zg.fakePercentage === 'number' ? zg.fakePercentage : null;

    if (statZeroGpt) {
      if (pct === null) {
        statZeroGpt.textContent = 'Unverified';
        statZeroGpt.className = 'warn';
        statZeroGpt.title = (zg && zg.feedback) || 'Detector unavailable';
      } else {
        statZeroGpt.textContent = `${pct.toFixed(1)}% AI`;
        statZeroGpt.className = pct <= 10 ? 'good' : '';
        statZeroGpt.title = zg.feedback || '';
      }
    }

    if (resultStatusBadge) {
      resultStatusBadge.style.display = 'inline-block';
      if (pct === null) {
        resultStatusBadge.className = 'status-indicator';
        resultStatusBadge.textContent = 'Not verified · test on a detector';
      } else if (pct <= 10) {
        resultStatusBadge.className = 'status-indicator pass';
        resultStatusBadge.textContent = `${pct.toFixed(1)}% AI · Looks Human`;
      } else if (pct <= 35) {
        resultStatusBadge.className = 'status-indicator pass';
        resultStatusBadge.textContent = `${pct.toFixed(1)}% AI · Mostly Human`;
      } else {
        resultStatusBadge.className = 'status-indicator';
        resultStatusBadge.textContent = `${pct.toFixed(1)}% AI · Try Re-roll / 2nd pass`;
      }
    }
  }

  async function presentResult(sourceText, resultText, engineName) {
    outputEl.textContent = resultText;
    updateOutputCounts();

    const missingAnchors = TextHumanizer.verifyAnchors(sourceText, resultText);
    const totalAnchors = TextHumanizer.collectAnchors(sourceText);

    if (outputEmptyHint) outputEmptyHint.style.display = 'none';
    if (scoreRow) scoreRow.style.display = 'flex';
    if (statEngine) statEngine.textContent = engineName;

    if (statFacts) {
      if (missingAnchors.length === 0) {
        statFacts.textContent = `100% (${totalAnchors.length} anchors)`;
        statFacts.className = 'good';
        statFacts.title = '';
      } else {
        statFacts.textContent = `${totalAnchors.length - missingAnchors.length}/${totalAnchors.length} retained`;
        statFacts.className = 'warn';
        statFacts.title = `Missing: ${missingAnchors.join(', ')}`;
      }
    }

    if (statZeroGpt) {
      statZeroGpt.textContent = 'Checking...';
      statZeroGpt.className = '';
    }
    spinText.textContent = 'Checking ZeroGPT live...';
    const zg = await TextHumanizer.checkZeroGPTLive(resultText);
    setDetectorUI(zg);
    return zg;
  }

  function detectorToast(zg) {
    return typeof zg.fakePercentage === 'number'
      ? `ZeroGPT: ${zg.fakePercentage.toFixed(1)}% AI`
      : 'Detector unreachable. Please test the text on ZeroGPT/GPTZero yourself.';
  }

  // ── Humanize Execution ──────────────────────────────────────────────────────
  async function handleHumanize() {
    const text = inputEl.value.trim();
    if (!text) {
      showToast('Please enter or paste text to humanize.');
      inputEl.focus();
      return;
    }

    // Prompt Kit: no network call, hand the user a ready-made prompt
    if (currentEngine === 'prompt') {
      openPromptModal(text);
      return;
    }

    const key = getApiKey();
    if (currentEngine === 'ai' && !key) {
      openSettingsModal();
      showToast('Paste an API key or switch to Prompt Kit / Local.');
      return;
    }

    btnHumanize.disabled = true;
    spinner.style.display = 'flex';
    spinText.textContent = 'Rewriting...';

    try {
      let resultText = '';
      let engineName = 'Local Engine';

      if (currentEngine === 'ai') {
        const model = selectModel ? selectModel.value : 'gemini-2.0-flash';
        engineName = selectedProvider === 'gemini' ? `Gemini (${model}) + polish` : 'Groq (Llama 3.3) + polish';
        const raw = selectedProvider === 'gemini'
          ? await TextHumanizer.callGeminiAPI(key, model, text, currentStyle)
          : await TextHumanizer.callGroqAPI(key, text, currentStyle);
        resultText = TextHumanizer.polishText(raw, currentStyle);
      } else {
        resultText = TextHumanizer.humanizeLocalText(text, currentStyle);
      }

      const zg = await presentResult(text, resultText, engineName);
      showToast(`Conversion complete · ${detectorToast(zg)}`, 4500);
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message || 'Transformation failed'}`);
    } finally {
      btnHumanize.disabled = false;
      spinner.style.display = 'none';
    }
  }

  // ── Prompt Kit ──────────────────────────────────────────────────────────────
  let promptSourceText = '';

  function renderPrompt() {
    promptBox.value = TextHumanizer.buildPrompt(promptSourceText, currentStyle);
  }

  function openPromptModal(text) {
    promptSourceText = text;
    renderPrompt();
    replyBox.value = '';
    modalPrompt.classList.add('active');
  }

  function closePromptModal() {
    modalPrompt.classList.remove('active');
  }

  async function copyText(str) {
    try {
      await navigator.clipboard.writeText(str);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = str;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  async function openAiChat(target) {
    const prompt = promptBox.value;
    await copyText(prompt);
    const q = encodeURIComponent(prompt);
    let url = 'https://gemini.google.com/app';
    if (target === 'chatgpt') url = q.length < 6000 ? `https://chatgpt.com/?q=${q}` : 'https://chatgpt.com/';
    if (target === 'claude') url = q.length < 6000 ? `https://claude.ai/new?q=${q}` : 'https://claude.ai/new';
    window.open(url, '_blank', 'noopener');
    showToast('Prompt copied. If the chat opens empty, just paste it.', 4000);
  }

  async function handleFinishReply() {
    const reply = replyBox.value.trim();
    if (!reply) {
      showToast("Paste the AI's reply first.");
      replyBox.focus();
      return;
    }

    btnFinishReply.disabled = true;
    closePromptModal();
    spinner.style.display = 'flex';
    spinText.textContent = 'Polishing...';

    try {
      const cleaned = TextHumanizer.cleanAIOutput(reply);
      const polished = TextHumanizer.polishText(cleaned, currentStyle);
      const zg = await presentResult(promptSourceText, polished, 'Prompt Kit + local polish');
      showToast(`Done · ${detectorToast(zg)}`, 4500);
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message || 'Polishing failed'}`);
    } finally {
      btnFinishReply.disabled = false;
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
      setDetectorUI(zg);
      showToast(detectorToast(zg), 4500);
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