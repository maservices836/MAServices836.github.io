/**
 * privacy-vault.js
 * Client-side clean-room tokenizer and local re-hydrator for MA Services Hybrid AI.
 * Zero network egress: raw PII remains strictly in browser memory.
 */

const TOKEN_PATTERN = /(\[[A-Z_]+_\d+\])/g;

const DETERMINISTIC_RULES = [
  {
    prefix: "SECRET",
    // Matches common API keys, bearer tokens, Firebase keys, and hex secrets
    regex: /\b(?:AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z]{20,}|ghp_[0-9A-Za-z]{30,}|Bearer\s+[0-9A-Za-z._-]{20,})\b/g
  },
  {
    prefix: "EMAIL",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
  },
  {
    prefix: "IP_ADDR",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g
  },
  {
    prefix: "PHONE",
    // Matches international (+962, +966, +1, etc.) and local formatted numbers
    regex: /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g
  },
  {
    prefix: "URL",
    regex: /\bhttps?:\/\/[^\s"'<>]+/gi
  }
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Masks sensitive substrings using deterministic rules + Gemini Nano semantic entities.
 * @param {string} rawText - Original user/client brief
 * @param {string[]} nanoEntities - Sensitive substrings extracted locally by Gemini Nano
 * @returns {{ maskedText: string, vault: Map<string, { original: string, category: string }>, stats: object }}
 */
export function maskPayload(rawText, nanoEntities = []) {
  const vault = new Map();
  const reverseLookup = new Map();
  const counters = {
    SECRET: 0,
    EMAIL: 0,
    IP_ADDR: 0,
    PHONE: 0,
    URL: 0,
    ENTITY: 0
  };

  const registerToken = (rawMatch, prefix) => {
    const cleaned = rawMatch.trim();
    if (cleaned.length < 3 || /^\[[A-Z_]+_\d+\]$/.test(cleaned)) {
      return rawMatch;
    }
    if (reverseLookup.has(cleaned)) {
      return reverseLookup.get(cleaned);
    }
    counters[prefix] = (counters[prefix] || 0) + 1;
    const token = `[${prefix}_${counters[prefix]}]`;
    vault.set(token, { original: cleaned, category: prefix });
    reverseLookup.set(cleaned, token);
    return token;
  };

  let maskedText = String(rawText || "");

  // Pass 1: Deterministic regex rules
  for (const rule of DETERMINISTIC_RULES) {
    maskedText = maskedText.replace(rule.regex, (match) => registerToken(match, rule.prefix));
  }

  // Pass 2: Semantic entities detected on-device by Gemini Nano (longest-first to prevent partial collisions)
  const sortedEntities = [...new Set(nanoEntities)]
    .filter((item) => typeof item === "string" && item.trim().length >= 3 && !/^\[[A-Z_]+_\d+\]$/.test(item.trim()))
    .sort((a, b) => b.length - a.length);

  for (const entity of sortedEntities) {
    const rx = new RegExp(escapeRegex(entity.trim()), "g");
    // Split on existing [TOKEN_N] segments so placeholders are never mutated
    const segments = maskedText.split(TOKEN_PATTERN);
    for (let i = 0; i < segments.length; i += 2) {
      segments[i] = segments[i].replace(rx, (match) => registerToken(match, "ENTITY"));
    }
    maskedText = segments.join("");
  }

  return {
    maskedText,
    vault,
    stats: {
      totalRedacted: vault.size,
      byCategory: { ...counters }
    }
  };
}

/**
 * Restores original values locally after cloud Gemini synthesis completes.
 * @param {string} cloudText - Sanitized response returned from cloud Gemini
 * @param {Map<string, { original: string, category: string }>} vault - Token map from maskPayload()
 * @returns {string}
 */
export function rehydratePayload(cloudText, vault) {
  let hydrated = String(cloudText || "");
  if (!vault || vault.size === 0) return hydrated;

  for (const [token, entry] of vault.entries()) {
    hydrated = hydrated.split(token).join(entry.original);
  }
  return hydrated;
}