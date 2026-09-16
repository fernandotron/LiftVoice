/**
 * Deepgram Token Service — Security & Reliability Fortifications (September 2026 Standards)
 *
 * Implements:
 * 1. Ephemeral Grant Token Minting (POST https://api.deepgram.com/v1/auth/grant)
 * 2. Strict TTL clamping: Math.min(Math.max(parsedTtl, 30), 60) (30s to 60s maximum)
 * 3. IP-based rate limiting (maximum 30 requests/minute per IP)
 * 4. Multi-tenant in-memory cache with LRU eviction and periodic sweep
 * 5. Single-flight mutex promise coalescing (prevents duplicate upstream API hits)
 * 6. Secret hygiene & redaction (guarantees API keys and Auth headers never leak in errors)
 * 7. Keyterm sanitization (strips script tags, quotes, control chars, trims, deduplicates)
 * 8. URL budget protection (caps at 40 terms & <1600 chars to avoid HTTP 414 WebSocket failures)
 */

export const ASR_KEYTERM_MAX_URL_CHARS = 1600;
export const ASR_MAX_KEYTERMS_COUNT = 40;
export const ASR_MAX_TERM_LENGTH = 50;
export const ASR_TOKEN_CACHE_MIN_MARGIN_MS = 20000; // Require >=20s validity before reusing cached token
export const MAX_GRANT_CACHE_ENTRIES = 500;
export const ASR_RATE_LIMIT_MAX_ENTRIES = 2000; // Strictly bounded rate limit map
export const MAX_IN_FLIGHT_GRANTS = 50; // Guard against outgoing socket/promise exhaustion
export const ASR_TOKEN_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const ASR_TOKEN_MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute per IP
export const MIN_TTL_SECONDS = 30;
export const MAX_TTL_SECONDS = 60;

// In-memory rate limiting map for token minting: IP -> [timestamps]
export const asrTokenRateLimitMap = new Map();

// In-memory multi-tenant token cache: apiKey -> { token, expiresAt }
export const cachedGrantTokens = new Map();

// Single-flight mutex in-flight map: apiKey -> Promise
export const grantTokenPromisesInFlight = new Map();

/**
 * Check and record token minting rate limit for client IP.
 * Enforces strict 30 req/min with O(1) bounded memory eviction to prevent algorithmic DoS.
 */
export function checkAsrTokenRateLimit(clientIp) {
  const now = Date.now();
  const key = String(clientIp || 'unknown').trim();
  const record = asrTokenRateLimitMap.get(key) || [];
  const recent = record.filter(time => now - time < ASR_TOKEN_RATE_LIMIT_WINDOW_MS);

  if (recent.length >= ASR_TOKEN_MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + ASR_TOKEN_RATE_LIMIT_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfter };
  }

  recent.push(now);
  asrTokenRateLimitMap.set(key, recent);

  // O(1) Hard-cap bounded memory eviction: evict oldest entry if capacity exceeded
  if (asrTokenRateLimitMap.size > ASR_RATE_LIMIT_MAX_ENTRIES) {
    const oldestKey = asrTokenRateLimitMap.keys().next().value;
    if (oldestKey) asrTokenRateLimitMap.delete(oldestKey);
  }

  return { allowed: true };
}

// Background sweep every 60s for expired rate limit entries (prevents unbounded memory growth while idle)
const asrRateLimitSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of asrTokenRateLimitMap.entries()) {
    if (!timestamps || timestamps.length === 0 || now - timestamps[timestamps.length - 1] >= ASR_TOKEN_RATE_LIMIT_WINDOW_MS) {
      asrTokenRateLimitMap.delete(key);
    }
  }
}, ASR_TOKEN_RATE_LIMIT_WINDOW_MS);
if (asrRateLimitSweepInterval.unref) asrRateLimitSweepInterval.unref();

/**
 * Reset rate limit cache (for testing or administrative unlocks).
 */
export function resetAsrTokenRateLimit(ip) {
  if (ip) {
    asrTokenRateLimitMap.delete(String(ip).trim());
  } else {
    asrTokenRateLimitMap.clear();
  }
}

/**
 * Clear cached tokens and in-flight promises.
 */
export function clearGrantTokenCache() {
  cachedGrantTokens.clear();
  grantTokenPromisesInFlight.clear();
}

/**
 * Store token in bounded in-memory cache with true LRU eviction.
 */
export function storeGrantTokenInCache(key, tokenData) {
  if (cachedGrantTokens.has(key)) {
    cachedGrantTokens.delete(key);
  } else if (cachedGrantTokens.size >= MAX_GRANT_CACHE_ENTRIES) {
    const oldestKey = cachedGrantTokens.keys().next().value;
    if (oldestKey) cachedGrantTokens.delete(oldestKey);
  }
  cachedGrantTokens.set(key, tokenData);
}

// Periodic background sweep every 60s for expired cache entries
const grantTokenSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of cachedGrantTokens.entries()) {
    if (!record || now >= record.expiresAt) {
      cachedGrantTokens.delete(key);
    }
  }
}, 60000);
if (grantTokenSweepInterval.unref) grantTokenSweepInterval.unref();

/**
 * Strict TTL clamping adhering to 2026 security best practices.
 * Math.floor(Math.min(Math.max(parsedTtl, 30), 60))
 * Guaranteed integer in range [30, 60].
 */
export function clampTtl(rawTtl) {
  const parsedTtl = Number(rawTtl !== undefined && rawTtl !== null ? rawTtl : 60);
  if (!Number.isFinite(parsedTtl)) return 60;
  return Math.floor(Math.min(Math.max(parsedTtl, MIN_TTL_SECONDS), MAX_TTL_SECONDS));
}

/**
 * Sanitizes any text string to scrub out master API keys and sensitive auth tokens.
 */
export function sanitizeSecret(text, ...secretsToRedact) {
  if (text === null || text === undefined) return '';
  let sanitized = typeof text === 'string' ? text : String(text);

  // Redact any explicitly provided secrets
  for (const secret of secretsToRedact) {
    if (secret && typeof secret === 'string' && secret.trim().length >= 4) {
      sanitized = sanitized.replaceAll(secret.trim(), '[REDACTED_API_KEY]');
    }
  }

  // Redact Authorization headers: Token <key> or Bearer <key>
  sanitized = sanitized.replace(/(Token|Bearer)\s+[A-Za-z0-9_\-\.]{8,}/gi, '$1 [REDACTED_AUTH_TOKEN]');

  // Redact keys in URL query parameters: ?key=..., &api_key=..., &token=...
  sanitized = sanitized.replace(/([?&](?:api[_-]?key|access[_-]?token|token|key|secret)=)[^&\s"'`]+/gi, '$1[REDACTED_QUERY_KEY]');

  // Redact dg_ formatted keys (e.g. dg_live_..., dg_...)
  sanitized = sanitized.replace(/\bdg_[a-zA-Z0-9_\-]{16,}\b/gi, '[REDACTED_DG_KEY]');

  // Redact 32-64 hex char strings (typical Deepgram API key is 40 hex chars)
  sanitized = sanitized.replace(/\b[0-9a-fA-F]{32,64}\b/g, '[REDACTED_HEX_KEY]');

  // Redact key / token fields in JSON strings
  sanitized = sanitized.replace(/(["']?(?:api[_-]?key|access[_-]?token|secret|password)["']?\s*[:=]\s*["']?)[A-Za-z0-9_\-\.]{8,}(["']?)/gi, '$1[REDACTED]$2');

  return sanitized;
}

/**
 * Recursively deep-sanitizes strings within arbitrary response objects or arrays.
 */
export function deepSanitizeSecrets(obj, ...secretsToRedact) {
  if (typeof obj === 'string') {
    return sanitizeSecret(obj, ...secretsToRedact);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitizeSecrets(item, ...secretsToRedact));
  }
  if (obj && typeof obj === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = deepSanitizeSecrets(v, ...secretsToRedact);
    }
    return res;
  }
  return obj;
}

/**
 * Keyterm sanitization:
 * - Normalizes Unicode to NFC (handles decomposed accents from macOS/iOS)
 * - Strips script tags and HTML tags
 * - Strips quotes (single, double, backticks, typographic quotes)
 * - Strips control characters (\r, \n, \t, null bytes, ASCII 0-31, 127-159)
 * - Retains safe alphanumeric, European/Latin medical accents, and punctuation
 * - Normalizes whitespace and clamps length to ASR_MAX_TERM_LENGTH (50)
 */
export function sanitizeKeyterm(term) {
  if (term === null || term === undefined) return '';
  const termStr = typeof term === 'object' ? (term.term || term.text || term.word || '') : String(term);

  // Unicode normalization to NFC (composes decomposed accented characters from macOS/iOS)
  const normalized = termStr.normalize ? termStr.normalize('NFC') : termStr;

  let cleaned = normalized
    // 1. Strip script tags with content and any HTML tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    // 2. Strip quotes
    .replace(/["'`“”‘’]/g, '')
    // 3. Replace control characters (\r, \n, \t, ASCII 0-31, 127-159) with spaces
    .replace(/[\x00-\x1F\x7F-\x9F\r\n\t]/g, ' ')
    // 4. Retain safe alphanumeric, European/Latin accents (es, pt, it, fr, de), and punctuation
    .replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙãõÃÕâêîôûÂÊÎÔÛçÇäëïöÄËÏÖ.,/_-]/g, '')
    // 5. Collapse whitespace and trim
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, ASR_MAX_TERM_LENGTH);
}

/**
 * Sanitizes and deduplicates a list of keyterms.
 * Filters out terms with length < 2.
 */
export function sanitizeKeyterms(rawTerms) {
  if (!Array.isArray(rawTerms)) return [];
  const seenTermKeys = new Set();
  const cleanTerms = [];
  for (const t of rawTerms) {
    const sanitized = sanitizeKeyterm(t);
    if (sanitized.length < 2) continue;
    const termKey = sanitized.toLowerCase();
    if (!seenTermKeys.has(termKey)) {
      seenTermKeys.add(termKey);
      cleanTerms.push(sanitized);
    }
  }
  return cleanTerms;
}

/**
 * URL Budget Protection:
 * Deepgram and reverse proxies (ALB/Cloudflare/Envoy) reject or drop HTTP Upgrade requests with URL >2150 chars.
 * This function caps keyterms count to ASR_MAX_KEYTERMS_COUNT (40) and query URL contribution to maxBudgetChars (1600).
 * Resilient against lone surrogates and malformed Unicode strings.
 */
export function applyKeytermsUrlBudget(cleanTerms, model = 'nova-3', maxBudgetChars = ASR_KEYTERM_MAX_URL_CHARS) {
  let totalKeytermsCharBudget = 0;
  const validKeyterms = [];
  const isNova3 = String(model || '').toLowerCase().includes('nova-3');

  if (!Array.isArray(cleanTerms)) return { validKeyterms: [], totalKeytermsCharBudget: 0 };

  for (const term of cleanTerms) {
    if (validKeyterms.length >= ASR_MAX_KEYTERMS_COUNT) break;
    let termEncodedLen = 0;
    try {
      // Safe encoding: ensure well-formed string before URI encoding
      const wellFormed = typeof term.toWellFormed === 'function' ? term.toWellFormed() : term;
      termEncodedLen = encodeURIComponent(wellFormed).length;
    } catch (_) {
      continue; // Skip malformed Unicode terms safely without crashing
    }

    const termUrlLen = (isNova3 ? 9 : 13) + termEncodedLen; // '&keyterm=' (9) vs '&keywords=:2' (13)
    if (totalKeytermsCharBudget + termUrlLen > maxBudgetChars) {
      break;
    }
    validKeyterms.push(term);
    totalKeytermsCharBudget += termUrlLen;
  }
  return { validKeyterms, totalKeytermsCharBudget };
}

/**
 * Language resolution logic (homologous to toDeepgramLanguage).
 */
export function resolveDeepgramLanguage(rawLang, effectiveModel = 'nova-3') {
  const langLower = String(rawLang || 'auto').trim().toLowerCase();
  if (langLower.startsWith('en')) return 'en';
  if (langLower.startsWith('es')) return 'es';
  if (langLower.startsWith('it')) return 'it';
  if (langLower.startsWith('pt')) return langLower.includes('br') ? 'pt-BR' : 'pt';
  if (langLower === 'auto' || langLower === 'multi' || !langLower) {
    return effectiveModel === 'nova-3' ? 'multi' : 'es';
  }
  return langLower.length > 2 ? langLower.slice(0, 2) : langLower;
}

/**
 * Mints an ephemeral token via Deepgram Auth Grant API with caching and single-flight coalescing.
 */
export async function mintEphemeralToken({ apiKey, ttl = 60, forceRefresh = false, fetchFn = globalThis.fetch }) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return {
      success: false,
      status: 503,
      code: 'DEEPGRAM_NOT_CONFIGURED',
      error: 'Deepgram API key not configured on server'
    };
  }

  const requestedTtl = clampTtl(ttl);
  const now = Date.now();
  const cacheKey = apiKey.trim();
  const cachedToken = cachedGrantTokens.get(cacheKey);

  // Reuse cached token if not forced and at least ASR_TOKEN_CACHE_MIN_MARGIN_MS (20s) remain
  if (!forceRefresh && cachedToken && now < cachedToken.expiresAt - ASR_TOKEN_CACHE_MIN_MARGIN_MS) {
    // Refresh LRU position on access
    cachedGrantTokens.delete(cacheKey);
    cachedGrantTokens.set(cacheKey, cachedToken);

    const remainingSeconds = Math.min(Math.max(5, Math.round((cachedToken.expiresAt - now) / 1000)), MAX_TTL_SECONDS);
    return {
      success: true,
      token: cachedToken.token,
      expiresIn: remainingSeconds,
      cached: true
    };
  }

  if (forceRefresh) {
    cachedGrantTokens.delete(cacheKey);
  }

  // Guard against in-flight promise saturation (DoS/resource exhaustion protection)
  if (!grantTokenPromisesInFlight.has(cacheKey) && grantTokenPromisesInFlight.size >= MAX_IN_FLIGHT_GRANTS) {
    return {
      success: false,
      status: 503,
      code: 'GRANT_API_CONCURRENCY_LIMIT',
      error: 'Upstream token minting capacity temporarily saturated. Please retry shortly.'
    };
  }

  // Single-flight mutex pattern per apiKey
  let grantPromise = grantTokenPromisesInFlight.get(cacheKey);
  if (!grantPromise) {
    grantPromise = (async () => {
      try {
        const grantRes = await fetchFn('https://api.deepgram.com/v1/auth/grant', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ttl_seconds: requestedTtl }),
          signal: AbortSignal.timeout(5000)
        });

        if (grantRes.ok) {
          const grantData = await grantRes.json();
          const newToken = grantData.access_token || grantData.key;
          const rawExpiresIn = Number(grantData.expires_in) || requestedTtl;
          // Strictly clamp expires_in <= 60
          const newExpiresIn = Math.min(Math.max(rawExpiresIn, MIN_TTL_SECONDS), MAX_TTL_SECONDS);

          storeGrantTokenInCache(cacheKey, {
            token: newToken,
            expiresAt: Date.now() + (newExpiresIn * 1000)
          });

          return {
            success: true,
            token: newToken,
            expiresIn: newExpiresIn,
            cached: false
          };
        } else {
          const errText = await grantRes.text().catch(() => '');
          let parsedErr = null;
          try { parsedErr = JSON.parse(errText); } catch (_) {}
          const rawDeepgramMsg = parsedErr?.err_msg || parsedErr?.message || parsedErr?.error || errText.slice(0, 300);

          let userMsg = 'Deepgram Grant API authentication failed.';
          let errCode = 'GRANT_API_UNAVAILABLE';

          if (grantRes.status === 401) {
            userMsg = 'Invalid Deepgram API key. Please check your credentials in Settings.';
            errCode = 'DEEPGRAM_AUTH_INVALID';
          } else if (grantRes.status === 403) {
            userMsg = 'Deepgram API key lacks permissions to mint ephemeral tokens. A Project Admin or Member role with auth scope is required.';
            errCode = 'DEEPGRAM_GRANT_FORBIDDEN';
          } else if (grantRes.status === 429) {
            userMsg = 'Deepgram API rate limit exceeded. Please wait a moment before retrying.';
            errCode = 'DEEPGRAM_RATE_LIMITED';
          } else if (grantRes.status >= 500) {
            userMsg = `Deepgram Grant API upstream server error (${grantRes.status}).`;
            errCode = 'DEEPGRAM_UPSTREAM_ERROR';
          }

          // Strict Secret Hygiene: sanitize any details before logging or returning
          const safeDeepgramMsg = sanitizeSecret(rawDeepgramMsg, apiKey);
          console.warn(`[ASR Token] Deepgram grant failed (${grantRes.status}) [${errCode}]: ${safeDeepgramMsg}`);

          return {
            success: false,
            status: grantRes.status,
            error: userMsg,
            code: errCode,
            details: safeDeepgramMsg || undefined
          };
        }
      } catch (gErr) {
        const isTimeout = gErr.name === 'TimeoutError' || gErr.name === 'AbortError';
        const safeErrMsg = sanitizeSecret(gErr.message, apiKey);
        console.warn('[ASR Token] Grant fetch exception:', safeErrMsg);
        return {
          success: false,
          status: isTimeout ? 504 : 502,
          error: isTimeout
            ? 'Timeout connecting to Deepgram Grant API (5000ms limit reached).'
            : `Failed to connect to Deepgram Grant API: ${safeErrMsg}`,
          code: isTimeout ? 'GRANT_API_TIMEOUT' : 'GRANT_API_NETWORK_ERROR'
        };
      } finally {
        grantTokenPromisesInFlight.delete(cacheKey);
      }
    })();

    grantTokenPromisesInFlight.set(cacheKey, grantPromise);
  }

  const result = await grantPromise;
  // Ensure the returned payload is deep-sanitized
  return deepSanitizeSecrets(result, apiKey);
}
