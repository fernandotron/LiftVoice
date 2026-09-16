/**
 * test_deepgram_security.js
 * Comprehensive Security & Reliability Test Suite for Deepgram Integration (LiftVoice 2026)
 *
 * Test 1: Ephemeral Token Minting - Calls /api/asr-token, verifies valid token with expiresIn <= 60s.
 * Test 2: In-Memory Cache & Mutex - Verifies concurrent calls share token & do not generate duplicate API hits.
 * Test 3: TTL Enforcement - Verifies requests asking for ttl=3600 are clamped to <= 60s.
 * Test 4: Rate Limiting - Verifies exceeding rate limits returns 429 with clear structured error.
 * Test 5: Keyterm Sanitization - Tests malicious/dirty keyterms (<script>, " OR 1=1, \n\r) and asserts cleaning.
 * Test 6: URL Budget Protection - Tests 100 long keyterms and verifies URL budget (<1600 chars) prevents overflow.
 * Test 7: Secret Hygiene - Verifies simulate-failed requests never return the API key in the response payload.
 */

import assert from 'assert';

// Set isolated test port before server initialization
const TEST_PORT = process.env.TEST_PORT || '3097';
process.env.PORT = TEST_PORT;

console.log('================================================================');
console.log('🛡️  LIFTVOICE DEEPGRAM SECURITY & CORRECTNESS TEST SUITE (2026)');
console.log('================================================================\n');

// Import server and services
const { app, server } = await import('./src/index.js');
const {
  mintEphemeralToken,
  checkAsrTokenRateLimit,
  resetAsrTokenRateLimit,
  clearGrantTokenCache,
  sanitizeKeyterm,
  sanitizeKeyterms,
  applyKeytermsUrlBudget,
  clampTtl,
  sanitizeSecret,
  deepSanitizeSecrets,
  cachedGrantTokens,
  grantTokenPromisesInFlight,
  ASR_KEYTERM_MAX_URL_CHARS,
  ASR_TOKEN_MAX_REQUESTS_PER_WINDOW
} = await import('./src/services/deepgramTokenService.js');

const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Helper delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  let passedTests = 0;
  const totalTests = 7;

  // --------------------------------------------------------------------------
  // TEST 1: Ephemeral Token Minting
  // --------------------------------------------------------------------------
  console.log('▶ [Test 1/7] Ephemeral Token Minting (HTTP & Function Level)...');
  {
    // Reset rate limiter for clean state
    resetAsrTokenRateLimit('127.0.0.1');
    clearGrantTokenCache();

    // 1A: Test via HTTP endpoint /api/asr-token
    const res = await fetch(`${BASE_URL}/api/asr-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'es',
        model: 'nova-3'
      })
    });

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();

    assert.strictEqual(data.success, true, 'Response should indicate success');
    assert(typeof data.token === 'string' && data.token.length > 20, 'Token must be a valid non-empty string');
    assert(typeof data.expiresIn === 'number', 'expiresIn must be a number');
    assert(data.expiresIn <= 60, `expiresIn must be <= 60, got ${data.expiresIn}`);
    assert(data.expiresIn >= 30, `expiresIn must be >= 30, got ${data.expiresIn}`);
    assert.strictEqual(data.listenUrl, 'wss://api.deepgram.com/v1/listen', 'listenUrl must match Deepgram WebSocket');
    assert.strictEqual(data.model, 'nova-3', 'Model should resolve to nova-3');
    assert.strictEqual(data.language, 'es', 'Language should resolve to es');

    // 1B: Test underlying mintEphemeralToken function
    const fnResult = await mintEphemeralToken({
      apiKey: process.env.DEEPGRAM_API_KEY,
      ttl: 60
    });
    assert.strictEqual(fnResult.success, true, 'Function call should succeed');
    assert(typeof fnResult.token === 'string' && fnResult.token.length > 20, 'Function must return valid token');
    assert(fnResult.expiresIn <= 60, 'Function expiresIn must be <= 60');

    passedTests++;
    console.log(`  ✔ Passed: Ephemeral token minted successfully. Token length: ${data.token.length}, expiresIn: ${data.expiresIn}s\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: In-Memory Cache & Mutex (Single-Flight Coalescing)
  // --------------------------------------------------------------------------
  console.log('▶ [Test 2/7] In-Memory Cache & Single-Flight Mutex Coalescing...');
  {
    clearGrantTokenCache();
    let upstreamCallCount = 0;
    const testApiKey = 'test_deepgram_api_key_mutex_simulation_12345';

    // Mock fetch that simulates upstream latency
    const mockSlowFetch = async (url, opts) => {
      upstreamCallCount++;
      await sleep(50); // Simulate network delay
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: `mock_ephemeral_jwt_${Date.now()}_call_${upstreamCallCount}`,
          expires_in: 60
        })
      };
    };

    // Fire 10 concurrent requests simultaneously with the same API key
    const concurrentRequests = Array.from({ length: 10 }, () =>
      mintEphemeralToken({
        apiKey: testApiKey,
        ttl: 60,
        fetchFn: mockSlowFetch
      })
    );

    const results = await Promise.all(concurrentRequests);

    // 1. All 10 requests must return the EXACT same token string
    const firstToken = results[0].token;
    assert(firstToken, 'First token must exist');
    for (let i = 0; i < results.length; i++) {
      assert.strictEqual(results[i].success, true, `Request ${i} should succeed`);
      assert.strictEqual(results[i].token, firstToken, `Request ${i} token must match request 0 token`);
    }

    // 2. Upstream fetch must be called EXACTLY ONCE
    assert.strictEqual(upstreamCallCount, 1, `Upstream API must be called exactly 1 time, got ${upstreamCallCount}`);

    // 3. In-flight promise map must be completely clean after resolution
    assert.strictEqual(grantTokenPromisesInFlight.size, 0, 'In-flight promise map must be empty');

    // 4. Subsequent request immediately reuses cached token (0 additional upstream calls)
    const subsequent = await mintEphemeralToken({
      apiKey: testApiKey,
      ttl: 60,
      fetchFn: mockSlowFetch
    });
    assert.strictEqual(subsequent.token, firstToken, 'Subsequent call must reuse cached token');
    assert.strictEqual(subsequent.cached, true, 'Subsequent call must be flagged as cached');
    assert.strictEqual(upstreamCallCount, 1, `Upstream API count must still be 1, got ${upstreamCallCount}`);

    // 5. Force refresh bypasses cache and creates new upstream call
    const refreshed = await mintEphemeralToken({
      apiKey: testApiKey,
      ttl: 60,
      forceRefresh: true,
      fetchFn: mockSlowFetch
    });
    assert.strictEqual(upstreamCallCount, 2, 'Force refresh must increment upstream API call count to 2');
    assert.notStrictEqual(refreshed.token, firstToken, 'Refreshed token must differ from initial token');

    passedTests++;
    console.log(`  ✔ Passed: Single-flight mutex collapsed 10 concurrent requests into 1 API call, cache re-use verified.\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: TTL Enforcement (Clamped to <= 60s)
  // --------------------------------------------------------------------------
  console.log('▶ [Test 3/7] TTL Enforcement (Clamp [30s, 60s] max)...');
  {
    resetAsrTokenRateLimit('127.0.0.1');

    // 3A: Unit testing clampTtl edge cases
    assert.strictEqual(clampTtl(3600), 60, 'TTL 3600 must be clamped to 60');
    assert.strictEqual(clampTtl(600), 60, 'TTL 600 must be clamped to 60');
    assert.strictEqual(clampTtl(61), 60, 'TTL 61 must be clamped to 60');
    assert.strictEqual(clampTtl(60), 60, 'TTL 60 should remain 60');
    assert.strictEqual(clampTtl(45), 45, 'TTL 45 should remain 45');
    assert.strictEqual(clampTtl(30), 30, 'TTL 30 should remain 30');
    assert.strictEqual(clampTtl(10), 30, 'TTL 10 must be clamped up to min 30');
    assert.strictEqual(clampTtl(0), 30, 'TTL 0 must be clamped up to min 30');
    assert.strictEqual(clampTtl(-500), 30, 'Negative TTL must be clamped up to min 30');
    assert.strictEqual(clampTtl(Infinity), 60, 'TTL Infinity must be clamped to 60');
    assert.strictEqual(clampTtl(NaN), 60, 'TTL NaN must default safely to 60');
    assert.strictEqual(clampTtl(undefined), 60, 'TTL undefined must default to 60');
    assert.strictEqual(clampTtl(null), 60, 'TTL null must default to 60');

    // 3B: Verify upstream payload receives clamped TTL
    let capturedTtlSentUpstream = null;
    const mockTtlFetch = async (url, opts) => {
      const parsedBody = JSON.parse(opts.body);
      capturedTtlSentUpstream = parsedBody.ttl_seconds;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mock_ttl_jwt',
          expires_in: capturedTtlSentUpstream
        })
      };
    };

    const ttlResult = await mintEphemeralToken({
      apiKey: 'test_ttl_api_key',
      ttl: 3600,
      forceRefresh: true,
      fetchFn: mockTtlFetch
    });

    assert.strictEqual(capturedTtlSentUpstream, 60, `Upstream body ttl_seconds must be 60, was ${capturedTtlSentUpstream}`);
    assert.strictEqual(ttlResult.expiresIn, 60, `Returned expiresIn must be 60, was ${ttlResult.expiresIn}`);

    // 3C: HTTP Endpoint integration test with ttl: 3600
    const httpRes = await fetch(`${BASE_URL}/api/asr-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ttl: 3600,
        forceRefresh: true
      })
    });
    const httpData = await httpRes.json();
    assert.strictEqual(httpRes.status, 200);
    assert(httpData.expiresIn <= 60, `HTTP response expiresIn must be <= 60, got ${httpData.expiresIn}`);

    passedTests++;
    console.log(`  ✔ Passed: Requested TTL=3600 strictly clamped to <= 60s (both upstream and HTTP response).\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Rate Limiting & DoS Protection
  // --------------------------------------------------------------------------
  console.log('▶ [Test 4/7] Token Minting Rate Limiting & DoS Protection (429)...');
  {
    const testIp = '198.51.100.42';
    resetAsrTokenRateLimit(testIp);

    // 4A: Function-level rate limit test
    for (let i = 1; i <= ASR_TOKEN_MAX_REQUESTS_PER_WINDOW; i++) {
      const check = checkAsrTokenRateLimit(testIp);
      assert.strictEqual(check.allowed, true, `Request ${i} should be allowed`);
    }

    // 31st request must be blocked
    const blockedCheck = checkAsrTokenRateLimit(testIp);
    assert.strictEqual(blockedCheck.allowed, false, '31st request must be rejected');
    assert(typeof blockedCheck.retryAfter === 'number' && blockedCheck.retryAfter > 0, 'retryAfter must be positive number');

    // 4B: HTTP-level rate limit verification
    const httpRateIp = '203.0.113.88';
    resetAsrTokenRateLimit(httpRateIp);

    // Exhaust quota of 30 requests
    for (let i = 1; i <= ASR_TOKEN_MAX_REQUESTS_PER_WINDOW; i++) {
      checkAsrTokenRateLimit(httpRateIp);
    }

    // Next HTTP request simulating this IP via trusted header or direct call
    // Note: getClientIp respects reverse proxy when from 127.0.0.1
    const rateLimitRes = await fetch(`${BASE_URL}/api/asr-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': httpRateIp
      },
      body: JSON.stringify({})
    });

    assert.strictEqual(rateLimitRes.status, 429, `Expected HTTP 429, got ${rateLimitRes.status}`);
    const retryHeader = rateLimitRes.headers.get('retry-after');
    assert(retryHeader !== null, 'Retry-After header must be present');
    assert(Number(retryHeader) > 0, 'Retry-After header must be a positive number');

    const rateLimitBody = await rateLimitRes.json();
    assert.strictEqual(rateLimitBody.success, false);
    assert.strictEqual(rateLimitBody.code, 'RATE_LIMIT_EXCEEDED');
    assert(rateLimitBody.error.includes('30 requests per minute'), 'Error message should clearly state limit');
    assert(typeof rateLimitBody.retryAfter === 'number', 'retryAfter in JSON body must be a number');

    passedTests++;
    console.log(`  ✔ Passed: Rate limit capped at 30 requests/min. 31st request returned HTTP 429 with Retry-After: ${retryHeader}.\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Keyterm Sanitization
  // --------------------------------------------------------------------------
  console.log('▶ [Test 5/7] Keyterm Sanitization (Quotes, Script Tags, Control Chars)...');
  {
    // 5A: Test individual dirty terms (<script>, " OR 1=1, \n\r)
    assert.strictEqual(sanitizeKeyterm('<script>alert("xss")</script>'), '', 'Script tags with content should be completely stripped');
    assert.strictEqual(sanitizeKeyterm('<script>'), '', 'Isolated script tag should be stripped');
    assert.strictEqual(sanitizeKeyterm('" OR 1=1'), 'OR 11', 'Quotes and SQL injection chars must be sanitized');
    assert.strictEqual(sanitizeKeyterm('\' OR \'1\'=\'1'), 'OR 11', 'Single quotes and SQL characters must be sanitized');
    assert.strictEqual(sanitizeKeyterm('\n\r'), '', 'Control characters alone should reduce to empty string');
    assert.strictEqual(sanitizeKeyterm('stroke\n\rcardiopathy'), 'stroke cardiopathy', 'Newlines and carriage returns replaced with space');
    assert.strictEqual(sanitizeKeyterm('   "paciente"   '), 'paciente', 'Enclosing quotes stripped and trimmed');
    assert.strictEqual(sanitizeKeyterm('\x00\x1fmalicious\x7fcontrol'), 'malicious control', 'Control characters replaced with space and sanitized');
    assert.strictEqual(sanitizeKeyterm('<img src=x onerror=alert(1)>cardiología'), 'cardiología', 'HTML tags stripped and legitimate term preserved');

    // 5B: Test list sanitization and deduplication
    const dirtyKeyterms = [
      '<script>alert("xss")</script>',
      '<script>',
      '" OR 1=1',
      '\n\r',
      'stroke\n\rcardiopathy',
      '   "paciente"   ',
      'Stroke\r\nCardiopathy', // Duplicate case-insensitive
      'a',                     // Length < 2 -> should be dropped
      'hipertensión arterial',
      'ECG-v1/2_test'
    ];

    const cleaned = sanitizeKeyterms(dirtyKeyterms);

    // Verify none contain dangerous or dirty characters
    for (const term of cleaned) {
      assert(!term.includes('<'), `Term "${term}" must not contain '<'`);
      assert(!term.includes('>'), `Term "${term}" must not contain '>'`);
      assert(!term.includes('"'), `Term "${term}" must not contain '"'`);
      assert(!term.includes("'"), `Term "${term}" must not contain "'"`);
      assert(!term.includes('\n'), `Term "${term}" must not contain newline`);
      assert(!term.includes('\r'), `Term "${term}" must not contain carriage return`);
      assert(term.length >= 2, `Term "${term}" length must be >= 2`);
      assert(term.length <= 50, `Term "${term}" length must be <= 50`);
    }

    // Verify deduplication: 'stroke cardiopathy' should appear only once
    const strokeOccurrences = cleaned.filter(t => t.toLowerCase() === 'stroke cardiopathy');
    assert.strictEqual(strokeOccurrences.length, 1, 'Case-insensitive duplicate terms must be deduplicated');

    // Verify legitimate accented terms are preserved
    assert(cleaned.includes('hipertensión arterial'), 'Accented medical term must be preserved');
    assert(cleaned.includes('ECG-v1/2_test'), 'Safe punctuation (-, /, _) must be preserved');

    // 5C: HTTP endpoint integration
    resetAsrTokenRateLimit('127.0.0.1');
    const httpRes = await fetch(`${BASE_URL}/api/asr-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyterms: dirtyKeyterms
      })
    });
    const httpData = await httpRes.json();
    assert.strictEqual(httpRes.status, 200);
    assert(Array.isArray(httpData.keyterms), 'keyterms in response must be an array');
    assert(!httpData.keyterms.some(t => t.includes('<script>') || t.includes('"')), 'HTTP response keyterms must be completely clean');

    passedTests++;
    console.log(`  ✔ Passed: Keyterms rigorously sanitized (quotes, script tags, control chars stripped; legitimate terms preserved).\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: URL Budget Protection (<1600 Chars Budget)
  // --------------------------------------------------------------------------
  console.log('▶ [Test 6/7] URL Budget Protection (<1600 chars, HTTP 414 / proxy drop prevention)...');
  {
    // Generate 100 distinct long keyterms (each ~50 characters long with unique index prefix)
    const hundredTerms = Array.from({ length: 100 }, (_, i) =>
      `term_${String(i).padStart(3, '0')}_cardiovascular_syndrome_condition`
    );

    // Apply keyterm sanitization and URL budget guard
    const cleanTerms = sanitizeKeyterms(hundredTerms);
    const { validKeyterms, totalKeytermsCharBudget } = applyKeytermsUrlBudget(cleanTerms, 'nova-3', ASR_KEYTERM_MAX_URL_CHARS);

    // 1. Must be truncated safely
    assert(validKeyterms.length < 100, `Expected truncation from 100 terms, got ${validKeyterms.length}`);
    assert(validKeyterms.length <= 40, `Count must not exceed MAX_KEYTERMS_COUNT (40), got ${validKeyterms.length}`);
    assert(totalKeytermsCharBudget <= ASR_KEYTERM_MAX_URL_CHARS, `Budget must stay <= ${ASR_KEYTERM_MAX_URL_CHARS}, got ${totalKeytermsCharBudget}`);

    // 2. Verify keyterm query parameter string length stays strictly within budget
    const keytermsOnlyParams = new URLSearchParams();
    for (const term of validKeyterms) {
      keytermsOnlyParams.append('keyterm', term);
    }
    const keytermsParamString = keytermsOnlyParams.toString();
    console.log(`    Keyterms query string length with ${validKeyterms.length} retained keyterms: ${keytermsParamString.length} chars (budget: ${ASR_KEYTERM_MAX_URL_CHARS})`);
    assert(keytermsParamString.length <= ASR_KEYTERM_MAX_URL_CHARS, `Keyterms query string must stay <= ${ASR_KEYTERM_MAX_URL_CHARS} chars, got ${keytermsParamString.length}`);

    // 3. HTTP endpoint integration with 100 terms
    resetAsrTokenRateLimit('127.0.0.1');
    const httpRes = await fetch(`${BASE_URL}/api/asr-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyterms: hundredTerms
      })
    });
    const httpData = await httpRes.json();
    assert.strictEqual(httpRes.status, 200);
    assert(httpData.keyterms.length <= 40, 'Returned keyterms count must be <= 40');
    assert(httpData.keyterms.length === validKeyterms.length, 'HTTP endpoint keyterms count must match budget guard');

    passedTests++;
    console.log(`  ✔ Passed: URL budget strictly bounded (${validKeyterms.length}/100 terms retained, char budget: ${totalKeytermsCharBudget}/${ASR_KEYTERM_MAX_URL_CHARS}).\n`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Secret Hygiene (No API Keys Echoed in Failures)
  // --------------------------------------------------------------------------
  console.log('▶ [Test 7/7] Secret Hygiene (Master API Key Leakage Prevention)...');
  {
    const SECRET_KEY = 'c97d5531991756825ed380d6e459f8032a009ad8';

    // 7A: Unit test sanitizeSecret and deepSanitizeSecrets
    const dirtyErrorString = `Failed authentication with Token ${SECRET_KEY} at https://api.deepgram.com/v1/auth/grant`;
    const sanitizedString = sanitizeSecret(dirtyErrorString, SECRET_KEY);
    assert(!sanitizedString.includes(SECRET_KEY), 'Sanitized string must not contain SECRET_KEY');
    assert(sanitizedString.includes('[REDACTED_AUTH_TOKEN]') || sanitizedString.includes('[REDACTED_API_KEY]'), 'Secret must be replaced by redaction tag');

    const dirtyObject = {
      status: 401,
      error: `Invalid key: ${SECRET_KEY}`,
      nested: {
        authHeader: `Bearer ${SECRET_KEY}`,
        deepgramApiKey: SECRET_KEY
      },
      list: [`Authorization: Token ${SECRET_KEY}`, 'normal string']
    };
    const cleanObject = deepSanitizeSecrets(dirtyObject, SECRET_KEY);
    const cleanObjectJson = JSON.stringify(cleanObject);
    assert(!cleanObjectJson.includes(SECRET_KEY), 'Deep-sanitized object must not contain SECRET_KEY anywhere');

    // 7B: Simulate 401 Unauthorized echoing key from Deepgram
    const mock401Fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({
        err_code: 'INVALID_AUTH',
        err_msg: `The provided key ${SECRET_KEY} is invalid or expired`
      })
    });

    const res401 = await mintEphemeralToken({
      apiKey: SECRET_KEY,
      forceRefresh: true,
      fetchFn: mock401Fetch
    });

    assert.strictEqual(res401.success, false);
    assert.strictEqual(res401.status, 401);
    const res401Str = JSON.stringify(res401);
    assert(!res401Str.includes(SECRET_KEY), `401 response payload MUST NOT leak API key: ${res401Str}`);

    // 7C: Simulate 403 Forbidden echoing Authorization header
    const mock403Fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => `Forbidden: Token ${SECRET_KEY} does not possess 'auth' grant scope`
    });

    const res403 = await mintEphemeralToken({
      apiKey: SECRET_KEY,
      forceRefresh: true,
      fetchFn: mock403Fetch
    });

    assert.strictEqual(res403.success, false);
    assert.strictEqual(res403.status, 403);
    const res403Str = JSON.stringify(res403);
    assert(!res403Str.includes(SECRET_KEY), `403 response payload MUST NOT leak API key: ${res403Str}`);

    // 7D: Simulate 500 Upstream Internal Server Error with key in error message
    const mock500Fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({
        error: `Deepgram core exception for credentials: Token ${SECRET_KEY}`
      })
    });

    const res500 = await mintEphemeralToken({
      apiKey: SECRET_KEY,
      forceRefresh: true,
      fetchFn: mock500Fetch
    });

    assert.strictEqual(res500.success, false);
    assert.strictEqual(res500.status, 500);
    const res500Str = JSON.stringify(res500);
    assert(!res500Str.includes(SECRET_KEY), `500 response payload MUST NOT leak API key: ${res500Str}`);

    // 7E: Simulate Network Exception containing key in error.message
    const mockNetworkExceptionFetch = async () => {
      throw new Error(`Socket timeout connecting to api.deepgram.com with key ${SECRET_KEY}`);
    };

    const resNetwork = await mintEphemeralToken({
      apiKey: SECRET_KEY,
      forceRefresh: true,
      fetchFn: mockNetworkExceptionFetch
    });

    assert.strictEqual(resNetwork.success, false);
    const resNetworkStr = JSON.stringify(resNetwork);
    assert(!resNetworkStr.includes(SECRET_KEY), `Network exception MUST NOT leak API key: ${resNetworkStr}`);

    passedTests++;
    console.log(`  ✔ Passed: Secret hygiene verified. 401, 403, 500, and network exceptions completely scrub master API keys.\n`);
  }

  // --------------------------------------------------------------------------
  // Summary & Teardown
  // --------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY (September 2026 Consensus)`);
  console.log('================================================================\n');

  try {
    server.close();
  } catch (_) {}

  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ FATAL TEST SUITE FAILURE:', err);
  try {
    server.close();
  } catch (_) {}
  process.exit(1);
});
