/**
 * humanizer.js
 * High-Performance AI-to-Human Text Transformation Engine (v2.0)
 * 
 * Core Architectural Modules:
 * 1. Boundary & Text Parsing: Decimal-aware and abbreviation-safe sentence splitting.
 * 2. Dynamic Content Anchor Protection: Masks proper nouns, numbers, dates, and technical terms.
 * 3. AI Signature Elimination: Removes formulaic transitions, triads, and summary closers.
 * 4. Collocations & Lexicon Optimization: Replaces AI-favored tokens with authentic phrasing.
 * 5. Deterministic Non-LLM Post-Processing: 928 safe synonym mappings and context-aware shifts.
 * 6. Dual-Register Stylistic Adaptation: Natural conversational voice vs Academic formal rigor.
 * 7. Micro-Burstiness & Sawtooth Rhythm: Eliminates uniform sentence length distributions.
 * 8. Real-Time Detection Metrics: Local perplexity and burstiness heuristic evaluation.
 */

// ── 1. Text Parsing & Boundary Detection ──────────────────────────────────────
const ABBREVIATIONS = new Set([
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'St', 'etc', 'vs', 'i.e', 'e.g',
  'Inc', 'Ltd', 'Co', 'Corp', 'Rev', 'Gen', 'Sen', 'Rep', 'Pres', 'Hon', 'al', 'No', 'U.S', 'U.K'
]);

function splitIntoSentences(text) {
  if (!text || !text.trim()) return [];
  const sentences = [];
  let current = '';
  let i = 0;

  while (i < text.length) {
    current += text[i];
    if (['.', '!', '?'].includes(text[i])) {
      const beforeMatch = text.slice(Math.max(0, i - 5), i + 1);
      // Period inside an identifier (e.g. 3.14, version 3.x, domain.com) is not sentence end
      const isInsideIdentifier = text[i] === '.'
        && /[a-zA-Z0-9]/.test(text[i - 1] || '')
        && /[a-zA-Z0-9]/.test(text[i + 1] || '');
      if (!isInsideIdentifier && !Array.from(ABBREVIATIONS).some(abbr => beforeMatch.endsWith(abbr + '.'))) {
        if (text[i + 1] === '"' || text[i + 1] === "'") { current += text[i + 1]; i++; }
        const trimmed = current.trim();
        if (trimmed.length > 0) sentences.push(trimmed);
        current = '';
      }
    }
    i++;
  }
  const trimmed = current.trim();
  if (trimmed.length > 0) sentences.push(trimmed);
  return sentences;
}

function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function cleanMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^###\s+(.*$)/gm, '$1')
    .replace(/^##\s+(.*$)/gm, '$1')
    .replace(/^#\s+(.*$)/gm, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .trim();
}

// ── 2. Content Anchors & Do-NOT List (Dynamic Entity Protection) ─────────────
const ANCHOR_PATTERNS = [
  /https?:\/\/[^\s)]+/g,
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  /"[^"]+"|“[^”]+”/g,
  /\b\d[\d,]*(?:\.\d+)?%?/g,
  /\b[A-Z]{2,}[A-Za-z0-9]*\b/g,
  /\b(?:[A-Z][a-z]+(?:\s+(?:of|the|van|von|de|and)\s+|\s+)){1,3}[A-Z][a-z]+\b/g
];

const COMMON_ANCHOR_STARTERS = /^(?:Applying|Utilizing|Leveraging|Adopting|Implementing|Using|By|With|In|At|On|For|During|Before|After|Because|Since|Although|When|While|If|Through)\s+/i;

function collectAnchors(text) {
  const found = new Set();
  for (const re of ANCHOR_PATTERNS) {
    const matches = text.match(re) || [];
    for (const m of matches) {
      let clean = m.replace(/[,.]$/, '').trim();
      if (COMMON_ANCHOR_STARTERS.test(clean)) {
        clean = clean.replace(COMMON_ANCHOR_STARTERS, '').trim();
      }
      if (clean.length >= 3) found.add(clean);
    }
  }
  return Array.from(found);
}

function extractProtectedEntities(text, userLockedTerms = []) {
  const protectedItems = [];
  let masked = text;

  // 0. Custom User Locked Keywords ("Glossary Guard")
  if (Array.isArray(userLockedTerms) && userLockedTerms.length > 0) {
    const sortedUserTerms = [...userLockedTerms]
      .map(t => String(t).trim())
      .filter(t => t.length > 0)
      .sort((a, b) => b.length - a.length);

    for (const term of sortedUserTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'gi');
      masked = masked.replace(re, (m) => {
        const idx = protectedItems.length;
        protectedItems.push(m);
        return `___PROT_${idx}___`;
      });
    }
  }

  // 1. Quoted direct speech
  masked = masked.replace(/"([^"]+)"|“([^”]+)”/g, (m) => {
    const idx = protectedItems.length;
    protectedItems.push(m);
    return `___PROT_${idx}___`;
  });

  // 2. Multi-word capitalized proper names, frameworks, and technical entities
  const dynamicAnchors = collectAnchors(text)
    .filter(a => a.length >= 3 && !/^\d+$/.test(a))
    .sort((a, b) => b.length - a.length);

  for (const item of dynamicAnchors) {
    const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'g');
    masked = masked.replace(re, (m) => {
      const idx = protectedItems.length;
      protectedItems.push(m);
      return `___PROT_${idx}___`;
    });
  }

  // 3. Known technical frameworks, tools, and technical terms
  const KNOWN_ENTITIES = [
    'NumPy', 'Pandas', 'Matplotlib', 'Seaborn',
    'PyTorch', 'TensorFlow', 'Scikit-learn', 'Django', 'Flask',
    'Python', 'C\\+\\+', 'Rust', 'Linux', 'Windows', 'macOS'
  ];
  for (const item of KNOWN_ENTITIES) {
    const re = new RegExp(`\\b${item}\\b`, 'gi');
    masked = masked.replace(re, (m) => {
      const idx = protectedItems.length;
      protectedItems.push(m);
      return `___PROT_${idx}___`;
    });
  }

  // 4. Technical acronyms (2-5 uppercase characters)
  masked = masked.replace(/\b([A-Z]{2,5})\b/g, (m) => {
    const idx = protectedItems.length;
    protectedItems.push(m);
    return `___PROT_${idx}___`;
  });

  // 5. Exact numbers, years, percentages, and units
  masked = masked.replace(/\b\d+(?:[.,]\d+)*(?:st|nd|rd|th|%)?(?!\w)/g, (m) => {
    const idx = protectedItems.length;
    protectedItems.push(m);
    return `___PROT_${idx}___`;
  });

  return { masked, protectedItems };
}

function restoreProtectedEntities(text, protectedItems) {
  let res = text;
  for (let i = 0; i < protectedItems.length; i++) {
    res = res.replace(new RegExp(`___PROT_${i}___`, 'g'), protectedItems[i]);
  }
  return res;
}

function verifyAnchors(source, output, userLockedTerms = []) {
  const missing = [];
  const lowerOut = output.toLowerCase();

  // Check user locked terms first
  if (Array.isArray(userLockedTerms)) {
    for (const term of userLockedTerms) {
      const t = String(term).trim();
      if (t && !lowerOut.includes(t.toLowerCase())) {
        missing.push(t);
      }
    }
  }

  for (const a of collectAnchors(source)) {
    const raw = a.trim();
    const stripped = raw.replace(/^(?:applying|using|by|the|in|at|on|for|with|of)\s+/i, '').replace(/^(?:the)\s+/i, '').trim();
    if (!lowerOut.includes(raw.toLowerCase()) && !lowerOut.includes(stripped.toLowerCase())) {
      missing.push(raw);
    }
  }
  return missing;
}

// ── 3. AI Tells Elimination & Formulaic Pattern Purge ─────────────────────────
const AI_TELL_PATTERNS = [
  [/\bnot only ([^,]+),? but also ([^.]+)\b/gi, 'both $1 and $2'],
  [/\bnot only ([^,]+) but ([^.]+)\b/gi, '$1 as well as $2'],
  [/\bit is not ([^,]+),? (?:but|rather) ([^.]+)\b/gi, '$2 instead of $1'],
  [/\b(?:is|are|was|were)\s+not\s+(?:born\s+from|driven\s+by|rooted\s+in|about|a\s+matter\s+of)\s+([^,]+),\s*(?:but|rather)\s+(?:from|about|by|in|a\s+matter\s+of)?\s*([^.]+)\b/gi, 'comes down to $2, not $1'],
  [/\b(?:is|are)\s+less\s+about\s+([^,]+)\s+and\s+more\s+about\s+([^.]+)\b/gi, 'comes down to $2 rather than $1'],
  [/\b(?:not\s+merely|not\s+just)\s+([^,]+),?\s+but\s+(?:also\s+)?([^.]+)\b/gi, 'both $1 and $2'],
  [/\*\*([^\*]+)\*\*:\s*/g, '$1: '],
  [/\bIn today's(?:\s+[\w-]+){0,3}\s+(?:world|landscape|society|era)[,]?\s*/gi, 'In modern settings, '],
  [/\bIn today's(?:\s+[\w-]+){0,3}\s+(?:environment|workplace|market)[,]?\s*/gi, 'Across modern workplaces, '],
  [/\bIn the contemporary(?:\s+[\w-]+){0,3}\s+(?:world|landscape|environment|era)[,]?\s*/gi, 'In modern practice, '],
  [/\b(?:In conclusion|To conclude|To summarize|In summary)\s*,?\s*/gi, ''],
  [/\bplays? a (?:crucial|pivotal|vital|key|significant|important) role in\b/gi, 'matters in'],
  [/\bstands? as a (?:testament|beacon|symbol) (?:of|to|for)\b/gi, 'shows'],
  [/\bserves as a\b/gi, 'is a'],
  [/\bnavigating the (?:complexities|challenges|landscape) of\b/gi, 'dealing with'],
  [/\bnavigates the (?:complexities|challenges|landscape) of\b/gi, 'deals with'],
  [/\bnavigate the (?:complexities|challenges|landscape) of\b/gi, 'deal with'],
  [/\bat the (?:heart|core|forefront) of\b/gi, 'central to'],
  [/\b(?:Moreover|Furthermore|Additionally|In addition|Consequently|Notably|Importantly),\s*/gi, ''],
  [/\b[Ii]t is (?:crucial|essential|vital|pivotal|imperative) (?:for|to|that)\b/g, 'it helps to'],
  [/\bdrastically (?:reduces|decreases|diminishes)\b/gi, 'cuts down'],
  [/\bfrequently struggle with\b/gi, 'often run into'],
  [/\ba wide (?:variety|range) of\b/gi, 'many'],
  [/\bAt the end of the day,\s*/gi, 'In reality, '],
  [/\bIt goes without saying that\s*/gi, 'Naturally, '],
  [/\bNeedless to say,\s*/gi, 'Naturally, '],
  [/\bIt is worth mentioning that\s*/gi, 'Notably, '],
  [/\bIt is important to remember that\s*/gi, 'Remember, '],

  // Generalized Structural Cliché Busters
  [/\bIn order to ([a-z]+)\b/gi, 'To $1'],
  [/\bA wide (?:variety|array|spectrum) of\b/gi, 'Many'],
  [/\bPlays an? (?:integral|essential|vital) role in\b/gi, 'is central to'],
  [/\bDue to the fact that\b/gi, 'Because'],
  [/\bIn the event that\b/gi, 'If'],
  [/\bHas the (?:potential|ability) to\b/gi, 'can'],
  [/\bIt is (?:widely|commonly) (?:believed|accepted) that\b/gi, 'Most observers agree that'],
  [/\bWith that (?:being )?said,?\s*/gi, 'Even so, '],
  [/\bIn this day and age,?\s*/gi, 'Today, ']
];

function stripAITells(text) {
  let r = text;
  for (const [re, rep] of AI_TELL_PATTERNS) {
    r = r.replace(re, rep);
  }
  return r;
}
// ── 4. Collocations & AI Lexicon Purge ──────────────────────────────────────────
const COLLOCATIONS = [
  {
    "from": "delve into",
    "to": ["look into", "explore", "dig into"]
  },
  {
    "from": "beacon of",
    "to": ["clear example of", "symbol of"]
  },
  {
    "from": "testament to",
    "to": ["proof of", "sign of"]
  },
  {
    "from": "tapestry of",
    "to": ["mix of", "combination of"]
  },
  {
    "from": "pivotal role",
    "to": ["key role", "critical role"]
  },
  {
    "from": "in order to",
    "to": ["to"]
  },
  {
    "from": "with respect to",
    "to": ["regarding", "on"]
  },
  {
    "from": "in light of the fact that",
    "to": ["because", "since"]
  },
  {
    "from": "it is crucial to",
    "to": ["it helps to", "you need to"]
  },
  {
    "from": "at the forefront of",
    "to": ["leading", "central to"]
  },
  {
    "from": "serves as a reminder that",
    "to": ["reminds us that"]
  },
  {
    "from": "in order to",
    "to": [
      "so we can",
      "to",
      "so that we",
      "for the purpose of"
    ]
  },
  {
    "from": "due to the fact that",
    "to": [
      "since",
      "because",
      "seeing as",
      "given that"
    ]
  },
  {
    "from": "it is worth noting that",
    "to": [
      "worth mentioning",
      "also",
      "one more thing",
      "it helps to know"
    ]
  },
  {
    "from": "it is worth noting",
    "to": [
      "worth mentioning",
      "it's good to know",
      "keep in mind"
    ]
  },
  {
    "from": "it is important to note",
    "to": [
      "keep in mind",
      "remember",
      "it helps to know"
    ]
  },
  {
    "from": "it is important to",
    "to": [
      "it helps to",
      "you need to",
      "make sure to",
      "it is key to"
    ]
  },
  {
    "from": "it is important",
    "to": [
      "it matters",
      "this is key",
      "this counts",
      "this is a big deal"
    ]
  },
  {
    "from": "it is essential",
    "to": [
      "it is necessary",
      "it matters to",
      "we need to",
      "you have to"
    ]
  },
  {
    "from": "it is crucial",
    "to": [
      "it is vital",
      "it matters",
      "it is key"
    ]
  },
  {
    "from": "it is evident that",
    "to": [
      "clearly",
      "obviously",
      "you can see that",
      "it's pretty clear"
    ]
  },
  {
    "from": "it is clear that",
    "to": [
      "clearly",
      "obviously",
      "you can tell",
      "no surprise"
    ]
  },
  {
    "from": "it is clear",
    "to": [
      "obviously",
      "clearly",
      "no doubt",
      "pretty obvious"
    ]
  },
  {
    "from": "it is possible",
    "to": [
      "it could happen",
      "there's a chance",
      "maybe"
    ]
  },
  {
    "from": "it is likely",
    "to": [
      "probably",
      "chances are",
      "I'd bet"
    ]
  },
  {
    "from": "it is unlikely",
    "to": [
      "probably not",
      "doubtful",
      "a long shot"
    ]
  },
  {
    "from": "it is necessary",
    "to": [
      "you need to",
      "it has to happen",
      "required"
    ]
  },
  {
    "from": "it is interesting",
    "to": [
      "pretty cool actually",
      "neat",
      "fascinating when you think about it"
    ]
  },
  {
    "from": "it is difficult",
    "to": [
      "it's hard",
      "not easy",
      "tough",
      "tricky"
    ]
  },
  {
    "from": "it is true that",
    "to": [
      "sure",
      "granted",
      "fair point",
      "admittedly"
    ]
  },
  {
    "from": "it should be noted",
    "to": [
      "keep in mind",
      "worth knowing",
      "one thing to remember"
    ]
  },
  {
    "from": "it should be mentioned",
    "to": [
      "worth bringing up",
      "I should add",
      "also"
    ]
  },
  {
    "from": "it goes without saying",
    "to": [
      "obviously",
      "naturally",
      "of course",
      "no brainer"
    ]
  },
  {
    "from": "it is safe to say",
    "to": [
      "you can pretty much say",
      "I think it's fair to say",
      "safe bet"
    ]
  },
  {
    "from": "it cannot be denied",
    "to": [
      "you can't really argue with",
      "hard to dispute",
      "no way around it"
    ]
  },
  {
    "from": "it cannot be overstated",
    "to": [
      "this really can't be said enough",
      "huge deal",
      "seriously important"
    ]
  },
  {
    "from": "has the ability to",
    "to": [
      "can",
      "is able to",
      "knows how to"
    ]
  },
  {
    "from": "has the potential to",
    "to": [
      "could",
      "might just",
      "stands a chance of"
    ]
  },
  {
    "from": "has the capacity to",
    "to": [
      "can",
      "is equipped to",
      "has what it takes to"
    ]
  },
  {
    "from": "has the potential",
    "to": [
      "could",
      "might",
      "has a shot at"
    ]
  },
  {
    "from": "a large number of",
    "to": [
      "tons of",
      "a bunch of",
      "quite a few",
      "loads of",
      "a whole lot of"
    ]
  },
  {
    "from": "a significant number of",
    "to": [
      "quite a few",
      "a good chunk of",
      "a bunch of"
    ]
  },
  {
    "from": "a wide range of",
    "to": [
      "all sorts of",
      "a variety of",
      "different kinds of"
    ]
  },
  {
    "from": "a variety of",
    "to": [
      "different",
      "various",
      "all kinds of",
      "a mix of"
    ]
  },
  {
    "from": "a great deal of",
    "to": [
      "a lot of",
      "tons of",
      "loads of",
      "a massive amount of"
    ]
  },
  {
    "from": "a vast amount of",
    "to": [
      "a ton of",
      "so much",
      "a mountain of"
    ]
  },
  {
    "from": "a considerable amount",
    "to": [
      "a lot",
      "quite a bit",
      "a good amount"
    ]
  },
  {
    "from": "a considerable number",
    "to": [
      "a bunch",
      "quite a few",
      "a good number"
    ]
  },
  {
    "from": "a high level of",
    "to": [
      "a lot of",
      "deep",
      "serious"
    ]
  },
  {
    "from": "in the field of",
    "to": [
      "when it comes to",
      "in the world of",
      "for anyone working in"
    ]
  },
  {
    "from": "in the realm of",
    "to": [
      "in the world of",
      "when it comes to",
      "within"
    ]
  },
  {
    "from": "in the context of",
    "to": [
      "when you look at",
      "in the case of",
      "given"
    ]
  },
  {
    "from": "in the case of",
    "to": [
      "when it comes to",
      "for",
      "with"
    ]
  },
  {
    "from": "in addition to",
    "to": [
      "besides",
      "on top of",
      "along with",
      "plus"
    ]
  },
  {
    "from": "in terms of",
    "to": [
      "when it comes to",
      "regarding",
      "as for",
      "looking at"
    ]
  },
  {
    "from": "in light of",
    "to": [
      "given",
      "considering",
      "because of",
      "with"
    ]
  },
  {
    "from": "in spite of",
    "to": [
      "despite",
      "even with",
      "even though",
      "regardless of"
    ]
  },
  {
    "from": "in relation to",
    "to": [
      "about",
      "regarding",
      "when it comes to",
      "connected to"
    ]
  },
  {
    "from": "in comparison to",
    "to": [
      "compared to",
      "versus",
      "next to",
      "against"
    ]
  },
  {
    "from": "in contrast to",
    "to": [
      "unlike",
      "compared to",
      "on the flip side",
      "while"
    ]
  },
  {
    "from": "in response to",
    "to": [
      "as an answer to",
      "reacting to",
      "to address"
    ]
  },
  {
    "from": "make a decision",
    "to": [
      "decide",
      "make up your mind",
      "land on something",
      "figure out what to do"
    ]
  },
  {
    "from": "make a difference",
    "to": [
      "change things",
      "have an impact",
      "actually matter"
    ]
  },
  {
    "from": "make an effort",
    "to": [
      "try",
      "put in the work",
      "push",
      "make a point of"
    ]
  },
  {
    "from": "make use of",
    "to": [
      "use",
      "leverage",
      "take advantage of",
      "put to work"
    ]
  },
  {
    "from": "make a contribution",
    "to": [
      "chip in",
      "add something",
      "do your part"
    ]
  },
  {
    "from": "make progress",
    "to": [
      "move forward",
      "get somewhere",
      "make headway"
    ]
  },
  {
    "from": "take into account",
    "to": [
      "consider",
      "factor in",
      "think about",
      "keep in mind"
    ]
  },
  {
    "from": "take into consideration",
    "to": [
      "consider",
      "factor in",
      "think about",
      "weigh"
    ]
  },
  {
    "from": "take advantage of",
    "to": [
      "use",
      "leverage",
      "capitalize on",
      "jump on"
    ]
  },
  {
    "from": "play a role",
    "to": [
      "matter",
      "be a factor",
      "make a difference",
      "have a say"
    ]
  },
  {
    "from": "play a crucial role",
    "to": [
      "be a big deal",
      "really matter",
      "make a huge difference"
    ]
  },
  {
    "from": "play a key role",
    "to": [
      "be central",
      "be a big factor",
      "really matter"
    ]
  },
  {
    "from": "play a significant role",
    "to": [
      "be a big part",
      "carry real weight",
      "matter a lot"
    ]
  },
  {
    "from": "play an important role",
    "to": [
      "really matter",
      "be important",
      "carry weight"
    ]
  },
  {
    "from": "on the other hand",
    "to": [
      "then again",
      "but then",
      "on the flip side",
      "that said"
    ]
  },
  {
    "from": "on the one hand",
    "to": [
      "for one thing",
      "sure",
      "on one side"
    ]
  },
  {
    "from": "at the same time",
    "to": [
      "simultaneously",
      "meanwhile",
      "all the while",
      "but also"
    ]
  },
  {
    "from": "at the end of the day",
    "to": [
      "ultimately",
      "when all is said and done",
      "in the end"
    ]
  },
  {
    "from": "for the most part",
    "to": [
      "mostly",
      "generally",
      "by and large",
      "usually"
    ]
  },
  {
    "from": "for the purpose of",
    "to": [
      "to",
      "for",
      "so we can",
      "in order to"
    ]
  },
  {
    "from": "as a matter of fact",
    "to": [
      "actually",
      "in fact",
      "truthfully",
      "honestly"
    ]
  },
  {
    "from": "as a result of",
    "to": [
      "because of",
      "thanks to",
      "due to",
      "from"
    ]
  },
  {
    "from": "as a result",
    "to": [
      "so",
      "because of this",
      "that's why",
      "consequently"
    ]
  },
  {
    "from": "as well as",
    "to": [
      "and",
      "plus",
      "along with",
      "alongside"
    ]
  },
  {
    "from": "with regard to",
    "to": [
      "about",
      "regarding",
      "when it comes to",
      "on the topic of"
    ]
  },
  {
    "from": "with respect to",
    "to": [
      "about",
      "regarding",
      "in terms of",
      "on"
    ]
  },
  {
    "from": "with the exception of",
    "to": [
      "except",
      "other than",
      "besides"
    ]
  },
  {
    "from": "first and foremost",
    "to": [
      "first off",
      "to start",
      "the main thing"
    ]
  },
  {
    "from": "last but not least",
    "to": [
      "finally",
      "one more thing",
      "also"
    ]
  },
  {
    "from": "to begin with",
    "to": [
      "first off",
      "to start",
      "for starters"
    ]
  },
  {
    "from": "to sum up",
    "to": [
      "basically",
      "in short",
      "long story short",
      "the bottom line"
    ]
  },
  {
    "from": "to put it differently",
    "to": [
      "or to say it another way",
      "in other words",
      "basically"
    ]
  },
  {
    "from": "to put it simply",
    "to": [
      "basically",
      "simply put",
      "long story short"
    ]
  },
  {
    "from": "the vast majority of",
    "to": [
      "most",
      "pretty much all",
      "nearly all",
      "almost all"
    ]
  },
  {
    "from": "the majority of",
    "to": [
      "most",
      "a lot of",
      "pretty much all"
    ]
  },
  {
    "from": "a growing number of",
    "to": [
      "more and more",
      "an increasing number of",
      "increasingly"
    ]
  },
  {
    "from": "an increasing number of",
    "to": [
      "more and more",
      "growing numbers of"
    ]
  },
  {
    "from": "the purpose of",
    "to": [
      "why we",
      "the point of",
      "what we're trying to do"
    ]
  },
  {
    "from": "the fact that",
    "to": [
      "that",
      "how",
      "the reality that"
    ]
  },
  {
    "from": "the ability to",
    "to": [
      "being able to",
      "can",
      "getting to"
    ]
  },
  {
    "from": "the importance of",
    "to": [
      "the value of",
      "the role of",
      "what's key about"
    ]
  },
  {
    "from": "the development of",
    "to": [
      "building",
      "the rise of",
      "the growth of"
    ]
  },
  {
    "from": "the implementation of",
    "to": [
      "rolling out",
      "deploying",
      "putting in place"
    ]
  },
  {
    "from": "the utilization of",
    "to": [
      "using",
      "the use of",
      "how we use"
    ]
  },
  {
    "from": "the use of",
    "to": [
      "using",
      "how we use",
      "relying on"
    ]
  },
  {
    "from": "the impact of",
    "to": [
      "the effect of",
      "the result of",
      "what comes from"
    ]
  },
  {
    "from": "the results of",
    "to": [
      "what happened when",
      "the outcome of",
      "what we got from"
    ]
  },
  {
    "from": "in conclusion",
    "to": [
      "to wrap up",
      "so yeah",
      "basically",
      "at the end of the day"
    ]
  },
  {
    "from": "to conclude",
    "to": [
      "to wrap up",
      "so",
      "anyway",
      "long story short"
    ]
  },
  {
    "from": "in summary",
    "to": [
      "basically",
      "long story short",
      "so yeah",
      "the bottom line"
    ]
  },
  {
    "from": "it is widely recognized",
    "to": [
      "everyone knows",
      "it's pretty well known",
      "people generally agree"
    ]
  },
  {
    "from": "it is widely accepted",
    "to": [
      "most people agree",
      "it's generally agreed",
      "pretty much everyone accepts"
    ]
  },
  {
    "from": "it is generally accepted",
    "to": [
      "most people agree",
      "it's pretty widely accepted",
      "common knowledge"
    ]
  },
  {
    "from": "it is generally understood",
    "to": [
      "most people get that",
      "pretty clear to everyone",
      "common understanding"
    ]
  },
  {
    "from": "there is a growing",
    "to": [
      "there's more and more",
      "we're seeing increasing"
    ]
  },
  {
    "from": "there is no doubt",
    "to": [
      "no question",
      "clearly",
      "definitely",
      "for sure"
    ]
  },
  {
    "from": "there is no denying",
    "to": [
      "you can't deny",
      "hard to argue with",
      "undeniably"
    ]
  },
  {
    "from": "demonstrates that",
    "to": [
      "shows that",
      "proves",
      "makes it clear that"
    ]
  },
  {
    "from": "suggests that",
    "to": [
      "hints at",
      "points to",
      "seems like",
      "makes you think"
    ]
  },
  {
    "from": "indicates that",
    "to": [
      "shows",
      "points to",
      "suggests",
      "gives the sense that"
    ]
  },
  {
    "from": "has been shown to",
    "to": [
      "has proven to",
      "we know",
      "turns out to"
    ]
  },
  {
    "from": "has been proven to",
    "to": [
      "we've seen that",
      "it's been shown",
      "clearly"
    ]
  },
  {
    "from": "responsible for",
    "to": [
      "in charge of",
      "handling",
      "taking care of",
      "doing"
    ]
  },
  {
    "from": "associated with",
    "to": [
      "linked to",
      "tied to",
      "connected to",
      "related to"
    ]
  },
  {
    "from": "according to",
    "to": [
      "per",
      "based on what",
      "if you look at",
      "says"
    ]
  },
  {
    "from": "prior to",
    "to": [
      "before",
      "leading up to",
      "ahead of"
    ]
  },
  {
    "from": "subsequent to",
    "to": [
      "after",
      "following",
      "once"
    ]
  },
  {
    "from": "in the first place",
    "to": [
      "to begin with",
      "first off",
      "for starters"
    ]
  },
  {
    "from": "in the second place",
    "to": [
      "secondly",
      "also",
      "on top of that"
    ]
  },
  {
    "from": "moreover",
    "to": [
      "additionally",
      "also",
      "in addition"
    ]
  },
  {
    "from": "furthermore",
    "to": [
      "additionally",
      "in addition",
      "also"
    ]
  },
  {
    "from": "additionally",
    "to": [
      "also",
      "in addition"
    ]
  },
  {
    "from": "nevertheless",
    "to": [
      "still",
      "but",
      "even so",
      "that said"
    ]
  },
  {
    "from": "consequently",
    "to": [
      "so",
      "as a result",
      "that's why",
      "because of that"
    ]
  },
  {
    "from": "subsequently",
    "to": [
      "then",
      "after that",
      "later",
      "next"
    ]
  },
  {
    "from": "facilitate",
    "to": [
      "help with",
      "make easier",
      "enable",
      "allow"
    ]
  },
  {
    "from": "utilize",
    "to": [
      "use",
      "work with",
      "put to use",
      "apply"
    ]
  },
  {
    "from": "implement",
    "to": [
      "put in place",
      "roll out",
      "set up",
      "start using"
    ]
  },
  {
    "from": "leverage",
    "to": [
      "use",
      "take advantage of",
      "build on",
      "work with"
    ]
  },
  {
    "from": "optimize",
    "to": [
      "improve",
      "fine-tune",
      "make better",
      "tweak"
    ]
  },
  {
    "from": "comprehensive",
    "to": [
      "thorough",
      "complete",
      "detailed",
      "full"
    ]
  },
  {
    "from": "facilitates the",
    "to": [
      "helps with",
      "makes it easier to",
      "allows for"
    ]
  },
  {
    "from": "paramount",
    "to": [
      "key",
      "top priority",
      "most important",
      "critical"
    ]
  },
  {
    "from": "underscore",
    "to": [
      "highlight",
      "stress",
      "point out",
      "show"
    ]
  },
  {
    "from": "delve into",
    "to": [
      "dig into",
      "look at",
      "explore",
      "get into"
    ]
  },
  {
    "from": "sheds light on",
    "to": [
      "helps explain",
      "clarifies",
      "makes sense of",
      "reveals"
    ]
  },
  {
    "from": "landscape",
    "to": [
      "world",
      "space",
      "scene",
      "area",
      "environment"
    ]
  },
  {
    "from": "a myriad of",
    "to": [
      "lots of",
      "tons of",
      "all kinds of",
      "a bunch of"
    ]
  },
  {
    "from": "multifaceted",
    "to": [
      "complex",
      "many-sided",
      "layered",
      "complicated"
    ]
  },
  {
    "from": "seamless",
    "to": [
      "smooth",
      "easy",
      "frictionless",
      "painless"
    ]
  },
  {
    "from": "synergy",
    "to": [
      "teamwork",
      "working together",
      "combined effort",
      "collaboration"
    ]
  },
  {
    "from": "paradigm shift",
    "to": [
      "big change",
      "fundamental shift",
      "game changer",
      "new way of thinking"
    ]
  },
  {
    "from": "holistic",
    "to": [
      "complete",
      "all-around",
      "full-picture",
      "big-picture"
    ]
  },
  {
    "from": "groundbreaking",
    "to": [
      "revolutionary",
      "huge",
      "game-changing",
      "innovative"
    ]
  },
  {
    "from": "transformative",
    "to": [
      "life-changing",
      "revolutionary",
      "major",
      "powerful"
    ]
  },
  {
    "from": "unprecedented",
    "to": [
      "never seen before",
      "unheard of",
      "unlike anything before",
      "brand new"
    ]
  },
  {
    "from": "embark on",
    "to": [
      "start",
      "begin",
      "kick off",
      "dive into"
    ]
  },
  {
    "from": "navigating",
    "to": [
      "working through",
      "dealing with",
      "handling",
      "figuring out"
    ]
  },
  {
    "from": "pivotal",
    "to": [
      "key",
      "crucial",
      "critical",
      "game-changing"
    ]
  },
  {
    "from": "integral",
    "to": [
      "important",
      "essential",
      "key",
      "central"
    ]
  },
  {
    "from": "robust",
    "to": [
      "strong",
      "solid",
      "tough",
      "reliable"
    ]
  },
  {
    "from": "innovative",
    "to": [
      "new",
      "fresh",
      "creative",
      "cutting-edge"
    ]
  },
  {
    "from": "streamline",
    "to": [
      "simplify",
      "speed up",
      "make easier",
      "smooth out"
    ]
  },
  {
    "from": "state-of-the-art",
    "to": [
      "latest",
      "cutting-edge",
      "modern",
      "top-of-the-line"
    ]
  },
  {
    "from": "cutting-edge",
    "to": [
      "latest",
      "bleeding-edge",
      "newest",
      "advanced"
    ]
  },
  {
    "from": "best practices",
    "to": [
      "smart approaches",
      "proven methods",
      "what works",
      "standard approaches"
    ]
  },
  {
    "from": "in the modern era",
    "to": [
      "now",
      "these days",
      "today",
      "in this day and age"
    ]
  },
  {
    "from": "in this day and age",
    "to": [
      "now",
      "these days",
      "today",
      "right now"
    ]
  },
  {
    "from": "a deep dive into",
    "to": [
      "a closer look at",
      "digging into",
      "exploring",
      "looking at"
    ]
  },
  {
    "from": "deep dive",
    "to": [
      "closer look",
      "detailed look",
      "proper examination",
      "real analysis"
    ]
  },
  {
    "from": "unlocking the potential",
    "to": [
      "tapping into",
      "making the most of",
      "getting more out of",
      "using"
    ]
  },
  {
    "from": "unlocking",
    "to": [
      "opening up",
      "revealing",
      "exposing",
      "making available"
    ]
  },
  {
    "from": "the intersection of",
    "to": [
      "the overlap between",
      "the crossroads of",
      "the meeting point of"
    ]
  },
  {
    "from": "at the intersection of",
    "to": [
      "between",
      "at the crossroads of",
      "where"
    ]
  },
  {
    "from": "paving the way",
    "to": [
      "leading to",
      "making room for",
      "opening the door for",
      "setting up"
    ]
  },
  {
    "from": "paves the way",
    "to": [
      "leads to",
      "sets up",
      "clears the path for",
      "makes possible"
    ]
  },
  {
    "from": "the backbone of",
    "to": [
      "the core of",
      "what supports",
      "the foundation of",
      "what holds up"
    ]
  },
  {
    "from": "a testament to",
    "to": [
      "proof of",
      "shows that",
      "evidence of",
      "a sign of"
    ]
  },
  {
    "from": "in an ever-changing",
    "to": [
      "in a changing",
      "as things change in",
      "today's",
      "in a shifting"
    ]
  },
  {
    "from": "ever-evolving",
    "to": [
      "constantly changing",
      "always shifting",
      "developing",
      "moving"
    ]
  },
  {
    "from": "not only",
    "to": [
      "not just",
      "both"
    ]
  },
  {
    "from": "it is imperative that",
    "to": [
      "we really need to",
      "it's critical to",
      "you have to",
      "we must"
    ]
  },
  {
    "from": "the landscape of",
    "to": [
      "the world of",
      "the field of",
      "the area of",
      "the space of"
    ]
  },
  {
    "from": "navigating the complexities",
    "to": [
      "dealing with the complexity",
      "working through the complications",
      "handling the tricky parts"
    ]
  },
  {
    "from": "a rich tapestry",
    "to": [
      "a mix of",
      "a blend of",
      "a variety of",
      "a combination of"
    ]
  },
  {
    "from": "tapestry",
    "to": [
      "mix",
      "blend",
      "combination",
      "mosaic",
      "collection"
    ]
  },
  {
    "from": "the nuances of",
    "to": [
      "the subtle parts of",
      "the details of",
      "the finer points of"
    ]
  },
  {
    "from": "bringing to light",
    "to": [
      "revealing",
      "showing",
      "exposing",
      "uncovering"
    ]
  },
  {
    "from": "in the grand scheme of things",
    "to": [
      "overall",
      "when you step back",
      "in the bigger picture",
      "all things considered"
    ]
  },
  {
    "from": "it bears mentioning",
    "to": [
      "worth saying",
      "I should add",
      "also",
      "one more thing"
    ]
  },
  {
    "from": "serves as a",
    "to": [
      "acts as a",
      "works as a",
      "functions as a",
      "is a"
    ]
  },
  {
    "from": "acts as a catalyst",
    "to": [
      "sparks",
      "drives",
      "pushes forward",
      "accelerates"
    ]
  },
  {
    "from": "catalyst for change",
    "to": [
      "what drives change",
      "what pushes things forward",
      "a driver of change"
    ]
  },
  {
    "from": "the crux of",
    "to": [
      "the heart of",
      "the key part of",
      "the main point of",
      "what matters most about"
    ]
  },
  {
    "from": "at its core",
    "to": [
      "basically",
      "fundamentally",
      "at the heart of it"
    ]
  },
  {
    "from": "at its essence",
    "to": [
      "basically",
      "in essence",
      "at heart",
      "fundamentally"
    ]
  },
  {
    "from": "it is undeniable that",
    "to": [
      "clearly",
      "obviously",
      "you can't argue with",
      "no question"
    ]
  },
  {
    "from": "undeniably",
    "to": [
      "clearly",
      "without doubt",
      "for sure",
      "no question"
    ]
  },
  {
    "from": "a beacon of",
    "to": [
      "a sign of",
      "an example of",
      "a model for",
      "a symbol of"
    ]
  },
  {
    "from": "the paradigm of",
    "to": [
      "the model of",
      "the approach to",
      "the pattern of",
      "the framework for"
    ]
  },
  {
    "from": "in a rapidly evolving",
    "to": [
      "in a fast-changing",
      "in a quickly changing",
      "today's",
      "in a developing"
    ]
  },
  {
    "from": "rapidly evolving",
    "to": [
      "fast-changing",
      "quickly developing",
      "shifting",
      "growing"
    ]
  },
  {
    "from": "weaving together",
    "to": [
      "combining",
      "bringing together",
      "mixing",
      "merging"
    ]
  },
  {
    "from": "a delicate balance",
    "to": [
      "a tricky balance",
      "a fine line",
      "a careful balance",
      "a tight balance"
    ]
  },
  {
    "from": "it is paramount",
    "to": [
      "it's crucial",
      "this is the top priority",
      "this matters most",
      "nothing is more important"
    ]
  },
  {
    "from": "paramount importance",
    "to": [
      "really important",
      "top priority",
      "critical",
      "the most important thing"
    ]
  },
  {
    "from": "fostering a culture of",
    "to": [
      "building a culture of",
      "creating an environment for",
      "encouraging"
    ]
  },
  {
    "from": "the proliferation of",
    "to": [
      "the spread of",
      "the growth of",
      "more and more",
      "the rise in"
    ]
  },
  {
    "from": "proliferation",
    "to": [
      "spread",
      "growth",
      "increase",
      "expansion"
    ]
  },
  {
    "from": "a myriad of ways",
    "to": [
      "lots of ways",
      "many ways",
      "all sorts of ways",
      "tons of ways"
    ]
  },
  {
    "from": "championing",
    "to": [
      "supporting",
      "pushing for",
      "leading",
      "advocating for"
    ]
  },
  {
    "from": "demystifying",
    "to": [
      "explaining",
      "breaking down",
      "making sense of",
      "clarifying"
    ]
  },
  {
    "from": "thought-provoking",
    "to": [
      "interesting",
      "makes you think",
      "worth reflecting on",
      "stimulating"
    ]
  },
  {
    "from": "game-changing",
    "to": [
      "huge",
      "revolutionary",
      "major",
      "a big deal"
    ]
  },
  {
    "from": "reshaping the way",
    "to": [
      "changing how",
      "transforming how",
      "shifting how"
    ]
  },
  {
    "from": "bridging the gap",
    "to": [
      "closing the gap",
      "connecting",
      "filling the gap",
      "linking"
    ]
  },
  {
    "from": "a cornerstone of",
    "to": [
      "a key part of",
      "central to",
      "essential to",
      "a foundation of"
    ]
  },
  {
    "from": "stands as",
    "to": [
      "is",
      "serves as",
      "works as",
      "functions as"
    ]
  },
  {
    "from": "encompasses",
    "to": [
      "includes",
      "covers",
      "involves",
      "contains"
    ]
  },
  {
    "from": "the advent of",
    "to": [
      "the arrival of",
      "the start of",
      "the beginning of"
    ]
  },
  {
    "from": "a stark contrast",
    "to": [
      "a big difference",
      "a clear difference",
      "totally different from",
      "nothing like"
    ]
  },
  {
    "from": "delves deeper",
    "to": [
      "goes deeper",
      "looks closer",
      "digs into",
      "explores further"
    ]
  },
  {
    "from": "unparalleled",
    "to": [
      "unmatched",
      "unequaled",
      "unrivaled",
      "like nothing else"
    ]
  },
  {
    "from": "a lens through which",
    "to": [
      "a way to look at",
      "a perspective on",
      "an angle for"
    ]
  }
];

const AI_LEXICON_PHRASES = [
  {
    "pattern": "\\b(?:moreover|furthermore|additionally|in addition|lastly|finally),\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bit is important to note that\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bit is worth (?:noting|mentioning) that\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bit should be (?:noted|emphasized) that\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bit must be noted that\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bit is (?:crucial|essential|imperative|vital) to\\s+",
    "replacement": "it helps to "
  },
  {
    "pattern": "\\bit is (?:evident|clear|apparent) that\\s*,?\\s*",
    "replacement": "clearly, "
  },
  {
    "pattern": "\\bin conclusion\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bin summary\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bto summarize\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bto conclude\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bas (?:previously )?mentioned(?: earlier)?\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bas (?:discussed|noted) (?:earlier|above)\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bneedless to say\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\blast but not least\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bfirst and foremost\\s*,?\\s*",
    "replacement": "first, "
  },
  {
    "pattern": "\\bat the end of the day\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bin today'?s world\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bin today'?s digital landscape\\s*,?\\s*",
    "replacement": "today "
  },
  {
    "pattern": "\\bin this day and age\\s*,?\\s*",
    "replacement": "now "
  },
  {
    "pattern": "\\bin the modern era\\s*,?\\s*",
    "replacement": "now "
  },
  {
    "pattern": "\\bin the (?:contemporary|current) landscape\\s*,?\\s*",
    "replacement": "today "
  },
  {
    "pattern": "\\bin the realm of\\b",
    "replacement": "in"
  },
  {
    "pattern": "\\bas we navigate\\s+",
    "replacement": "as we handle "
  },
  {
    "pattern": "\\bplays? a (?:crucial|important|pivotal|key|vital|significant) role (?:in|of)\\b",
    "replacement": "is essential to"
  },
  {
    "pattern": "\\bplays? a (?:crucial|important|pivotal|key|vital) role\\b",
    "replacement": "is essential to"
  },
  {
    "pattern": "\\bhas the potential to\\b",
    "replacement": "can"
  },
  {
    "pattern": "\\bdelve(?:s)? into\\b",
    "replacement": "dig into"
  },
  {
    "pattern": "\\bsheds? light on\\b",
    "replacement": "shows"
  },
  {
    "pattern": "\\bbrings? to the forefront\\b",
    "replacement": "highlights"
  },
  {
    "pattern": "\\bembarks? on a journey\\b",
    "replacement": "starts"
  },
  {
    "pattern": "\\bnavigat(?:e|es|ing) the\\b",
    "replacement": "handle the"
  },
  {
    "pattern": "\\ba myriad of\\b",
    "replacement": "many"
  },
  {
    "pattern": "\\ba multitude of\\b",
    "replacement": "many"
  },
  {
    "pattern": "\\ba (?:wide|broad|vast) (?:range|array) of\\b",
    "replacement": "many"
  },
  {
    "pattern": "\\ba significant number of\\b",
    "replacement": "many"
  },
  {
    "pattern": "\\ba (?:large|small) number of\\b",
    "replacement": "many"
  },
  {
    "pattern": "\\bin terms of\\b",
    "replacement": "for"
  },
  {
    "pattern": "\\bwhen it comes to\\b",
    "replacement": "for"
  },
  {
    "pattern": "\\bon the other hand\\s*,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bas a result\\s*,?\\s*",
    "replacement": "so "
  },
  {
    "pattern": "\\bin order to\\b",
    "replacement": "to"
  },
  {
    "pattern": "\\bdue to the fact that\\b",
    "replacement": "because"
  },
  {
    "pattern": "\\bdespite the fact that\\b",
    "replacement": "although"
  },
  {
    "pattern": "\\ba (?:key|crucial|vital|critical) aspect of\\b",
    "replacement": "a core part of"
  }
];

const AI_LEXICON_WORDS = [
  {
    "pattern": "\\bleverage(?:d|s|ing)?\\b",
    "replacement": "use"
  },
  {
    "pattern": "\\butilize(?:d|s|ing)?\\b",
    "replacement": "use"
  },
  {
    "pattern": "\\bfacilitates\\b",
    "replacement": "enables"
  },
  {
    "pattern": "\\bfacilitated\\b",
    "replacement": "enabled"
  },
  {
    "pattern": "\\bfacilitating\\b",
    "replacement": "enabling"
  },
  {
    "pattern": "\\bfacilitate\\b",
    "replacement": "support"
  },
  {
    "pattern": "\\bfosters\\b",
    "replacement": "encourages"
  },
  {
    "pattern": "\\bfostered\\b",
    "replacement": "encouraged"
  },
  {
    "pattern": "\\bfostering\\b",
    "replacement": "encouraging"
  },
  {
    "pattern": "\\bfoster\\b",
    "replacement": "encourage"
  },
  {
    "pattern": "\\bcultivat(?:e|ed|es|ing)\\b",
    "replacement": "grow"
  },
  {
    "pattern": "\\bempower(?:ed|s|ing)?\\b",
    "replacement": "enable"
  },
  {
    "pattern": "\\brobust\\b",
    "replacement": "strong"
  },
  {
    "pattern": "\\bcomprehensively\\b",
    "replacement": "completely"
  },
  {
    "pattern": "\\bcomprehensive\\b",
    "replacement": "complete"
  },
  {
    "pattern": "\\binnovative\\b",
    "replacement": "new"
  },
  {
    "pattern": "\\bunprecedented\\b",
    "replacement": "rare"
  },
  {
    "pattern": "\\bseamlessly\\b",
    "replacement": "smoothly"
  },
  {
    "pattern": "\\bseamless\\b",
    "replacement": "smooth"
  },
  {
    "pattern": "\\bstreamline(?:d|s|ing)?\\b",
    "replacement": "simplify"
  },
  {
    "pattern": "\\bparadigm\\b",
    "replacement": "model"
  },
  {
    "pattern": "\\bsynerg(?:y|ies|istic(?:ally)?)\\b",
    "replacement": "teamwork"
  },
  {
    "pattern": "\\bmultifaceted\\b",
    "replacement": "complex"
  },
  {
    "pattern": "\\bholistically\\b",
    "replacement": "comprehensively"
  },
  {
    "pattern": "\\bholistic\\b",
    "replacement": "well-rounded"
  },
  {
    "pattern": "\\bcutting-edge\\b",
    "replacement": "advanced"
  },
  {
    "pattern": "\\bstate-of-the-art\\b",
    "replacement": "modern"
  },
  {
    "pattern": "\\bgroundbreaking\\b",
    "replacement": "new"
  },
  {
    "pattern": "\\btransformative\\b",
    "replacement": "important"
  },
  {
    "pattern": "\\bshowcase(?:d|s|ing)?\\b",
    "replacement": "show"
  },
  {
    "pattern": "\\bunderscore(?:d|s|ing)?\\b",
    "replacement": "highlight"
  },
  {
    "pattern": "\\belucidate(?:d|s|ing)?\\b",
    "replacement": "explain"
  },
  {
    "pattern": "\\bmitigat(?:e|ed|es|ing)\\b",
    "replacement": "reduce"
  },
  {
    "pattern": "\\bsynthesi[sz]e(?:d|s|ing)?\\b",
    "replacement": "combine"
  },
  {
    "pattern": "\\bmyriad\\b",
    "replacement": "many"
  },
  {
    "pattern": "\\bnevertheless\\b",
    "replacement": "still"
  },
  {
    "pattern": "\\bconsequently\\b",
    "replacement": "so"
  },
  {
    "pattern": "\\bsubsequently\\b",
    "replacement": "then"
  },
  {
    "pattern": "\\bthus,?\\s+",
    "replacement": "so "
  },
  {
    "pattern": "\\bhence,?\\s+",
    "replacement": "so "
  },
  {
    "pattern": "\\bdemonstrat(?:e|es|ed)\\b",
    "replacement": "show"
  },
  {
    "pattern": "\\billustrat(?:e|es|ed)\\b",
    "replacement": "show"
  },
  {
    "pattern": "\\bnotably\\b,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bremarkably\\b,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bsignificantly\\b,?\\s*",
    "replacement": ""
  },
  {
    "pattern": "\\bessentially\\b,?\\s*",
    "replacement": ""
  }
];

const VERB_FORMS = {
  use: ['used', 'uses', 'using'],
  help: ['helped', 'helps', 'helping'],
  build: ['built', 'builds', 'building'],
  grow: ['grew', 'grows', 'growing'],
  enable: ['enabled', 'enables', 'enabling'],
  simplify: ['simplified', 'simplifies', 'simplifying'],
  show: ['showed', 'shows', 'showing'],
  explore: ['explored', 'explores', 'exploring'],
  improve: ['improved', 'improves', 'improving'],
  support: ['supported', 'supports', 'supporting'],
  highlight: ['highlighted', 'highlights', 'highlighting'],
  stress: ['stressed', 'stresses', 'stressing'],
  handle: ['handled', 'handles', 'handling'],
  change: ['changed', 'changes', 'changing'],
  start: ['started', 'starts', 'starting'],
  dig: ['dug', 'digs', 'digging']
};

function inflectLike(match, replacement) {
  const forms = VERB_FORMS[replacement.toLowerCase()];
  if (!forms) return replacement;
  const m = match.toLowerCase();
  if (/(?:ing)$/.test(m)) return forms[2];
  if (/(?:ed|d)$/.test(m) && !/(?:ss|us|is)$/.test(m)) return forms[0];
  if (/s$/.test(m) && !/(?:ss|us|is)$/.test(m)) return forms[1];
  return replacement;
}

function matchCase(rep, original) {
  return /^[A-Z]/.test(original) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
}

function applyCollocationsAndLexicon(text) {
  let r = text;

  // Apply AI lexicon phrases
  for (const item of AI_LEXICON_PHRASES) {
    try {
      const re = new RegExp(item.pattern, 'gi');
      r = r.replace(re, item.replacement);
    } catch (e) {}
  }

  // Apply AI lexicon words with verb inflection
  for (const item of AI_LEXICON_WORDS) {
    try {
      const re = new RegExp(item.pattern, 'gi');
      r = r.replace(re, (m) => matchCase(inflectLike(m, item.replacement), m));
    } catch (e) {}
  }

  // Apply collocations
  for (const item of COLLOCATIONS) {
    try {
      const re = new RegExp(`\\b${item.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (re.test(r)) {
        const rep = item.to[Math.floor(Math.random() * item.to.length)];
        r = r.replace(re, (m) => matchCase(rep, m));
      }
    } catch (e) {}
  }

  return r;
}

// ── 5. Context-Safe Synonym Perturbation ────────────────────────────────────────
const SYNONYMS = {
  "abandon": [
    "leave",
    "give up",
    "forsake",
    "ditch",
    "walk away from"
  ],
  "ability": [
    "capability",
    "skill",
    "capacity",
    "talent",
    "knack"
  ],
  "able": [
    "capable",
    "competent",
    "qualified",
    "equipped",
    "fit"
  ],
  "about": [
    "regarding",
    "concerning",
    "on the subject of",
    "in relation to"
  ],
  "above": [
    "over",
    "higher than",
    "beyond",
    "atop"
  ],
  "absence": [
    "lack",
    "shortage",
    "void",
    "nonexistence"
  ],
  "absolutely": [
    "completely",
    "totally",
    "entirely",
    "utterly",
    "definitely"
  ],
  "absorb": [
    "soak up",
    "take in",
    "assimilate",
    "digest",
    "swallow"
  ],
  "abstract": [
    "theoretical",
    "conceptual",
    "intangible",
    "vague"
  ],
  "abundant": [
    "plentiful",
    "copious",
    "ample",
    "rich",
    "generous"
  ],
  "accept": [
    "acknowledge",
    "embrace",
    "adopt",
    "take on",
    "welcome"
  ],
  "access": [
    "entry",
    "approach",
    "admission",
    "way in"
  ],
  "accident": [
    "mishap",
    "incident",
    "mishappenstance",
    "fluke"
  ],
  "accomplish": [
    "achieve",
    "pull off",
    "pull together",
    "get done",
    "bring about"
  ],
  "according": [
    "as stated by",
    "per",
    "based on",
    "in line with"
  ],
  "accumulate": [
    "gather",
    "collect",
    "amass",
    "build up",
    "pile up"
  ],
  "accurate": [
    "correct",
    "precise",
    "exact",
    "spot-on",
    "on the money"
  ],
  "achieve": [
    "accomplish",
    "reach",
    "attain",
    "pull off",
    "realize"
  ],
  "acknowledge": [
    "recognize",
    "admit",
    "accept",
    "own up to",
    "concede"
  ],
  "acquire": [
    "get",
    "obtain",
    "gain",
    "pick up",
    "land"
  ],
  "actually": [
    "really",
    "honestly",
    "truthfully",
    "in fact"
  ],
  "address": [
    "tackle",
    "deal with",
    "handle",
    "approach",
    "take on"
  ],
  "adequate": [
    "sufficient",
    "enough",
    "passable",
    "decent",
    "acceptable"
  ],
  "adjust": [
    "tweak",
    "modify",
    "adapt",
    "fine-tune",
    "alter"
  ],
  "administration": [
    "management",
    "leadership",
    "the people running things"
  ],
  "admire": [
    "respect",
    "look up to",
    "appreciate",
    "esteem"
  ],
  "adopt": [
    "take on",
    "embrace",
    "choose",
    "go with",
    "pick up"
  ],
  "advance": [
    "progress",
    "move forward",
    "develop",
    "push ahead"
  ],
  "advantage": [
    "benefit",
    "edge",
    "upper hand",
    "plus",
    "strength"
  ],
  "advice": [
    "guidance",
    "counsel",
    "input",
    "recommendation",
    "two cents"
  ],
  "advocate": [
    "supporter",
    "champion",
    "backer",
    "promoter"
  ],
  "affect": [
    "influence",
    "impact",
    "shape",
    "sway",
    "alter"
  ],
  "afford": [
    "have the means for",
    "be able to swing",
    "manage"
  ],
  "afraid": [
    "scared",
    "fearful",
    "terrified",
    "worried",
    "anxious"
  ],
  "after": [
    "following",
    "post",
    "once",
    "in the wake of"
  ],
  "afterwards": [
    "later",
    "subsequently",
    "then",
    "after that"
  ],
  "against": [
    "opposed to",
    "resisting",
    "anti"
  ],
  "age": [
    "era",
    "period",
    "time",
    "epoch"
  ],
  "agreement": [
    "deal",
    "pact",
    "understanding",
    "arrangement"
  ],
  "almost": [
    "nearly",
    "practically",
    "virtually",
    "pretty much",
    "close to"
  ],
  "alone": [
    "by itself",
    "solo",
    "on its own",
    "unaccompanied"
  ],
  "already": [
    "previously",
    "by now",
    "in advance"
  ],
  "also": [
    "too",
    "additionally",
    "as well",
    "on top of that",
    "plus"
  ],
  "although": [
    "even though",
    "though",
    "while",
    "despite the fact that"
  ],
  "always": [
    "constantly",
    "consistently",
    "perpetually",
    "forever",
    "nonstop"
  ],
  "amazing": [
    "incredible",
    "remarkable",
    "stunning",
    "unbelievable",
    "mind-blowing"
  ],
  "amount": [
    "quantity",
    "number",
    "volume",
    "sum"
  ],
  "analyze": [
    "examine",
    "study",
    "break down",
    "look into",
    "dig into"
  ],
  "ancient": [
    "old",
    "historic",
    "age-old",
    "primordial",
    "from way back"
  ],
  "angry": [
    "mad",
    "furious",
    "upset",
    "livid",
    "pissed off"
  ],
  "announce": [
    "declare",
    "reveal",
    "share",
    "make known",
    "put out there"
  ],
  "annoying": [
    "irritating",
    "frustrating",
    "bothersome",
    "aggravating"
  ],
  "answer": [
    "response",
    "reply",
    "solution"
  ],
  "anxious": [
    "worried",
    "nervous",
    "uneasy",
    "on edge",
    "stressed"
  ],
  "apparent": [
    "obvious",
    "clear",
    "evident",
    "plain to see",
    "glaring"
  ],
  "apparently": [
    "seemingly",
    "supposedly",
    "it seems like",
    "from the looks of it"
  ],
  "appeal": [
    "attraction",
    "draw",
    "pull",
    "charm"
  ],
  "appear": [
    "seem",
    "look like",
    "come across as",
    "show up"
  ],
  "application": [
    "use",
    "implementation",
    "deployment",
    "practical use"
  ],
  "approach": [
    "method",
    "way",
    "strategy",
    "tactic",
    "angle"
  ],
  "appropriate": [
    "suitable",
    "proper",
    "fitting",
    "right"
  ],
  "approve": [
    "endorse",
    "sign off on",
    "give the green light",
    "back"
  ],
  "area": [
    "region",
    "zone",
    "territory",
    "space",
    "field"
  ],
  "argue": [
    "contend",
    "claim",
    "assert",
    "make the case"
  ],
  "argument": [
    "debate",
    "dispute",
    "discussion",
    "case"
  ],
  "arise": [
    "come up",
    "emerge",
    "surface",
    "pop up",
    "spring up"
  ],
  "arrange": [
    "set up",
    "organize",
    "put together",
    "coordinate"
  ],
  "artificial": [
    "synthetic",
    "man-made",
    "manufactured",
    "fake"
  ],
  "aspect": [
    "side",
    "part",
    "facet",
    "dimension",
    "angle"
  ],
  "assemble": [
    "gather",
    "put together",
    "bring together",
    "round up"
  ],
  "assess": [
    "evaluate",
    "judge",
    "gauge",
    "measure",
    "weigh up"
  ],
  "assign": [
    "give",
    "allocate",
    "hand out",
    "delegate",
    "dole out"
  ],
  "assist": [
    "help",
    "support",
    "aid",
    "lend a hand"
  ],
  "assume": [
    "presume",
    "suppose",
    "take for granted",
    "figure",
    "guess"
  ],
  "assure": [
    "guarantee",
    "promise",
    "ensure",
    "make certain"
  ],
  "atmosphere": [
    "vibe",
    "ambiance",
    "feel",
    "mood",
    "aura"
  ],
  "attach": [
    "connect",
    "link",
    "join",
    "fasten",
    "tie"
  ],
  "attempt": [
    "try",
    "effort",
    "shot",
    "stab at",
    "go at"
  ],
  "attention": [
    "focus",
    "notice",
    "awareness",
    "consideration"
  ],
  "attract": [
    "draw",
    "pull in",
    "entice",
    "lure"
  ],
  "authority": [
    "power",
    "control",
    "say-so",
    "jurisdiction"
  ],
  "available": [
    "accessible",
    "on hand",
    "at your disposal",
    "free"
  ],
  "average": [
    "typical",
    "ordinary",
    "standard",
    "run-of-the-mill",
    "normal"
  ],
  "avoid": [
    "steer clear of",
    "dodge",
    "sidestep",
    "shun",
    "evade"
  ],
  "awful": [
    "terrible",
    "dreadful",
    "horrible",
    "atrocious"
  ],
  "back": [
    "support",
    "back up",
    "stand behind",
    "champion"
  ],
  "basic": [
    "fundamental",
    "core",
    "essential",
    "foundational"
  ],
  "basically": [
    "essentially",
    "pretty much",
    "fundamentally",
    "at its core"
  ],
  "basis": [
    "foundation",
    "base",
    "grounding",
    "starting point"
  ],
  "battle": [
    "fight",
    "struggle",
    "conflict",
    "clash"
  ],
  "because": [
    "since",
    "as",
    "seeing as",
    "given that"
  ],
  "become": [
    "turn into",
    "grow into",
    "evolve into",
    "develop into"
  ],
  "before": [
    "earlier",
    "prior",
    "leading up to",
    "ahead of"
  ],
  "begin": [
    "start",
    "kick off",
    "get going",
    "launch"
  ],
  "behavior": [
    "conduct",
    "actions",
    "way of acting",
    "demeanor"
  ],
  "believe": [
    "think",
    "feel",
    "reckon",
    "figure"
  ],
  "belong": [
    "be part of",
    "fit in",
    "go with"
  ],
  "benefit": [
    "advantage",
    "perk",
    "plus",
    "upside",
    "gain"
  ],
  "besides": [
    "apart from",
    "other than",
    "in addition to",
    "plus"
  ],
  "between": [
    "among",
    "in the middle of",
    "in between"
  ],
  "beyond": [
    "past",
    "further than",
    "outside of",
    "above"
  ],
  "big": [
    "large",
    "huge",
    "massive",
    "major"
  ],
  "blame": [
    "point the finger at",
    "hold responsible",
    "pin on"
  ],
  "blend": [
    "mix",
    "combine",
    "merge",
    "fuse",
    "mingle"
  ],
  "block": [
    "obstruct",
    "prevent",
    "stop",
    "stand in the way of"
  ],
  "blow": [
    "impact",
    "hit",
    "shock",
    "setback"
  ],
  "bold": [
    "daring",
    "courageous",
    "brave",
    "fearless"
  ],
  "boost": [
    "increase",
    "lift",
    "improve",
    "elevate",
    "bump up"
  ],
  "boring": [
    "dull",
    "tedious",
    "uninteresting",
    "dry",
    "mind-numbing"
  ],
  "bound": [
    "tied",
    "destined",
    "certain",
    "headed"
  ],
  "boundary": [
    "border",
    "limit",
    "edge",
    "line"
  ],
  "break": [
    "shatter",
    "crack",
    "fracture",
    "snap",
    "rupture"
  ],
  "brief": [
    "short",
    "quick",
    "concise",
    "fleeting",
    "momentary"
  ],
  "bring": [
    "carry",
    "deliver",
    "provide",
    "supply"
  ],
  "broad": [
    "wide",
    "extensive",
    "sweeping",
    "far-reaching"
  ],
  "build": [
    "construct",
    "create",
    "put together",
    "develop",
    "erect"
  ],
  "burden": [
    "load",
    "weight",
    "responsibility",
    "strain"
  ],
  "calculate": [
    "compute",
    "figure out",
    "work out",
    "estimate"
  ],
  "call": [
    "refer to",
    "label",
    "name",
    "describe as"
  ],
  "capable": [
    "competent",
    "able",
    "qualified",
    "equipped",
    "skilled"
  ],
  "capacity": [
    "ability",
    "capability",
    "potential",
    "room"
  ],
  "capture": [
    "catch",
    "grab",
    "record",
    "seize",
    "snag"
  ],
  "careful": [
    "cautious",
    "mindful",
    "attentive",
    "wary"
  ],
  "carry": [
    "bring",
    "transport",
    "move",
    "haul"
  ],
  "case": [
    "instance",
    "situation",
    "scenario",
    "example"
  ],
  "cause": [
    "reason",
    "root",
    "source",
    "driving force"
  ],
  "cease": [
    "stop",
    "end",
    "halt",
    "quit",
    "discontinue"
  ],
  "certain": [
    "sure",
    "definite",
    "specific",
    "particular"
  ],
  "challenge": [
    "obstacle",
    "hurdle",
    "test",
    "difficulty",
    "problem"
  ],
  "chance": [
    "opportunity",
    "shot",
    "possibility",
    "likelihood"
  ],
  "change": [
    "shift",
    "alter",
    "modify",
    "revamp"
  ],
  "characteristic": [
    "trait",
    "feature",
    "quality",
    "attribute",
    "mark"
  ],
  "cheap": [
    "inexpensive",
    "affordable",
    "low-cost",
    "budget"
  ],
  "choose": [
    "pick",
    "select",
    "opt for",
    "go with"
  ],
  "circumstance": [
    "situation",
    "condition",
    "context",
    "state of affairs"
  ],
  "claim": [
    "assert",
    "state",
    "argue",
    "maintain",
    "contend"
  ],
  "clear": [
    "obvious",
    "plain",
    "apparent",
    "straightforward"
  ],
  "clearly": [
    "obviously",
    "evidently",
    "plainly",
    "without a doubt"
  ],
  "close": [
    "near",
    "nearby",
    "adjacent",
    "shut"
  ],
  "clue": [
    "hint",
    "sign",
    "indicator",
    "lead",
    "tip-off"
  ],
  "collect": [
    "gather",
    "assemble",
    "accumulate",
    "round up"
  ],
  "combine": [
    "merge",
    "join",
    "blend",
    "mix",
    "unite"
  ],
  "come": [
    "arrive",
    "approach",
    "show up",
    "head over"
  ],
  "common": [
    "widespread",
    "typical",
    "standard",
    "usual"
  ],
  "communicate": [
    "convey",
    "express",
    "get across",
    "pass along",
    "share"
  ],
  "community": [
    "group",
    "society",
    "network",
    "collective"
  ],
  "company": [
    "business",
    "firm",
    "organization",
    "enterprise"
  ],
  "compare": [
    "contrast",
    "weigh against",
    "put side by side"
  ],
  "compel": [
    "force",
    "push",
    "drive",
    "pressure"
  ],
  "compensate": [
    "make up for",
    "offset",
    "balance out",
    "reimburse"
  ],
  "compete": [
    "vie",
    "contend",
    "go head-to-head",
    "battle"
  ],
  "complain": [
    "grumble",
    "gripe",
    "whine",
    "protest"
  ],
  "complex": [
    "complicated",
    "intricate",
    "involved",
    "tricky"
  ],
  "component": [
    "part",
    "piece",
    "element",
    "building block"
  ],
  "comprehend": [
    "understand",
    "grasp",
    "wrap your head around",
    "get"
  ],
  "comprehensive": [
    "thorough",
    "complete",
    "all-inclusive",
    "exhaustive"
  ],
  "concentrate": [
    "focus",
    "zero in on",
    "hone in on",
    "pay attention to"
  ],
  "concern": [
    "worry",
    "care",
    "interest",
    "issue"
  ],
  "conclude": [
    "wrap up",
    "finish",
    "end",
    "close",
    "wind down"
  ],
  "concrete": [
    "specific",
    "solid",
    "tangible",
    "definite"
  ],
  "condition": [
    "state",
    "situation",
    "shape",
    "status"
  ],
  "conduct": [
    "carry out",
    "perform",
    "execute",
    "do",
    "run"
  ],
  "confirm": [
    "verify",
    "validate",
    "double-check",
    "corroborate"
  ],
  "conflict": [
    "clash",
    "dispute",
    "disagreement",
    "friction",
    "tension"
  ],
  "confront": [
    "face",
    "tackle",
    "deal with",
    "address head-on"
  ],
  "confuse": [
    "bewilder",
    "perplex",
    "muddle",
    "mix up"
  ],
  "connect": [
    "link",
    "tie",
    "join",
    "bridge",
    "hook up"
  ],
  "consequence": [
    "result",
    "outcome",
    "effect",
    "impact",
    "ramification"
  ],
  "consider": [
    "think about",
    "weigh",
    "ponder",
    "mull over",
    "take into account"
  ],
  "consist": [
    "be made up of",
    "be composed of",
    "comprise"
  ],
  "constant": [
    "steady",
    "continuous",
    "unrelenting",
    "nonstop",
    "never-ending"
  ],
  "constitute": [
    "make up",
    "form",
    "comprise",
    "represent"
  ],
  "construct": [
    "build",
    "create",
    "put together",
    "erect"
  ],
  "consult": [
    "ask",
    "seek advice from",
    "check with",
    "run by"
  ],
  "consume": [
    "use up",
    "eat up",
    "devour",
    "take in"
  ],
  "contact": [
    "reach out to",
    "get in touch with",
    "connect with"
  ],
  "contain": [
    "hold",
    "include",
    "house",
    "carry"
  ],
  "contemporary": [
    "current",
    "modern",
    "present-day",
    "today\\'s"
  ],
  "content": [
    "happy",
    "satisfied",
    "pleased",
    "fine with"
  ],
  "context": [
    "setting",
    "background",
    "circumstances",
    "frame"
  ],
  "continue": [
    "keep going",
    "carry on",
    "press on",
    "persist"
  ],
  "contract": [
    "agreement",
    "deal",
    "arrangement"
  ],
  "contradict": [
    "disagree with",
    "conflict with",
    "go against",
    "counter"
  ],
  "contrast": [
    "difference",
    "distinction",
    "opposition",
    "juxtaposition"
  ],
  "contribute": [
    "chip in",
    "pitch in",
    "add",
    "provide",
    "give"
  ],
  "control": [
    "manage",
    "direct",
    "govern",
    "oversee",
    "run"
  ],
  "convenient": [
    "handy",
    "easy",
    "practical",
    "accessible"
  ],
  "convince": [
    "persuade",
    "win over",
    "talk into",
    "sell on"
  ],
  "cooperate": [
    "work together",
    "collaborate",
    "team up",
    "join forces"
  ],
  "copy": [
    "replica",
    "duplicate",
    "version",
    "reproduction"
  ],
  "core": [
    "heart",
    "center",
    "essence",
    "foundation"
  ],
  "correct": [
    "right",
    "accurate",
    "true",
    "proper",
    "on point"
  ],
  "correspond": [
    "match",
    "align",
    "line up with",
    "relate to"
  ],
  "cost": [
    "price",
    "expense",
    "fee",
    "charge"
  ],
  "could": [
    "might",
    "may",
    "would be able to"
  ],
  "count": [
    "matter",
    "make a difference",
    "carry weight"
  ],
  "couple": [
    "few",
    "pair",
    "two or three",
    "handful"
  ],
  "course": [
    "path",
    "route",
    "direction",
    "track"
  ],
  "create": [
    "make",
    "build",
    "craft",
    "develop"
  ],
  "creative": [
    "inventive",
    "innovative",
    "original",
    "imaginative"
  ],
  "crucial": [
    "critical",
    "vital",
    "key",
    "essential",
    "make-or-break"
  ],
  "crush": [
    "overwhelm",
    "defeat",
    "destroy",
    "obliterate"
  ],
  "curious": [
    "intrigued",
    "inquisitive",
    "fascinated",
    "wondering"
  ],
  "current": [
    "present",
    "existing",
    "ongoing",
    "present-day"
  ],
  "currently": [
    "right now",
    "at the moment",
    "these days",
    "as of now"
  ],
  "customary": [
    "usual",
    "typical",
    "standard",
    "normal",
    "routine"
  ],
  "damage": [
    "harm",
    "hurt",
    "ruin",
    "wreck"
  ],
  "danger": [
    "risk",
    "threat",
    "hazard",
    "peril"
  ],
  "decide": [
    "choose",
    "settle on",
    "make up your mind",
    "resolve"
  ],
  "decision": [
    "choice",
    "call",
    "ruling",
    "judgment",
    "determination"
  ],
  "declare": [
    "announce",
    "state",
    "proclaim",
    "make known"
  ],
  "decline": [
    "decrease",
    "drop",
    "fall",
    "go down",
    "shrink"
  ],
  "decrease": [
    "reduction",
    "drop",
    "cut",
    "dip",
    "fall"
  ],
  "deep": [
    "profound",
    "intense",
    "thorough",
    "far-reaching"
  ],
  "defeat": [
    "beat",
    "overcome",
    "conquer",
    "triumph over"
  ],
  "defend": [
    "protect",
    "guard",
    "shield",
    "stand up for"
  ],
  "define": [
    "spell out",
    "lay out",
    "specify",
    "establish"
  ],
  "definitely": [
    "absolutely",
    "certainly",
    "without a doubt",
    "for sure"
  ],
  "degree": [
    "extent",
    "level",
    "measure",
    "amount"
  ],
  "delay": [
    "postpone",
    "put off",
    "push back",
    "defer"
  ],
  "deliver": [
    "provide",
    "supply",
    "bring",
    "hand over",
    "give"
  ],
  "demand": [
    "request",
    "require",
    "call for",
    "need"
  ],
  "demonstrate": [
    "show",
    "prove",
    "illustrate",
    "display",
    "reveal"
  ],
  "deny": [
    "reject",
    "refuse",
    "dispute",
    "push back on"
  ],
  "depart": [
    "leave",
    "go",
    "head out",
    "set off"
  ],
  "depend": [
    "rely",
    "count on",
    "lean on",
    "hinge on"
  ],
  "depict": [
    "portray",
    "show",
    "represent",
    "illustrate"
  ],
  "deploy": [
    "roll out",
    "put in place",
    "implement",
    "launch"
  ],
  "describe": [
    "explain",
    "detail",
    "lay out",
    "spell out",
    "paint a picture of"
  ],
  "description": [
    "account",
    "breakdown",
    "summary",
    "overview"
  ],
  "deserve": [
    "earn",
    "warrant",
    "merit",
    "be worthy of"
  ],
  "design": [
    "plan",
    "create",
    "develop",
    "craft",
    "lay out"
  ],
  "desire": [
    "want",
    "wish",
    "longing",
    "craving"
  ],
  "destroy": [
    "ruin",
    "wreck",
    "demolish",
    "obliterate",
    "wipe out"
  ],
  "detail": [
    "specifics",
    "particulars",
    "nuances",
    "ins and outs"
  ],
  "detect": [
    "spot",
    "notice",
    "identify",
    "catch",
    "pick up on"
  ],
  "determine": [
    "figure out",
    "decide",
    "establish",
    "pin down",
    "work out"
  ],
  "develop": [
    "build",
    "create",
    "grow",
    "evolve",
    "craft"
  ],
  "device": [
    "tool",
    "gadget",
    "instrument",
    "piece of equipment"
  ],
  "devote": [
    "dedicate",
    "commit",
    "pour into",
    "invest"
  ],
  "different": [
    "distinct",
    "various",
    "diverse",
    "unlike"
  ],
  "difficult": [
    "hard",
    "tough",
    "challenging",
    "tricky"
  ],
  "difficulty": [
    "struggle",
    "challenge",
    "problem",
    "obstacle",
    "hurdle"
  ],
  "direct": [
    "straight",
    "immediate",
    "explicit",
    "point-blank"
  ],
  "direction": [
    "way",
    "path",
    "course",
    "route"
  ],
  "directly": [
    "straight",
    "personally",
    "face-to-face"
  ],
  "disappear": [
    "vanish",
    "fade",
    "go away",
    "dissolve"
  ],
  "discover": [
    "find",
    "uncover",
    "stumble upon",
    "come across"
  ],
  "discuss": [
    "talk about",
    "cover",
    "explore",
    "dive into",
    "go over"
  ],
  "discussion": [
    "conversation",
    "talk",
    "dialogue",
    "exchange"
  ],
  "disease": [
    "illness",
    "sickness",
    "condition",
    "ailment"
  ],
  "display": [
    "show",
    "exhibit",
    "reveal",
    "present",
    "put on display"
  ],
  "distance": [
    "gap",
    "space",
    "span",
    "stretch"
  ],
  "distinct": [
    "clear",
    "separate",
    "different",
    "noticeable"
  ],
  "distribute": [
    "spread",
    "share",
    "hand out",
    "disperse"
  ],
  "disturb": [
    "bother",
    "upset",
    "interrupt",
    "disrupt"
  ],
  "diverse": [
    "varied",
    "mixed",
    "assorted",
    "wide-ranging"
  ],
  "divide": [
    "split",
    "separate",
    "break up",
    "carve up"
  ],
  "domestic": [
    "home",
    "local",
    "national",
    "internal"
  ],
  "dominant": [
    "leading",
    "main",
    "primary",
    "top",
    "foremost"
  ],
  "doubt": [
    "question",
    "uncertainty",
    "skepticism",
    "hesitation"
  ],
  "downside": [
    "drawback",
    "negative",
    "catch",
    "disadvantage"
  ],
  "dramatic": [
    "striking",
    "significant",
    "major",
    "noticeable",
    "huge"
  ],
  "drastic": [
    "extreme",
    "severe",
    "radical",
    "harsh"
  ],
  "duration": [
    "length",
    "time",
    "span",
    "period"
  ],
  "during": [
    "throughout",
    "in the course of",
    "while",
    "over"
  ],
  "early": [
    "ahead of time",
    "before expected",
    "at the start"
  ],
  "earn": [
    "make",
    "gain",
    "bring in",
    "pick up"
  ],
  "ease": [
    "comfort",
    "simplicity",
    "effortlessness"
  ],
  "economic": [
    "financial",
    "fiscal",
    "monetary"
  ],
  "economy": [
    "market",
    "financial system",
    "economics"
  ],
  "effect": [
    "impact",
    "result",
    "outcome",
    "consequence"
  ],
  "effective": [
    "successful",
    "potent",
    "powerful",
    "efficient",
    "productive"
  ],
  "efficiency": [
    "productivity",
    "effectiveness",
    "performance"
  ],
  "effort": [
    "attempt",
    "try",
    "push",
    "energy"
  ],
  "either": [
    "one or the other",
    "both options",
    "whichever"
  ],
  "elaborate": [
    "expand on",
    "detail",
    "flesh out",
    "go into more depth"
  ],
  "element": [
    "part",
    "piece",
    "component",
    "aspect",
    "factor"
  ],
  "eliminate": [
    "remove",
    "get rid of",
    "wipe out",
    "eradicate",
    "cut out"
  ],
  "embrace": [
    "adopt",
    "welcome",
    "take on",
    "accept"
  ],
  "emerge": [
    "come up",
    "appear",
    "surface",
    "arise"
  ],
  "emphasize": [
    "stress",
    "highlight",
    "underline",
    "drive home",
    "accentuate"
  ],
  "employ": [
    "use",
    "utilize",
    "apply",
    "put to work"
  ],
  "enable": [
    "allow",
    "make possible",
    "facilitate",
    "let"
  ],
  "encounter": [
    "come across",
    "face",
    "run into",
    "meet"
  ],
  "encourage": [
    "motivate",
    "inspire",
    "push",
    "urge"
  ],
  "end": [
    "finish",
    "wrap up",
    "close",
    "conclude"
  ],
  "enemy": [
    "opponent",
    "adversary",
    "foe",
    "rival"
  ],
  "energy": [
    "vigor",
    "power",
    "drive",
    "stamina"
  ],
  "engage": [
    "involve",
    "participate",
    "take part",
    "dive in"
  ],
  "enhance": [
    "improve",
    "boost",
    "elevate",
    "upgrade",
    "step up"
  ],
  "enormous": [
    "huge",
    "massive",
    "vast",
    "gigantic",
    "immense"
  ],
  "ensure": [
    "make sure",
    "guarantee",
    "see to it",
    "confirm"
  ],
  "enter": [
    "go into",
    "join",
    "step into",
    "access"
  ],
  "entire": [
    "whole",
    "complete",
    "full",
    "total",
    "entire"
  ],
  "environment": [
    "surroundings",
    "setting",
    "context",
    "habitat"
  ],
  "episode": [
    "instance",
    "occurrence",
    "event",
    "incident"
  ],
  "equal": [
    "same",
    "equivalent",
    "matching",
    "comparable"
  ],
  "equip": [
    "provide",
    "supply",
    "outfit",
    "arm"
  ],
  "error": [
    "mistake",
    "slip-up",
    "blunder",
    "oversight"
  ],
  "escape": [
    "get away",
    "flee",
    "break free",
    "bolt"
  ],
  "especially": [
    "particularly",
    "notably",
    "specifically",
    "above all"
  ],
  "essential": [
    "crucial",
    "vital",
    "key",
    "necessary",
    "must-have"
  ],
  "establish": [
    "set up",
    "create",
    "found",
    "put in place",
    "build"
  ],
  "evaluate": [
    "assess",
    "judge",
    "measure",
    "rate",
    "weigh"
  ],
  "event": [
    "happening",
    "occasion",
    "incident",
    "occurrence"
  ],
  "eventually": [
    "finally",
    "in the end",
    "sooner or later",
    "down the road"
  ],
  "every": [
    "each",
    "all",
    "every single"
  ],
  "evidence": [
    "proof",
    "data",
    "signs",
    "indication",
    "findings"
  ],
  "evil": [
    "bad",
    "wicked",
    "terrible",
    "malicious"
  ],
  "exact": [
    "precise",
    "accurate",
    "specific",
    "spot-on"
  ],
  "examine": [
    "inspect",
    "look at",
    "analyze",
    "review",
    "check out"
  ],
  "example": [
    "instance",
    "case",
    "illustration",
    "sample"
  ],
  "excellent": [
    "outstanding",
    "great",
    "superb",
    "top-notch",
    "stellar"
  ],
  "except": [
    "other than",
    "apart from",
    "besides",
    "but"
  ],
  "exchange": [
    "swap",
    "trade",
    "switch",
    "give and take"
  ],
  "exciting": [
    "thrilling",
    "stirring",
    "electrifying",
    "pulse-pounding"
  ],
  "exclude": [
    "leave out",
    "omit",
    "rule out",
    "keep out"
  ],
  "execute": [
    "carry out",
    "perform",
    "do",
    "implement"
  ],
  "exhibit": [
    "show",
    "display",
    "present",
    "demonstrate"
  ],
  "exist": [
    "be present",
    "live",
    "occur",
    "be around"
  ],
  "expand": [
    "grow",
    "broaden",
    "scale up",
    "extend",
    "stretch"
  ],
  "expect": [
    "anticipate",
    "foresee",
    "look forward to",
    "predict"
  ],
  "expense": [
    "cost",
    "price",
    "charge",
    "outlay"
  ],
  "experience": [
    "go through",
    "face",
    "live through",
    "encounter"
  ],
  "experiment": [
    "test",
    "trial",
    "tryout",
    "pilot"
  ],
  "expert": [
    "specialist",
    "pro",
    "authority",
    "master"
  ],
  "explain": [
    "clarify",
    "spell out",
    "break down",
    "walk through"
  ],
  "explicit": [
    "clear",
    "direct",
    "specific",
    "stated"
  ],
  "explore": [
    "investigate",
    "look into",
    "dive into",
    "probe",
    "dig into"
  ],
  "expose": [
    "reveal",
    "uncover",
    "show",
    "bring to light"
  ],
  "extend": [
    "stretch",
    "expand",
    "lengthen",
    "reach"
  ],
  "extent": [
    "degree",
    "scope",
    "measure",
    "level"
  ],
  "external": [
    "outside",
    "outer",
    "foreign"
  ],
  "extra": [
    "additional",
    "more",
    "bonus",
    "supplementary"
  ],
  "extreme": [
    "intense",
    "severe",
    "drastic",
    "radical"
  ],
  "face": [
    "confront",
    "deal with",
    "tackle",
    "take on"
  ],
  "fact": [
    "reality",
    "truth",
    "reality of the matter"
  ],
  "factor": [
    "element",
    "variable",
    "piece",
    "consideration"
  ],
  "fail": [
    "fall short",
    "not make it",
    "come up short",
    "fall flat"
  ],
  "failure": [
    "flop",
    "disaster",
    "setback",
    "letdown"
  ],
  "fair": [
    "reasonable",
    "just",
    "balanced",
    "equitable"
  ],
  "faith": [
    "belief",
    "trust",
    "confidence"
  ],
  "familiar": [
    "known",
    "recognized",
    "well-known",
    "comfortable"
  ],
  "famous": [
    "well-known",
    "renowned",
    "celebrated",
    "notable"
  ],
  "feature": [
    "characteristic",
    "aspect",
    "quality",
    "element"
  ],
  "few": [
    "a handful of",
    "a couple of",
    "not many",
    "several"
  ],
  "fierce": [
    "intense",
    "aggressive",
    "strong",
    "powerful"
  ],
  "figure": [
    "number",
    "stat",
    "amount",
    "quantity"
  ],
  "finally": [
    "at last",
    "in the end",
    "after all that"
  ],
  "financial": [
    "monetary",
    "economic",
    "money-related",
    "fiscal"
  ],
  "finding": [
    "discovery",
    "result",
    "conclusion",
    "observation"
  ],
  "firm": [
    "company",
    "business",
    "organization",
    "enterprise"
  ],
  "flexible": [
    "adaptable",
    "versatile",
    "adjustable",
    "moldable"
  ],
  "flow": [
    "movement",
    "stream",
    "current",
    "progression"
  ],
  "focus": [
    "concentrate",
    "zero in",
    "hone in",
    "center"
  ],
  "follow": [
    "track",
    "pursue",
    "go after",
    "trail"
  ],
  "force": [
    "power",
    "strength",
    "pressure",
    "might"
  ],
  "foreign": [
    "external",
    "outside",
    "international",
    "alien"
  ],
  "form": [
    "shape",
    "structure",
    "type",
    "format"
  ],
  "formal": [
    "official",
    "proper",
    "structured",
    "ceremonial"
  ],
  "former": [
    "previous",
    "past",
    "earlier",
    "old"
  ],
  "formula": [
    "recipe",
    "approach",
    "method",
    "blueprint"
  ],
  "fortune": [
    "wealth",
    "money",
    "riches",
    "prosperity"
  ],
  "forward": [
    "ahead",
    "onward",
    "on",
    "in front"
  ],
  "foundation": [
    "base",
    "basis",
    "grounding",
    "cornerstone"
  ],
  "fraction": [
    "portion",
    "part",
    "piece",
    "sliver"
  ],
  "fragment": [
    "piece",
    "bit",
    "chunk",
    "shard",
    "segment"
  ],
  "framework": [
    "structure",
    "system",
    "setup",
    "skeleton"
  ],
  "frequent": [
    "common",
    "regular",
    "often",
    "routine"
  ],
  "fresh": [
    "new",
    "novel",
    "original",
    "recent"
  ],
  "friend": [
    "buddy",
    "pal",
    "mate",
    "companion"
  ],
  "front": [
    "front line",
    "forefront",
    "lead"
  ],
  "fulfill": [
    "meet",
    "satisfy",
    "accomplish",
    "deliver on"
  ],
  "function": [
    "purpose",
    "role",
    "job",
    "use"
  ],
  "fundamental": [
    "basic",
    "core",
    "essential",
    "foundational",
    "central"
  ],
  "future": [
    "what lies ahead",
    "down the road",
    "tomorrow"
  ],
  "gain": [
    "acquire",
    "obtain",
    "earn",
    "pick up",
    "secure"
  ],
  "gathering": [
    "collection",
    "assembly",
    "meetup",
    "get-together"
  ],
  "general": [
    "overall",
    "broad",
    "widespread",
    "common"
  ],
  "generate": [
    "create",
    "produce",
    "make",
    "yield",
    "spawn"
  ],
  "generous": [
    "giving",
    "kind",
    "lavish",
    "big-hearted"
  ],
  "genuine": [
    "real",
    "authentic",
    "sincere",
    "true",
    "legit"
  ],
  "goal": [
    "aim",
    "objective",
    "target",
    "endgame",
    "purpose"
  ],
  "good": [
    "solid",
    "great",
    "strong",
    "quality"
  ],
  "gradual": [
    "slow",
    "steady",
    "progressive",
    "incremental"
  ],
  "grand": [
    "big",
    "major",
    "impressive",
    "ambitious"
  ],
  "grant": [
    "give",
    "award",
    "provide",
    "hand over"
  ],
  "grasp": [
    "understand",
    "comprehend",
    "get",
    "wrap your head around"
  ],
  "great": [
    "huge",
    "significant",
    "major",
    "massive",
    "notable"
  ],
  "ground": [
    "basis",
    "foundation",
    "reasoning",
    "rationale"
  ],
  "group": [
    "bunch",
    "collection",
    "cluster",
    "team"
  ],
  "grow": [
    "expand",
    "increase",
    "develop",
    "build up"
  ],
  "guarantee": [
    "promise",
    "ensure",
    "warrant",
    "certify"
  ],
  "guard": [
    "protect",
    "defend",
    "watch over",
    "shield"
  ],
  "guidance": [
    "direction",
    "advice",
    "help",
    "support",
    "leadership"
  ],
  "handle": [
    "deal with",
    "manage",
    "tackle",
    "take care of"
  ],
  "happen": [
    "occur",
    "take place",
    "come about",
    "go down"
  ],
  "harsh": [
    "severe",
    "tough",
    "strict",
    "rough",
    "brutal"
  ],
  "hazard": [
    "danger",
    "risk",
    "threat",
    "peril"
  ],
  "head": [
    "lead",
    "be in charge of",
    "run",
    "direct"
  ],
  "healthy": [
    "wholesome",
    "nutritious",
    "fit",
    "well"
  ],
  "heavy": [
    "weighty",
    "substantial",
    "serious",
    "intense"
  ],
  "help": [
    "assist",
    "support",
    "aid",
    "lend a hand"
  ],
  "hidden": [
    "concealed",
    "buried",
    "tucked away",
    "obscured"
  ],
  "highlight": [
    "emphasize",
    "stress",
    "point out",
    "spotlight",
    "call attention to"
  ],
  "hint": [
    "clue",
    "sign",
    "suggestion",
    "tip",
    "trace"
  ],
  "hold": [
    "keep",
    "maintain",
    "retain",
    "carry"
  ],
  "honest": [
    "truthful",
    "sincere",
    "straightforward",
    "candid"
  ],
  "hope": [
    "wish",
    "expect",
    "look forward to",
    "aim for"
  ],
  "horrible": [
    "terrible",
    "awful",
    "dreadful",
    "atrocious"
  ],
  "huge": [
    "massive",
    "enormous",
    "gigantic",
    "immense"
  ],
  "human": [
    "person",
    "individual",
    "people"
  ],
  "humor": [
    "comedy",
    "funny side",
    "amusement",
    "wit"
  ],
  "hurt": [
    "harm",
    "injure",
    "damage",
    "wound"
  ],
  "idea": [
    "concept",
    "thought",
    "notion",
    "plan"
  ],
  "ideal": [
    "perfect",
    "optimal",
    "best possible",
    "model"
  ],
  "identify": [
    "spot",
    "recognize",
    "pinpoint",
    "detect",
    "name"
  ],
  "ignore": [
    "disregard",
    "overlook",
    "brush off",
    "pay no attention to"
  ],
  "illustrate": [
    "show",
    "demonstrate",
    "exemplify",
    "depict"
  ],
  "impact": [
    "effect",
    "influence",
    "consequence",
    "repercussion"
  ],
  "implement": [
    "put in place",
    "carry out",
    "roll out",
    "execute",
    "deploy"
  ],
  "imply": [
    "suggest",
    "hint at",
    "indicate",
    "insinuate"
  ],
  "importance": [
    "significance",
    "weight",
    "relevance",
    "priority"
  ],
  "important": [
    "crucial",
    "key",
    "vital",
    "significant"
  ],
  "impose": [
    "force",
    "apply",
    "place",
    "inflict"
  ],
  "improve": [
    "enhance",
    "boost",
    "upgrade",
    "better"
  ],
  "incident": [
    "event",
    "occurrence",
    "episode",
    "happening"
  ],
  "include": [
    "feature",
    "incorporate",
    "cover",
    "involve"
  ],
  "increase": [
    "rise",
    "grow",
    "go up",
    "climb",
    "surge"
  ],
  "incredible": [
    "amazing",
    "unbelievable",
    "remarkable",
    "extraordinary"
  ],
  "indeed": [
    "absolutely",
    "truly",
    "without question",
    "certainly"
  ],
  "independent": [
    "autonomous",
    "self-sufficient",
    "standalone"
  ],
  "indicate": [
    "show",
    "suggest",
    "point to",
    "signal",
    "reveal"
  ],
  "individual": [
    "person",
    "single",
    "specific",
    "unique"
  ],
  "inevitable": [
    "unavoidable",
    "certain",
    "bound to happen",
    "guaranteed"
  ],
  "influence": [
    "impact",
    "effect",
    "sway",
    "shape",
    "steer"
  ],
  "inform": [
    "tell",
    "let know",
    "notify",
    "update",
    "give a heads-up"
  ],
  "initial": [
    "first",
    "starting",
    "opening",
    "early"
  ],
  "innovation": [
    "breakthrough",
    "new idea",
    "advance",
    "novelty"
  ],
  "input": [
    "contribution",
    "feedback",
    "thoughts",
    "perspective"
  ],
  "insight": [
    "understanding",
    "revelation",
    "realization",
    "perspective"
  ],
  "inspect": [
    "examine",
    "check",
    "review",
    "look over"
  ],
  "install": [
    "set up",
    "put in",
    "configure"
  ],
  "instance": [
    "example",
    "case",
    "occasion",
    "situation"
  ],
  "instead": [
    "rather",
    "alternatively",
    "as a substitute"
  ],
  "integrate": [
    "combine",
    "blend",
    "weave in",
    "incorporate"
  ],
  "intend": [
    "plan",
    "mean to",
    "aim to",
    "set out to"
  ],
  "intense": [
    "strong",
    "powerful",
    "severe",
    "heavy",
    "fierce"
  ],
  "interest": [
    "fascination",
    "curiosity",
    "attention",
    "engagement"
  ],
  "interesting": [
    "fascinating",
    "intriguing",
    "compelling",
    "thought-provoking"
  ],
  "internal": [
    "inside",
    "inner",
    "domestic"
  ],
  "interpret": [
    "read",
    "understand",
    "make sense of",
    "decode"
  ],
  "interview": [
    "conversation",
    "discussion",
    "questioning",
    "chat"
  ],
  "introduce": [
    "bring in",
    "present",
    "launch",
    "roll out"
  ],
  "intuition": [
    "gut feeling",
    "instinct",
    "hunch",
    "sixth sense"
  ],
  "invade": [
    "enter",
    "encroach",
    "overrun",
    "infiltrate"
  ],
  "invest": [
    "put money into",
    "fund",
    "back",
    "sink resources into"
  ],
  "investigate": [
    "look into",
    "examine",
    "probe",
    "dig into",
    "explore"
  ],
  "involve": [
    "include",
    "engage",
    "draw in",
    "require"
  ],
  "issue": [
    "problem",
    "matter",
    "concern",
    "topic",
    "question"
  ],
  "item": [
    "thing",
    "piece",
    "object",
    "unit"
  ],
  "job": [
    "task",
    "role",
    "position",
    "gig",
    "work"
  ],
  "join": [
    "connect",
    "link",
    "unite",
    "combine",
    "team up"
  ],
  "journal": [
    "diary",
    "log",
    "record",
    "publication"
  ],
  "journey": [
    "trip",
    "voyage",
    "expedition",
    "adventure",
    "trek"
  ],
  "judge": [
    "evaluate",
    "assess",
    "rate",
    "determine"
  ],
  "just": [
    "simply",
    "merely",
    "only",
    "purely"
  ],
  "keep": [
    "maintain",
    "hold on to",
    "retain",
    "preserve"
  ],
  "key": [
    "crucial",
    "vital",
    "essential",
    "central",
    "main"
  ],
  "kind": [
    "type",
    "sort",
    "variety",
    "category",
    "flavor"
  ],
  "knowledge": [
    "understanding",
    "expertise",
    "know-how",
    "insight"
  ],
  "lack": [
    "shortage",
    "absence",
    "deficiency",
    "dearth"
  ],
  "landscape": [
    "scene",
    "terrain",
    "environment",
    "picture"
  ],
  "large": [
    "big",
    "huge",
    "substantial",
    "sizeable"
  ],
  "last": [
    "final",
    "ultimate",
    "closing",
    "concluding"
  ],
  "late": [
    "tardy",
    "delayed",
    "behind schedule"
  ],
  "latter": [
    "second",
    "last-mentioned",
    "later one"
  ],
  "launch": [
    "start",
    "kick off",
    "roll out",
    "introduce",
    "debut"
  ],
  "law": [
    "rule",
    "regulation",
    "statute",
    "legislation"
  ],
  "lead": [
    "guide",
    "direct",
    "steer",
    "head up",
    "be at the front of"
  ],
  "learn": [
    "find out",
    "pick up",
    "figure out",
    "discover"
  ],
  "least": [
    "minimum",
    "smallest amount",
    "bare minimum"
  ],
  "leave": [
    "depart",
    "go",
    "exit",
    "head out"
  ],
  "legal": [
    "lawful",
    "legitimate",
    "by the book"
  ],
  "level": [
    "degree",
    "extent",
    "amount",
    "standard"
  ],
  "likely": [
    "probable",
    "expected",
    "plausible",
    "a good bet"
  ],
  "limit": [
    "cap",
    "boundary",
    "ceiling",
    "restriction",
    "constraint"
  ],
  "link": [
    "connection",
    "tie",
    "relationship",
    "bond"
  ],
  "literally": [
    "actually",
    "truly",
    "exactly",
    "quite literally"
  ],
  "little": [
    "small",
    "tiny",
    "bit",
    "modest"
  ],
  "locate": [
    "find",
    "pinpoint",
    "track down",
    "discover"
  ],
  "logical": [
    "rational",
    "reasonable",
    "sensible",
    "sound"
  ],
  "look": [
    "appear",
    "seem",
    "come across as"
  ],
  "lose": [
    "misplace",
    "drop",
    "forfeit",
    "be deprived of"
  ],
  "lot": [
    "bunch",
    "ton",
    "heap",
    "load",
    "pile"
  ],
  "low": [
    "small",
    "minimal",
    "down",
    "below average"
  ],
  "main": [
    "primary",
    "chief",
    "principal",
    "key"
  ],
  "maintain": [
    "keep",
    "preserve",
    "sustain",
    "uphold"
  ],
  "major": [
    "big",
    "significant",
    "important",
    "notable",
    "substantial"
  ],
  "manage": [
    "handle",
    "deal with",
    "run",
    "oversee"
  ],
  "manner": [
    "way",
    "method",
    "approach",
    "style",
    "fashion"
  ],
  "many": [
    "a lot of",
    "tons of",
    "quite a few",
    "numerous"
  ],
  "market": [
    "industry",
    "sector",
    "business",
    "economy"
  ],
  "massive": [
    "huge",
    "enormous",
    "gigantic",
    "immense"
  ],
  "material": [
    "substance",
    "stuff",
    "content",
    "matter"
  ],
  "matter": [
    "issue",
    "subject",
    "topic",
    "concern"
  ],
  "maximum": [
    "highest",
    "greatest",
    "top",
    "peak"
  ],
  "mean": [
    "signify",
    "indicate",
    "represent",
    "imply"
  ],
  "measure": [
    "gauge",
    "assess",
    "evaluate",
    "quantify"
  ],
  "method": [
    "approach",
    "technique",
    "way",
    "strategy"
  ],
  "might": [
    "may",
    "could",
    "perhaps",
    "possibly"
  ],
  "million": [
    "a whole lot",
    "countless",
    "a massive amount"
  ],
  "mind": [
    "brain",
    "head",
    "thoughts",
    "thinking"
  ],
  "minimum": [
    "least",
    "lowest",
    "bare minimum",
    "baseline"
  ],
  "minor": [
    "small",
    "slight",
    "trivial",
    "insignificant"
  ],
  "minute": [
    "tiny",
    "minuscule",
    "microscopic",
    "tiny little"
  ],
  "mistake": [
    "error",
    "slip-up",
    "blunder",
    "oversight",
    "mess-up"
  ],
  "model": [
    "framework",
    "example",
    "pattern",
    "template"
  ],
  "modern": [
    "current",
    "contemporary",
    "present-day",
    "up-to-date"
  ],
  "modify": [
    "change",
    "adjust",
    "alter",
    "tweak",
    "revise"
  ],
  "moment": [
    "point",
    "instance",
    "time",
    "juncture"
  ],
  "money": [
    "cash",
    "funds",
    "capital",
    "resources"
  ],
  "monitor": [
    "watch",
    "track",
    "keep an eye on",
    "observe"
  ],
  "mood": [
    "feeling",
    "state of mind",
    "vibe",
    "temperament"
  ],
  "moral": [
    "ethical",
    "right",
    "principled"
  ],
  "motivation": [
    "drive",
    "incentive",
    "reason",
    "push"
  ],
  "motion": [
    "movement",
    "action",
    "gesture"
  ],
  "mount": [
    "increase",
    "rise",
    "grow",
    "build up"
  ],
  "move": [
    "shift",
    "transition",
    "relocate",
    "budge"
  ],
  "multiple": [
    "several",
    "various",
    "numerous",
    "a number of"
  ],
  "mutual": [
    "shared",
    "common",
    "joint",
    "reciprocal"
  ],
  "narrow": [
    "tight",
    "slim",
    "limited",
    "restricted"
  ],
  "nation": [
    "country",
    "state",
    "land"
  ],
  "natural": [
    "normal",
    "organic",
    "innate",
    "inherent"
  ],
  "necessary": [
    "required",
    "essential",
    "needed",
    "must-have"
  ],
  "negative": [
    "bad",
    "unfavorable",
    "downside",
    "pessimistic"
  ],
  "neglect": [
    "ignore",
    "overlook",
    "forget about",
    "brush off"
  ],
  "network": [
    "web",
    "system",
    "grid",
    "connections"
  ],
  "neutral": [
    "impartial",
    "unbiased",
    "objective",
    "middle-ground"
  ],
  "nevertheless": [
    "however",
    "still",
    "nonetheless",
    "even so"
  ],
  "next": [
    "following",
    "upcoming",
    "coming"
  ],
  "nice": [
    "good",
    "pleasant",
    "great",
    "lovely",
    "fine"
  ],
  "normal": [
    "typical",
    "standard",
    "usual",
    "regular",
    "average"
  ],
  "notable": [
    "significant",
    "remarkable",
    "worth mentioning",
    "noteworthy"
  ],
  "notion": [
    "idea",
    "concept",
    "belief",
    "thought"
  ],
  "novel": [
    "new",
    "original",
    "fresh",
    "innovative"
  ],
  "nowadays": [
    "these days",
    "today",
    "currently",
    "in this day and age"
  ],
  "numerous": [
    "many",
    "several",
    "a lot of",
    "tons of",
    "countless"
  ],
  "obvious": [
    "clear",
    "apparent",
    "evident",
    "plain to see"
  ],
  "obtain": [
    "get",
    "acquire",
    "secure",
    "gain",
    "pick up"
  ],
  "occasion": [
    "event",
    "instance",
    "moment",
    "time"
  ],
  "occupy": [
    "take up",
    "fill",
    "hold",
    "use"
  ],
  "occur": [
    "happen",
    "take place",
    "come about",
    "arise"
  ],
  "odd": [
    "strange",
    "weird",
    "unusual",
    "peculiar"
  ],
  "offer": [
    "provide",
    "give",
    "present",
    "put forward"
  ],
  "official": [
    "formal",
    "authorized",
    "approved"
  ],
  "often": [
    "frequently",
    "regularly",
    "commonly",
    "a lot"
  ],
  "ongoing": [
    "continuing",
    "active",
    "current",
    "in progress"
  ],
  "opinion": [
    "view",
    "perspective",
    "take",
    "stance",
    "position"
  ],
  "opponent": [
    "rival",
    "competitor",
    "adversary",
    "challenger"
  ],
  "opportunity": [
    "chance",
    "opening",
    "shot",
    "possibility"
  ],
  "oppose": [
    "resist",
    "fight against",
    "object to",
    "push back on"
  ],
  "option": [
    "choice",
    "alternative",
    "possibility"
  ],
  "order": [
    "arrangement",
    "sequence",
    "organization",
    "structure"
  ],
  "ordinary": [
    "normal",
    "average",
    "typical",
    "standard",
    "regular"
  ],
  "organize": [
    "arrange",
    "set up",
    "structure",
    "put together",
    "coordinate"
  ],
  "origin": [
    "source",
    "root",
    "beginning",
    "starting point"
  ],
  "original": [
    "initial",
    "first",
    "authentic",
    "genuine"
  ],
  "outcome": [
    "result",
    "consequence",
    "effect",
    "end result"
  ],
  "overcome": [
    "beat",
    "conquer",
    "defeat",
    "get past",
    "surmount"
  ],
  "overlap": [
    "intersect",
    "coincide",
    "run parallel"
  ],
  "overlook": [
    "miss",
    "ignore",
    "disregard",
    "skip over"
  ],
  "owe": [
    "be indebted to",
    "be in debt to"
  ],
  "own": [
    "personal",
    "individual",
    "possess"
  ],
  "pace": [
    "speed",
    "rate",
    "tempo",
    "rhythm"
  ],
  "part": [
    "piece",
    "section",
    "portion",
    "component"
  ],
  "participate": [
    "take part",
    "join in",
    "get involved",
    "engage"
  ],
  "particular": [
    "specific",
    "certain",
    "exact",
    "given"
  ],
  "partner": [
    "ally",
    "collaborator",
    "teammate",
    "associate"
  ],
  "pass": [
    "go by",
    "come to an end",
    "wrap up"
  ],
  "pattern": [
    "trend",
    "tendency",
    "model",
    "theme"
  ],
  "pause": [
    "stop briefly",
    "hesitate",
    "take a break"
  ],
  "pay": [
    "compensate",
    "reimburse",
    "settle",
    "fork over"
  ],
  "peak": [
    "top",
    "summit",
    "highest point",
    "crest"
  ],
  "penalty": [
    "punishment",
    "fine",
    "cost",
    "consequence"
  ],
  "perceive": [
    "see",
    "notice",
    "observe",
    "interpret"
  ],
  "percent": [
    "percentage",
    "portion",
    "share",
    "proportion"
  ],
  "perform": [
    "do",
    "carry out",
    "execute",
    "deliver"
  ],
  "period": [
    "time",
    "era",
    "span",
    "stretch"
  ],
  "permit": [
    "allow",
    "let",
    "authorize",
    "give the green light"
  ],
  "persist": [
    "keep going",
    "continue",
    "hang in there",
    "stick with it"
  ],
  "perspective": [
    "viewpoint",
    "angle",
    "standpoint",
    "point of view",
    "lens"
  ],
  "phrase": [
    "expression",
    "saying",
    "wording",
    "term"
  ],
  "physical": [
    "bodily",
    "material",
    "tangible",
    "concrete"
  ],
  "pick": [
    "choose",
    "select",
    "opt for",
    "go with"
  ],
  "piece": [
    "part",
    "segment",
    "bit",
    "chunk",
    "section"
  ],
  "place": [
    "spot",
    "location",
    "area",
    "site"
  ],
  "plan": [
    "strategy",
    "scheme",
    "blueprint",
    "proposal"
  ],
  "platform": [
    "system",
    "framework",
    "infrastructure",
    "setup"
  ],
  "play": [
    "role",
    "part",
    "function",
    "contribute"
  ],
  "pleasure": [
    "joy",
    "delight",
    "enjoyment",
    "satisfaction"
  ],
  "point": [
    "purpose",
    "objective",
    "goal",
    "message"
  ],
  "popular": [
    "well-liked",
    "trending",
    "in demand",
    "widely used"
  ],
  "portion": [
    "part",
    "section",
    "share",
    "piece"
  ],
  "position": [
    "stance",
    "viewpoint",
    "place",
    "role",
    "situation"
  ],
  "positive": [
    "good",
    "favorable",
    "optimistic",
    "encouraging"
  ],
  "possess": [
    "have",
    "own",
    "hold",
    "carry"
  ],
  "possibility": [
    "chance",
    "option",
    "potential",
    "likelihood"
  ],
  "potential": [
    "possibility",
    "promise",
    "prospects",
    "room to grow"
  ],
  "power": [
    "strength",
    "force",
    "energy",
    "authority"
  ],
  "practical": [
    "useful",
    "realistic",
    "actionable",
    "hands-on"
  ],
  "precisely": [
    "exactly",
    "specifically",
    "spot-on",
    "to the letter"
  ],
  "predict": [
    "forecast",
    "foresee",
    "anticipate",
    "project"
  ],
  "prefer": [
    "favor",
    "lean toward",
    "opt for",
    "like better"
  ],
  "prepare": [
    "get ready",
    "set up",
    "gear up",
    "prime"
  ],
  "present": [
    "current",
    "existing",
    "show",
    "display",
    "offer"
  ],
  "preserve": [
    "protect",
    "maintain",
    "save",
    "keep intact"
  ],
  "pressing": [
    "urgent",
    "critical",
    "important",
    "immediate"
  ],
  "pressure": [
    "stress",
    "tension",
    "strain",
    "weight"
  ],
  "pretend": [
    "fake",
    "act like",
    "put on",
    "make believe"
  ],
  "prevent": [
    "stop",
    "block",
    "avoid",
    "ward off",
    "keep from"
  ],
  "previous": [
    "earlier",
    "prior",
    "past",
    "former"
  ],
  "primary": [
    "main",
    "chief",
    "principal",
    "central",
    "key"
  ],
  "prime": [
    "top",
    "best",
    "main",
    "ideal"
  ],
  "principle": [
    "rule",
    "belief",
    "value",
    "tenet",
    "core idea"
  ],
  "priority": [
    "top concern",
    "main focus",
    "first order of business"
  ],
  "problem": [
    "issue",
    "challenge",
    "difficulty",
    "headache"
  ],
  "procedure": [
    "process",
    "method",
    "steps",
    "approach"
  ],
  "proceed": [
    "move forward",
    "continue",
    "go ahead",
    "advance"
  ],
  "process": [
    "method",
    "system",
    "approach",
    "procedure"
  ],
  "produce": [
    "create",
    "generate",
    "make",
    "yield",
    "put out"
  ],
  "product": [
    "item",
    "good",
    "output",
    "offering"
  ],
  "professional": [
    "career",
    "workplace",
    "expert"
  ],
  "profit": [
    "gain",
    "return",
    "earnings",
    "bottom line"
  ],
  "program": [
    "initiative",
    "project",
    "plan",
    "scheme"
  ],
  "progress": [
    "advancement",
    "development",
    "headway",
    "forward movement"
  ],
  "project": [
    "plan",
    "initiative",
    "undertaking",
    "effort"
  ],
  "promise": [
    "guarantee",
    "commitment",
    "pledge",
    "word"
  ],
  "promote": [
    "push",
    "advance",
    "champion",
    "advocate for"
  ],
  "proper": [
    "correct",
    "appropriate",
    "right",
    "suitable"
  ],
  "property": [
    "asset",
    "possession",
    "feature",
    "characteristic"
  ],
  "proposal": [
    "plan",
    "offer",
    "suggestion",
    "pitch"
  ],
  "propose": [
    "suggest",
    "put forward",
    "offer",
    "recommend"
  ],
  "prospect": [
    "possibility",
    "chance",
    "outlook",
    "potential"
  ],
  "protect": [
    "defend",
    "guard",
    "shield",
    "safeguard"
  ],
  "prove": [
    "demonstrate",
    "show",
    "confirm",
    "establish"
  ],
  "provide": [
    "supply",
    "give",
    "deliver",
    "offer",
    "furnish"
  ],
  "pull": [
    "draw",
    "tug",
    "drag",
    "extract"
  ],
  "purchase": [
    "buy",
    "acquire",
    "get",
    "pick up"
  ],
  "purpose": [
    "goal",
    "aim",
    "objective",
    "reason",
    "mission"
  ],
  "pursue": [
    "chase",
    "go after",
    "follow",
    "seek"
  ],
  "push": [
    "drive",
    "force",
    "press",
    "urge"
  ],
  "put": [
    "place",
    "set",
    "position",
    "lay down"
  ],
  "qualify": [
    "meet the criteria",
    "be eligible",
    "fit the bill"
  ],
  "quality": [
    "standard",
    "caliber",
    "level",
    "grade"
  ],
  "quantity": [
    "amount",
    "number",
    "volume",
    "bulk"
  ],
  "question": [
    "issue",
    "doubt",
    "uncertainty",
    "inquiry"
  ],
  "quick": [
    "fast",
    "rapid",
    "swift",
    "speedy"
  ],
  "quiet": [
    "silent",
    "still",
    "calm",
    "peaceful"
  ],
  "quite": [
    "fairly",
    "rather",
    "pretty",
    "somewhat"
  ],
  "radical": [
    "extreme",
    "drastic",
    "fundamental",
    "revolutionary"
  ],
  "raise": [
    "lift",
    "increase",
    "bring up",
    "elevate"
  ],
  "range": [
    "scope",
    "spectrum",
    "span",
    "variety"
  ],
  "rapid": [
    "fast",
    "quick",
    "swift",
    "speedy"
  ],
  "rare": [
    "uncommon",
    "scarce",
    "unusual",
    "hard to find"
  ],
  "rate": [
    "speed",
    "pace",
    "frequency",
    "ratio"
  ],
  "rather": [
    "somewhat",
    "instead",
    "more like",
    "preferably"
  ],
  "reach": [
    "arrive at",
    "get to",
    "attain",
    "hit"
  ],
  "react": [
    "respond",
    "reply",
    "answer back"
  ],
  "real": [
    "genuine",
    "actual",
    "authentic",
    "true"
  ],
  "realize": [
    "recognize",
    "understand",
    "become aware of",
    "figure out"
  ],
  "really": [
    "truly",
    "genuinely",
    "actually",
    "honestly"
  ],
  "reason": [
    "cause",
    "motive",
    "basis",
    "rationale"
  ],
  "reasonable": [
    "fair",
    "sensible",
    "logical",
    "rational",
    "sound"
  ],
  "recall": [
    "remember",
    "think back to",
    "recollect",
    "call to mind"
  ],
  "receive": [
    "get",
    "obtain",
    "take in",
    "accept"
  ],
  "recent": [
    "latest",
    "new",
    "current",
    "not long ago"
  ],
  "recognize": [
    "acknowledge",
    "identify",
    "admit",
    "spot"
  ],
  "recommend": [
    "suggest",
    "advise",
    "propose",
    "endorse"
  ],
  "recover": [
    "bounce back",
    "get back",
    "regain",
    "restore"
  ],
  "reduce": [
    "cut",
    "decrease",
    "lower",
    "trim",
    "slash"
  ],
  "refer": [
    "point to",
    "mention",
    "direct to",
    "allude to"
  ],
  "reflect": [
    "show",
    "mirror",
    "demonstrate",
    "reveal"
  ],
  "regular": [
    "routine",
    "normal",
    "standard",
    "typical",
    "usual"
  ],
  "relate": [
    "connect",
    "link",
    "apply to",
    "tie in with"
  ],
  "release": [
    "put out",
    "launch",
    "roll out",
    "unveil",
    "drop"
  ],
  "relevant": [
    "applicable",
    "related",
    "pertinent",
    "on-point"
  ],
  "reliable": [
    "dependable",
    "trustworthy",
    "consistent",
    "solid"
  ],
  "relief": [
    "comfort",
    "ease",
    "reassurance",
    "break"
  ],
  "rely": [
    "depend",
    "count on",
    "lean on",
    "trust"
  ],
  "remain": [
    "stay",
    "keep",
    "continue to be",
    "linger"
  ],
  "remark": [
    "comment",
    "observation",
    "note",
    "statement"
  ],
  "remarkable": [
    "notable",
    "extraordinary",
    "impressive",
    "outstanding"
  ],
  "remember": [
    "recall",
    "think of",
    "keep in mind",
    "not forget"
  ],
  "remind": [
    "prompt",
    "jog someone\\'s memory",
    "bring up"
  ],
  "remove": [
    "get rid of",
    "take out",
    "eliminate",
    "delete",
    "strip away"
  ],
  "repeat": [
    "do again",
    "say again",
    "reiterate"
  ],
  "replace": [
    "swap",
    "substitute",
    "exchange",
    "swap out"
  ],
  "represent": [
    "stand for",
    "symbolize",
    "embody",
    "illustrate"
  ],
  "request": [
    "ask",
    "ask for",
    "call for",
    "demand"
  ],
  "require": [
    "need",
    "demand",
    "call for",
    "necessitate"
  ],
  "research": [
    "study",
    "investigation",
    "inquiry",
    "analysis"
  ],
  "reserve": [
    "save",
    "hold back",
    "keep",
    "set aside"
  ],
  "resist": [
    "fight",
    "withstand",
    "push back against",
    "hold off"
  ],
  "resolve": [
    "solve",
    "fix",
    "settle",
    "address",
    "work out"
  ],
  "resource": [
    "asset",
    "tool",
    "material",
    "source"
  ],
  "respond": [
    "reply",
    "answer",
    "react",
    "get back to"
  ],
  "responsible": [
    "accountable",
    "in charge",
    "at fault"
  ],
  "restore": [
    "bring back",
    "recover",
    "rebuild",
    "repair"
  ],
  "restrict": [
    "limit",
    "cap",
    "constrain",
    "hold back"
  ],
  "result": [
    "outcome",
    "consequence",
    "effect",
    "end product"
  ],
  "retain": [
    "keep",
    "hold on to",
    "maintain",
    "preserve"
  ],
  "retire": [
    "step down",
    "bow out",
    "leave",
    "wrap up a career"
  ],
  "reveal": [
    "show",
    "uncover",
    "disclose",
    "expose",
    "bring to light"
  ],
  "revenue": [
    "income",
    "earnings",
    "takings",
    "money coming in"
  ],
  "reverse": [
    "flip",
    "turn around",
    "undo",
    "invert"
  ],
  "review": [
    "evaluate",
    "assess",
    "look over",
    "go through"
  ],
  "revolution": [
    "upheaval",
    "transformation",
    "overhaul",
    "shake-up"
  ],
  "rich": [
    "wealthy",
    "well-off",
    "prosperous",
    "loaded"
  ],
  "rise": [
    "increase",
    "climb",
    "go up",
    "surge",
    "jump"
  ],
  "risk": [
    "danger",
    "hazard",
    "threat",
    "gamble",
    "chance"
  ],
  "role": [
    "part",
    "function",
    "job",
    "position",
    "purpose"
  ],
  "rough": [
    "tough",
    "difficult",
    "harsh",
    "coarse",
    "uneven"
  ],
  "roughly": [
    "about",
    "approximately",
    "around",
    "close to"
  ],
  "route": [
    "path",
    "way",
    "course",
    "direction"
  ],
  "rule": [
    "regulation",
    "guideline",
    "principle",
    "law"
  ],
  "rumor": [
    "gossip",
    "talk",
    "buzz",
    "word on the street"
  ],
  "safe": [
    "secure",
    "protected",
    "out of harm\\'s way"
  ],
  "satisfy": [
    "meet",
    "fulfill",
    "please",
    "answer"
  ],
  "scale": [
    "size",
    "scope",
    "extent",
    "magnitude",
    "level"
  ],
  "scene": [
    "setting",
    "location",
    "situation",
    "sight"
  ],
  "scope": [
    "range",
    "extent",
    "reach",
    "breadth"
  ],
  "secure": [
    "safe",
    "protected",
    "locked down",
    "stable"
  ],
  "seek": [
    "look for",
    "search for",
    "pursue",
    "go after"
  ],
  "select": [
    "choose",
    "pick",
    "opt for",
    "hand-pick"
  ],
  "sense": [
    "feeling",
    "understanding",
    "perception",
    "awareness"
  ],
  "serious": [
    "significant",
    "severe",
    "grave",
    "major",
    "no joke"
  ],
  "serve": [
    "function as",
    "act as",
    "work as"
  ],
  "set": [
    "put",
    "place",
    "establish",
    "lay out"
  ],
  "settle": [
    "resolve",
    "decide",
    "agree on",
    "work out"
  ],
  "several": [
    "multiple",
    "a few",
    "various",
    "a number of"
  ],
  "severe": [
    "serious",
    "intense",
    "harsh",
    "extreme",
    "heavy"
  ],
  "shape": [
    "form",
    "mold",
    "influence",
    "define"
  ],
  "share": [
    "portion",
    "part",
    "slice",
    "piece"
  ],
  "sharp": [
    "keen",
    "acute",
    "precise",
    "quick"
  ],
  "shift": [
    "change",
    "move",
    "transition",
    "switch"
  ],
  "short": [
    "brief",
    "quick",
    "concise",
    "compact"
  ],
  "show": [
    "reveal",
    "display",
    "present",
    "demonstrate"
  ],
  "shut": [
    "close",
    "seal",
    "lock"
  ],
  "significant": [
    "important",
    "major",
    "notable",
    "meaningful",
    "substantial"
  ],
  "similar": [
    "alike",
    "comparable",
    "like",
    "analogous"
  ],
  "simple": [
    "easy",
    "straightforward",
    "basic",
    "uncomplicated"
  ],
  "simply": [
    "just",
    "merely",
    "only",
    "basically"
  ],
  "situation": [
    "scenario",
    "circumstance",
    "context",
    "state of affairs"
  ],
  "size": [
    "scale",
    "magnitude",
    "dimensions",
    "extent"
  ],
  "skill": [
    "ability",
    "talent",
    "expertise",
    "capability"
  ],
  "slow": [
    "gradual",
    "unhurried",
    "steady",
    "leisurely"
  ],
  "small": [
    "tiny",
    "little",
    "modest",
    "minor"
  ],
  "smart": [
    "clever",
    "intelligent",
    "sharp",
    "bright",
    "savvy"
  ],
  "smooth": [
    "seamless",
    "effortless",
    "easy",
    "fluid"
  ],
  "solution": [
    "answer",
    "fix",
    "resolution",
    "way forward"
  ],
  "some": [
    "a few",
    "several",
    "a handful of",
    "certain"
  ],
  "source": [
    "origin",
    "root",
    "starting point",
    "cause"
  ],
  "specific": [
    "particular",
    "exact",
    "precise",
    "given"
  ],
  "spot": [
    "place",
    "location",
    "position",
    "site"
  ],
  "spread": [
    "expand",
    "extend",
    "distribute",
    "disseminate"
  ],
  "stable": [
    "steady",
    "secure",
    "firm",
    "solid"
  ],
  "standard": [
    "normal",
    "typical",
    "usual",
    "baseline"
  ],
  "start": [
    "begin",
    "kick off",
    "launch",
    "get going"
  ],
  "state": [
    "condition",
    "status",
    "situation",
    "declare"
  ],
  "step": [
    "stage",
    "phase",
    "move",
    "action"
  ],
  "still": [
    "yet",
    "even so",
    "nevertheless"
  ],
  "stimulate": [
    "trigger",
    "spark",
    "encourage",
    "activate"
  ],
  "stop": [
    "halt",
    "cease",
    "end",
    "quit"
  ],
  "straight": [
    "direct",
    "immediate",
    "honest",
    "simple"
  ],
  "strategy": [
    "plan",
    "approach",
    "game plan",
    "tactic"
  ],
  "strength": [
    "power",
    "advantage",
    "strong point",
    "muscle"
  ],
  "strict": [
    "firm",
    "tough",
    "rigid"
  ],
  "strike": [
    "hit",
    "attack",
    "impact",
    "land on"
  ],
  "structure": [
    "framework",
    "organization",
    "setup",
    "arrangement"
  ],
  "struggle": [
    "fight",
    "battle",
    "effort",
    "grapple"
  ],
  "study": [
    "research",
    "examination",
    "analysis",
    "investigation"
  ],
  "stuff": [
    "things",
    "material",
    "items",
    "content"
  ],
  "style": [
    "approach",
    "manner",
    "way",
    "flavor"
  ],
  "subject": [
    "topic",
    "theme",
    "matter",
    "area of focus"
  ],
  "submit": [
    "send in",
    "hand in",
    "turn in",
    "deliver"
  ],
  "subsequent": [
    "following",
    "later",
    "next",
    "ensuing"
  ],
  "substance": [
    "material",
    "content",
    "essence",
    "core"
  ],
  "substitute": [
    "replacement",
    "alternative",
    "stand-in",
    "swap"
  ],
  "succeed": [
    "achieve",
    "accomplish",
    "make it",
    "pull it off"
  ],
  "success": [
    "achievement",
    "win",
    "triumph",
    "victory"
  ],
  "sufficient": [
    "enough",
    "adequate",
    "plenty"
  ],
  "suggest": [
    "propose",
    "recommend",
    "hint at",
    "float",
    "put forward"
  ],
  "suitable": [
    "appropriate",
    "fitting",
    "right",
    "proper"
  ],
  "sum": [
    "total",
    "amount",
    "whole",
    "aggregate"
  ],
  "supply": [
    "provide",
    "deliver",
    "furnish",
    "give"
  ],
  "support": [
    "back",
    "help",
    "champion",
    "stand behind"
  ],
  "suppose": [
    "assume",
    "guess",
    "presume",
    "imagine"
  ],
  "sure": [
    "certain",
    "confident",
    "positive",
    "definite"
  ],
  "surprise": [
    "shock",
    "unexpected",
    "astonishment",
    "twist"
  ],
  "surround": [
    "encircle",
    "envelop",
    "ring",
    "wrap around"
  ],
  "survey": [
    "poll",
    "study",
    "assessment",
    "overview"
  ],
  "survive": [
    "make it",
    "pull through",
    "endure",
    "last"
  ],
  "suspect": [
    "think",
    "believe",
    "guess",
    "have a hunch"
  ],
  "sustain": [
    "maintain",
    "support",
    "keep up",
    "uphold"
  ],
  "symbol": [
    "sign",
    "mark",
    "representation",
    "emblem"
  ],
  "system": [
    "network",
    "setup",
    "framework",
    "structure"
  ],
  "tackle": [
    "address",
    "deal with",
    "handle",
    "take on",
    "approach"
  ],
  "take": [
    "grab",
    "pick up",
    "claim",
    "seize"
  ],
  "tale": [
    "story",
    "account",
    "narrative",
    "version"
  ],
  "target": [
    "goal",
    "aim",
    "objective",
    "mark"
  ],
  "task": [
    "job",
    "assignment",
    "chore",
    "duty",
    "mission"
  ],
  "team": [
    "group",
    "crew",
    "squad",
    "unit"
  ],
  "technique": [
    "method",
    "approach",
    "strategy",
    "way"
  ],
  "technology": [
    "tech",
    "tools",
    "systems",
    "innovation"
  ],
  "tell": [
    "say",
    "inform",
    "let know",
    "reveal"
  ],
  "tend": [
    "be inclined to",
    "have a tendency to",
    "usually"
  ],
  "term": [
    "period",
    "duration",
    "word",
    "phrase"
  ],
  "terrible": [
    "awful",
    "horrible",
    "dreadful",
    "atrocious",
    "ghastly"
  ],
  "test": [
    "trial",
    "experiment",
    "assessment",
    "evaluation"
  ],
  "text": [
    "writing",
    "content",
    "words",
    "passage"
  ],
  "theme": [
    "topic",
    "subject",
    "motif",
    "idea"
  ],
  "theory": [
    "idea",
    "concept",
    "hypothesis",
    "framework"
  ],
  "therefore": [
    "so",
    "thus",
    "as a result",
    "consequently",
    "hence"
  ],
  "thick": [
    "dense",
    "heavy",
    "deep"
  ],
  "thing": [
    "item",
    "object",
    "piece",
    "stuff"
  ],
  "think": [
    "believe",
    "consider",
    "reckon",
    "feel"
  ],
  "thorough": [
    "comprehensive",
    "complete",
    "detailed",
    "in-depth"
  ],
  "though": [
    "although",
    "even though",
    "however"
  ],
  "threat": [
    "danger",
    "risk",
    "menace",
    "peril"
  ],
  "tight": [
    "strict",
    "close",
    "limited",
    "firm"
  ],
  "tiny": [
    "small",
    "little",
    "minuscule",
    "microscopic"
  ],
  "title": [
    "name",
    "heading",
    "label",
    "designation"
  ],
  "today": [
    "nowadays",
    "currently",
    "these days",
    "in the present"
  ],
  "together": [
    "jointly",
    "collectively",
    "as one",
    "in combination"
  ],
  "topic": [
    "subject",
    "theme",
    "issue",
    "matter"
  ],
  "total": [
    "complete",
    "entire",
    "overall",
    "full"
  ],
  "tough": [
    "hard",
    "difficult",
    "challenging",
    "demanding"
  ],
  "toward": [
    "towards",
    "in the direction of",
    "heading to"
  ],
  "trace": [
    "track",
    "follow",
    "trail",
    "find"
  ],
  "track": [
    "follow",
    "monitor",
    "keep tabs on",
    "trail"
  ],
  "traditional": [
    "conventional",
    "classic",
    "established",
    "old-school"
  ],
  "transfer": [
    "move",
    "shift",
    "hand over",
    "pass along"
  ],
  "transform": [
    "change",
    "convert",
    "revolutionize",
    "turn into"
  ],
  "transition": [
    "shift",
    "change",
    "move",
    "handover"
  ],
  "translate": [
    "convert",
    "render",
    "put into",
    "turn into"
  ],
  "transport": [
    "carry",
    "move",
    "transit",
    "ship"
  ],
  "trap": [
    "catch",
    "snare",
    "ambush",
    "pin down"
  ],
  "treat": [
    "handle",
    "deal with",
    "approach",
    "address"
  ],
  "trend": [
    "pattern",
    "direction",
    "movement",
    "wave"
  ],
  "trial": [
    "test",
    "experiment",
    "attempt",
    "run"
  ],
  "trigger": [
    "spark",
    "set off",
    "activate",
    "prompt"
  ],
  "trouble": [
    "problem",
    "difficulty",
    "issue",
    "headache"
  ],
  "true": [
    "real",
    "genuine",
    "accurate",
    "correct",
    "factual"
  ],
  "trust": [
    "believe in",
    "rely on",
    "have faith in",
    "count on"
  ],
  "truth": [
    "fact",
    "reality",
    "honest truth"
  ],
  "turn": [
    "shift",
    "change",
    "flip",
    "switch"
  ],
  "typical": [
    "normal",
    "standard",
    "usual",
    "average",
    "ordinary"
  ],
  "ultimate": [
    "final",
    "supreme",
    "absolute",
    "highest"
  ],
  "understand": [
    "comprehend",
    "grasp",
    "get",
    "follow",
    "wrap your head around"
  ],
  "unite": [
    "join",
    "combine",
    "come together",
    "band together"
  ],
  "university": [
    "college",
    "school",
    "institution",
    "academy"
  ],
  "unlikely": [
    "improbable",
    "doubtful",
    "not likely",
    "a long shot"
  ],
  "unusual": [
    "uncommon",
    "rare",
    "strange",
    "out of the ordinary"
  ],
  "update": [
    "refresh",
    "revise",
    "bring up to date",
    "modernize"
  ],
  "upgrade": [
    "improve",
    "enhance",
    "elevate",
    "step up"
  ],
  "uphold": [
    "support",
    "maintain",
    "defend",
    "back up"
  ],
  "urgency": [
    "pressing need",
    "importance",
    "priority",
    "rush"
  ],
  "useful": [
    "helpful",
    "practical",
    "handy",
    "valuable"
  ],
  "usual": [
    "normal",
    "typical",
    "standard",
    "routine",
    "regular"
  ],
  "utilize": [
    "use",
    "employ",
    "apply",
    "put to work",
    "leverage"
  ],
  "valid": [
    "legitimate",
    "sound",
    "legit",
    "proper"
  ],
  "value": [
    "worth",
    "importance",
    "significance",
    "merit"
  ],
  "variable": [
    "factor",
    "element",
    "uncertainty",
    "unknown"
  ],
  "vast": [
    "huge",
    "enormous",
    "massive",
    "expansive",
    "immense"
  ],
  "verify": [
    "confirm",
    "validate",
    "check",
    "double-check"
  ],
  "version": [
    "edition",
    "variant",
    "iteration",
    "release"
  ],
  "very": [
    "extremely",
    "incredibly",
    "super",
    "quite"
  ],
  "view": [
    "perspective",
    "opinion",
    "take",
    "angle",
    "standpoint"
  ],
  "vital": [
    "crucial",
    "essential",
    "critical",
    "key",
    "must-have"
  ],
  "voice": [
    "say",
    "speak up",
    "express",
    "articulate"
  ],
  "volume": [
    "amount",
    "quantity",
    "bulk",
    "number"
  ],
  "waste": [
    "squander",
    "misuse",
    "throw away",
    "burn through"
  ],
  "watch": [
    "observe",
    "monitor",
    "keep an eye on",
    "pay attention to"
  ],
  "weak": [
    "feeble",
    "fragile",
    "flimsy",
    "lacking"
  ],
  "wealth": [
    "riches",
    "money",
    "fortune",
    "assets"
  ],
  "weapon": [
    "tool",
    "instrument",
    "means",
    "arm"
  ],
  "weight": [
    "heaviness",
    "mass",
    "load",
    "burden"
  ],
  "whole": [
    "entire",
    "complete",
    "full",
    "total"
  ],
  "widespread": [
    "common",
    "prevalent",
    "extensive",
    "rampant"
  ],
  "willing": [
    "ready",
    "open to",
    "inclined",
    "eager"
  ],
  "wind": [
    "breeze",
    "air",
    "gust",
    "draft"
  ],
  "wise": [
    "smart",
    "clever",
    "sensible",
    "judicious"
  ],
  "wish": [
    "hope",
    "want",
    "desire",
    "dream"
  ],
  "within": [
    "inside",
    "in",
    "during"
  ],
  "without": [],
  "wonderful": [
    "great",
    "amazing",
    "fantastic",
    "marvelous"
  ],
  "word": [
    "term",
    "expression",
    "statement"
  ],
  "work": [
    "job",
    "task",
    "labor",
    "effort"
  ],
  "world": [
    "globe",
    "planet",
    "earth",
    "society"
  ],
  "worry": [
    "concern",
    "stress",
    "anxiety",
    "fret"
  ],
  "worth": [
    "valuable",
    "meaningful",
    "of value"
  ],
  "write": [
    "pen",
    "draft",
    "compose",
    "put down"
  ],
  "wrong": [
    "incorrect",
    "mistaken",
    "off",
    "not right"
  ],
  "year": [
    "twelve months",
    "calendar year",
    "cycle"
  ],
  "yield": [
    "produce",
    "generate",
    "return",
    "output"
  ],
  "young": [
    "early",
    "new",
    "fresh"
  ],
  "deadline": [
    "cutoff",
    "due date",
    "time limit"
  ],
  "enough": [
    "plenty",
    "sufficient",
    "adequate"
  ],
  "exactly": [
    "precisely",
    "spot-on",
    "specifically"
  ],
  "fast": [
    "quick",
    "rapid",
    "swift",
    "speedy"
  ],
  "find": [
    "discover",
    "come across",
    "stumble upon",
    "uncover"
  ],
  "first": [
    "initially",
    "to start",
    "for starters",
    "first off"
  ],
  "get": [
    "obtain",
    "acquire",
    "land",
    "pick up"
  ],
  "give": [
    "provide",
    "supply",
    "hand over",
    "deliver"
  ],
  "know": [
    "understand",
    "realize",
    "be aware"
  ],
  "make": [
    "create",
    "build",
    "craft",
    "produce"
  ],
  "new": [
    "fresh",
    "novel",
    "recent",
    "latest"
  ],
  "old": [
    "previous",
    "former",
    "past",
    "earlier"
  ],
  "right": [
    "correct",
    "proper",
    "appropriate",
    "suitable"
  ],
  "see": [
    "notice",
    "observe",
    "spot",
    "catch"
  ],
  "seem": [
    "appear",
    "look like",
    "come across as"
  ],
  "try": [
    "attempt",
    "make an effort",
    "give it a shot"
  ],
  "use": [
    "employ",
    "apply",
    "put to work",
    "utilize"
  ],
  "want": [
    "need",
    "desire",
    "wish",
    "aim for"
  ],
  "way": [
    "method",
    "approach",
    "manner",
    "strategy"
  ]
};

function isInQuotes(text, index) {
  const before = text.slice(0, index);
  const doubleQuotes = (before.match(/"/g) || []).length;
  const singleQuotes = (before.match(/'/g) || []).length;
  return doubleQuotes % 2 === 1 || singleQuotes % 2 === 1;
}

function looksLikeProperNoun(word, position, sentence) {
  if (!/^[A-Z][a-z]/.test(word)) return false;
  const words = sentence.trim().split(/\s+/);
  const idx = words.indexOf(word);
  return idx > 0;
}

function swapSafeSynonyms(text, probability = 0.12) {
  const words = text.split(/(\s+)/);
  const result = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word || /^\s+$/.test(word) || /^[^a-zA-Z]+$/.test(word) || word.length < 4) {
      result.push(word);
      continue;
    }
    if (word.startsWith('___PROT_')) {
      result.push(word);
      continue;
    }
    if (word === word.toUpperCase()) {
      result.push(word);
      continue;
    }
    const fullTextSoFar = words.slice(0, i).join('');
    if (isInQuotes(text, fullTextSoFar.length)) {
      result.push(word);
      continue;
    }
    const sentenceContext = words.slice(Math.max(0, i - 15), i + 15).join('');
    if (looksLikeProperNoun(word, i, sentenceContext)) {
      result.push(word);
      continue;
    }

    const lower = word.toLowerCase();
    const nextNonEmpty = (words.slice(i + 1).find(w => w && !/^\s+$/.test(w)) || '').toLowerCase().replace(/[^a-z]/g, '');
    const prevNonEmpty = (words.slice(0, i).reverse().find(w => w && !/^\s+$/.test(w)) || '').toLowerCase().replace(/[^a-z]/g, '');
    if (lower === 'instead' && nextNonEmpty === 'of') {
      result.push(word);
      continue;
    }
    if (lower === 'rather' && nextNonEmpty === 'than') {
      result.push(word);
      continue;
    }
    if (lower === 'after' && (prevNonEmpty === 'day' || nextNonEmpty === 'day')) {
      result.push(word);
      continue;
    }
    const COMPOUND_BLACKLIST = [
      'time management', 'time block', 'time blocks', 'time frame', 'time frames',
      'design philosophy', 'operating system', 'machine learning', 'data science',
      'climate change', 'fossil fuel', 'fossil fuels', 'power plant', 'power plants',
      'wind turbine', 'wind turbines', 'solar panel', 'solar panels', 'smart grid',
      'battery storage', 'electoral roll', 'electoral rolls', 'voter list', 'voter lists',
      'zero trust', 'supply chain', 'deep work', 'mental fatigue', 'decision making',
      'decision support', 'programming language', 'high level', 'general purpose',
      'object oriented', 'functional programming', 'clinical workflows', 'patient care',
      'context switching', 'knowledge workers', 'knowledge worker', 'meeting sprawl',
      'long-term deliverables', 'calendar defense', 'defense mechanisms', 'work environment',
      'corporate environment', 'least privilege', 'circuit breaker', 'event loop',
      'garbage collection', 'gradient descent', 'cross validation', 'cold start',
      'single sign-on', 'rate limiting', 'buffer overflow', 'type inference',
      'distributed ledger', 'feature flag', 'root cause analysis', 'technical debt',
      'cognitive load', 'flow state', 'working memory', 'eisenhower matrix',
      'pomodoro technique', 'kanban board', 'active recall', 'spaced repetition',
      'microservice architecture', 'cloud computing', 'data pipeline', 'neural network',
      'natural language processing', 'large language model', 'generative ai',
      'reinforcement learning', 'continuous integration', 'continuous delivery',
      'professional success', 'personal productivity', 'artificial intelligence',
      'educational technology', 'student development', 'higher education',
      'digital classrooms', 'machine learning', 'intelligent tutoring'
    ];
    const surrounding = text.toLowerCase().slice(Math.max(0, fullTextSoFar.length - 25), fullTextSoFar.length + 30);
    if (COMPOUND_BLACKLIST.some(phrase => surrounding.includes(phrase))) {
      result.push(word);
      continue;
    }

    const candidateList = SYNONYMS[lower];
    if (candidateList && candidateList.length > 0 && Math.random() < probability) {
      // Pick a single-word synonym
      const singleCandidates = candidateList.filter(c => !/\s/.test(c));
      if (singleCandidates.length > 0) {
        const chosen = singleCandidates[Math.floor(Math.random() * singleCandidates.length)];
        result.push(matchCase(chosen, word));
        continue;
      }
    }

    result.push(word);
  }

  return result.join('');
}

// ── 6. Burstiness & Sentence Length Manipulation ─────────────────────────────
function manipulateSentenceLengths(sentences) {
  const result = [];
  for (const s of sentences) {
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length > 26) {
      const match = s.match(/,\s+(?:and|but|while|which|where|so)\s+/i);
      if (match && match.index > 12 && match.index < s.length - 12) {
        const p1 = s.slice(0, match.index).trim();
        const p2 = s.slice(match.index + match[0].length).trim();
        const cap = p2.charAt(0).toUpperCase() + p2.slice(1);
        result.push(p1 + '.');
        result.push(cap);
        continue;
      }
    }
    result.push(s);
  }
  return result;
}

function ensureBurstiness(sentences) {
  if (sentences.length < 2) return sentences;
  const lengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  
  let flat = true;
  for (let i = 0; i < lengths.length - 1; i++) {
    if (Math.abs(lengths[i] - lengths[i+1]) >= 7) {
      flat = false;
      break;
    }
  }

  if (flat) {
    // If sentences are flat, split the longest sentence at a coordinating conjunction or comma
    let longestIdx = 0;
    for (let i = 1; i < lengths.length; i++) {
      if (lengths[i] > lengths[longestIdx]) longestIdx = i;
    }
    const target = sentences[longestIdx];
    if (lengths[longestIdx] >= 16) {
      const m = target.match(/,\s+(and|but|while|so|which|because)\s+/i);
      if (m && m.index > 20 && m.index < target.length - 20) {
        const h = target.slice(0, m.index).trim() + '.';
        const conj = m[1].toLowerCase();
        const t = target.slice(m.index + m[0].length).trim();
        let prefix = '';
        if (conj === 'but' || conj === 'so') {
          prefix = conj.charAt(0).toUpperCase() + conj.slice(1) + ' ';
        } else if (conj === 'which') {
          prefix = 'This ';
        } else if (conj === 'while') {
          prefix = 'Meanwhile, ';
        } else if (conj === 'because') {
          prefix = 'This occurs because ';
        }
        const cleanT = (prefix && prefix.endsWith(' '))
          ? (t.charAt(0).toLowerCase() + t.slice(1))
          : (t.charAt(0).toUpperCase() + t.slice(1));
        sentences.splice(longestIdx, 1, h, prefix + cleanT);
      }
    }
  }

  return sentences;
}

// ── 7. Register & Formality Styling ───────────────────────────────────────────
const STEALTH_CONTRACTIONS = [
  [/\bDo not\b/g, "Don't"], [/\bdo not\b/g, "don't"],
  [/\bDoes not\b/g, "Doesn't"], [/\bdoes not\b/g, "doesn't"],
  [/\bDid not\b/g, "Didn't"], [/\bdid not\b/g, "didn't"],
  [/\bCannot\b/g, "Can't"], [/\bcannot\b/g, "can't"], [/\bcan not\b/g, "can't"],
  [/\bWill not\b/g, "Won't"], [/\bwill not\b/g, "won't"],
  [/\bWould not\b/g, "Wouldn't"], [/\bwould not\b/g, "wouldn't"],
  [/\bShould not\b/g, "Shouldn't"], [/\bshould not\b/g, "shouldn't"],
  [/\bCould not\b/g, "Couldn't"], [/\bcould not\b/g, "couldn't"],
  [/\bIs not\b/g, "Isn't"], [/\bis not\b/g, "isn't"],
  [/\bAre not\b/g, "Aren't"], [/\bare not\b/g, "aren't"],
  [/\bWas not\b/g, "Wasn't"], [/\bwas not\b/g, "wasn't"],
  [/\bWere not\b/g, "Weren't"], [/\bwere not\b/g, "weren't"],
  [/\bHas not\b/g, "Hasn't"], [/\bhas not\b/g, "hasn't"],
  [/\bHave not\b/g, "Haven't"], [/\bhave not\b/g, "haven't"],
  [/\bIt is\b/g, "It's"], [/\bit is\b/g, "it's"],
  [/\bThey are\b/g, "They're"], [/\bthey are\b/g, "they're"],
  [/\bWe are\b/g, "We're"], [/\bwe are\b/g, "we're"],
  [/\bYou are\b/g, "You're"], [/\byou are\b/g, "you're"],
  [/\bThat is\b/g, "That's"], [/\bthat is\b/g, "that's"],
  [/\bThere is\b/g, "There's"], [/\bthere is\b/g, "there's"]
];

const ACADEMIC_EXPANSIONS = [
  [/\bdon't\b/gi, "do not"], [/\bdoesn't\b/gi, "does not"], [/\bdidn't\b/gi, "did not"],
  [/\bcan't\b/gi, "cannot"], [/\bwon't\b/gi, "will not"], [/\bwouldn't\b/gi, "would not"],
  [/\bisn't\b/gi, "is not"], [/\baren't\b/gi, "are not"], [/\bit's\b/gi, "it is"],
  [/\bthey're\b/gi, "they are"], [/\bwe're\b/gi, "we are"], [/\byou're\b/gi, "you are"],
  [/\bthere's\b/gi, "there is"], [/\bthat's\b/gi, "that is"]
];

function applyRegister(text, style) {
  let r = text;
  if (style !== 'academic') {
    for (const [re, rep] of STEALTH_CONTRACTIONS) {
      r = r.replace(re, rep);
    }
  } else {
    for (const [re, rep] of ACADEMIC_EXPANSIONS) {
      r = r.replace(re, rep);
    }
  }
  return r;
}

function fixArticles(text) {
  return text
    .replace(/\b([Aa])\s+([Aa])\s+/g, '$1 ')
    .replace(/\b([Aa])\s+an\s+/gi, 'an ')
    .replace(/\b(an)\s+([Aa])\s+/gi, 'an ')
    .replace(/\b(a)(\s+)(?=[aeiou][a-z]{2,})(?!uni|use|usu|one|eu)/gi, (m, a, sp) => (a === 'A' ? 'An' : 'an') + sp)
    .replace(/\b(an)(\s+)(?=[bcdfgjklmnpqrstvwxyz][a-z]{2,})(?!hour|honest|honor|heir)/gi, (m, a, sp) => (a === 'An' ? 'A' : 'a') + sp);
}

function capitalizeSentenceStarts(text) {
  return text.replace(/(^\s*|[.!?]["')\]]?\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

function tidyPunctuation(text) {
  return fixArticles(text)
    .replace(/,\s*,+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

// ── 8. Local Multi-Metric AI Detection Engine ─────────────────────────────────
function calculatePerplexity(text) {
  const words = text.toLowerCase().split(/\s+/);
  if (words.length < 5) return 50;
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  const values = Object.values(freq);
  const maxFreq = Math.max(...values);
  const avgFreq = words.length / values.length;
  const uniformity = maxFreq / avgFreq;
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + ' ' + words[i + 1]);
  const bigramFreq = {};
  bigrams.forEach(b => bigramFreq[b] = (bigramFreq[b] || 0) + 1);
  const uniqueBigrams = Object.keys(bigramFreq).length;
  const bigramDiversity = uniqueBigrams / (bigrams.length || 1);
  const score = (bigramDiversity * 60) + ((100 - uniformity * 15) * 0.4);
  return Math.min(100, Math.max(0, score));
}

function calculateBurstiness(sentences) {
  if (sentences.length < 3) return 50;
  const lengths = sentences.map(s => s.split(/\s+/).length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const burstiness = (stdDev / (avg || 1)) * 100;
  return Math.min(100, burstiness * 2.5);
}

function calculateAiProbability(text) {
  if (!text || !text.trim()) return 0.0;
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return 0.0;
  const perp = calculatePerplexity(text);
  const burst = calculateBurstiness(sentences);

  let aiPhraseCount = 0;
  const lower = text.toLowerCase();
  for (const item of AI_LEXICON_PHRASES) {
    try {
      if (new RegExp(item.pattern, 'i').test(lower)) aiPhraseCount++;
    } catch (e) {}
  }

  let formulaicOpeners = 0;
  for (const s of sentences) {
    if (/^(By\s+[a-z]+ing|Moreover|Furthermore|Additionally|In addition|It is essential|It is important|Consequently|In today's|In conclusion)\b/i.test(s.trim())) {
      formulaicOpeners++;
    }
  }

  // Real multi-dimensional scoring:
  const perpDeficit = Math.max(0, 55 - perp);
  const burstDeficit = Math.max(0, 60 - burst);
  const structDeficit = (formulaicOpeners / sentences.length) * 40;
  const phraseScore = Math.min(30, aiPhraseCount * 6);

  const raw = (perpDeficit * 0.8) + (burstDeficit * 0.7) + structDeficit + phraseScore;
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}
const estimateAiScore = calculateAiProbability;

// ── 9. Multi-Stage Transformation Pipeline ───────────────────────────────────
// Structural transforms: these change sentence SHAPE (order of clauses, length,
// transitions), not just vocabulary, because detectors score structure/predictability.

const SAFE_LOWER_STARTERS = new Set([
  'the', 'this', 'that', 'these', 'those', 'it', 'they', 'we', 'you', 'there', 'many', 'most',
  'some', 'a', 'an', 'each', 'such', 'their', 'its', 'our', 'your', 'people', 'few', 'several',
  'both', 'all', 'one', 'what'
]);

function lowerFirstSafe(s) {
  const w = (s.match(/^[A-Za-z']+/) || [''])[0].toLowerCase();
  return SAFE_LOWER_STARTERS.has(w) ? s.charAt(0).toLowerCase() + s.slice(1) : null;
}

function upperFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function wc(s) {
  return s.split(/\s+/).filter(Boolean).length;
}

// "Because X, Y." -> "Y because X."   (changes clause order, a strong structural signal)
function swapSubordinateClause(sentence) {
  const m = sentence.match(/^(Because|Since|Although|Though|While|Whereas|If|When|Unless|After|Before) ([^,;]{10,}?), ([^,].{15,}?)([.!?])$/);
  if (!m) return sentence;
  const [, conj, clause, main, punct] = m;
  // If main clause starts with a pronoun referring back to the subordinate clause, DO NOT swap
  if (/^(it|it's|they|they're|he|she|this|these|its|their)\b/i.test(main.trim())) return sentence;
  if (/^(and|but|which|so|yet|then)\b/i.test(main)) return sentence;
  const needsComma = /^(Although|Though|While|Whereas)$/.test(conj);
  return upperFirst(main) + (needsComma ? ', ' : ' ') + conj.toLowerCase() + ' ' + clause + punct;
}

function splitLongSentence(sentence) {
  const wordCount = wc(sentence);
  if (wordCount < 16) return [sentence];
  const m = sentence.match(/,\s+(and|but|so|yet|while|whereas)\s+/i);
  if (m && m.index >= 20 && m.index <= sentence.length - 20) {
    const head = sentence.slice(0, m.index).trim() + '.';
    const word = m[1].toLowerCase();
    const tail = sentence.slice(m.index + m[0].length).trim();
    const keep = (word === 'but' || word === 'yet' || word === 'so')
      ? (upperFirst(word) + ' ' + (tail.charAt(0).toLowerCase() + tail.slice(1)))
      : upperFirst(tail);
    return [head, keep];
  }
  return [sentence];
}

function mergeShortNeighbours(sents) {
  const out = [];
  for (let i = 0; i < sents.length; i++) {
    const a = sents[i];
    const b = sents[i + 1];
    if (b && wc(a) < 10 && wc(b) < 10 && /\.$/.test(a) && Math.random() < 0.6) {
      const lowered = lowerFirstSafe(b);
      if (lowered) {
        out.push(a.slice(0, -1) + (Math.random() < 0.5 ? ', and ' : '; ') + lowered);
        i++;
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

function softenTransitions(sentence, style) {
  const filler = /^(Moreover|Furthermore|Additionally|In addition|Notably|Importantly|Consequently|Subsequently|Indeed),\s+(.*)$/s;
  const m = sentence.match(filler);
  if (m && Math.random() < 0.6) return upperFirst(m[2]);
  if (style !== 'academic') {
    const h = sentence.match(/^However,\s+(.*)$/s);
    if (h && Math.random() < 0.5) return 'But ' + h[1];
    const t = sentence.match(/^(Therefore|Thus|Hence),\s+(.*)$/s);
    if (t) return 'So ' + t[2].charAt(0).toLowerCase() + t[2].slice(1);
  }
  return sentence;
}

// Soften formulaic conclusion openers without discarding user content
function dropRecapCloser(sents) {
  if (!sents || sents.length === 0) return sents;
  const lastIdx = sents.length - 1;
  const last = sents[lastIdx];
  const m = last.match(/^(?:Overall|Ultimately|In essence|In short|All in all|In summary|To sum up),?\s*(.*)$/i);
  if (m && m[1]) {
    sents[lastIdx] = upperFirst(m[1]);
  }
  return sents;
}

function transformDefinitionOpener(sents, style = 'natural') {
  if (!sents || sents.length === 0) return sents;
  const s0 = sents[0];

  // Pattern A: [Subject] is (essential | vital | crucial | pivotal | critical | fundamental | indispensable) (for | to) [Domain/Outcome]
  const mEssential = s0.match(/^((?:___PROT_\d+___|[A-Z][\w\s-]+?))\s+(?:is|has become|remains|serves as|acts as|stands as|constitutes)\s+(?:an?\s+)?(essential|vital|crucial|pivotal|critical|fundamental|indispensable)\s+(?:turning point|milestone|driver|prerequisite|element|paradigm|component)?\s*(?:for|in|to)\s+([^.]+)[.!?]?$/i);
  if (mEssential) {
    const subj = mEssential[1].trim();
    const outcome = mEssential[3].trim().replace(/[.!?]+$/, '');
    const cleanOutcome = outcome.replace(/^(?:maintaining|achieving|supporting|promoting|securing|ensuring)\s+/i, '');
    const subjClean = subj.replace(/^(The|A|An)\s+([a-z])/i, (m, p1, p2) => p1.toLowerCase() + ' ' + p2);
    const subjLower = subj.startsWith('___PROT_') ? subj : (subj.charAt(0).toLowerCase() + subj.slice(1));
    const subjAcademic = subj.startsWith('___PROT_') ? subj : (subj.charAt(0).toUpperCase() + subj.slice(1));

    let options;
    if (style === 'academic') {
      options = [
        `${subjAcademic} represents a foundational prerequisite for ${cleanOutcome}.`,
        `Achieving sustained progress in ${cleanOutcome} relies fundamentally on ${subjLower}.`,
        `Within this domain, ${subjLower} functions as an indispensable driver of ${cleanOutcome}.`,
        `The realization of ${cleanOutcome} depends substantially upon ${subjLower}.`
      ];
    } else if (style === 'executive') {
      options = [
        `${subjClean} is critical to driving ${cleanOutcome}.`,
        `Delivering ${cleanOutcome} starts directly with ${subjLower}.`,
        `${subj} remains the primary lever for ${cleanOutcome}.`,
        `Sustaining ${cleanOutcome} requires an active focus on ${subjLower}.`
      ];
    } else if (style === 'casual') {
      options = [
        `If you care about ${cleanOutcome}, you really need ${subjLower}.`,
        `Honestly, ${cleanOutcome} mostly comes down to ${subjLower}.`,
        `Without ${subjLower}, keeping up with ${cleanOutcome} turns into an uphill battle.`,
        `Getting a good handle on ${subjLower} makes all the difference for ${cleanOutcome}.`
      ];
    } else {
      options = [
        `Few things influence ${cleanOutcome} more directly than ${subjLower}.`,
        `Sustaining ${cleanOutcome} ultimately comes down to ${subjLower}.`,
        `Without ${subjLower}, keeping up with ${cleanOutcome} quickly turns into an uphill battle.`,
        `Getting a real handle on ${subjLower} is central to ${cleanOutcome}.`
      ];
    }
    const pick = options[Math.abs(subj.length * 7) % options.length];
    sents[0] = pick;
    return sents;
  }

  // Pattern B: [Subject] is (a | an | the) [Category Noun] (that | which | used to | designed to | intended to) [Description]
  const m = s0.match(/^((?:___PROT_\d+___|[A-Z][\w\s-]+?))\s+(is|represents|denotes|comprises)\s+(an?|the)\s+([a-z-]+(?:\s+[a-z-]+){0,2})\s+(that|which|used to|designed to|intended to)\s+(.*)$/i);
  if (m) {
    const subj = m[1].trim();
    const art = m[3].trim() + ' ';
    const cat = m[4].trim() + ' ';
    const rel = m[5].trim() + ' ';
    const rest = m[6].trim().replace(/[.!?]+$/, '');

    const subjClean = subj.replace(/^(The|A|An)\s+([a-z])/i, (match, p1, p2) => p1.toLowerCase() + ' ' + p2);

    let options;
    if (style === 'academic') {
      options = [
        `Fundamentally, ${subjClean} functions as ${art}${cat}${rel}${rest}.`,
        `In operational terms, ${subjClean} serves as ${art}${cat}${rel}${rest}.`,
        `At its core, ${subjClean} operates as ${art}${cat}${rel}${rest}.`
      ];
    } else if (style === 'executive') {
      options = [
        `In practice, ${subjClean} serves as ${art}${cat}${rel}${rest}.`,
        `Operationally, ${subjClean} functions as ${art}${cat}${rel}${rest}.`,
        `${subjClean} provides ${art}${cat}${rel}${rest}.`
      ];
    } else if (style === 'casual') {
      options = [
        `Basically, ${subjClean} is ${art}${cat}${rel}${rest}.`,
        `Think of ${subjClean} as ${art}${cat}${rel}${rest}.`,
        `${subjClean} pretty much acts as ${art}${cat}${rel}${rest}.`
      ];
    } else {
      options = [
        `At its core, ${subjClean} functions as ${art}${cat}${rel}${rest}.`,
        `In practical terms, ${subjClean} serves as ${art}${cat}${rel}${rest}.`,
        `${subjClean} essentially acts as ${art}${cat}${rel}${rest}.`,
        `When looking at ${subjClean}, it basically operates as ${art}${cat}${rel}${rest}.`
      ];
    }
    const pick = options[Math.abs(subj.length * 3) % options.length];
    sents[0] = pick;
    return sents;
  }

  // Pattern C: [Subject] is (rapidly/increasingly...) (transforming/reshaping...) [Object]
  const mAction = s0.match(/^((?:___PROT_\d+___|[A-Z][\w\s-]+?))\s+is\s+(?:(rapidly|increasingly|steadily|quietly)\s+)?(transforming|reshaping|changing|driving|altering|revolutionizing|redefining)\s+(.+?)[.!?]?$/i);
  if (mAction) {
    const subj = mAction[1].trim();
    const object = mAction[4].trim();
    const cleanObj = object.replace(/^(the|a|an)\s+/i, '').replace(/^(?:modern|contemporary|current)\s+/i, '');
    const subjClean = subj.replace(/^(The|A|An)\s+([a-z])/i, (match, p1, p2) => p1.toLowerCase() + ' ' + p2);

    let options;
    if (style === 'academic') {
      options = [
        `${subj} increasingly informs and reorganizes contemporary ${cleanObj}.`,
        `The ongoing evolution of ${object} reflects the significant impact of ${subjClean}.`,
        `${subj} continues to systematically reshape ${object}.`
      ];
    } else if (style === 'executive') {
      options = [
        `${subj} is fundamentally accelerating ${object}.`,
        `Today's ${cleanObj} is being actively reshaped by ${subjClean}.`,
        `${subj} continues to drive major shifts across ${object}.`
      ];
    } else if (style === 'casual') {
      options = [
        `${subj} is shaking up ${object} in a big way.`,
        `You can really see how ${subjClean} is changing ${object}.`,
        `${subj} is totally changing the game for ${cleanObj}.`
      ];
    } else {
      options = [
        `${subj} is quickly reshaping how people approach ${cleanObj}.`,
        `${subj} continues to change ${object} in fundamental ways.`,
        `The way people handle ${cleanObj} is shifting quickly because of ${subjClean}.`,
        `Few developments are altering ${object} as noticeably as ${subjClean}.`
      ];
    }
    const pick = options[Math.abs(subj.length * 5) % options.length];
    sents[0] = pick;
    return sents;
  }
  return sents;
}

function restructureGerundClauses(sentence, style = 'natural') {
  if (!sentence || sentence.length < 25) return sentence;

  // By [verb-ing] [Object], [Subject] [can|may|experienced...] [Predicate]
  const m = sentence.match(/^By\s+([a-z]+ing(?:\s+[a-z]+)?)\s+(.+?),\s+([A-Za-z0-9_\s-]+?)\s+(can|may|could|are able to|experienced|achieved)\s+(.+?)[.!?]?$/i);
  if (!m) return sentence;

  const [, gerund, object, subject, modal, predicate] = m;
  const cleanObj = object.trim();
  const cleanSubj = subject.trim();
  const cleanPred = predicate.trim();

  let options;
  if (modal === 'experienced' || modal === 'achieved') {
    options = style === 'academic'
      ? [
        `Through ${gerund} ${cleanObj}, ${cleanSubj} ${modal} ${cleanPred}.`,
        `The shift involving ${gerund} ${cleanObj} enabled ${cleanSubj} to experience ${cleanPred}.`
      ]
      : [
        `As ${cleanSubj} moved into ${cleanObj}, they ${modal} ${cleanPred}.`,
        `Transitioning toward ${cleanObj} led ${cleanSubj} to see ${cleanPred}.`
      ];
  } else if (style === 'academic') {
    options = [
      `Establishing ${cleanObj} enables ${cleanSubj} to ${cleanPred}.`,
      `Through the systematic deployment of ${cleanObj}, ${cleanSubj} effectively ${cleanPred}.`,
      `The implementation of ${cleanObj} ensures that ${cleanSubj} can ${cleanPred}.`
    ];
  } else {
    options = [
      `When ${cleanSubj} bring ${cleanObj}, they can ${cleanPred}.`,
      `By adopting ${cleanObj}, ${cleanSubj} are able to ${cleanPred}.`,
      `With ${cleanObj} in place, ${cleanSubj} can more easily ${cleanPred}.`,
      `Integrating ${cleanObj} enables ${cleanSubj} to ${cleanPred}.`
    ];
  }

  return options[Math.abs(sentence.length * 3) % options.length];
}

function restructureParticipialFacilitation(sentence, style = 'natural') {
  if (!sentence || sentence.length < 25) return sentence;

  // Pattern A: Applying / Utilizing / Leveraging / Adopting [Tool] helps [Audience] [Verb] [Rest]
  const mA = sentence.match(/^(?:Applying|Utilizing|Leveraging|Adopting|Implementing|Employing)\s+([^,]{3,50})\s+(helps?|enables?|allows?)\s+([A-Za-z0-9_\s-]+?)\s+(?:to\s+)?(distinguish|separate|identify|prioritize|optimize|streamline|accelerate|mitigate|manage|navigate|balance|handle|reach|achieve|differentiate)\s+(.+?)[.!?]?$/i);
  if (mA) {
    const [, tool, helperVerb, audience, actionVerb, rest] = mA;
    const cleanTool = tool.trim();
    const cleanAudience = audience.trim();
    const cleanRest = rest.trim();

    let options;
    if (style === 'academic') {
      options = [
        `The operationalization of ${cleanTool} provides ${cleanAudience} with a structured method to ${actionVerb} ${cleanRest}.`,
        `Deploying ${cleanTool} equips ${cleanAudience} to systematically ${actionVerb} ${cleanRest}.`,
        `Through ${cleanTool}, ${cleanAudience} obtain an analytical framework to ${actionVerb} ${cleanRest}.`
      ];
    } else {
      options = [
        `Frameworks like ${cleanTool} give ${cleanAudience} a practical way to ${actionVerb} ${cleanRest}.`,
        `With ${cleanTool}, ${cleanAudience} can more reliably ${actionVerb} ${cleanRest}.`,
        `Putting ${cleanTool} into practice gives ${cleanAudience} the clarity to ${actionVerb} ${cleanRest}.`
      ];
    }
    return options[Math.abs(sentence.length * 5) % options.length];
  }

  // Pattern B: Utilizing / Leveraging / Adopting [Tool] facilitates/drives/supports [Rest]
  const mB = sentence.match(/^(?:Applying|Utilizing|Leveraging|Adopting|Implementing|Employing)\s+([^,]{3,60})\s+(facilitates?|supports?|accelerates?|drives?|simplifies?)\s+([^.]+)[.!?]?$/i);
  if (mB) {
    const [, tool, verb, rest] = mB;
    const cleanTool = tool.trim();
    const cleanRest = rest.trim();

    let options;
    if (style === 'academic') {
      options = [
        `Deploying ${cleanTool} provides direct operational support for ${cleanRest}.`,
        `Through the adoption of ${cleanTool}, teams systematically streamline ${cleanRest}.`
      ];
    } else {
      options = [
        `Adopting ${cleanTool} makes it much simpler to manage ${cleanRest}.`,
        `Using ${cleanTool} is one of the cleanest ways to handle ${cleanRest}.`
      ];
    }
    return options[Math.abs(sentence.length * 7) % options.length];
  }

  return sentence;
}

function restructureCorporateStageSetting(sentence, style = 'natural') {
  if (!sentence || sentence.length < 25) return sentence;

  // Across modern workplaces / In modern settings / Today, [Subject] [struggle/encounter] [Problems], which [erodes/cuts down] [Target]
  const m = sentence.match(/^(?:Today|In modern settings|Across modern workplaces),\s+([^,]{3,35})\s+(?:often run into|frequently struggle with|grapple with)\s+([^,]+?)(?:,\s*which|\s*—|\s*\.\s*This)\s*(?:cuts down|reduces|diminishes|erodes)\s+([^.]+)[.!?]?$/i);
  if (!m) return sentence;

  const [, subject, problems, target] = m;
  const cleanSubj = subject.trim();
  const cleanProbs = problems.trim();
  const cleanTarget = target.trim();

  let options;
  if (style === 'academic') {
    options = [
      `Across contemporary organizational settings, ${cleanSubj} regularly encounter ${cleanProbs}, substantially undermining ${cleanTarget}.`,
      `The prevalence of ${cleanProbs} in modern work environments presents a persistent friction for ${cleanSubj}, attenuating ${cleanTarget}.`
    ];
  } else {
    options = [
      `Across modern work environments, ${cleanSubj} constantly battle ${cleanProbs}—eroding the hours needed for ${cleanTarget}.`,
      `In busy workplaces, ${cleanSubj} frequently get derailed by ${cleanProbs}, which eats away at ${cleanTarget}.`
    ];
  }

  return options[Math.abs(sentence.length * 11) % options.length];
}

function injectRhythmicBurstiness(sents, style, opts = {}) {
  if (sents.length < 2 || opts.isListItem) return sents;

  const lengths = sents.map(wc);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / lengths.length;
  const cv = (Math.sqrt(variance) / (mean || 1)) * 100;

  // If sentence lengths are flat (CV < 40%), split the longest compound sentence to introduce natural cadence variance
  if (cv < 40) {
    let maxIdx = 0;
    for (let i = 1; i < lengths.length; i++) {
      if (lengths[i] > lengths[maxIdx]) maxIdx = i;
    }
    if (lengths[maxIdx] >= 16) {
      const splitRes = splitLongSentence(sents[maxIdx]);
      if (splitRes.length > 1) {
        sents.splice(maxIdx, 1, ...splitRes);
      }
    }
  }
  return sents;
}

// ── 6 Advanced Anti-Detection Techniques ──────────────────────────────────────

// 1. Break AI Triads ("X, Y, and Z" -> "X and Y—along with Z")
// Fixed: anchors first token so preceding space is never consumed or stripped (prevents "iswidely")
function breakAITriads(text) {
  return text.replace(
    /([A-Za-z0-9][A-Za-z0-9_\s—–-]{1,26}[A-Za-z0-9]),\s+([A-Za-z0-9][A-Za-z0-9_\s—–-]{1,26}[A-Za-z0-9]),\s+and\s+([A-Za-z0-9][A-Za-z0-9_\s—–-]{1,26}[A-Za-z0-9])\b/g,
    (match, p1, p2, p3) => {
      if (match.includes('.') || match.includes(';') || match.includes('\n') || match.includes('___PROT_')) return match;
      return `${p1.trim()} and ${p2.trim()}—along with ${p3.trim()}`;
    }
  );
}

// 2. De-passivization (Active Voice Inversion)
const PASSIVE_VOICE_MAP = [
  [/\bis (?:utilized|utilised|employed) to\b/gi, 'helps to'],
  [/\bis designed to\b/gi, 'aims to'],
  [/\bis intended to\b/gi, 'aims to'],
  [/\bis characterized by\b/gi, 'features'],
  [/\bare characterized by\b/gi, 'feature'],
  [/\bcan be achieved by\b/gi, 'comes from'],
  [/\bare required to\b/gi, 'must'],
  [/\bhas been shown to\b/gi, 'consistently'],
  [/\bis considered to be\b/gi, 'is'],
  [/\bcan be seen as\b/gi, 'acts as'],
  [/\bis required in order to\b/gi, 'must']
];

function depassivizeClauses(text) {
  let r = text;
  for (const [re, rep] of PASSIVE_VOICE_MAP) {
    r = r.replace(re, rep);
  }
  return r;
}

// 3. Sawtooth Rhythm Enforcer (Micro-Burstiness: alternates short & long sentences)
// Fixed: supplies grammatical subjects so "which" splits don't leave subjectless fragments and preserves correct lowercase for continued verbs
function enforceSawtoothRhythm(sents) {
  if (sents.length < 3) return sents;
  const out = [];
  for (let i = 0; i < sents.length; i++) {
    const curr = sents[i];
    const next = sents[i + 1];
    if (next && Math.abs(wc(curr) - wc(next)) < 5 && wc(curr) >= 16) {
      const m = curr.match(/,\s+(and|but|while|so|which)\s+/i);
      if (m && m.index > 25 && m.index < curr.length - 20) {
        const h = curr.slice(0, m.index).trim() + '.';
        const t = curr.slice(m.index + m[0].length).trim();
        const conj = m[1].toLowerCase();
        let start = '';
        if (conj === 'but' || conj === 'so') {
          start = conj.charAt(0).toUpperCase() + conj.slice(1) + ' ';
        } else if (conj === 'which') {
          start = 'This ';
        } else if (conj === 'while') {
          start = 'At the same time, ';
        }
        out.push(h);
        const cleanT = (start && start.endsWith(' '))
          ? (t.charAt(0).toLowerCase() + t.slice(1))
          : (t.charAt(0).toUpperCase() + t.slice(1));
        out.push(start + cleanT);
        continue;
      }
    }
    out.push(curr);
  }
  return out;
}

// 4. Attention-Vector Disruption (Inject parenthetical qualifications adjacent to entities)
// Fixed: guards against possessives, acronyms in parens, and floating insertions; anchors to following verb
function injectAttentionDisruptions(sents, style) {
  if (style === 'academic') return sents;
  let injected = false;
  const QUALIFIERS = [
    '—in day-to-day practice—',
    '—when handled properly—',
    '—in most practical scenarios—',
    '—at least in standard settings—',
    '—from what practitioners observe—'
  ];
  return sents.map((s, idx) => {
    if (idx > 0 && idx < sents.length - 1 && !injected && !s.includes('—')) {
      const q = QUALIFIERS[Math.abs(s.length * 5 + idx) % QUALIFIERS.length];
      const m = s.match(/\b(___PROT_\d+___)(?!['’]s?\b)(?!\s*[\(\[,\-—])\s+(is|are|has|have|operates|functions|works|remains)\b/i);
      if (m) {
        injected = true;
        return s.replace(m[0], `${m[1]}${q} ${m[2]}`);
      }
      const mNoun = s.match(/^([A-Z][a-z]+(?:\s+[a-z]+){1,3})\s+(have|has|is|are|remains)\b/);
      if (mNoun && !mNoun[1].includes("'")) {
        injected = true;
        return s.replace(mNoun[0], `${mNoun[1]}${q} ${mNoun[2]}`);
      }
    }
    return s;
  });
}

// 5. Conversational Concessions ("Sure, X, but Y anyway")
function injectConversationalConcessions(sents, style) {
  if (style === 'academic') return sents;
  return sents.map(s => {
    const m = s.match(/^(?:However|Nevertheless|Still|But),\s+(.*)$/i);
    if (m && Math.random() < 0.8) {
      return `Sure, ${m[1].charAt(0).toLowerCase() + m[1].slice(1)}`;
    }
    return s;
  });
}

// 6. Punctuation Diversity (Colons for setups, semicolons for close thoughts)
function diversifyPunctuation(text) {
  return text
    .replace(/\bThe reason for this is that\b/gi, 'The reason is simple:')
    .replace(/\bThis means that\b/gi, 'In other words,')
    .replace(/\bIt is worth noting that\b/gi, 'Keep in mind:');
}

// 7. Academic Register Restructuring (Scholarly hedging, active academic syntax, de-corporatization)
function applyAcademicRestructuring(sents) {
  if (!sents || sents.length === 0) return sents;
  const ACADEMIC_HEDGES = [
    [/\bclearly demonstrates that\b/gi, 'suggests that'],
    [/\bclearly indicates that\b/gi, 'suggests that'],
    [/\bproves that\b/gi, 'points to the conclusion that'],
    [/\bplays a crucial role in\b/gi, 'remains central to'],
    [/\bplays a vital role in\b/gi, 'remains fundamental to'],
    [/\bplays a pivotal role in\b/gi, 'critically informs'],
    [/\bIn conclusion,\s*/gi, 'In synthesis, '],
    [/\bIn summary,\s*/gi, 'Synthesizing these findings, ']
  ];

  return sents.map((s, idx) => {
    let out = s;
    for (const [re, rep] of ACADEMIC_HEDGES) {
      out = out.replace(re, rep);
    }
    if (wc(out) >= 24 && idx % 2 === 1) {
      const m = out.match(/^([^,]{15,50}),\s+which\s+(.+)$/i);
      if (m) {
        out = `${m[1]}. This dynamic ${m[2]}`;
      }
    }
    return out;
  });
}

function restructureArbitraryParagraph(paragraph, style, opts = {}) {
  let p = paragraph.trim();
  let synProb = typeof opts.synProb === 'number' ? opts.synProb : 0.05;
  const intensity = opts.intensity || 'standard';
  if (intensity === 'deep') {
    synProb = Math.max(synProb, 0.09);
  } else if (intensity === 'stealth') {
    synProb = Math.max(synProb, 0.14);
  }

  const isListItem = opts.isListItem || /^\s*([*•\-\d]+\.?|[a-zA-Z]\))\s+/.test(p);
  const currentOpts = { ...opts, isListItem };

  // Lists / multi-line blocks: keep line structure, process long lines individually
  if (/\n/.test(p)) {
    return p.split(/\n/).map(line => {
      const t = line.trim();
      if (!t) return '';
      if (t.length < 60 && !/[.!?]\s*\S/.test(t)) return t;
      return restructureArbitraryParagraph(t, style, { ...currentOpts, isListItem: /^\s*([*•\-\d]+\.?|[a-zA-Z]\))\s+/.test(t) });
    }).join('\n');
  }

  // Pass 1: strip AI tells and domain-level formulaic templates on unmasked text
  let pClean = stripAITells(p);

  // Pass 1b: lock protected entities (including user-defined Glossary Guard)
  const { masked, protectedItems } = extractProtectedEntities(pClean, opts.lockedTerms || []);

  // Pass 2-3: AI tell patterns (supporting placeholders), collocations, de-passivization, triad breaking & lexicon purge
  let processed = stripAITells(masked);
  processed = depassivizeClauses(processed);
  processed = breakAITriads(processed);
  processed = diversifyPunctuation(processed);
  processed = applyCollocationsAndLexicon(processed);

  // Pass 4: light synonym perturbation (kept low: heavy swapping reads as spun text)
  if (synProb > 0) processed = swapSafeSynonyms(processed, synProb);

  // Pass 5: sentences
  let sents = splitIntoSentences(processed);

  // Pass 6: structural rewrites & micro-burstiness
  sents = sents.map(s => softenTransitions(s, style));
  sents = sents.map(s => (Math.random() < 0.7 ? swapSubordinateClause(s) : s));
  sents = sents.map(s => restructureGerundClauses(s, style));
  sents = sents.map(s => restructureParticipialFacilitation(s, style));
  sents = sents.map(s => restructureCorporateStageSetting(s, style));
  sents = sents.flatMap(splitLongSentence);
  sents = dropRecapCloser(sents);
  sents = mergeShortNeighbours(sents);
  if (!isListItem) sents = transformDefinitionOpener(sents, style);
  if (style === 'academic') {
    sents = applyAcademicRestructuring(sents);
    sents = enforceSawtoothRhythm(sents);
  } else {
    sents = injectRhythmicBurstiness(sents, style, currentOpts);
    sents = enforceSawtoothRhythm(sents);
    if (!isListItem) sents = injectAttentionDisruptions(sents, style);
    sents = injectConversationalConcessions(sents, style);
  }
  sents = ensureBurstiness(sents);

  // Pass 7-8: register, punctuation
  let joined = applyRegister(sents.join(' '), style);
  joined = tidyPunctuation(joined);
  joined = capitalizeSentenceStarts(joined);

  // Pass 9: restore protected entities
  return restoreProtectedEntities(joined, protectedItems);
}

function gerundToBase(word) {
  if (!word || !word.toLowerCase().endsWith('ing') || word.length < 5) return null;
  const w = word.toLowerCase();
  if (w.endsWith('tting')) return w.slice(0, -5) + 't';
  if (w.endsWith('pping')) return w.slice(0, -5) + 'p';
  if (w.endsWith('nning')) return w.slice(0, -5) + 'n';
  if (w.endsWith('rring')) return w.slice(0, -5) + 'r';
  if (w.endsWith('gging')) return w.slice(0, -5) + 'g';
  if (w.endsWith('bbing')) return w.slice(0, -5) + 'b';
  if (w.endsWith('mming')) return w.slice(0, -5) + 'm';
  const base = w.slice(0, -3);
  if (/(?:ur|iz|is|at|pl|bl|tl|sl|cl|gl|ud|id|od|os|us|iv|uc|ag|ug)$/.test(base)) {
    return base + 'e';
  }
  return base;
}

function destructureBulletHeadings(rawText, style) {
  return rawText.split('\n').map(line => {
    const m = line.match(/^(\s*[*•\-\d]+\.?|[a-zA-Z]\))\s+([^:\n]{3,60}):\s+(.+)$/);
    if (!m) return line;
    const [, bullet, heading, body] = m;
    const firstWord = heading.trim().split(/\s+/)[0];
    
    let processedBody = body;
    const bodyM = processedBody.match(/^([A-Z][a-z]+ing)\s+(.*)$/);
    if (bodyM && style !== 'academic') {
      const imp = gerundToBase(bodyM[1]);
      if (imp) {
        processedBody = imp.charAt(0).toUpperCase() + imp.slice(1) + ' ' + bodyM[2];
      }
    }

    const impHeading = gerundToBase(firstWord);
    if (impHeading && style !== 'academic') {
      const restHeading = heading.trim().slice(firstWord.length).trim();
      const imperativeHeading = impHeading.charAt(0).toUpperCase() 
        + impHeading.slice(1) 
        + (restHeading ? ' ' + restHeading : '');
      return `${bullet} ${imperativeHeading}: ${processedBody}`;
    }
    return `${bullet} ${heading}—${processedBody.charAt(0).toLowerCase() + processedBody.slice(1)}`;
  }).join('\n');
}

// ── 11. Main Humanize Controller ─────────────────────────────────────────────
// Always transforms the user's own text. Nothing is ever substituted.
function humanizeLocalText(rawText, style = 'natural', opts = {}) {
  if (!rawText || !rawText.trim()) return '';
  const cleaned = cleanMarkdown(rawText);
  const destructured = destructureBulletHeadings(cleaned, style);
  const rawParagraphs = destructured.split(/\n\s*\n+/);

  const out = rawParagraphs.map(paragraph => {
    const p = paragraph.trim();
    if (!p) return '';
    if (p.length < 60 && !/[.!?]\s*\S/.test(p) && !p.includes('.')) return p;
    return restructureArbitraryParagraph(p, style, opts);
  });
  return out.filter(Boolean).join('\n\n');
}

// Post-processing for text that came back from an LLM (no synonym swapping, no hooks).
function polishText(rawText, style = 'natural') {
  return humanizeLocalText(rawText, style, { synProb: 0, noHooks: true });
}

async function humanizeText(rawText, style = 'natural', options = {}) {
  const engine = options.engine || 'local';
  const lockedTerms = options.lockedTerms || [];
  if (engine === 'localllm') {
    const raw = await callLocalLLMAPI({
      endpoint: options.localEndpoint || 'http://localhost:11434',
      model: options.localModel || 'llama3.2',
      runner: options.localRunner || 'auto',
      text: rawText,
      style,
      lockedTerms
    });
    return polishText(raw, style);
  }
  if (engine === 'ai' && options.apiKey) {
    const raw = options.provider === 'gemini'
      ? await callGeminiAPI(options.apiKey, options.model || 'gemini-2.0-flash', rawText, style, lockedTerms)
      : await callGroqAPI(options.apiKey, rawText, style, lockedTerms);
    return polishText(raw, style);
  }
  return humanizeLocalText(rawText, style, { lockedTerms });
}

// ── 12. Randomised Human-Writing Prompt Builder ──────────────────────────────
// Each prompt is assembled from random parts so outputs don't share one fingerprint.
const PROMPT_PERSONAS = {
  natural: [
    'a working journalist writing a clear explainer for a general audience',
    'a practical blogger who explains things the way you would to a smart friend',
    'a student writing up their own notes after reading about the topic',
    'an industry practitioner writing a short internal memo for colleagues',
    'a magazine columnist with a dry, understated sense of humor'
  ],
  academic: [
    'a graduate student drafting a literature-review section',
    'a researcher writing a restrained journal-article introduction',
    'a policy analyst writing a briefing note',
    'a university lecturer writing course reading notes'
  ]
};

const PROMPT_RHYTHMS = [
  'short, long, medium, very short, long',
  'medium, very short, long, medium, short',
  'long, short, short, long, medium',
  'very short, long, medium, long, short',
  'medium, long, very short, medium, long'
];

const PROMPT_QUIRKS = {
  natural: [
    'include one candid conversational concession (e.g. "Sure, [objection or drawback], but [main point] anyway")',
    'use at least one vivid idiom or everyday phrase (e.g. "turns to mush", "out the window", "got heated", "juggle supplies")',
    'include one parenthetical aside in brackets or dashes',
    'start exactly one sentence with "And" or "But"',
    'include one short punchy sentence of four to six words',
    'use at least three natural contractions (it\'s, don\'t, that\'s)',
    'let one sentence run longer with an extra descriptive clause tucked inside',
    'refer to the reader or shared experience naturally ("you", "we")'
  ],
  academic: [
    'include one sentence over 30 words with a subordinate clause in the middle',
    'include one hedged analytical claim ("appears to", "in most circumstances", "tends to")',
    'include one parenthetical qualification or context note',
    'include one short sentence under eight words to decisively land an argument',
    'vary the grammatical subject of consecutive sentences'
  ]
};

const PROMPT_BANNED = [
  'delve', 'tapestry', 'multifaceted', 'pivotal', 'crucial', 'seamless', 'seamlessly', 'leverage',
  'utilize', 'foster', 'holistic', 'robust', 'landscape', 'realm', 'testament', 'underscore',
  'navigate', 'comprehensive', 'moreover', 'furthermore', 'additionally', 'in conclusion',
  '"it is important to note"', '"plays a vital role"', '"not only ... but also"', 'em dashes'
];

function pickRandom(arr, n = 1) {
  const pool = arr.slice();
  const picked = [];
  while (picked.length < n && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return n === 1 ? picked[0] : picked;
}

function countParagraphs(text) {
  return text.trim().split(/\n\s*\n+/).filter(s => s.trim()).length || 1;
}

function buildPrompt(text, style = 'natural', userLockedTerms = []) {
  const key = style === 'academic' ? 'academic' : 'natural';
  const persona = pickRandom(PROMPT_PERSONAS[key]);
  const rhythm = pickRandom(PROMPT_RHYTHMS);
  const quirks = pickRandom(PROMPT_QUIRKS[key], 2);
  const banned = pickRandom(PROMPT_BANNED, 14).join(', ');
  const paras = countParagraphs(text);
  const words = countWords(text);
  const tone = key === 'academic'
    ? 'Keep a formal, objective register, but write like a real scholar, not like an AI template. No contractions.'
    : 'Write in an authentic, conversational voice with contractions where a real person would use them.';

  const lockedSection = (Array.isArray(userLockedTerms) && userLockedTerms.length > 0)
    ? `\n- GLOSSARY GUARD (STRICT IMMUTABILITY): Under no circumstance alter, synonymize, omit, or rephrase any of the following terms:\n${userLockedTerms.map(t => `  * "${t}"`).join('\n')}\nEvery occurrence must remain 100% character-for-character intact.`
    : '';

  const exemplar = key === 'academic'
    ? `FEW-SHOT REFERENCE (How to rebuild AI text into authentic scholarly prose):
Original AI: "Artificial intelligence is rapidly transforming modern clinical workflows and patient care. Advanced machine learning models assist radiologists in identifying early-stage tumors and subtle fractures with high diagnostic precision."
Scholarly Human: "Over the past decade, automated diagnostic tools have steadily transitioned from experimental benchmarks into routine clinical environments. Within radiology departments, deep neural networks now support clinicians by flagging subtle anomalies—such as micro-calcifications and hairline fractures—that might otherwise escape initial review."`
    : `FEW-SHOT REFERENCE (How to rebuild AI text into authentic human prose):
Original AI: "Cloud computing infrastructure provides substantial scalability benefits for modern engineering organizations. Migrating monolithic legacy applications into microservices allows development teams to ship software updates continuously while reducing deployment risks."
Authentic Human: "Breaking down monolithic systems into cloud-hosted microservices isn't just an architectural flex; it changes how development teams actually work day-to-day. When teams aren't terrified of a single giant deployment taking down production, they can ship small, isolated improvements several times a day without breaking a sweat."`;

  return `Rewrite the text below as if you are ${persona}.

${exemplar}

FACTS (non-negotiable)
- Keep every fact, name, number, date, quote and technical term exactly as given. Add nothing new.${lockedSection}
- Keep exactly ${paras} paragraph${paras > 1 ? 's' : ''}, in the same order, separated by a blank line.
- Keep the length within 10% of the original (about ${words} words).

HOW TO WRITE
1. Rebuild the sentences from the meaning. Do not just swap synonyms. Change which noun is the subject, change the order of ideas inside a paragraph where it still makes sense, and combine or split sentences.
2. Make the rhythm uneven. In each paragraph, aim for sentence lengths roughly like this: ${rhythm}.
3. Prefer plain, specific wording over abstract wording. Where two words fit, pick the less obvious one, as long as it sounds natural.
4. ${tone}
5. Required quirks: ${quirks[0]}; ${quirks[1]}.
6. Avoid these words and patterns: ${banned}.
7. Never open with a generic textbook definition (e.g. "X is a framework that...", "X is an interpreted language..."). Open directly with the practical situation, tension, or problem.
8. Do not open with a framing line and do not end any paragraph with a sentence that sums up or repeats the paragraph. No rhetorical questions, no lists of three adjectives or clauses (no triads), no headings, no markdown.

Return only the rewritten text directly. Do not include any introductory remarks, thinking tags, or meta commentary.

TEXT:
"""
${text.trim()}
"""`;
}

function buildRefinePrompt(style = 'natural') {
  const tone = style === 'academic' ? 'Keep the formal register.' : 'Keep it conversational.';
  return `Now do a second pass on your rewrite. Find the 4 sentences that still sound most like generic AI writing (smooth, balanced, abstract, or summary-like) and rewrite each so it is more specific, plainer, or shaped differently. Change at least two sentence openings. Make sure sentence lengths stay uneven. ${tone} Keep every fact and the paragraph count. Return the full revised text only.`;
}

// ── 13. Live Detection Check (honest: reports "unavailable" when unreachable) ─
async function checkZeroGPTLive(text) {
  const unavailable = (why) => ({
    success: false,
    fakePercentage: null,
    feedback: why,
    flagged: []
  });

  try {
    const headers = { 'Content-Type': 'application/json' };

    // In a browser, check if our local proxy endpoint is available (e.g. running via node server.js)
    if (typeof window !== 'undefined') {
      try {
        const proxyCheck = await fetch('/api/zerogpt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input_text: text })
        });
        if (proxyCheck.ok) {
          const json = await proxyCheck.json();
          const data = json.data || {};
          if (typeof data.fakePercentage === 'number') {
            const rawFake = data.fakePercentage;
            const isHum = typeof data.isHuman === 'number' ? data.isHuman : (100 - rawFake);
            const calculatedFake = isHum > 0 ? Math.min(rawFake, 100 - isHum) : rawFake;
            return {
              success: true,
              fakePercentage: Math.round(calculatedFake * 10) / 10,
              feedback: data.feedback || '',
              isHuman: isHum,
              aiWords: data.aiWords || 0,
              textWords: data.textWords || 0,
              flagged: Array.isArray(data.specialSentences) ? data.specialSentences : []
            };
          }
        }
      } catch (proxyErr) {
        // Fall back to direct fetch attempt
      }
    } else {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      headers['Referer'] = 'https://www.zerogpt.com/';
      headers['Origin'] = 'https://www.zerogpt.com';
    }

    const res = await fetch('https://api.zerogpt.com/api/detect/detectText', {
      method: 'POST',
      headers,
      body: JSON.stringify({ input_text: text })
    });
    if (!res.ok) return unavailable(`Detector returned HTTP ${res.status}`);

    const json = await res.json();
    const data = json.data || {};
    if (typeof data.fakePercentage !== 'number') return unavailable(json.message || 'Detector gave no score');

    const rawFake = data.fakePercentage;
    const isHum = typeof data.isHuman === 'number' ? data.isHuman : (100 - rawFake);
    const calculatedFake = isHum > 0 ? Math.min(rawFake, 100 - isHum) : rawFake;

    return {
      success: true,
      fakePercentage: Math.round(calculatedFake * 10) / 10,
      feedback: data.feedback || '',
      isHuman: isHum,
      aiWords: data.aiWords || 0,
      textWords: data.textWords || 0,
      flagged: Array.isArray(data.specialSentences) ? data.specialSentences : []
    };
  } catch (err) {
    return unavailable('Direct browser fetch blocked by ZeroGPT paywall (Run node server.js or click Open ZeroGPT)');
  }
}

// ── 14. AI Engine API Callers (Gemini & Groq, optional own key) ──────────────
async function callGeminiAPI(apiKey, model, text, style, lockedTerms = []) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(text, style, lockedTerms) }] }],
    generationConfig: { temperature: 1.0, topP: 0.95 }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate) throw new Error('Empty response received from Gemini.');
  return cleanAIOutput(candidate);
}

async function callGroqAPI(apiKey, text, style, lockedTerms = []) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: buildPrompt(text, style, lockedTerms) }],
      temperature: 1.0
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API Error: HTTP ${response.status}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response received from Groq.');
  return cleanAIOutput(content);
}

// ── 14b. Local LLM Runner Callers (Ollama, LM Studio, LocalAI) ───────────────
async function fetchLocalModels(endpoint = 'http://localhost:11434') {
  const cleanEndpoint = (endpoint || 'http://localhost:11434').replace(/\/+$/, '');
  
  // 1. Direct browser probe to Ollama /api/tags
  try {
    const res = await fetch(`${cleanEndpoint}/api/tags`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        return {
          runner: 'ollama',
          models: data.models.map(m => ({ id: m.name, name: m.name, size: m.size }))
        };
      }
    }
  } catch (e) {}

  // 2. Direct browser probe to OpenAI-compatible /v1/models (LM Studio)
  try {
    const lmUrl = cleanEndpoint.endsWith('/v1') ? `${cleanEndpoint}/models` : `${cleanEndpoint}/v1/models`;
    const res = await fetch(lmUrl, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        return {
          runner: 'lmstudio',
          models: data.data.map(m => ({ id: m.id, name: m.id }))
        };
      }
    }
  } catch (e) {}

  // 3. Fallback to local server proxy relay (bypasses browser CORS restrictions)
  try {
    const proxyBase = typeof window !== 'undefined' ? '' : 'http://localhost:3000';
    const res = await fetch(`${proxyBase}/api/local-llm/models?endpoint=${encodeURIComponent(cleanEndpoint)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.models) return data;
    }
  } catch (e) {}

  return { runner: 'unknown', models: [] };
}

async function callLocalLLMAPI(options) {
  const {
    endpoint = 'http://localhost:11434',
    model = 'llama3.2',
    runner = 'auto',
    text,
    style = 'natural',
    lockedTerms = []
  } = options;

  const promptText = buildPrompt(text, style, lockedTerms);
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const isOllama = runner === 'ollama' || (runner === 'auto' && cleanEndpoint.includes('11434'));

  const messages = [
    {
      role: 'system',
      content: 'You are an expert human author and cadence rewriter. Follow the exact instructions, facts, and structure specified by the user.'
    },
    { role: 'user', content: promptText }
  ];

  const extractText = (data) => {
    if (!data) return null;
    if (data.message?.content && data.message.content.trim()) return data.message.content.trim();
    if (data.choices?.[0]?.message?.content && data.choices[0].message.content.trim()) return data.choices[0].message.content.trim();
    if (data.response && data.response.trim()) return data.response.trim();
    if (data.content && data.content.trim()) return data.content.trim();

    // Support reasoning/thinking models (e.g. Qwen 3.5, DeepSeek-R1) where answer is inside thinking or before length cut
    const think = data.message?.thinking || data.thinking;
    if (think && think.trim()) {
      const cleanThink = think.trim();
      const match = cleanThink.match(/(?:(?:Version|Option|Rewrite|Draft|Output|Final|Rewritten Text|Human Text)[^\n]*:\s*([^\n]+))/gi);
      if (match && match.length > 0) {
        const lastLine = match[match.length - 1].replace(/^(?:Version|Option|Rewrite|Draft|Output|Final|Rewritten Text|Human Text)[^\n]*:\s*/i, '').trim();
        if (lastLine) return lastLine.replace(/^["']|["']$/g, '');
      }
      const paras = cleanThink.split(/\n\s*\n+/);
      const lastPara = paras[paras.length - 1].trim();
      if (lastPara && !lastPara.startsWith('#') && !lastPara.startsWith('Thinking Process')) {
        return lastPara.replace(/^[*-\s]+/, '').replace(/^["']|["']$/g, '');
      }
    }
    return null;
  };

  // Attempt 1: Direct fetch to local runner
  try {
    if (isOllama) {
      // 1a. Try Ollama /api/chat
      try {
        const chatRes = await fetch(`${cleanEndpoint}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            think: false,
            options: { temperature: 0.85, top_p: 0.9 }
          })
        });
        if (chatRes.ok) {
          const json = await chatRes.json();
          const content = extractText(json);
          if (content) return cleanAIOutput(content);
        }
      } catch (chatErr) {}

      // 1b. Try Ollama /api/generate (ideal for non-chat / raw completion / thinking models)
      const genRes = await fetch(`${cleanEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: promptText,
          stream: false,
          think: false,
          options: { temperature: 0.85, top_p: 0.9 }
        })
      });
      if (genRes.ok) {
        const json = await genRes.json();
        const content = extractText(json);
        if (content) return cleanAIOutput(content);
      }
    } else {
      // OpenAI-compatible /v1/chat/completions (LM Studio, LocalAI, vLLM)
      const lmUrl = cleanEndpoint.endsWith('/v1') ? `${cleanEndpoint}/chat/completions` : `${cleanEndpoint}/v1/chat/completions`;
      const directRes = await fetch(lmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.85
        })
      });
      if (directRes.ok) {
        const json = await directRes.json();
        const content = extractText(json);
        if (content) return cleanAIOutput(content);
      }
    }
  } catch (directErr) {
    // Direct fetch failed (CORS or network policy), fall back to proxy
  }

  // Attempt 2: Local server proxy relay (bypasses browser CORS restrictions)
  const proxyBase = typeof window !== 'undefined' ? '' : 'http://localhost:3000';
  const proxyRes = await fetch(`${proxyBase}/api/local-llm/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: cleanEndpoint,
      model,
      runner: isOllama ? 'ollama' : 'openai-compatible',
      prompt: promptText,
      messages,
      temperature: 0.85
    })
  });

  if (!proxyRes.ok) {
    const errData = await proxyRes.json().catch(() => ({}));
    throw new Error(errData.error || `Local LLM failed (HTTP ${proxyRes.status}). Ensure Ollama ('ollama serve') or LM Studio is running.`);
  }

  const json = await proxyRes.json();
  const content = extractText(json);
  if (!content) {
    throw new Error(`Empty response received from Local LLM (${model}). Please verify the model is loaded.`);
  }

  return cleanAIOutput(content);
}

// ── 14c. Real-Time Streaming Local LLM Runner ────────────────────────────────
async function streamLocalLLMAPI(options, onChunk, onDone, onError) {
  const {
    endpoint = 'http://localhost:11434',
    model = 'llama3.2',
    runner = 'auto',
    text,
    style = 'natural',
    lockedTerms = []
  } = options;

  const promptText = buildPrompt(text, style, lockedTerms);
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const isOllama = runner === 'ollama' || (runner === 'auto' && cleanEndpoint.includes('11434'));

  const messages = [
    {
      role: 'system',
      content: 'You are an expert human author and cadence rewriter. Follow the exact instructions, facts, and structure specified by the user.'
    },
    { role: 'user', content: promptText }
  ];

  const proxyBase = typeof window !== 'undefined' ? '' : 'http://localhost:3000';

  try {
    const res = await fetch(`${proxyBase}/api/local-llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: cleanEndpoint,
        model,
        runner: isOllama ? 'ollama' : 'openai-compatible',
        prompt: promptText,
        messages,
        temperature: 0.85,
        stream: true
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Stream failed with HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulated = '';
    let thinkingAccumulated = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // preserve last incomplete chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.token) {
            accumulated += parsed.token;
          }
          if (parsed.thinking) {
            thinkingAccumulated += parsed.thinking;
          }
          if (onChunk) {
            onChunk(parsed.token || '', accumulated, thinkingAccumulated);
          }
          if (parsed.done) {
            break;
          }
        } catch (e) {}
      }
    }

    let candidate = accumulated;
    if (!candidate.trim() && thinkingAccumulated.trim()) {
      const paras = thinkingAccumulated.trim().split(/\n\s*\n+/);
      candidate = paras[paras.length - 1].trim();
    }

    const cleaned = polishText(cleanAIOutput(candidate), style);
    if (onDone) onDone(cleaned);
    return cleaned;
  } catch (err) {
    if (onError) onError(err);
    throw err;
  }
}

// Cleans chat-style wrappers from pasted/API replies.
function cleanAIOutput(output) {
  let cleaned = (output || '').trim();
  cleaned = cleaned.replace(/^(sure|certainly|of course|okay|ok|here(?:'s| is| are))[^\n]*:\s*\n+/i, '');
  cleaned = cleaned.replace(/^"""\s*|\s*"""$/g, '');
  cleaned = cleaned.replace(/^"([\s\S]*)"$/, '$1');
  cleaned = cleanMarkdown(cleaned);
  // Strip trailing metadata or word counts (e.g. `." (11 words).` or `(about 45 words)`)
  cleaned = cleaned.replace(/["']?\s*\((?:about\s+)?\d+\s*words?\)\.?$/i, '');
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  return cleaned.trim();
}

// ── 15. Export Module ────────────────────────────────────────────────────────
const _API = {
  countWords,
  cleanMarkdown,
  splitIntoSentences,
  calculatePerplexity,
  calculateBurstiness,
  calculateAiProbability,
  estimateAiScore: calculateAiProbability,
  humanizeLocalText,
  humanizeText,
  checkZeroGPTLive,
  callGeminiAPI,
  callGroqAPI,
  callLocalLLMAPI,
  streamLocalLLMAPI,
  fetchLocalModels,
  verifyAnchors,
  collectAnchors,
  stripAITells,
  polishText,
  buildPrompt,
  buildRefinePrompt,
  cleanAIOutput
};

if (typeof window !== 'undefined') {
  window.TextHumanizer = _API;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _API;
}