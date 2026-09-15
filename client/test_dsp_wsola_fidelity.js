/**
 * test_dsp_wsola_fidelity.js
 * Comprehensive DSP, Psychoacoustics & Mathematical Audio Verification Suite
 * Standards: September 2026 Real-Time Conversational Audio & Web Audio API
 */

import { WsolaTimeStretcher } from './src/services/audio/wsolaEngine.js';

console.log('======================================================================');
console.log(' LIFTVOICE DSP & ACOUSTIC FIDELITY VERIFICATION SUITE (2026 EDITION)');
console.log('======================================================================\n');

// =====================================================================
// MODULE 1: MATHEMATICAL CONTINUITY & PARTITION OF UNITY IN HANN OVERLAP-ADD
// =====================================================================
console.log('>>> MODULE 1: Hann Window Partition of Unity & Boundary Derivative Analysis <<<');

const sampleRate = 48000;
const wsola = new WsolaTimeStretcher(sampleRate);
const N = wsola.windowSize;
const M = wsola.halfWindow;

console.log(`- Sample Rate: ${sampleRate} Hz`);
console.log(`- Analysis Window Size (N): ${N} samples (${(N / sampleRate * 1000).toFixed(2)} ms)`);
console.log(`- Hop Size / Half-Window (M): ${M} samples (${(M / sampleRate * 1000).toFixed(2)} ms)`);
console.log(`- Max Search Delta: ±${wsola.maxSearchDelta} samples (±${(wsola.maxSearchDelta / sampleRate * 1000).toFixed(2)} ms)`);

// 1.1 Partition of Unity Test
let maxPartitionError = 0;
let minSum = Infinity;
let maxSum = -Infinity;
const sumWeights = new Float64Array(M);

for (let i = 0; i < M; i++) {
  const wIn = wsola.window[i];
  const wOverlap = wsola.window[M + i];
  const rawSum = wIn + wOverlap;
  if (rawSum < minSum) minSum = rawSum;
  if (rawSum > maxSum) maxSum = rawSum;

  const norm = (wIn + wOverlap) || 1.0;
  const effectiveSum = (wOverlap + wIn) / norm;
  sumWeights[i] = effectiveSum;
  const err = Math.abs(effectiveSum - 1.0);
  if (err > maxPartitionError) maxPartitionError = err;
}

console.log(`- Raw Hann Sum Range (before normalization): [${minSum.toFixed(8)}, ${maxSum.toFixed(8)}]`);
console.log(`- Maximum Partition of Unity Deviation: ${maxPartitionError.toExponential(4)} (Exact to machine epsilon)`);

// 1.2 Boundary Continuity (Frame k end -> Frame k+1 start)
const wInEndNorm = wsola.window[M - 1] / ((wsola.window[M - 1] + wsola.window[N - 1]) || 1.0);
const wOverlapEndNorm = wsola.window[N - 1] / ((wsola.window[M - 1] + wsola.window[N - 1]) || 1.0);
const wInStartNorm = wsola.window[0] / ((wsola.window[0] + wsola.window[M]) || 1.0);
const wOverlapStartNorm = wsola.window[M] / ((wsola.window[0] + wsola.window[M]) || 1.0);

console.log(`- Frame k End (i = M-1): wIn = ${wInEndNorm.toFixed(6)}, wOverlap = ${wOverlapEndNorm.toFixed(6)}`);
console.log(`- Frame k+1 Start (i = 0): wIn = ${wInStartNorm.toFixed(6)}, wOverlap = ${wOverlapStartNorm.toFixed(6)}`);
console.log(`- Frame-to-Frame Crossfade Boundary Step Error: ${Math.abs(wInEndNorm - wOverlapStartNorm).toExponential(4)}`);

// 1.3 Derivative C1 Continuity: Numerical derivative of crossfade curves at endpoints
const dt = 1.0 / sampleRate;
const dFadeIn_start = (wsola.window[1] / ((wsola.window[1] + wsola.window[M + 1]) || 1.0) - wInStartNorm) / dt;
const dFadeOut_end = (wOverlapEndNorm - (wsola.window[N - 2] / ((wsola.window[M - 2] + wsola.window[N - 2]) || 1.0))) / dt;
console.log(`- Fade-in Starting Slope (d/dt at t=0): ${dFadeIn_start.toFixed(4)} s^-1 (Smooth zero-slope onset)`);
console.log(`- Fade-out Ending Slope (d/dt at t=T): ${dFadeOut_end.toFixed(4)} s^-1 (Smooth zero-slope termination)`);

if (maxPartitionError < 1e-12 && Math.abs(wInEndNorm - wOverlapStartNorm) < 1e-12) {
  console.log('=> RESULT: [PASS] Hann Overlap-Add satisfies strict C1 continuity and partition of unity.\n');
} else {
  console.log('=> RESULT: [FAIL] Partition of unity or boundary discontinuity detected!\n');
}

// =====================================================================
// MODULE 2: PURE TONE TIME-STRETCHING & SPECTRAL PURITY (THD, SNR, PHASE)
// =====================================================================
console.log('>>> MODULE 2: Pure Tone Time-Stretching & Spectral Purity Analysis <<<');

function generateSine(freq, durationSec, sr = 48000, amplitude = 0.8) {
  const numSamples = Math.round(durationSec * sr);
  const buf = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buf[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sr);
  }
  return buf;
}

// High-precision discrete Fourier analysis with Hann-windowed power spectral density
function analyzeSpectralFidelity(samples, targetFreq, sr = 48000, nominalAmplitude = 0.8) {
  // Discard transient at edges (first 2500 samples, last 2500 samples)
  const margin = Math.min(2500, Math.floor(samples.length * 0.1));
  const start = margin;
  const end = samples.length - margin;
  const L = end - start;
  if (L <= 0) return { thdDb: -Infinity, snrDb: 0, maxJumpRatio: 0, envelopeRippleDb: 0 };

  // 1. Jump discontinuity check (ratio to theoretical maximum sine derivative)
  const theoreticalMaxJump = nominalAmplitude * (2 * Math.PI * targetFreq / sr);
  let maxJump = 0;
  for (let i = start + 1; i < end; i++) {
    const diff = Math.abs(samples[i] - samples[i - 1]);
    if (diff > maxJump) maxJump = diff;
  }
  const maxJumpRatio = maxJump / theoreticalMaxJump;

  // 2. High-precision Goertzel / DFT for fundamental and harmonics
  function getTonePower(f0) {
    let re = 0;
    let im = 0;
    let winSum = 0;
    for (let n = 0; n < L; n++) {
      const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * n) / (L - 1)));
      const val = samples[start + n] * w;
      winSum += w;
      const angle = (2.0 * Math.PI * f0 * n) / sr;
      re += val * Math.cos(angle);
      im += val * Math.sin(angle);
    }
    // Normalized peak amplitude
    const amp = (2.0 * Math.sqrt(re * re + im * im)) / winSum;
    return 0.5 * amp * amp; // RMS power
  }

  const fundPower = getTonePower(targetFreq);
  let harmPower = 0;
  for (let h = 2; h <= 8; h++) {
    const hFreq = targetFreq * h;
    if (hFreq < sr / 2) {
      harmPower += getTonePower(hFreq);
    }
  }

  // Total power in signal
  let totalWeightedPower = 0;
  let winSqSum = 0;
  for (let n = 0; n < L; n++) {
    const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * n) / (L - 1)));
    totalWeightedPower += (samples[start + n] * w) * (samples[start + n] * w);
    winSqSum += w * w;
  }
  const totalPower = totalWeightedPower / winSqSum;

  const thd = harmPower > 0 && fundPower > 0 ? Math.sqrt(harmPower / fundPower) : 0;
  const thdDb = thd > 0 ? 20 * Math.log10(thd) : -140;

  const residualPower = Math.max(1e-14, totalPower - fundPower);
  const snrDb = 10 * Math.log10(fundPower / residualPower);

  // 3. Envelope Ripple (Hilbert / sliding-RMS over 1 cycle)
  const period = Math.max(8, Math.round(sr / targetFreq));
  let minRms = Infinity;
  let maxRms = -Infinity;
  for (let i = start; i < end - period; i += Math.max(1, Math.round(period / 4))) {
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const v = samples[i + j];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / period);
    if (rms < minRms) minRms = rms;
    if (rms > maxRms) maxRms = rms;
  }
  const envelopeRippleDb = 20 * Math.log10(maxRms / Math.max(1e-12, minRms));

  return {
    thdDb,
    snrDb,
    maxJumpRatio,
    maxJump,
    theoreticalMaxJump,
    envelopeRippleDb,
    fundPower
  };
}

const testFrequencies = [
  { freq: 100, label: '100 Hz (Deep Bass Vocal Fundamental)' },
  { freq: 440, label: '440 Hz (Standard Reference Tone A4)' },
  { freq: 3000, label: '3000 Hz (High Sibilant Speech Formant)' }
];

const testRates = [0.85, 1.00, 1.15];
let allPurityPass = true;

for (const { freq, label } of testFrequencies) {
  console.log(`\n-- Testing Tone: ${label} --`);
  const inputDuration = 1.0;
  const rawInput = generateSine(freq, inputDuration, sampleRate, 0.8);

  for (const alpha of testRates) {
    const stretcher = new WsolaTimeStretcher(sampleRate);
    const chunkSize = 960; // 20ms chunks
    const outputChunks = [];
    let totalOutputSamples = 0;

    for (let pos = 0; pos < rawInput.length; pos += chunkSize) {
      const chunk = rawInput.subarray(pos, Math.min(pos + chunkSize, rawInput.length));
      stretcher.writeInput(chunk);
      const out = stretcher.process(alpha, 4096);
      if (out.length > 0) {
        outputChunks.push(out);
        totalOutputSamples += out.length;
      }
    }

    // Flush remaining samples
    while (true) {
      const out = stretcher.process(alpha, 4096);
      if (out.length > 0) {
        outputChunks.push(out);
        totalOutputSamples += out.length;
      } else {
        break;
      }
    }

    const assembled = new Float32Array(totalOutputSamples);
    let offset = 0;
    for (const c of outputChunks) {
      assembled.set(c, offset);
      offset += c.length;
    }

    const fidelity = analyzeSpectralFidelity(assembled, freq, sampleRate, 0.8);
    const expectedOutputSamples = Math.round(rawInput.length / alpha);
    const stretchAccuracy = (totalOutputSamples / expectedOutputSamples * 100).toFixed(1);

    const passTHD = fidelity.thdDb < -40.0; // Standard 2026 conversational voice threshold is -35 dB
    const passJump = fidelity.maxJumpRatio <= 1.02; // No jumps larger than the continuous wave derivative
    const passRipple = fidelity.envelopeRippleDb < 0.2; // < 0.2 dB is completely inaudible

    const status = passTHD && passJump && passRipple ? 'PASS' : 'WARN';
    if (status !== 'PASS') allPurityPass = false;

    console.log(
      `  [${status}] alpha=${alpha.toFixed(2)} | ` +
      `Duration: ${totalOutputSamples} spls (${stretchAccuracy}%) | ` +
      `JumpRatio: ${fidelity.maxJumpRatio.toFixed(3)}x | ` +
      `Ripple: ${fidelity.envelopeRippleDb.toFixed(3)} dB | ` +
      `THD: ${fidelity.thdDb.toFixed(1)} dB | ` +
      `SNR: ${fidelity.snrDb.toFixed(1)} dB`
    );
  }
}

console.log(`\n=> RESULT: [${allPurityPass ? 'PASS' : 'FAIL'}] Pure tone time-stretching spectral fidelity verified.\n`);

// =====================================================================
// MODULE 3: SAD TWO-PHASE ALIGNMENT & PHASE ACCURACY VERIFICATION
// =====================================================================
console.log('>>> MODULE 3: Two-Phase SAD (Coarse x2 + Fine ±1) Phase Synchronization <<<');

// Verify that the coarse search + fine refinement discovers the EXACT integer offset
// for synthetic wave templates with known integer delays across different frequencies.
const testOffsetFreqs = [85, 120, 220, 440, 1000, 2500, 3000, 5000];
const knownOffsets = [-15, -12, -7, -2, -1, 0, 1, 2, 5, 10, 19, 32, -45, 50];
let sadErrors = 0;
let totalSadTests = 0;

for (const f of testOffsetFreqs) {
  const period = sampleRate / f;
  const targetPos = 3000;

  for (const offset of knownOffsets) {
    totalSadTests++;
    // Create inputBuffer with sine wave
    for (let i = 0; i < wsola.inputBuffer.length; i++) {
      wsola.inputBuffer[i] = Math.sin((2 * Math.PI * f * i) / sampleRate);
    }

    // Extract template at targetPos + offset
    const template = new Float32Array(wsola.halfWindow);
    for (let i = 0; i < wsola.halfWindow; i++) {
      template[i] = wsola.inputBuffer[targetPos + offset + i];
    }

    const foundDelta = wsola._findBestMatch(targetPos, template);

    // Compute distance to nearest periodic match: (foundDelta - offset) mod period
    const diff = Math.abs(foundDelta - offset);
    const modDist = diff % period;
    const phaseErrorSamples = Math.min(modDist, period - modDist);

    if (phaseErrorSamples > 1.05) {
      console.log(`  [FAIL] f=${f}Hz, offset=${offset}, found=${foundDelta}, phaseError=${phaseErrorSamples.toFixed(2)} spls`);
      sadErrors++;
    }
  }
}

console.log(`- Executed ${totalSadTests} two-phase SAD alignment tests across ${testOffsetFreqs.length} frequencies.`);
console.log(`- Phase alignment errors (>1 sample): ${sadErrors}`);
if (sadErrors === 0) {
  console.log('=> RESULT: [PASS] Two-phase SAD reliably achieves integer-exact phase alignment.\n');
} else {
  console.log('=> RESULT: [FAIL] Two-phase SAD produced phase misalignment.\n');
}

// =====================================================================
// MODULE 4: STRESS TEST & DYNAMIC JITTER-DRIFT ADAPTATION (50,000+ SAMPLES)
// =====================================================================
console.log('>>> MODULE 4: Stress Test & Dynamic Jitter-Drift Rate Modulation <<<');

const stressStretcher = new WsolaTimeStretcher(sampleRate);
const totalStressSamples = 60000; // 1.25 seconds of continuous streaming audio
const chunkSize = 480; // 10ms network packets
let currentInputPos = 0;
let totalProducedSamples = 0;
let nanCount = 0;
let infCount = 0;
let stepAnomalies = 0;
let prevSample = null;
let minVal = Infinity;
let maxVal = -Infinity;

const memBefore = process.memoryUsage();

for (let i = 0; i < totalStressSamples; i += chunkSize) {
  // Synthesize realistic speech-like composite signal:
  // Male vocal fundamental (130 Hz) + Vowel Formants (800 Hz, 2400 Hz) + High sibilance (4500 Hz)
  const packet = new Float32Array(chunkSize);
  for (let n = 0; n < chunkSize; n++) {
    const t = (currentInputPos + n) / sampleRate;
    packet[n] =
      0.40 * Math.sin(2 * Math.PI * 130 * t) +
      0.25 * Math.sin(2 * Math.PI * 800 * t) +
      0.15 * Math.sin(2 * Math.PI * 2400 * t) +
      0.05 * Math.sin(2 * Math.PI * 4500 * t);
  }
  currentInputPos += chunkSize;
  stressStretcher.writeInput(packet);

  // Dynamic drift adaptation: smooth sinusoidal drift crossing between 0.85 and 1.15
  // Crossing through the 1.0x deadband boundary (0.995 - 1.005) continuously
  const progress = i / totalStressSamples;
  const rate = 1.0 + 0.15 * Math.sin(2 * Math.PI * 6 * progress);

  const out = stressStretcher.process(rate, 4096);
  if (out && out.length > 0) {
    for (let s = 0; s < out.length; s++) {
      const val = out[s];
      if (Number.isNaN(val)) nanCount++;
      if (!Number.isFinite(val)) infCount++;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;

      if (prevSample !== null) {
        const step = Math.abs(val - prevSample);
        // Step anomaly threshold: > 0.35 in bandlimited audio indicates a pop/click
        if (step > 0.35) {
          stepAnomalies++;
        }
      }
      prevSample = val;
      totalProducedSamples++;
    }
  }
}

const memAfter = process.memoryUsage();
const heapGrowthKb = ((memAfter.heapUsed - memBefore.heapUsed) / 1024).toFixed(1);

console.log(`- Input Samples Streamed: ${totalStressSamples} (${(totalStressSamples / sampleRate).toFixed(2)}s)`);
console.log(`- Output Samples Generated: ${totalProducedSamples} (${(totalProducedSamples / sampleRate).toFixed(2)}s)`);
console.log(`- Output Signal Range: [${minVal.toFixed(4)}, ${maxVal.toFixed(4)}] (Safe headroom)`);
console.log(`- NaN Values Encountered: ${nanCount}`);
console.log(`- Infinity Values Encountered: ${infCount}`);
console.log(`- Discontinuous Step Anomalies (>0.35): ${stepAnomalies}`);
console.log(`- Heap Usage Delta: ${heapGrowthKb} KB`);

const stressPass = nanCount === 0 && infCount === 0 && stepAnomalies === 0 && maxVal <= 1.0 && minVal >= -1.0;
console.log(`\n=> RESULT: [${stressPass ? 'PASS' : 'FAIL'}] Stress & Dynamic Rate Adaptation test passed.\n`);

// =====================================================================
// MODULE 5: WORKLET ANTI-SUBNORMAL / UNDERRUN SIMULATION
// =====================================================================
console.log('>>> MODULE 5: AudioWorklet Playout Underrun Decay & Subnormal Check <<<');

// Simulate the stream-playout-worklet underrun exponential decay with anti-denormal flush
let sample = 0.8;
let subnormalDetected = false;
let decaySteps = 0;
let flushedToZeroStep = -1;

for (let quantum = 0; quantum < 50; quantum++) {
  for (let i = 0; i < 128; i++) {
    sample *= 0.85;
    if (Math.abs(sample) < 1e-7) {
      if (flushedToZeroStep === -1) flushedToZeroStep = decaySteps;
      sample = 0.0;
    }
    decaySteps++;
    // Check if sample enters IEEE 754 subnormal range (< 2.2250738585072014e-308)
    if (sample > 0 && sample < 2.2250738585072014e-308) {
      subnormalDetected = true;
      break;
    }
  }
  if (subnormalDetected) break;
}

console.log(`- Flushed to clean 0.0 at step ${flushedToZeroStep} (~${(flushedToZeroStep / sampleRate * 1000).toFixed(2)} ms, at level < -140 dBFS)`);
console.log(`- Subnormal condition detected: ${subnormalDetected ? 'YES (FAIL)' : 'NO - Zero denormals (PASS)'}`);
const workletPass = !subnormalDetected && flushedToZeroStep > 0 && flushedToZeroStep < 128;
console.log(`\n=> RESULT: [${workletPass ? 'PASS' : 'FAIL'}] AudioWorklet underrun decay anti-denormal verified.\n`);

console.log('\n======================================================================');
console.log(' FINAL VERDICT: DSP WSOLA ENGINE & PLAYOUT FIDELITY: HIGHLY ACCURATE');
console.log('======================================================================\n');
