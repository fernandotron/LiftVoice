/**
 * test_deepgram_appsec_audit.js
 * Comprehensive AppSec Penetration & Resilience Verification Suite (September 2026 Standards)
 *
 * Covers:
 * 1. IP Extraction & Rate Limit Spoofing Prevention (CWE-345 / CWE-290)
 * 2. TTL Clamping & Life-Cycle Integrity (Integer Enforcement [30, 60])
 * 3. Memory Consumption & DoS Resistance (LRU Eviction, Hard Caps, Mutex Concurrency)
 * 4. Keyterm Sanitization & URL Budget Guard (NFC Unicode, International Accents, Lone Surrogates)
 * 5. Secret Leakage & Hygiene Verification (Query Params, Prefixed Keys, Error Payloads)
 */

import assert from 'assert';
import {
  clampTtl,
  sanitizeKeyterm,
  sanitizeKeyterms,
  applyKeytermsUrlBudget,
  sanitizeSecret,
  deepSanitizeSecrets,
  checkAsrTokenRateLimit,
  resetAsrTokenRateLimit,
  asrTokenRateLimitMap,
  cachedGrantTokens,
  grantTokenPromisesInFlight,
  storeGrantTokenInCache,
  mintEphemeralToken,
  ASR_RATE_LIMIT_MAX_ENTRIES,
  MAX_IN_FLIGHT_GRANTS,
  MAX_GRANT_CACHE_ENTRIES,
  ASR_KEYTERM_MAX_URL_CHARS,
  ASR_MAX_KEYTERMS_COUNT
} from './src/services/deepgramTokenService.js';
import { getClientIp } from './src/services/adminAuth.js';

console.log('========================================================================');
console.log('🛡️  LIFTVOICE DEEPGRAM APPSEC & RESILIENCE AUDIT SUITE (September 2026)');
console.log('========================================================================\n');

let passedAssertions = 0;

// ----------------------------------------------------------------------------
// 1. IP EXTRACTION & RATE LIMIT BYPASS VECTORS
// ----------------------------------------------------------------------------
console.log('▶ [Audit Area 1] IP Extraction & Rate Limit Spoofing Prevention...');
{
  // 1A: Untrusted remote connection sending spoofed X-Forwarded-For
  const untrustedReq = {
    headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' },
    socket: { remoteAddress: '192.168.1.50' },
    ip: '192.168.1.50'
  };
  const extractedUntrusted = getClientIp(untrustedReq);
  assert.strictEqual(
    extractedUntrusted,
    '192.168.1.50',
    'Untrusted remote socket MUST NOT trust client-supplied X-Forwarded-For'
  );
  passedAssertions++;

  // 1B: Trusted proxy connection (loopback 127.0.0.1) forwarding real client
  const trustedReq = {
    headers: { 'x-forwarded-for': '203.0.113.195, 127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' }
  };
  const extractedTrusted = getClientIp(trustedReq);
  assert.strictEqual(
    extractedTrusted,
    '203.0.113.195',
    'Trusted reverse proxy connection should safely extract verified client IP'
  );
  passedAssertions++;

  // 1C: Trusted proxy with X-Real-IP
  const trustedRealIpReq = {
    headers: {
      'x-real-ip': '198.51.100.77',
      'x-forwarded-for': 'attacker.spoof, 127.0.0.1'
    },
    socket: { remoteAddress: '::ffff:127.0.0.1' }
  };
  const extractedRealIp = getClientIp(trustedRealIpReq);
  assert.strictEqual(
    extractedRealIp,
    '198.51.100.77',
    'X-Real-IP should take precedence when coming from trusted proxy'
  );
  passedAssertions++;

  // 1D: Malformed non-IP string in X-Forwarded-For
  const malformedReq = {
    headers: { 'x-forwarded-for': '<script>alert(1)</script>' },
    socket: { remoteAddress: '127.0.0.1' }
  };
  const extractedMalformed = getClientIp(malformedReq);
  assert.strictEqual(
    extractedMalformed,
    '127.0.0.1',
    'Malformed non-IP headers must be discarded and fall back to socket address'
  );
  passedAssertions++;

  console.log('  ✔ Passed: IP extraction securely discriminates between trusted proxies and untrusted clients.\n');
}

// ----------------------------------------------------------------------------
// 2. TTL & TOKEN LIFE-CYCLE SECURITY
// ----------------------------------------------------------------------------
console.log('▶ [Audit Area 2] TTL Clamping & Life-Cycle Integrity...');
{
  // 2A: Strict integer clamping
  assert.strictEqual(clampTtl(35.7), 35, 'Float TTL must be truncated to integer 35');
  assert.strictEqual(clampTtl(59.999), 59, 'Float TTL must be truncated to integer 59');
  assert.strictEqual(clampTtl(30.001), 30, 'Float TTL must be truncated to integer 30');
  passedAssertions += 3;

  // 2B: Boundary conditions & extremes
  assert.strictEqual(clampTtl(3600), 60, 'TTL 3600 clamped to max 60');
  assert.strictEqual(clampTtl(61), 60, 'TTL 61 clamped to max 60');
  assert.strictEqual(clampTtl(60), 60, 'TTL 60 stays 60');
  assert.strictEqual(clampTtl(30), 30, 'TTL 30 stays 30');
  assert.strictEqual(clampTtl(10), 30, 'TTL 10 clamped up to min 30');
  assert.strictEqual(clampTtl(0), 30, 'TTL 0 clamped up to min 30');
  assert.strictEqual(clampTtl(-500), 30, 'Negative TTL clamped up to min 30');
  assert.strictEqual(clampTtl(Infinity), 60, 'Infinity clamped safely to 60');
  assert.strictEqual(clampTtl(-Infinity), 60, '-Infinity clamped safely to 60');
  assert.strictEqual(clampTtl(NaN), 60, 'NaN defaults safely to 60');
  assert.strictEqual(clampTtl('1e2'), 60, 'Scientific notation 1e2 clamped to 60');
  assert.strictEqual(clampTtl('1e-5'), 30, 'Scientific notation 1e-5 clamped to 30');
  passedAssertions += 12;

  console.log('  ✔ Passed: Strict integer clamping strictly bounds TTL to [30, 60] seconds.\n');
}

// ----------------------------------------------------------------------------
// 3. MEMORY CONSUMPTION & DOS RESISTANCE
// ----------------------------------------------------------------------------
console.log('▶ [Audit Area 3] Memory Consumption & LRU Cache Verification...');
{
  // 3A: True LRU semantics in cachedGrantTokens
  cachedGrantTokens.clear();
  storeGrantTokenInCache('tenant_A', { token: 'token_A', expiresAt: Date.now() + 60000 });
  storeGrantTokenInCache('tenant_B', { token: 'token_B', expiresAt: Date.now() + 60000 });

  // Simulate read hit on tenant_A via mintEphemeralToken
  await mintEphemeralToken({ apiKey: 'tenant_A' });

  // Since tenant_A was read, it must now be MRU (at the end), and tenant_B is now oldest (LRU)
  const firstKeyAfterRead = cachedGrantTokens.keys().next().value;
  assert.strictEqual(
    firstKeyAfterRead,
    'tenant_B',
    'LRU read hit MUST promote accessed key to MRU; tenant_B should now be oldest'
  );
  passedAssertions++;

  // 3B: Hard-cap bounded rate limit map with O(1) eviction
  resetAsrTokenRateLimit();
  for (let i = 0; i < ASR_RATE_LIMIT_MAX_ENTRIES + 50; i++) {
    checkAsrTokenRateLimit(`10.99.${Math.floor(i / 256)}.${i % 256}`);
  }
  assert(
    asrTokenRateLimitMap.size <= ASR_RATE_LIMIT_MAX_ENTRIES,
    `asrTokenRateLimitMap must not exceed hard cap (${ASR_RATE_LIMIT_MAX_ENTRIES}), was ${asrTokenRateLimitMap.size}`
  );
  passedAssertions++;

  // 3C: Single-flight mutex in-flight capacity guard
  grantTokenPromisesInFlight.clear();
  for (let i = 0; i < MAX_IN_FLIGHT_GRANTS; i++) {
    grantTokenPromisesInFlight.set(`dummy_flight_${i}`, new Promise(() => {}));
  }
  const saturatedResult = await mintEphemeralToken({ apiKey: 'new_concurrent_key' });
  assert.strictEqual(saturatedResult.success, false);
  assert.strictEqual(saturatedResult.status, 503);
  assert.strictEqual(saturatedResult.code, 'GRANT_API_CONCURRENCY_LIMIT');
  grantTokenPromisesInFlight.clear();
  passedAssertions++;

  console.log('  ✔ Passed: True LRU cache eviction, bounded rate-limit map, and in-flight mutex concurrency caps verified.\n');
}

// ----------------------------------------------------------------------------
// 4. KEYTERM SANITIZATION & URL BUDGET GUARD
// ----------------------------------------------------------------------------
console.log('▶ [Audit Area 4] Keyterm Sanitization & URL Budget Guard...');
{
  // 4A: Lone surrogate robustness in applyKeytermsUrlBudget & sanitizeKeyterms
  const loneSurrogate = String.fromCharCode(0xD800);
  const cleanTermsWithSurrogate = sanitizeKeyterms([loneSurrogate, 'validMedicalTerm']);
  assert.strictEqual(cleanTermsWithSurrogate.length, 1, 'Lone surrogate must be stripped by sanitizeKeyterms');
  assert.strictEqual(cleanTermsWithSurrogate[0], 'validMedicalTerm');

  // Direct call to applyKeytermsUrlBudget with lone surrogate must not throw URIError
  const directBudget = applyKeytermsUrlBudget([loneSurrogate]);
  assert(directBudget && typeof directBudget.totalKeytermsCharBudget === 'number', 'applyKeytermsUrlBudget must safely handle lone surrogate without crashing');
  passedAssertions += 2;

  // 4B: Unicode normalization (NFD to NFC preservation)
  const nfdTerm = 'coraz' + 'o\u0301' + 'n'; // NFD decomposed
  const sanitizedNfd = sanitizeKeyterm(nfdTerm);
  assert.strictEqual(sanitizedNfd, 'corazón', 'NFD decomposed accented term must normalize to composed NFC term');
  passedAssertions++;

  // 4C: Multilingual European medical vocabulary support
  const multilingualTerms = [
    { input: 'coração saudável', expected: 'coração saudável', lang: 'Portuguese' },
    { input: 'atenção cardíaca', expected: 'atenção cardíaca', lang: 'Portuguese' },
    { input: 'caffè espresso', expected: 'caffè espresso', lang: 'Italian' },
    { input: 'crème médicale', expected: 'crème médicale', lang: 'French' },
    { input: 'Überdruckkammer', expected: 'Überdruckkammer', lang: 'German' },
    { input: 'ECG-v1/2_monitoring', expected: 'ECG-v1/2_monitoring', lang: 'Medical symbols' }
  ];

  for (const item of multilingualTerms) {
    const res = sanitizeKeyterm(item.input);
    assert.strictEqual(res, item.expected, `Term in ${item.lang} failed sanitization: got "${res}"`);
    passedAssertions++;
  }

  // 4D: Injection payloads stripped
  assert.strictEqual(sanitizeKeyterm('<script>alert("xss")</script>'), '');
  assert.strictEqual(sanitizeKeyterm('" OR 1=1 --'), 'OR 11 --');
  assert.strictEqual(sanitizeKeyterm('pulse\x00\x1f\r\noxygen'), 'pulse oxygen');
  passedAssertions += 3;

  // 4E: URL Budget Guard stays strictly <= 1600 characters
  const hundredTerms = Array.from({ length: 100 }, (_, i) => `term_${i}_cardiovascular_condition_treatment`);
  const cleanTerms = sanitizeKeyterms(hundredTerms);
  const { validKeyterms, totalKeytermsCharBudget } = applyKeytermsUrlBudget(cleanTerms, 'nova-3', ASR_KEYTERM_MAX_URL_CHARS);
  assert(validKeyterms.length <= ASR_MAX_KEYTERMS_COUNT, 'Count must stay <= 40');
  assert(totalKeytermsCharBudget <= ASR_KEYTERM_MAX_URL_CHARS, 'Budget must stay <= 1600');
  passedAssertions += 2;

  console.log('  ✔ Passed: Unicode NFC normalization, European medical terminology, injection stripping, and URL budget validated.\n');
}

// ----------------------------------------------------------------------------
// 5. SECRET LEAKAGE AUDIT
// ----------------------------------------------------------------------------
console.log('▶ [Audit Area 5] Secret Leakage & Hygiene Verification...');
{
  const hexKey = 'c97d5531991756825ed380d6e459f8032a009ad8';
  const prefixedKey = 'dg_live_sk_99a88b77c66d55e44f33221100aabbcc';

  // 5A: Query parameter secret redaction
  const queryLeak = `Upstream network error: https://api.deepgram.com/v1/listen?key=${prefixedKey}&sample_rate=16000`;
  const sanitizedQuery = sanitizeSecret(queryLeak);
  assert(!sanitizedQuery.includes(prefixedKey), 'URL query parameter secret MUST be redacted');
  assert(sanitizedQuery.includes('[REDACTED_QUERY_KEY]'), 'Query param redaction tag must be present');
  passedAssertions += 2;

  // 5B: dg_ prefixed key redaction in plain text
  const dgLeak = `Error with credentials: ${prefixedKey} rejected by server`;
  const sanitizedDg = sanitizeSecret(dgLeak);
  assert(!sanitizedDg.includes(prefixedKey), 'dg_ prefixed key MUST be redacted');
  assert(sanitizedDg.includes('[REDACTED_DG_KEY]'), 'DG redaction tag must be present');
  passedAssertions += 2;

  // 5C: Authorization headers
  const authBearerLeak = `Authorization: Bearer ${hexKey}`;
  const authTokenLeak = `Authorization: Token ${hexKey}`;
  assert(!sanitizeSecret(authBearerLeak).includes(hexKey), 'Bearer header secret must be redacted');
  assert(!sanitizeSecret(authTokenLeak).includes(hexKey), 'Token header secret must be redacted');
  passedAssertions += 2;

  // 5D: Deep-nested JSON objects with multiple secrets
  const nestedObj = {
    code: 500,
    upstream: {
      url: `https://api.deepgram.com/v1/auth/grant?token=${hexKey}`,
      errorMsg: `Failed key ${prefixedKey}`
    },
    list: [`Bearer ${hexKey}`, `dg_key: ${prefixedKey}`]
  };
  const sanitizedNested = deepSanitizeSecrets(nestedObj);
  const sanitizedNestedStr = JSON.stringify(sanitizedNested);
  assert(!sanitizedNestedStr.includes(hexKey), 'Deep object must not contain hexKey');
  assert(!sanitizedNestedStr.includes(prefixedKey), 'Deep object must not contain prefixedKey');
  passedAssertions += 2;

  console.log('  ✔ Passed: Secret hygiene comprehensively sanitizes query parameters, dg_ prefixed keys, and nested structures.\n');
}

console.log('========================================================================');
console.log(`🎉 ALL ${passedAssertions} APPSEC & RESILIENCE ASSERTIONS PASSED (September 2026 Consensus)`);
console.log('========================================================================\n');

process.exit(0);
