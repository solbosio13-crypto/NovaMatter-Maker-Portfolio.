// Carbon confidence labels for the consumer Carbon view.
//
// Truth policy: a phase with no evidence range is Unknown, never "0% confidence".
// A 0% figure reads as a measured verdict; Unknown says we have nothing to show yet.

export type ConfidenceRange = { min?: unknown; max?: unknown } | null | undefined;

function midpoint(range: ConfidenceRange): number | null {
  if (!range) return null;
  const min = Number(range.min);
  const max = Number(range.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (range.min === null || range.max === null || range.min === '' || range.max === '') return null;
  const mid = (min + max) / 2;
  if (mid < 0 || mid > 100) return null;
  return mid;
}

/** Rounded midpoint of a phase's confidence range, or null when there is no usable range. */
export function phaseConfidencePct(range: ConfidenceRange): number | null {
  const mid = midpoint(range);
  return mid === null ? null : Math.round(mid);
}

/** Average of the phases that have a usable range, or null when none do. */
export function overallConfidencePct(ranges: ConfidenceRange[]): number | null {
  const values = ranges.map(midpoint).filter((value): value is number => value !== null);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Pill text: "72% confidence", or "Unknown" when there is no evidence range. */
export function confidenceLabel(pct: number | null): string {
  return pct === null ? 'Unknown' : `${pct}% confidence`;
}

/**
 * Normalises a raw confidence value (0-100, or 0-1 when allowFraction is set) to a whole
 * percentage. Missing, blank or non-numeric values return null so screens show Unknown.
 * Note: Number(null) is 0, which is how missing confidence used to render as "0% confidence".
 */
export function normalizeConfidencePct(raw: unknown, allowFraction = false): number | null {
  if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const pct = allowFraction && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
