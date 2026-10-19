import { confidenceLabel, normalizeConfidencePct, overallConfidencePct, phaseConfidencePct } from '../carbonConfidence';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function verifyCarbonConfidence() {
  // No evidence range is Unknown, never 0%.
  assert(phaseConfidencePct(undefined) === null, 'missing range is unknown');
  assert(phaseConfidencePct(null) === null, 'null range is unknown');
  assert(phaseConfidencePct({ min: null, max: null }) === null, 'null bounds are unknown, not 0');
  assert(phaseConfidencePct({ min: '', max: 40 }) === null, 'blank bound is unknown');
  assert(phaseConfidencePct({ min: 'abc', max: 40 }) === null, 'non-numeric bound is unknown');
  assert(phaseConfidencePct({ min: 150, max: 170 }) === null, 'out-of-range midpoint is unknown');
  assert(confidenceLabel(phaseConfidencePct(undefined)) === 'Unknown', 'label reads Unknown');

  // Real ranges keep their midpoint, including a genuine 0-0 range.
  assert(phaseConfidencePct({ min: 60, max: 80 }) === 70, 'midpoint of 60-80 is 70');
  assert(phaseConfidencePct({ min: '61', max: '80' }) === 71, 'numeric strings are accepted and rounded');
  assert(phaseConfidencePct({ min: 0, max: 0 }) === 0, 'an explicit 0-0 range is a real 0');
  assert(confidenceLabel(70) === '70% confidence', 'known label keeps the percentage');

  // Overall averages only phases with evidence; none means Unknown.
  assert(overallConfidencePct([]) === null, 'no phases is unknown');
  assert(overallConfidencePct([undefined, null]) === null, 'no evidence anywhere is unknown');
  assert(overallConfidencePct([{ min: 60, max: 80 }, undefined]) === 70, 'unknown phases are not averaged in as zero');
  assert(overallConfidencePct([{ min: 60, max: 80 }, { min: 40, max: 60 }]) === 60, 'known phases are averaged');
  return true;
}

export function verifyConfidenceNormalisation() {
  assert(normalizeConfidencePct(null) === null, 'null confidence is unknown, not 0');
  assert(normalizeConfidencePct(undefined) === null, 'missing confidence is unknown');
  assert(normalizeConfidencePct('') === null, 'blank confidence is unknown');
  assert(normalizeConfidencePct('n/a') === null, 'text confidence is unknown');
  assert(normalizeConfidencePct(0) === 0, 'an explicit 0 stays 0');
  assert(normalizeConfidencePct(72.4) === 72, 'percentages are rounded');
  assert(normalizeConfidencePct(140) === 100, 'values are clamped to 100');
  assert(normalizeConfidencePct(0.8, true) === 80, 'fractions are scaled when allowed');
  assert(normalizeConfidencePct(0.8) === 1, 'fractions are not scaled unless allowed');
  return true;
}
