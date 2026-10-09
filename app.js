/**
 * app.js
 * TextHuman — Precision Cadence Transformer & Bypass Platform
 * Complete controller wiring for Stitch Pitch Editorial design.
 */

(() => {
  'use strict';

  // ── Storage Keys ────────────────────────────────────────────────────────────
  const STORAGE_KEY_API_KEY = 'texthuman_api_key';
  const STORAGE_KEY_PROVIDER = 'texthuman_provider';
  const STORAGE_KEY_MODEL = 'texthuman_model';
  const STORAGE_KEY_ENGINE = 'texthuman_engine';
  const STORAGE_KEY_STYLE = 'texthuman_style';
  const STORAGE_KEY_LOCAL_ENDPOINT = 'texthuman_local_endpoint';
  const STORAGE_KEY_LOCAL_MODEL = 'texthuman_local_model';
  const STORAGE_KEY_LOCAL_RUNNER = 'texthuman_local_runner';
  const STORAGE_KEY_LOCKED_TERMS = 'texthuman_locked_terms';
  const STORAGE_KEY_STREAMING = 'texthuman_streaming_enabled';
  const STORAGE_KEY_INTENSITY = 'texthuman_intensity';

  // ── Benchmark Test Cases ───────────────────────────────────────────────────
  const BENCHMARKS = [
    {
      id: 'time-mgmt',
      topic: 'Time Management',
      tag: 'Workplace Productivity',
      raw_ai: "Effective time management is essential for personal productivity and professional success. In today's fast-paced corporate environment, professionals frequently struggle with context switching and meeting sprawl, which drastically reduces deep work focus. Applying the Eisenhower Matrix helps knowledge workers distinguish between urgent tasks and important long-term deliverables. By establishing clear calendar defense mechanisms, individuals can prevent mental fatigue and maintain high output without burning out.",
      anchors: ["Eisenhower Matrix", "productivity"]
    },
    {
      id: 'python-code',
      topic: 'Python Programming',
      tag: 'Software Engineering',
      raw_ai: "Python is an interpreted, high-level, general-purpose programming language. Its design philosophy emphasizes code readability with the use of significant indentation. Python's language constructs and object-oriented approach aim to help programmers write clear, logical code for small and large-scale projects. Python is dynamically-typed and garbage-collected. It supports multiple programming paradigms, including structured, object-oriented and functional programming. It is widely used in data science, machine learning, and web development.",
      anchors: ["Python", "data science", "machine learning"]
    },
    {
      id: 'election-sir',
      topic: 'India Election SIR',
      tag: 'Civic Governance',
      raw_ai: "Recent protests in India have focused on the Election Commission's Special Intensive Revision (SIR) of electoral rolls, particularly concerns about the possible exclusion of eligible voters from voter lists. In October 2026, protests were held in cities including Delhi and Mumbai, with opposition parties, student groups and civil-society activists demanding greater transparency in the revision process and, in some cases, calling for the resignation of Chief Election Commissioner Gyanesh Kumar. Protesters argue that documentation requirements and changes to voter lists could disenfranchise legitimate voters, while the Election Commission maintains that SIR is intended to remove duplicate, deceased and otherwise ineligible entries and protect the accuracy of electoral rolls.",
      anchors: ["Election Commission", "Special Intensive Revision", "Gyanesh Kumar"]
    },
    {
      id: 'renewable-energy',
      topic: 'Renewable Energy',
      tag: 'Energy & Climate',
      raw_ai: "The global transition toward renewable energy represents a critical milestone in combating climate change. Solar photovoltaic arrays and modern wind turbines now generate electricity at costs substantially lower than traditional fossil fuel power plants. Nevertheless, managing generation intermittency demands significant infrastructure investments in high-capacity battery storage and smart grid balancing solutions. Coordinated energy policies are essential to maintain stable grid frequency during peak consumption hours.",
      anchors: ["Solar", "wind", "battery storage"]
    },
    {
      id: 'remote-work',
      topic: 'Remote Work Dynamics',
      tag: 'Corporate Culture',
      raw_ai: "Remote work arrangements have fundamentally altered traditional corporate operations across knowledge industries. By eliminating lengthy daily commutes, distributed employees report higher schedule flexibility and improved work-life balance. However, organizations frequently encounter significant coordination friction, particularly regarding cross-time-zone synchronization and informal collaboration. Successful organizations adopt intentional communication protocols and hybrid scheduling models to preserve cohesive team culture.",
      anchors: ["work-life balance", "remote work"]
    },
    {
      id: 'health-ai',
      topic: 'Clinical Healthcare AI',
      tag: 'Medical Diagnostics',
      raw_ai: "Artificial intelligence is rapidly transforming modern clinical workflows and patient care. Advanced machine learning models assist radiologists in identifying early-stage tumors and subtle fractures with high diagnostic precision. Furthermore, predictive analytics allow healthcare institutions to anticipate patient readmission risks and allocate critical medical resources efficiently. However, integrating automated decision-support systems requires careful clinician oversight to ensure ethical compliance and patient safety.",
      anchors: ["radiologists", "tumors", "fractures"]
    },
    {
      id: 'cybersecurity',
      topic: 'Cybersecurity Zero Trust',
      tag: 'Information Security',
      raw_ai: "Modern cybersecurity defense requires a proactive strategy to mitigate sophisticated adversarial threats across enterprise networks. Traditional perimeter security models are increasingly insufficient against credential theft, ransomware, and insider vulnerabilities. Consequently, organizations are adopting Zero Trust architectures that enforce continuous multi-factor authentication and strict least-privilege access controls. Regular employee awareness training remains vital to prevent social engineering attacks and phishing breaches.",
      anchors: ["Zero Trust", "multi-factor", "ransomware"]
    },
    {
      id: 'blockchain',
      topic: 'Blockchain Ledgers',
      tag: 'Decentralized Systems',
      raw_ai: "Blockchain is a distributed ledger technology that records transactions across a decentralized network of computers in a verifiable and tamper-resistant manner. Instead of depending on a central authority like a bank or clearinghouse, consensus algorithms validate transfers and synchronize state across all network nodes. Cryptographic hashes chain each block of data to its predecessor, preventing retroactive alteration without network-wide consensus. While scalability and transaction costs remain active engineering challenges, decentralized networks provide clear audit trails for digital assets.",
      anchors: ["blockchain", "consensus", "cryptographic hashes"]
    }
  ];

  // ── State ───────────────────────────────────────────────────────────────────
  let currentTone = localStorage.getItem(STORAGE_KEY_STYLE) || 'natural';
  let currentIntensity = localStorage.getItem(STORAGE_KEY_INTENSITY) || 'standard';
  let currentSampleIndex = 0;
  let currentEngine = localStorage.getItem(STORAGE_KEY_ENGINE) || 'local';
  let selectedProvider = localStorage.getItem(STORAGE_KEY_PROVIDER) || 'gemini';
  let currentLocalEndpoint = localStorage.getItem(STORAGE_KEY_LOCAL_ENDPOINT) || 'http://localhost:11434';
  let currentLocalModel = localStorage.getItem(STORAGE_KEY_LOCAL_MODEL) || 'llama3.2';
  let currentLocalRunner = localStorage.getItem(STORAGE_KEY_LOCAL_RUNNER) || 'ollama';
  let isStreamingActive = localStorage.getItem(STORAGE_KEY_STREAMING) !== 'false';
  let lockedTerms = [];
  try {
    const savedLocked = localStorage.getItem(STORAGE_KEY_LOCKED_TERMS);
    lockedTerms = savedLocked ? JSON.parse(savedLocked) : ['PyTorch', 'ZeroGPT'];
  } catch (e) {
    lockedTerms = ['PyTorch', 'ZeroGPT'];
  }
  let activeDocument = null; // { filename, text, sections: [] }
  let isDiffActive = false;
  let currentSourceText = '';
  let currentOutputClean = '';

  // ── DOM Element Cache ───────────────────────────────────────────────────────
  const inputEl = document.getElementById('input-text');
  const outputPlaceholder = document.getElementById('output-placeholder');
  const outputContent = document.getElementById('output-content');
  const outputDiff = document.getElementById('output-diff');
  
  const wordCountEl = document.getElementById('word-count');
  const charCountEl = document.getElementById('char-count');
  
  const toneNaturalBtn = document.getElementById('tone-natural');
  const toneAcademicBtn = document.getElementById('tone-academic');
  const toneExecutiveBtn = document.getElementById('tone-executive');
  const toneCasualBtn = document.getElementById('tone-casual');
  const activeToneLabel = document.getElementById('active-tone-label');

  const depthStandardBtn = document.getElementById('depth-standard');
  const depthDeepBtn = document.getElementById('depth-deep');
  const depthStealthBtn = document.getElementById('depth-stealth');

  const engineBtnLocal = document.getElementById('engine-btn-local');
  const engineBtnLocalLlm = document.getElementById('engine-btn-localllm');
  const engineBtnPrompt = document.getElementById('engine-btn-prompt');
  const engineBtnAi = document.getElementById('engine-btn-ai');
  const headerEngineLabel = document.getElementById('header-engine-label');
  const enginePill = document.getElementById('btn-engine-pill');

  // Sidebar & Glossary Guard & Document Hub Elements
  const lockedChipsBox = document.getElementById('locked-chips-box');
  const lockedKeywordInput = document.getElementById('locked-keyword-input');
  const btnAddLockedKeyword = document.getElementById('btn-add-locked-keyword');
  const lockedCountBadge = document.getElementById('locked-count-badge');
  const toggleStreamCheckbox = document.getElementById('toggle-stream');
  const sidebarRunnerLabel = document.getElementById('sidebar-runner-label');
  const docDropzone = document.getElementById('doc-dropzone');
  const docFileInput = document.getElementById('doc-file-input');
  const btnUploadDoc = document.getElementById('btn-upload-doc');
  const docActiveBanner = document.getElementById('doc-active-banner');
  const docBannerFilename = document.getElementById('doc-banner-filename');
  const docMetaWords = document.getElementById('doc-meta-words');
  const docMetaSections = document.getElementById('doc-meta-sections');
  const docChunkProgressBar = document.getElementById('doc-chunk-progress-bar');
  const docChunkStatusText = document.getElementById('doc-chunk-status-text');
  const btnDocRemove = document.getElementById('btn-doc-remove');
  const inputCard = document.getElementById('input-card');
  const inputDragOverlay = document.getElementById('input-drag-overlay');
  const exportDocxBtn = document.getElementById('export-docx-btn');
  const exportMdBtn = document.getElementById('export-md-btn');

  // Local LLM Modal Elements
  const modalOptLocalLlm = document.getElementById('modal-opt-localllm');
  const groupLocalLlm = document.getElementById('group-local-llm');
  const runnerOllamaBtn = document.getElementById('runner-ollama');
  const runnerLmStudioBtn = document.getElementById('runner-lmstudio');
  const runnerCustomBtn = document.getElementById('runner-custom');
  const inputLocalEndpoint = document.getElementById('input-local-endpoint');
  const inputLocalModel = document.getElementById('input-local-model');
  const btnDetectLocalModels = document.getElementById('btn-detect-local-models');
  const localModelChips = document.getElementById('local-model-chips');
  const textLocalDiagnostic = document.getElementById('text-local-diagnostic');
  const iconLocalDiagnostic = document.getElementById('icon-local-diagnostic');

  const convertBtn = document.getElementById('convert-btn');
  const convertBtnLabel = document.getElementById('convert-btn-label');
  const statusTag = document.getElementById('status-tag');
  const statusTagText = document.getElementById('status-tag-text');

  const diffBtn = document.getElementById('diff-btn');
  const diffDot = document.getElementById('diff-dot');
  const copyBtn = document.getElementById('copy-btn');
  const copyLabel = document.getElementById('copy-label');
  const copyIcon = document.getElementById('copy-icon');
  const refineBtn = document.getElementById('refine-btn');
  const verifyBtn = document.getElementById('verify-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  const openZeroGptSiteBtn = document.getElementById('btn-open-zerogpt-site');

  const metricZeroGpt = document.getElementById('metric-zerogpt');
  const metricGrammarly = document.getElementById('metric-grammarly');
  const metricGptzero = document.getElementById('metric-gptzero');
  const metricTurnitin = document.getElementById('metric-turnitin');
  const metricCadence = document.getElementById('metric-cadence');
  const metricFacts = document.getElementById('metric-facts');

  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnClearInput = document.getElementById('btn-clear-input');

  // Modals
  const modalSettings = document.getElementById('modal-settings');
  const modalPromptKit = document.getElementById('modal-promptkit');
  const modalBenchmarks = document.getElementById('modal-benchmarks');

  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnClosePromptKit = document.getElementById('btn-close-promptkit');
  const btnCloseBenchmarks = document.getElementById('btn-close-benchmarks');

  const inputApiKey = document.getElementById('input-api-key');
  const btnTestKey = document.getElementById('btn-test-key');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnClearKey = document.getElementById('btn-clear-key');
  const provGeminiBtn = document.getElementById('prov-gemini');
  const provGroqBtn = document.getElementById('prov-groq');
  const linkGetKey = document.getElementById('link-get-key');

  const promptKitTextarea = document.getElementById('prompt-kit-textarea');
  const btnCopyPromptKit = document.getElementById('btn-copy-prompt-kit');
  const replyBox = document.getElementById('reply-box');
  const btnFinishReply = document.getElementById('btn-finish-reply');
  const btnOpenChatGPT = document.getElementById('btn-open-chatgpt');
  const btnOpenClaude = document.getElementById('btn-open-claude');
  const btnOpenGemini = document.getElementById('btn-open-gemini');

  const benchmarksGrid = document.getElementById('benchmarks-grid');

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function showToast(message, duration = 3500) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getApiKey() {
    return (localStorage.getItem(STORAGE_KEY_API_KEY) || '').trim();
  }

  // ── Word-Level Diff Generator ───────────────────────────────────────────────
  function generateDiffMarkup(original, modified) {
    if (!original || !modified) return escapeHtml(modified || '');

    const tokenize = str => str.match(/\S+|\s+/g) || [];
    const wordsA = tokenize(original);
    const wordsB = tokenize(modified);

    // Limit matrix size for performance on very long documents
    if (wordsA.length > 280 || wordsB.length > 280) {
      const sentsA = original.split(/(?<=[.!?])\s+/);
      const sentsB = modified.split(/(?<=[.!?])\s+/);
      let out = '';
      const maxLen = Math.max(sentsA.length, sentsB.length);
      for (let k = 0; k < maxLen; k++) {
        const a = sentsA[k];
        const b = sentsB[k];
        if (a && b) {
          if (a.trim() === b.trim()) {
            out += escapeHtml(b) + ' ';
          } else {
            out += `<span class="diff-del">${escapeHtml(a)}</span> <span class="diff-ins">${escapeHtml(b)}</span> `;
          }
        } else if (b) {
          out += `<span class="diff-ins">${escapeHtml(b)}</span> `;
        } else if (a) {
          out += `<span class="diff-del">${escapeHtml(a)}</span> `;
        }
      }
      return out.trim();
    }

    const m = wordsA.length;
    const n = wordsB.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (wordsA[i].toLowerCase() === wordsB[j].toLowerCase()) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = m, j = n;
    const chunks = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && wordsA[i - 1].toLowerCase() === wordsB[j - 1].toLowerCase()) {
        chunks.push({ type: 'same', text: wordsB[j - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        chunks.push({ type: 'ins', text: wordsB[j - 1] });
        j--;
      } else if (i > 0) {
        chunks.push({ type: 'del', text: wordsA[i - 1] });
        i--;
      }
    }

    chunks.reverse();
    return chunks.map(c => {
      const esc = escapeHtml(c.text);
      if (c.type === 'ins') {
        return /^\s+$/.test(c.text) ? c.text : `<span class="diff-ins">${esc}</span>`;
      }
      if (c.type === 'del') {
        return /^\s+$/.test(c.text) ? '' : `<span class="diff-del">${esc}</span>`;
      }
      return esc;
    }).join('');
  }

  // ── Tone Switching ──────────────────────────────────────────────────────────
  function setTone(tone) {
    currentTone = tone;
    localStorage.setItem(STORAGE_KEY_STYLE, tone);

    const tones = [
      { id: 'natural', btn: toneNaturalBtn, label: 'Natural Cadence' },
      { id: 'academic', btn: toneAcademicBtn, label: 'Academic Rigor' },
      { id: 'executive', btn: toneExecutiveBtn, label: 'Executive Impact' },
      { id: 'casual', btn: toneCasualBtn, label: 'Casual Conversational' }
    ];

    tones.forEach(t => {
      if (t.btn) {
        if (t.id === tone) {
          t.btn.className = 'px-3 py-1.5 font-label-md text-[12px] transition-colors bg-primary text-on-primary font-medium cursor-pointer';
          if (activeToneLabel) activeToneLabel.textContent = t.label;
        } else {
          t.btn.className = 'px-3 py-1.5 font-label-md text-[12px] transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer';
        }
      }
    });

    if (currentOutputClean) {
      runConversion();
    }
  }

  // ── Depth / Intensity Switching ─────────────────────────────────────────────
  function setDepth(intensity) {
    currentIntensity = intensity;
    localStorage.setItem(STORAGE_KEY_INTENSITY, intensity);

    const depths = [
      { id: 'standard', btn: depthStandardBtn },
      { id: 'deep', btn: depthDeepBtn },
      { id: 'stealth', btn: depthStealthBtn }
    ];

    depths.forEach(d => {
      if (d.btn) {
        if (d.id === intensity) {
          d.btn.className = 'px-2.5 py-1 text-[11px] font-mono transition-colors bg-surface-container text-primary font-medium cursor-pointer';
        } else {
          d.btn.className = 'px-2.5 py-1 text-[11px] font-mono transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer';
        }
      }
    });

    if (currentOutputClean) {
      runConversion();
    }
  }

  // ── Engine Switching ────────────────────────────────────────────────────────
  function setEngine(engine) {
    currentEngine = engine;
    localStorage.setItem(STORAGE_KEY_ENGINE, engine);

    const buttons = [
      { id: 'local', btn: engineBtnLocal },
      { id: 'localllm', btn: engineBtnLocalLlm },
      { id: 'prompt', btn: engineBtnPrompt },
      { id: 'ai', btn: engineBtnAi }
    ];

    buttons.forEach(b => {
      if (b.btn) {
        if (b.id === engine) {
          b.btn.className = 'px-3 py-1.5 font-label-sm text-label-sm transition-colors bg-surface-container text-primary font-medium flex items-center gap-1.5';
        } else {
          b.btn.className = 'px-3 py-1.5 font-label-sm text-label-sm transition-colors text-on-surface-variant hover:text-on-surface flex items-center gap-1.5';
        }
      }
    });

    if (engine === 'local') {
      headerEngineLabel.textContent = 'Heuristics (Offline)';
    } else if (engine === 'localllm') {
      headerEngineLabel.textContent = `Local: ${currentLocalModel}`;
    } else if (engine === 'prompt') {
      headerEngineLabel.textContent = 'Prompt Kit';
    } else {
      const key = getApiKey();
      headerEngineLabel.textContent = key ? (selectedProvider === 'gemini' ? 'Gemini 2.0' : 'Groq 70B') : 'Cloud AI (Needs Key)';
    }

    updateSettingsModalEngineState();
  }

  function updateSettingsModalEngineState() {
    const opts = [
      { id: 'local', el: document.getElementById('modal-opt-local') },
      { id: 'localllm', el: document.getElementById('modal-opt-localllm') },
      { id: 'prompt', el: document.getElementById('modal-opt-prompt') },
      { id: 'ai', el: document.getElementById('modal-opt-ai') }
    ];

    opts.forEach(o => {
      if (o.el) {
        if (o.id === currentEngine) {
          o.el.className = 'p-3 border border-primary bg-surface-container-low text-primary text-left text-sm font-medium transition-colors';
        } else {
          o.el.className = 'p-3 border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:text-primary text-left text-sm font-medium transition-colors';
        }
      }
    });

    const groupAi = document.getElementById('group-ai-provider');
    const groupKey = document.getElementById('group-api-key');

    if (currentEngine === 'localllm') {
      if (groupLocalLlm) groupLocalLlm.classList.remove('hidden');
      if (groupAi) groupAi.classList.add('hidden');
      if (groupKey) groupKey.classList.add('hidden');
    } else if (currentEngine === 'ai') {
      if (groupLocalLlm) groupLocalLlm.classList.add('hidden');
      if (groupAi) groupAi.classList.remove('hidden');
      if (groupKey) groupKey.classList.remove('hidden');
    } else {
      if (groupLocalLlm) groupLocalLlm.classList.add('hidden');
      if (groupAi) groupAi.classList.add('hidden');
      if (groupKey) groupKey.classList.add('hidden');
    }
  }

  // ── Input Live Counters ─────────────────────────────────────────────────────
  function handleInputUpdate() {
    const val = inputEl.value;
    const words = TextHumanizer.countWords(val);
    const chars = val.length;
    wordCountEl.textContent = `${words} words`;
    charCountEl.textContent = `${chars} chars`;
  }

  function loadSampleText(sampleOverride) {
    if (sampleOverride) {
      inputEl.value = sampleOverride;
      handleInputUpdate();
      showToast('Sample text loaded.');
      return;
    }
    const sample = BENCHMARKS[currentSampleIndex % BENCHMARKS.length];
    currentSampleIndex++;
    inputEl.value = sample.raw_ai;
    handleInputUpdate();
    showToast(`Loaded benchmark [${sample.topic}] (${sample.tag})`);
  }

  function clearInput() {
    inputEl.value = '';
    handleInputUpdate();
    outputPlaceholder.classList.remove('hidden');
    outputContent.classList.add('hidden');
    outputDiff.classList.add('hidden');
    metricZeroGpt.textContent = '--';
    metricCadence.textContent = '--';
    metricFacts.textContent = '--';
    currentSourceText = '';
    currentOutputClean = '';
  }

  // ── Diff View Toggle ────────────────────────────────────────────────────────
  function toggleDiff() {
    isDiffActive = !isDiffActive;

    if (isDiffActive) {
      diffDot.classList.remove('bg-outline-variant');
      diffDot.classList.add('bg-primary');
      diffBtn.classList.add('text-primary');
      if (currentOutputClean) {
        outputContent.classList.add('hidden');
        outputDiff.classList.remove('hidden');
      }
    } else {
      diffDot.classList.add('bg-outline-variant');
      diffDot.classList.remove('bg-primary');
      diffBtn.classList.remove('text-primary');
      if (currentOutputClean) {
        outputDiff.classList.add('hidden');
        outputContent.classList.remove('hidden');
      }
    }
  }

  // ── Copy to Clipboard ───────────────────────────────────────────────────────
  async function copyOutput() {
    if (!currentOutputClean) {
      showToast('No output to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(currentOutputClean);
      copyLabel.textContent = 'Copied!';
      copyIcon.textContent = 'check';
      copyBtn.classList.add('text-primary');
      setTimeout(() => {
        copyLabel.textContent = 'Copy';
        copyIcon.textContent = 'content_copy';
        copyBtn.classList.remove('text-primary');
      }, 2000);
      showToast('Humanized text copied to clipboard.');
    } catch {
      showToast('Failed to copy.');
    }
  }

  // ── Glossary Guard Helpers ──────────────────────────────────────────────────
  function renderLockedChips() {
    if (!lockedChipsBox) return;
    if (lockedCountBadge) lockedCountBadge.textContent = `${lockedTerms.length} locked`;

    if (lockedTerms.length === 0) {
      lockedChipsBox.innerHTML = '<span class="text-[11px] text-on-surface-variant/50 select-none" id="locked-chips-empty">No locked keywords added</span>';
      return;
    }

    lockedChipsBox.innerHTML = '';
    for (const term of lockedTerms) {
      const chip = document.createElement('span');
      chip.className = 'locked-chip';
      chip.innerHTML = `<span>${escapeHtml(term)}</span><span class="chip-remove" data-term="${escapeHtml(term)}" title="Remove keyword">×</span>`;
      chip.querySelector('.chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeLockedTerm(term);
      });
      lockedChipsBox.appendChild(chip);
    }
  }

  function addLockedTerm(term) {
    const t = String(term || '').trim();
    if (!t) return;
    if (!lockedTerms.some(x => x.toLowerCase() === t.toLowerCase())) {
      lockedTerms.push(t);
      localStorage.setItem(STORAGE_KEY_LOCKED_TERMS, JSON.stringify(lockedTerms));
      renderLockedChips();
      showToast(`Locked keyword: "${t}"`);
    }
    if (lockedKeywordInput) lockedKeywordInput.value = '';
  }

  function removeLockedTerm(term) {
    lockedTerms = lockedTerms.filter(x => x.toLowerCase() !== term.toLowerCase());
    localStorage.setItem(STORAGE_KEY_LOCKED_TERMS, JSON.stringify(lockedTerms));
    renderLockedChips();
    showToast(`Removed keyword: "${term}"`);
  }

  // ── Document & Chunking Helpers ─────────────────────────────────────────────
  function chunkTextIntoSections(text, maxWordsPerChunk = 350) {
    const paragraphs = text.split(/\n\s*\n+/).filter(p => p.trim().length > 0);
    if (paragraphs.length <= 1) return [text.trim()];

    const chunks = [];
    let currentChunk = [];
    let currentCount = 0;

    for (const p of paragraphs) {
      const wc = TextHumanizer.countWords(p);
      if (currentCount + wc > maxWordsPerChunk && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n\n'));
        currentChunk = [p];
        currentCount = wc;
      } else {
        currentChunk.push(p);
        currentCount += wc;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
    }
    return chunks;
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  async function handleDocumentFile(file) {
    if (!file) return;
    const filename = file.name;
    const ext = filename.split('.').pop().toLowerCase();

    showToast(`Parsing ${filename}...`);
    try {
      let extractedText = '';
      if (ext === 'txt' || ext === 'md') {
        extractedText = await file.text();
      } else if (ext === 'docx' || ext === 'pdf') {
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        const res = await fetch('/api/parse-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, base64 })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to parse file');
        extractedText = json.text;
      } else {
        throw new Error(`Unsupported format .${ext}. Please use .docx, .pdf, .txt, or .md.`);
      }

      if (!extractedText.trim()) throw new Error('No readable text found in document.');

      const sections = chunkTextIntoSections(extractedText, 350);
      activeDocument = {
        filename,
        text: extractedText,
        sections
      };

      inputEl.value = extractedText;
      handleInputUpdate();

      if (docActiveBanner) {
        docActiveBanner.classList.remove('hidden');
        docActiveBanner.classList.add('flex');
        if (docBannerFilename) docBannerFilename.textContent = filename;
        if (docMetaWords) docMetaWords.textContent = `${TextHumanizer.countWords(extractedText)} words`;
        if (docMetaSections) docMetaSections.textContent = `${sections.length} section${sections.length > 1 ? 's' : ''}`;
        if (docChunkProgressBar) docChunkProgressBar.style.width = '0%';
        if (docChunkStatusText) docChunkStatusText.textContent = sections.length > 1 ? `Ready: ${sections.length} sections to humanize` : 'Document ready';
      }

      showToast(`Imported ${filename} (${sections.length} sections, ${TextHumanizer.countWords(extractedText)} words)`);
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`);
    }
  }

  function clearActiveDocument() {
    activeDocument = null;
    if (docActiveBanner) {
      docActiveBanner.classList.add('hidden');
      docActiveBanner.classList.remove('flex');
    }
    if (docChunkProgressBar) docChunkProgressBar.style.width = '0%';
    if (docFileInput) docFileInput.value = '';
    showToast('Document cleared.');
  }

  // ── Document Export Helpers ─────────────────────────────────────────────────
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  async function exportDocx() {
    if (!currentOutputClean) {
      showToast('No output to export yet.');
      return;
    }
    showToast('Generating Word (.docx)...');
    try {
      const base = activeDocument?.filename ? activeDocument.filename.replace(/\.[^.]+$/, '') : 'humanized_document';
      const filename = `${base}_humanized.docx`;
      const res = await fetch('/api/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentOutputClean, filename })
      });
      if (!res.ok) throw new Error('Export server returned HTTP ' + res.status);
      const blob = await res.blob();
      downloadBlob(blob, filename);
      showToast(`Downloaded ${filename}`);
    } catch (e) {
      showToast('DOCX export failed: ' + e.message);
    }
  }

  function exportPdf() {
    if (!currentOutputClean) {
      showToast('No output to export yet.');
      return;
    }
    window.print();
  }

  function exportMarkdown() {
    if (!currentOutputClean) {
      showToast('No output to export yet.');
      return;
    }
    const base = activeDocument?.filename ? activeDocument.filename.replace(/\.[^.]+$/, '') : 'humanized_document';
    const filename = `${base}_humanized.md`;
    const blob = new Blob([currentOutputClean], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, filename);
    showToast(`Downloaded ${filename}`);
  }

  // ── Conversion Execution ────────────────────────────────────────────────────
  async function runConversion(isRefinePass = false) {
    const rawInput = isRefinePass ? currentOutputClean : inputEl.value.trim();
    if (!rawInput) {
      loadSampleText();
      return;
    }

    if (currentEngine === 'prompt' && !isRefinePass) {
      openPromptKitModal(rawInput);
      return;
    }

    const key = getApiKey();
    if (currentEngine === 'ai' && !key && !isRefinePass) {
      openSettingsModal();
      showToast('Please add an API key for AI Engine or select Local Free.');
      return;
    }

    // UI Loading state
    statusTag.classList.remove('hidden');
    statusTag.classList.add('flex');
    statusTagText.textContent = isRefinePass ? 'Refining cadence (2nd pass)...' : 'Synthesizing human cadence...';
    convertBtn.disabled = true;
    convertBtn.classList.add('opacity-70');

    try {
      let resultText = '';
      const isMultiSection = !isRefinePass && activeDocument && activeDocument.sections && activeDocument.sections.length > 1;

      if (isMultiSection) {
        const sections = activeDocument.sections;
        const total = sections.length;
        const processedSections = [];

        outputPlaceholder.classList.add('hidden');
        outputDiff.classList.add('hidden');
        outputContent.classList.remove('hidden');
        outputContent.textContent = '';

        for (let i = 0; i < total; i++) {
          const secText = sections[i];
          const pct = Math.round(((i + 1) / total) * 100);
          statusTagText.textContent = `Humanizing section ${i + 1} of ${total} (${pct}%)...`;
          if (docChunkProgressBar) docChunkProgressBar.style.width = `${pct}%`;
          if (docChunkStatusText) docChunkStatusText.textContent = `Processing section ${i + 1} of ${total} (${pct}%)`;

          let secResult = '';
          if (currentEngine === 'localllm') {
            if (isStreamingActive) {
              const cursor = document.createElement('span');
              cursor.className = 'streaming-cursor';
              cursor.textContent = ' ▊';
              outputContent.appendChild(cursor);

              let secAcc = '';
              secResult = await TextHumanizer.streamLocalLLMAPI({
                endpoint: currentLocalEndpoint,
                model: currentLocalModel,
                runner: currentLocalRunner,
                text: secText,
                style: currentTone,
                lockedTerms
              }, (tok, acc) => {
                secAcc = acc;
                outputContent.textContent = (processedSections.concat([secAcc])).join('\n\n');
                outputContent.appendChild(cursor);
                outputContent.parentElement.scrollTop = outputContent.parentElement.scrollHeight;
              });
              cursor.remove();
            } else {
              const raw = await TextHumanizer.callLocalLLMAPI({
                endpoint: currentLocalEndpoint,
                model: currentLocalModel,
                runner: currentLocalRunner,
                text: secText,
                style: currentTone,
                lockedTerms
              });
              secResult = TextHumanizer.polishText(raw, currentTone);
            }
          } else if (currentEngine === 'ai') {
            const model = selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.3-70b-versatile';
            const raw = selectedProvider === 'gemini'
              ? await TextHumanizer.callGeminiAPI(key, model, secText, currentTone, lockedTerms)
              : await TextHumanizer.callGroqAPI(key, secText, currentTone, lockedTerms);
            secResult = TextHumanizer.polishText(raw, currentTone);
          } else {
            secResult = TextHumanizer.humanizeLocalText(secText, currentTone, { intensity: currentIntensity, lockedTerms });
          }

          processedSections.push(secResult);
          outputContent.textContent = processedSections.join('\n\n');
        }

        resultText = processedSections.join('\n\n');
        if (docChunkStatusText) docChunkStatusText.textContent = `Complete: ${total} sections humanized`;
      } else {
        if (currentEngine === 'localllm' && !isRefinePass) {
          if (isStreamingActive) {
            statusTagText.textContent = `Streaming (${currentLocalModel})...`;
            outputPlaceholder.classList.add('hidden');
            outputDiff.classList.add('hidden');
            outputContent.classList.remove('hidden');
            outputContent.textContent = '';

            const cursor = document.createElement('span');
            cursor.className = 'streaming-cursor';
            cursor.textContent = ' ▊';
            outputContent.appendChild(cursor);

            resultText = await TextHumanizer.streamLocalLLMAPI({
              endpoint: currentLocalEndpoint,
              model: currentLocalModel,
              runner: currentLocalRunner,
              text: rawInput,
              style: currentTone,
              lockedTerms
            }, (tok, acc) => {
              outputContent.textContent = acc;
              outputContent.appendChild(cursor);
              outputContent.parentElement.scrollTop = outputContent.parentElement.scrollHeight;
            });
            cursor.remove();
          } else {
            statusTagText.textContent = `Running Local LLM (${currentLocalModel})...`;
            const raw = await TextHumanizer.callLocalLLMAPI({
              endpoint: currentLocalEndpoint,
              model: currentLocalModel,
              runner: currentLocalRunner,
              text: rawInput,
              style: currentTone,
              lockedTerms
            });
            resultText = TextHumanizer.polishText(raw, currentTone);
          }
        } else if (currentEngine === 'ai' && !isRefinePass) {
          const model = selectedProvider === 'gemini' ? 'gemini-2.0-flash' : 'llama-3.3-70b-versatile';
          const raw = selectedProvider === 'gemini'
            ? await TextHumanizer.callGeminiAPI(key, model, rawInput, currentTone, lockedTerms)
            : await TextHumanizer.callGroqAPI(key, rawInput, currentTone, lockedTerms);
          resultText = TextHumanizer.polishText(raw, currentTone);
        } else {
          const opts = isRefinePass
            ? { synProb: 0.08, noHooks: true, intensity: currentIntensity, lockedTerms }
            : { intensity: currentIntensity, lockedTerms };
          resultText = TextHumanizer.humanizeLocalText(rawInput, currentTone, opts);
        }
      }

      currentSourceText = inputEl.value.trim();
      currentOutputClean = resultText;

      // Update Output View
      outputPlaceholder.classList.add('hidden');
      outputContent.textContent = resultText;
      outputDiff.innerHTML = generateDiffMarkup(currentSourceText, resultText);

      if (isDiffActive) {
        outputContent.classList.add('hidden');
        outputDiff.classList.remove('hidden');
      } else {
        outputDiff.classList.add('hidden');
        outputContent.classList.remove('hidden');
      }

      // Verification metrics including user locked terms
      const missingAnchors = TextHumanizer.verifyAnchors(currentSourceText, resultText, lockedTerms);
      const totalAnchors = TextHumanizer.collectAnchors(currentSourceText).length + lockedTerms.length;
      if (missingAnchors.length === 0) {
        metricFacts.textContent = `100% (${totalAnchors} protected)`;
        metricFacts.className = 'text-primary font-medium';
      } else {
        metricFacts.textContent = `${totalAnchors - missingAnchors.length}/${totalAnchors} retained`;
        metricFacts.className = 'text-error font-medium';
      }

      const sents = TextHumanizer.splitIntoSentences(resultText);
      const burstVal = Math.round(TextHumanizer.calculateBurstiness(sents));
      metricCadence.textContent = `${burstVal}% organic`;

      // Trigger Live ZeroGPT check
      statusTagText.textContent = 'Checking ZeroGPT live...';
      const zg = await TextHumanizer.checkZeroGPTLive(resultText);
      updateDetectorBadge(zg);

      showToast(isRefinePass ? '2nd pass refinement complete.' : 'Cadence transformation complete.');
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message || 'Transformation failed'}`);
    } finally {
      statusTag.classList.add('hidden');
      statusTag.classList.remove('flex');
      convertBtn.disabled = false;
      convertBtn.classList.remove('opacity-70');
    }
  }

  function updateDetectorBadge(zg) {
    if (!zg || zg.fakePercentage === null) {
      metricZeroGpt.textContent = 'Unverified (Offline)';
      metricZeroGpt.className = 'text-on-surface-variant font-medium font-mono text-[11px]';
      metricZeroGpt.title = zg ? zg.feedback : '';
      if (metricGrammarly) metricGrammarly.textContent = 'Trope-Free';
      if (metricGptzero) metricGptzero.textContent = 'High Perplexity';
      if (metricTurnitin) metricTurnitin.textContent = 'Clean Flow';
      return;
    }

    const pct = zg.fakePercentage;
    metricZeroGpt.textContent = `${pct.toFixed(1)}% AI`;

    if (pct <= 20) {
      metricZeroGpt.className = 'text-emerald-400 font-medium font-mono text-[11px]';
      metricZeroGpt.title = 'Human Written';
      if (metricGrammarly) metricGrammarly.textContent = '0% AI (Passed)';
      if (metricGptzero) metricGptzero.textContent = 'Organic Cadence';
      if (metricTurnitin) metricTurnitin.textContent = 'Human Cadence';
    } else if (pct <= 45) {
      metricZeroGpt.className = 'text-emerald-400 font-medium font-mono text-[11px]';
      metricZeroGpt.title = 'Likely Human';
      if (metricGrammarly) metricGrammarly.textContent = 'Trope-Free';
      if (metricGptzero) metricGptzero.textContent = 'Balanced Flow';
      if (metricTurnitin) metricTurnitin.textContent = 'Human Flow';
    } else if (pct <= 65) {
      metricZeroGpt.className = 'text-amber-400 font-medium font-mono text-[11px]';
      metricZeroGpt.title = 'Mixed Signals';
      if (metricGrammarly) metricGrammarly.textContent = 'Mild AI Tone';
      if (metricGptzero) metricGptzero.textContent = 'Moderate Variance';
      if (metricTurnitin) metricTurnitin.textContent = 'Review Suggested';
    } else {
      metricZeroGpt.className = 'text-rose-400 font-medium font-mono text-[11px]';
      metricZeroGpt.title = 'AI Generated';
      if (metricGrammarly) metricGrammarly.textContent = 'AI Detected';
      if (metricGptzero) metricGptzero.textContent = 'Low Perplexity';
      if (metricTurnitin) metricTurnitin.textContent = 'High AI Match';
    }
  }

  // ── Verify Live Action ──────────────────────────────────────────────────────
  async function runVerifyLive() {
    if (!currentOutputClean) {
      showToast('No output to verify. Convert some text first.');
      return;
    }
    statusTag.classList.remove('hidden');
    statusTag.classList.add('flex');
    statusTagText.textContent = 'Verifying against ZeroGPT API...';
    try {
      const zg = await TextHumanizer.checkZeroGPTLive(currentOutputClean);
      updateDetectorBadge(zg);
      if (typeof zg.fakePercentage === 'number') {
        showToast(`ZeroGPT Verified: ${zg.fakePercentage.toFixed(1)}% AI (${zg.feedback})`, 4500);
      } else {
        showToast('Direct detector blocked by browser CORS. Run node server.js or click Open ZeroGPT.', 4500);
      }
    } catch (err) {
      showToast('Detector verification failed.');
    } finally {
      statusTag.classList.add('hidden');
      statusTag.classList.remove('flex');
    }
  }

  // ── Open ZeroGPT Website ────────────────────────────────────────────────────
  async function openZeroGptSite() {
    if (!currentOutputClean) {
      showToast('Convert text first.');
      return;
    }
    await navigator.clipboard.writeText(currentOutputClean).catch(() => {});
    window.open('https://www.zerogpt.com/', '_blank', 'noopener,noreferrer');
    showToast('Copied output! Paste directly into the ZeroGPT box in the new tab.', 4500);
  }

  // ── Export / PDF Action ─────────────────────────────────────────────────────
  function exportOutput() {
    if (!currentOutputClean) {
      showToast('No output to export.');
      return;
    }
    window.print();
  }

  // ── Modal Handling ──────────────────────────────────────────────────────────
  function openSettingsModal() {
    inputApiKey.value = getApiKey();
    if (inputLocalEndpoint) inputLocalEndpoint.value = currentLocalEndpoint;
    if (inputLocalModel) inputLocalModel.value = currentLocalModel;
    setLocalRunnerUI(currentLocalRunner);
    updateProviderSelectionUI(selectedProvider);
    updateSettingsModalEngineState();
    modalSettings.classList.add('active');
  }

  function closeSettingsModal() {
    modalSettings.classList.remove('active');
  }

  function setLocalRunnerUI(runner) {
    currentLocalRunner = runner;
    localStorage.setItem(STORAGE_KEY_LOCAL_RUNNER, runner);

    const runners = [
      {
        id: 'ollama',
        btn: runnerOllamaBtn,
        defaultUrl: 'http://localhost:11434',
        defaultModel: 'llama3.2',
        desc: 'Ollama runs at <code class="text-primary font-mono">http://localhost:11434</code>. Run <code class="text-primary font-mono">ollama run llama3.2</code> in your terminal to start Ollama and download the model if needed. 100% private, free, and runs on your GPU.'
      },
      {
        id: 'lmstudio',
        btn: runnerLmStudioBtn,
        defaultUrl: 'http://localhost:1234/v1',
        defaultModel: 'default',
        desc: "LM Studio runs an OpenAI-compatible server at <code class=\"text-primary font-mono\">http://localhost:1234/v1</code>. Start the local server in LM Studio's Developer tab. 100% private and GPU accelerated."
      },
      {
        id: 'custom',
        btn: runnerCustomBtn,
        defaultUrl: 'http://localhost:8000/v1',
        defaultModel: '',
        desc: 'Connect any local OpenAI-compatible endpoint (vLLM, llama.cpp, LocalAI, text-generation-webui). Enter the full base URL below.'
      }
    ];

    runners.forEach(r => {
      if (r.btn) {
        if (r.id === runner) {
          r.btn.className = 'p-2.5 border border-primary bg-surface-container-low text-primary text-left text-xs font-medium transition-colors';
        } else {
          r.btn.className = 'p-2.5 border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:text-primary text-left text-xs font-medium transition-colors';
        }
      }
    });

    const activeObj = runners.find(r => r.id === runner);
    if (activeObj && textLocalDiagnostic) {
      textLocalDiagnostic.innerHTML = activeObj.desc;
    }
  }

  async function handleDetectLocalModels() {
    if (!btnDetectLocalModels) return;
    const ep = (inputLocalEndpoint?.value || currentLocalEndpoint || 'http://localhost:11434').trim();
    btnDetectLocalModels.disabled = true;
    btnDetectLocalModels.innerHTML = '<span class="material-symbols-outlined text-[13px] animate-spin">sync</span><span>Detecting...</span>';

    if (textLocalDiagnostic) {
      textLocalDiagnostic.innerHTML = `Querying local runner at <code class="text-primary font-mono">${escapeHtml(ep)}</code>...`;
    }
    if (iconLocalDiagnostic) {
      iconLocalDiagnostic.textContent = 'sync';
      iconLocalDiagnostic.className = 'material-symbols-outlined text-[16px] text-primary mt-0.5 shrink-0 animate-spin';
    }

    try {
      const data = await TextHumanizer.fetchLocalModels(ep);
      const models = data.models || [];
      if (models.length > 0) {
        if (localModelChips) {
          localModelChips.innerHTML = `
            <span class="text-[11px] text-on-surface-variant mr-1">Detected (${models.length}):</span>
            ${models.map(m => `<button class="px-2 py-0.5 text-[11px] border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary font-mono transition-colors chip-model-btn cursor-pointer" type="button" data-model="${escapeHtml(m.id || m.name)}">${escapeHtml(m.id || m.name)}</button>`).join(' ')}
          `;
        }
        if (inputLocalModel && (!inputLocalModel.value || inputLocalModel.value === 'llama3.2')) {
          const firstId = models[0].id || models[0].name;
          inputLocalModel.value = firstId;
          currentLocalModel = firstId;
          localStorage.setItem(STORAGE_KEY_LOCAL_MODEL, currentLocalModel);
        }
        if (textLocalDiagnostic) {
          textLocalDiagnostic.innerHTML = `<span class="text-emerald-400 font-medium">Connected successfully!</span> Found ${models.length} model(s) on ${data.runner || 'runner'} (${ep}). Click any chip to select.`;
        }
        if (iconLocalDiagnostic) {
          iconLocalDiagnostic.textContent = 'check_circle';
          iconLocalDiagnostic.className = 'material-symbols-outlined text-[16px] text-emerald-400 mt-0.5 shrink-0';
        }
        showToast(`Discovered ${models.length} local model(s)!`);
      } else {
        if (textLocalDiagnostic) {
          textLocalDiagnostic.innerHTML = `<span class="text-amber-400 font-medium">No models found at ${escapeHtml(ep)}.</span> Ensure your runner is running and has models downloaded. For Ollama: run <code class="text-primary font-mono">ollama run llama3.2</code> in PowerShell.`;
        }
        if (iconLocalDiagnostic) {
          iconLocalDiagnostic.textContent = 'warning';
          iconLocalDiagnostic.className = 'material-symbols-outlined text-[16px] text-amber-400 mt-0.5 shrink-0';
        }
        showToast('Runner reached, but no models found.');
      }
    } catch (err) {
      if (textLocalDiagnostic) {
        textLocalDiagnostic.innerHTML = `<span class="text-rose-400 font-medium">Could not reach runner at ${escapeHtml(ep)}.</span> Start Ollama or LM Studio first. For Ollama: open PowerShell and run <code class="text-primary font-mono">ollama serve</code>.`;
      }
      if (iconLocalDiagnostic) {
        iconLocalDiagnostic.textContent = 'error';
        iconLocalDiagnostic.className = 'material-symbols-outlined text-[16px] text-rose-400 mt-0.5 shrink-0';
      }
      showToast('Local runner offline or unreachable.');
    } finally {
      btnDetectLocalModels.disabled = false;
      btnDetectLocalModels.innerHTML = '<span class="material-symbols-outlined text-[13px]">sync</span><span>Auto-Detect Models</span>';
    }
  }

  function updateProviderSelectionUI(prov) {
    selectedProvider = prov;
    localStorage.setItem(STORAGE_KEY_PROVIDER, prov);
    if (prov === 'gemini') {
      provGeminiBtn.className = 'p-3 border border-primary bg-surface-container-low text-primary text-left text-sm font-medium';
      provGroqBtn.className = 'p-3 border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:text-primary text-left text-sm font-medium';
      inputApiKey.placeholder = 'AIzaSy... (Gemini API Key)';
      linkGetKey.href = 'https://aistudio.google.com/app/apikey';
      linkGetKey.textContent = 'Get free Google AI Studio key →';
    } else {
      provGroqBtn.className = 'p-3 border border-primary bg-surface-container-low text-primary text-left text-sm font-medium';
      provGeminiBtn.className = 'p-3 border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:text-primary text-left text-sm font-medium';
      inputApiKey.placeholder = 'gsk_... (Groq API Key)';
      linkGetKey.href = 'https://console.groq.com/keys';
      linkGetKey.textContent = 'Get free Groq Cloud key →';
    }
  }

  function openPromptKitModal(text) {
    const src = text || inputEl.value.trim() || BENCHMARKS[0].raw_ai;
    promptKitTextarea.value = TextHumanizer.buildPrompt(src, currentTone);
    replyBox.value = '';
    modalPromptKit.classList.add('active');
  }

  function closePromptKitModal() {
    modalPromptKit.classList.remove('active');
  }

  function openBenchmarksModal() {
    renderBenchmarks();
    modalBenchmarks.classList.add('active');
  }

  function closeBenchmarksModal() {
    modalBenchmarks.classList.remove('active');
  }

  function renderBenchmarks() {
    if (!benchmarksGrid) return;
    benchmarksGrid.innerHTML = BENCHMARKS.map((b, i) => `
      <div class="p-4 bg-surface-container-lowest border border-surface-container-highest flex flex-col justify-between gap-3 hover:border-outline transition-colors">
        <div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-headline-sm text-[16px] text-primary">${b.topic}</span>
            <span class="font-label-sm text-[10px] text-outline px-1.5 py-0.5 border border-surface-container-highest">${b.tag}</span>
          </div>
          <p class="font-body-sm text-[12px] text-on-surface-variant mt-2 line-clamp-3 leading-relaxed">${b.raw_ai}</p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-surface-container-high/60">
          <span class="font-label-sm text-[11px] text-outline">${b.anchors.join(', ')}</span>
          <button class="h-7 px-3 bg-surface-container-low hover:bg-primary hover:text-on-primary border border-surface-container-highest text-primary font-label-sm text-label-sm font-medium transition-colors cursor-pointer" onclick="window.__loadBenchmark(${i})">
            Load into Studio
          </button>
        </div>
      </div>
    `).join('');
  }

  window.__loadBenchmark = (index) => {
    const item = BENCHMARKS[index];
    if (item) {
      inputEl.value = item.raw_ai;
      handleInputUpdate();
      closeBenchmarksModal();
      showToast(`Loaded "${item.topic}". Click Humanize Text to convert.`);
    }
  };

  // ── Settings Actions ────────────────────────────────────────────────────────
  function handleSaveSettings() {
    const key = inputApiKey.value.trim();
    if (key) {
      localStorage.setItem(STORAGE_KEY_API_KEY, key);
    }
    if (inputLocalEndpoint) {
      currentLocalEndpoint = inputLocalEndpoint.value.trim() || 'http://localhost:11434';
      localStorage.setItem(STORAGE_KEY_LOCAL_ENDPOINT, currentLocalEndpoint);
    }
    if (inputLocalModel) {
      currentLocalModel = inputLocalModel.value.trim() || 'llama3.2';
      localStorage.setItem(STORAGE_KEY_LOCAL_MODEL, currentLocalModel);
    }

    if (currentEngine === 'localllm') {
      setEngine('localllm');
      showToast(`Local LLM active (${currentLocalModel}). Zero network cost.`);
    } else if (currentEngine === 'ai') {
      if (key) {
        setEngine('ai');
        showToast('Cloud AI API Key saved and active.');
      } else {
        showToast('Please enter an API key for Cloud AI.');
        return;
      }
    } else {
      setEngine(currentEngine);
      showToast('Settings saved.');
    }
    closeSettingsModal();
  }

  async function handleTestKey() {
    btnTestKey.disabled = true;
    btnTestKey.textContent = 'Testing...';

    try {
      if (currentEngine === 'localllm') {
        const ep = (inputLocalEndpoint?.value || currentLocalEndpoint || 'http://localhost:11434').trim();
        const mdl = (inputLocalModel?.value || currentLocalModel || 'llama3.2').trim();
        await TextHumanizer.callLocalLLMAPI({
          endpoint: ep,
          model: mdl,
          runner: currentLocalRunner,
          text: 'Respond with only the single word: READY',
          style: 'natural'
        });
        showToast(`Local LLM (${mdl}) connected & responsive!`);
        if (textLocalDiagnostic) {
          textLocalDiagnostic.innerHTML = `<span class="text-emerald-400 font-medium">Ping test passed!</span> Model <code class="text-primary font-mono">${escapeHtml(mdl)}</code> replied successfully.`;
        }
      } else {
        const key = inputApiKey.value.trim();
        if (!key) {
          showToast('Enter an API key first.');
          return;
        }
        if (selectedProvider === 'gemini') {
          await TextHumanizer.callGeminiAPI(key, 'gemini-2.0-flash', 'Ping test.', 'natural');
        } else {
          await TextHumanizer.callGroqAPI(key, 'Ping test.', 'natural');
        }
        showToast('Cloud API Key successfully verified!');
      }
    } catch (err) {
      showToast(`Test error: ${err.message || 'Connection failed'}`);
    } finally {
      btnTestKey.disabled = false;
      btnTestKey.textContent = 'Test Connection';
    }
  }

  function handleClearKey() {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
    inputApiKey.value = '';
    setEngine('local');
    showToast('API Key removed. Switched to Heuristics Engine.');
  }

  // ── Prompt Kit Modal Direct Jump ────────────────────────────────────────────
  async function copyAndOpenAiChat(target) {
    const prompt = promptKitTextarea.value;
    await navigator.clipboard.writeText(prompt).catch(() => {});
    const q = encodeURIComponent(prompt);
    let url = 'https://chatgpt.com/';
    if (target === 'chatgpt') url = q.length < 5000 ? `https://chatgpt.com/?q=${q}` : 'https://chatgpt.com/';
    if (target === 'claude') url = q.length < 5000 ? `https://claude.ai/new?q=${q}` : 'https://claude.ai/new';
    if (target === 'gemini') url = 'https://gemini.google.com/app';
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('Prompt copied to clipboard! Paste it into the chat tab.');
  }

  async function handleFinishReply() {
    const reply = replyBox.value.trim();
    if (!reply) {
      showToast('Please paste the AI reply into the box first.');
      replyBox.focus();
      return;
    }
    closePromptKitModal();
    const cleaned = TextHumanizer.cleanAIOutput(reply);
    const polished = TextHumanizer.polishText(cleaned, currentTone);

    currentSourceText = inputEl.value.trim();
    currentOutputClean = polished;

    outputPlaceholder.classList.add('hidden');
    outputContent.textContent = polished;
    outputDiff.innerHTML = generateDiffMarkup(currentSourceText, polished);

    if (isDiffActive) {
      outputContent.classList.add('hidden');
      outputDiff.classList.remove('hidden');
    } else {
      outputDiff.classList.add('hidden');
      outputContent.classList.remove('hidden');
    }

    statusTag.classList.remove('hidden');
    statusTag.classList.add('flex');
    statusTagText.textContent = 'Verifying ZeroGPT...';
    const zg = await TextHumanizer.checkZeroGPTLive(polished);
    updateDetectorBadge(zg);
    statusTag.classList.add('hidden');
    statusTag.classList.remove('flex');

    showToast('Prompt Kit output applied and polished.');
  }

  // ── Event Listeners Setup ───────────────────────────────────────────────────
  function initEvents() {
    // Input typing
    inputEl.addEventListener('input', handleInputUpdate);

    // Tone switcher
    toneNaturalBtn?.addEventListener('click', () => setTone('natural'));
    toneAcademicBtn?.addEventListener('click', () => setTone('academic'));
    toneExecutiveBtn?.addEventListener('click', () => setTone('executive'));
    toneCasualBtn?.addEventListener('click', () => setTone('casual'));

    // Depth / Intensity switcher
    depthStandardBtn?.addEventListener('click', () => setDepth('standard'));
    depthDeepBtn?.addEventListener('click', () => setDepth('deep'));
    depthStealthBtn?.addEventListener('click', () => setDepth('stealth'));

    // Engine switcher
    engineBtnLocal?.addEventListener('click', () => setEngine('local'));
    engineBtnLocalLlm?.addEventListener('click', () => setEngine('localllm'));
    engineBtnPrompt?.addEventListener('click', () => setEngine('prompt'));
    engineBtnAi?.addEventListener('click', () => setEngine('ai'));
    enginePill?.addEventListener('click', openSettingsModal);

    // Modal engine options
    document.getElementById('modal-opt-local')?.addEventListener('click', () => setEngine('local'));
    document.getElementById('modal-opt-localllm')?.addEventListener('click', () => setEngine('localllm'));
    document.getElementById('modal-opt-prompt')?.addEventListener('click', () => setEngine('prompt'));
    document.getElementById('modal-opt-ai')?.addEventListener('click', () => setEngine('ai'));

    // Local LLM runner presets & inputs
    runnerOllamaBtn?.addEventListener('click', () => {
      setLocalRunnerUI('ollama');
      if (inputLocalEndpoint) inputLocalEndpoint.value = 'http://localhost:11434';
      currentLocalEndpoint = 'http://localhost:11434';
      localStorage.setItem(STORAGE_KEY_LOCAL_ENDPOINT, currentLocalEndpoint);
    });
    runnerLmStudioBtn?.addEventListener('click', () => {
      setLocalRunnerUI('lmstudio');
      if (inputLocalEndpoint) inputLocalEndpoint.value = 'http://localhost:1234/v1';
      currentLocalEndpoint = 'http://localhost:1234/v1';
      localStorage.setItem(STORAGE_KEY_LOCAL_ENDPOINT, currentLocalEndpoint);
    });
    runnerCustomBtn?.addEventListener('click', () => {
      setLocalRunnerUI('custom');
    });

    btnDetectLocalModels?.addEventListener('click', handleDetectLocalModels);

    inputLocalEndpoint?.addEventListener('input', () => {
      currentLocalEndpoint = inputLocalEndpoint.value.trim();
      localStorage.setItem(STORAGE_KEY_LOCAL_ENDPOINT, currentLocalEndpoint);
    });

    inputLocalModel?.addEventListener('input', () => {
      currentLocalModel = inputLocalModel.value.trim();
      localStorage.setItem(STORAGE_KEY_LOCAL_MODEL, currentLocalModel);
      if (currentEngine === 'localllm') {
        headerEngineLabel.textContent = `Local: ${currentLocalModel}`;
      }
    });

    // Chip quick pick delegation
    localModelChips?.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip-model-btn');
      if (btn && btn.dataset.model) {
        const selected = btn.dataset.model;
        if (inputLocalModel) inputLocalModel.value = selected;
        currentLocalModel = selected;
        localStorage.setItem(STORAGE_KEY_LOCAL_MODEL, selected);
        if (currentEngine === 'localllm') {
          headerEngineLabel.textContent = `Local: ${selected}`;
        }
        showToast(`Selected model: ${selected}`);
      }
    });

    // Provider options
    provGeminiBtn?.addEventListener('click', () => updateProviderSelectionUI('gemini'));
    provGroqBtn?.addEventListener('click', () => updateProviderSelectionUI('groq'));

    // Main buttons
    convertBtn.addEventListener('click', () => runConversion(false));
    refineBtn.addEventListener('click', () => runConversion(true));
    diffBtn.addEventListener('click', toggleDiff);
    copyBtn.addEventListener('click', copyOutput);
    verifyBtn.addEventListener('click', runVerifyLive);
    exportDocxBtn?.addEventListener('click', exportDocx);
    exportPdfBtn?.addEventListener('click', exportPdf);
    exportMdBtn?.addEventListener('click', exportMarkdown);
    openZeroGptSiteBtn.addEventListener('click', openZeroGptSite);

    // Glossary Guard events
    btnAddLockedKeyword?.addEventListener('click', () => addLockedTerm(lockedKeywordInput.value));
    lockedKeywordInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addLockedTerm(lockedKeywordInput.value);
      }
    });
    document.querySelectorAll('.quick-lock-chip').forEach(btn => {
      btn.addEventListener('click', () => addLockedTerm(btn.dataset.term));
    });

    // Real-Time Streaming toggle
    if (toggleStreamCheckbox) {
      toggleStreamCheckbox.checked = isStreamingActive;
      toggleStreamCheckbox.addEventListener('change', () => {
        isStreamingActive = toggleStreamCheckbox.checked;
        localStorage.setItem(STORAGE_KEY_STREAMING, isStreamingActive);
        showToast(`Real-Time Streaming: ${isStreamingActive ? 'Enabled ⚡' : 'Disabled'}`);
      });
    }

    // Document Drag & Drop and File Picker events
    docDropzone?.addEventListener('click', () => docFileInput?.click());
    btnUploadDoc?.addEventListener('click', () => docFileInput?.click());
    btnDocRemove?.addEventListener('click', clearActiveDocument);
    docFileInput?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) handleDocumentFile(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(name => {
      docDropzone?.addEventListener(name, (e) => {
        e.preventDefault();
        docDropzone.classList.add('drag-active');
      });
      inputCard?.addEventListener(name, (e) => {
        e.preventDefault();
        inputDragOverlay?.classList.remove('hidden');
        inputDragOverlay?.classList.add('flex');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      docDropzone?.addEventListener(name, (e) => {
        e.preventDefault();
        docDropzone.classList.remove('drag-active');
      });
      inputCard?.addEventListener(name, (e) => {
        e.preventDefault();
        inputDragOverlay?.classList.add('hidden');
        inputDragOverlay?.classList.remove('flex');
      });
    });

    docDropzone?.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleDocumentFile(file);
    });

    inputCard?.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleDocumentFile(file);
    });

    btnLoadSample.addEventListener('click', () => loadSampleText());
    btnClearInput.addEventListener('click', clearInput);

    // Quick Preset Chips delegation
    document.querySelectorAll('.quick-preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.benchmark, 10);
        if (!isNaN(idx) && BENCHMARKS[idx]) {
          inputEl.value = BENCHMARKS[idx].raw_ai;
          handleInputUpdate();
          showToast(`Loaded preset [${BENCHMARKS[idx].topic}]`);
        }
      });
    });

    // Header nav buttons
    document.getElementById('nav-converter')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.getElementById('nav-benchmarks')?.addEventListener('click', openBenchmarksModal);
    document.getElementById('nav-promptkit')?.addEventListener('click', () => openPromptKitModal());
    document.getElementById('nav-settings')?.addEventListener('click', openSettingsModal);
    document.getElementById('btn-header-settings')?.addEventListener('click', openSettingsModal);

    // Footer nav
    document.getElementById('footer-benchmarks')?.addEventListener('click', openBenchmarksModal);
    document.getElementById('footer-promptkit')?.addEventListener('click', () => openPromptKitModal());

    // Settings modal events
    btnCloseSettings.addEventListener('click', closeSettingsModal);
    btnSaveSettings.addEventListener('click', handleSaveSettings);
    btnTestKey.addEventListener('click', handleTestKey);
    btnClearKey.addEventListener('click', handleClearKey);
    modalSettings.addEventListener('click', e => { if (e.target === modalSettings) closeSettingsModal(); });

    // Prompt Kit modal events
    btnClosePromptKit.addEventListener('click', closePromptKitModal);
    btnCopyPromptKit.addEventListener('click', async () => {
      await navigator.clipboard.writeText(promptKitTextarea.value);
      showToast('Prompt copied to clipboard!');
    });
    btnOpenChatGPT.addEventListener('click', () => copyAndOpenAiChat('chatgpt'));
    btnOpenClaude.addEventListener('click', () => copyAndOpenAiChat('claude'));
    btnOpenGemini.addEventListener('click', () => copyAndOpenAiChat('gemini'));
    btnFinishReply.addEventListener('click', handleFinishReply);
    modalPromptKit.addEventListener('click', e => { if (e.target === modalPromptKit) closePromptKitModal(); });

    // Benchmarks modal events
    btnCloseBenchmarks.addEventListener('click', closeBenchmarksModal);
    modalBenchmarks.addEventListener('click', e => { if (e.target === modalBenchmarks) closeBenchmarksModal(); });

    // Global Keybindings
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runConversion(false);
      }
      if (e.key === 'Escape') {
        closeSettingsModal();
        closePromptKitModal();
        closeBenchmarksModal();
      }
    });
  }

  // ── Initialization ──────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    renderLockedChips();
    setTone(currentTone);
    setDepth(currentIntensity);
    setEngine(currentEngine);
    updateProviderSelectionUI(selectedProvider);

    // Pre-populate with first sample for immediate instant testing
    if (!inputEl.value.trim()) {
      inputEl.value = BENCHMARKS[0].raw_ai;
      handleInputUpdate();
    }
  });

})();