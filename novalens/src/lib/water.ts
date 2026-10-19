// Water evidence rules for the water-conscious scan (docs/WATER_CONSCIOUS_SCAN.md).
// Pure functions only: no network, no UI. The truth policy matches Carbon:
// unknown never becomes zero, category averages are never shown as product
// figures, blue/green/grey water are never summed, and conflicting sources
// stay Unknown until reviewed.

export type WaterBasis = 'blue' | 'green' | 'grey' | 'total' | 'use_per_cycle' | 'use_per_minute';

export type WaterEvidenceScope = 'product' | 'brand' | 'category';

export type WaterEvidence = {
  basis: WaterBasis;
  litres: number | null | undefined;
  functionalUnit: string;
  scope: WaterEvidenceScope;
  sourceId: string | null | undefined;
  verifiedAt?: string | null;
  region?: string | null;
};

export type WaterLabel = 'Verified' | 'Estimated' | 'Unknown';

export type WaterFigure = {
  basis: WaterBasis;
  functionalUnit: string | null;
  litres: number | null;
  label: WaterLabel;
  sourceIds: string[];
  conflict: boolean;
  // Most recent verification date among the sources behind the figure
  // (YYYY-MM-DD), or null when no source reports one.
  lastVerifiedAt?: string | null;
};

export const LIFECYCLE_BASES: readonly WaterBasis[] = ['blue', 'green', 'grey', 'total'];
export const USE_PHASE_BASES: readonly WaterBasis[] = ['use_per_cycle', 'use_per_minute'];

// Two sources for the same basis and unit that differ by more than this share
// are treated as conflicting, so the figure stays Unknown and goes to review.
export const CONFLICT_TOLERANCE = 0.05;

export function cleanLitres(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function hasSource(evidence: WaterEvidence) {
  return typeof evidence.sourceId === 'string' && evidence.sourceId.trim().length > 0;
}

export function waterLabel(evidence: WaterEvidence): WaterLabel {
  if (!hasSource(evidence) || cleanLitres(evidence.litres) === null) return 'Unknown';
  return evidence.scope === 'category' ? 'Estimated' : 'Verified';
}

function unknownFigure(basis: WaterBasis, functionalUnit: string | null, sourceIds: string[] = [], conflict = false): WaterFigure {
  return { basis, functionalUnit, litres: null, label: 'Unknown', sourceIds, conflict };
}

// Latest valid verification date (YYYY-MM-DD). Unparseable dates are ignored
// rather than guessed, so a figure never claims a date no source gave.
export function latestVerifiedDate(evidence: WaterEvidence[]): string | null {
  let latest: number | null = null;
  for (const item of evidence) {
    if (typeof item.verifiedAt !== 'string' || !item.verifiedAt.trim()) continue;
    const time = Date.parse(item.verifiedAt.trim());
    if (!Number.isFinite(time)) continue;
    if (latest === null || time > latest) latest = time;
  }
  return latest === null ? null : new Date(latest).toISOString().slice(0, 10);
}

function disagree(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === 0) return false;
  return (max - min) / max > CONFLICT_TOLERANCE;
}

// Resolve one figure for a basis. Product- or brand-specific evidence wins over
// category averages; within the winning tier, disagreeing sources or mixed
// functional units leave the figure Unknown.
export function resolveWaterFigure(evidence: WaterEvidence[], basis: WaterBasis): WaterFigure {
  const usable = evidence.filter(item => item.basis === basis && waterLabel(item) !== 'Unknown');
  if (!usable.length) return unknownFigure(basis, null);

  const verified = usable.filter(item => waterLabel(item) === 'Verified');
  const tier = verified.length ? verified : usable;
  const label: WaterLabel = verified.length ? 'Verified' : 'Estimated';
  const sourceIds = Array.from(new Set(tier.map(item => String(item.sourceId).trim())));
  const units = Array.from(new Set(tier.map(item => item.functionalUnit.trim().toLowerCase())));
  if (units.length !== 1) return unknownFigure(basis, null, sourceIds, true);

  const values = tier.map(item => cleanLitres(item.litres) as number);
  if (disagree(values)) return unknownFigure(basis, tier[0].functionalUnit, sourceIds, true);

  const litres = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { basis, functionalUnit: tier[0].functionalUnit, litres, label, sourceIds, conflict: false, lastVerifiedAt: latestVerifiedDate(tier) };
}

// Lifecycle water is reported per basis. A total appears only when a source
// reported a total itself; it is never built by adding blue, green and grey.
export function summarizeLifecycleWater(evidence: WaterEvidence[]): WaterFigure[] {
  return LIFECYCLE_BASES.map(basis => resolveWaterFigure(evidence, basis));
}

export function summarizeUsePhaseWater(evidence: WaterEvidence[]): WaterFigure[] {
  return USE_PHASE_BASES
    .map(basis => resolveWaterFigure(evidence, basis))
    .filter(figure => figure.label !== 'Unknown' || figure.conflict);
}

export type WaterComparison = 'first_lower' | 'second_lower' | 'similar' | 'unknown';

// Compare two products on the same basis. Any unknown side, conflict, or
// mismatched functional unit returns 'unknown' rather than a ranking.
export function compareWater(first: WaterFigure, second: WaterFigure, similarShare = 0.1): WaterComparison {
  if (first.basis !== second.basis) return 'unknown';
  if (first.litres === null || second.litres === null) return 'unknown';
  if (!first.functionalUnit || !second.functionalUnit) return 'unknown';
  if (first.functionalUnit.trim().toLowerCase() !== second.functionalUnit.trim().toLowerCase()) return 'unknown';
  const larger = Math.max(first.litres, second.litres);
  if (larger === 0 || Math.abs(first.litres - second.litres) / larger <= similarShare) return 'similar';
  return first.litres < second.litres ? 'first_lower' : 'second_lower';
}

export function formatLitres(litres: number | null): string {
  if (litres === null || !Number.isFinite(litres)) return 'Unknown';
  if (litres >= 1000) return `${(litres / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} m³`;
  if (litres >= 10) return `${Math.round(litres).toLocaleString('en-US')} L`;
  return `${litres.toLocaleString('en-US', { maximumFractionDigits: 1 })} L`;
}

// Regional water-stress context (WRI Aqueduct baseline water stress categories).
// This describes the sourcing region only. It is never a score, rank or rating
// of the product, and an unknown region or category stays Unknown.
export type WaterStressLevel = 'low' | 'low_medium' | 'medium_high' | 'high' | 'extremely_high' | 'arid_low_use';

export type WaterStressContext = {
  level: WaterStressLevel | null;
  region: string | null;
  sourceId: string | null;
  sentence: string;
};

const STRESS_ALIASES: Record<string, WaterStressLevel> = {
  'low': 'low',
  'low (<10%)': 'low',
  'low-medium': 'low_medium',
  'low - medium': 'low_medium',
  'low-medium (10-20%)': 'low_medium',
  'medium-high': 'medium_high',
  'medium - high': 'medium_high',
  'medium-high (20-40%)': 'medium_high',
  'high': 'high',
  'high (40-80%)': 'high',
  'extremely high': 'extremely_high',
  'extremely high (>80%)': 'extremely_high',
  'arid and low water use': 'arid_low_use',
};

const STRESS_WORDS: Record<WaterStressLevel, string> = {
  low: 'low baseline water stress',
  low_medium: 'low-to-medium baseline water stress',
  medium_high: 'medium-to-high baseline water stress',
  high: 'high baseline water stress',
  extremely_high: 'extremely high baseline water stress',
  arid_low_use: 'arid conditions with low water use',
};

export function parseWaterStressLevel(value: unknown): WaterStressLevel | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
  // Own keys only: `in` and plain lookup also match inherited names such as
  // "constructor" or "__proto__", which would turn untrusted API text into a
  // sentence like "an area with function Object() { [native code] }".
  if (Object.prototype.hasOwnProperty.call(STRESS_WORDS, key)) return key as WaterStressLevel;
  return Object.prototype.hasOwnProperty.call(STRESS_ALIASES, key) ? (STRESS_ALIASES[key] ?? null) : null;
}

export function waterStressContext(input: { category?: unknown; region?: string | null; sourceId?: string | null }): WaterStressContext {
  const region = typeof input.region === 'string' && input.region.trim() ? input.region.trim() : null;
  const sourceId = typeof input.sourceId === 'string' && input.sourceId.trim() ? input.sourceId.trim() : null;
  const level = region && sourceId ? parseWaterStressLevel(input.category) : null;
  if (!level || !region) {
    return { level: null, region, sourceId, sentence: 'Water-stress context for the sourcing region is unknown.' };
  }
  return { level, region, sourceId, sentence: `Sourced from ${region}, an area with ${STRESS_WORDS[level]}.` };
}

const KNOWN_BASES = new Set<string>([...LIFECYCLE_BASES, ...USE_PHASE_BASES]);
const KNOWN_SCOPES = new Set<string>(['product', 'brand', 'category']);

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// Parse untrusted API rows into WaterEvidence. Rows with an unrecognized basis
// or scope, or without a functional unit, are dropped instead of guessed, and a
// missing or invalid amount stays null so it can only ever read as Unknown.
export function parseWaterEvidence(raw: unknown): WaterEvidence[] {
  if (!Array.isArray(raw)) return [];
  const evidence: WaterEvidence[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const basis = typeof record.basis === 'string' ? record.basis.trim().toLowerCase() : '';
    const scope = typeof record.scope === 'string' ? record.scope.trim().toLowerCase() : '';
    const functionalUnit = optionalText(record.functionalUnit ?? record.functional_unit);
    if (!KNOWN_BASES.has(basis) || !KNOWN_SCOPES.has(scope) || !functionalUnit) continue;
    evidence.push({
      basis: basis as WaterBasis,
      litres: cleanLitres(record.litres),
      functionalUnit,
      scope: scope as WaterEvidenceScope,
      sourceId: optionalText(record.sourceId ?? record.source_id),
      verifiedAt: optionalText(record.verifiedAt ?? record.verified_at),
      region: optionalText(record.region),
    });
  }
  return evidence;
}

export const WATER_BASIS_LABELS: Record<WaterBasis, string> = {
  blue: 'Blue water (surface and groundwater used)',
  green: 'Green water (rainwater)',
  grey: 'Grey water (needed to dilute pollution)',
  total: 'Total water (as reported by the source)',
  use_per_cycle: 'Water used per cycle',
  use_per_minute: 'Water used per minute',
};

// One plain-language line per figure. Conflicts and missing evidence read as
// Unknown; a figure always carries its label and how many sources back it.
export function describeWaterFigure(figure: WaterFigure): string {
  if (figure.conflict) return 'Unknown: sources disagree, held for review';
  if (figure.litres === null) return 'Unknown';
  const unit = figure.functionalUnit ? ` ${figure.functionalUnit}` : '';
  const sources = figure.sourceIds.length === 1 ? '1 source' : `${figure.sourceIds.length} sources`;
  const verified = figure.lastVerifiedAt ? ` · checked ${figure.lastVerifiedAt}` : '';
  return `${formatLitres(figure.litres)}${unit} · ${figure.label} · ${sources}${verified}`;
}

// Plain-language comparison of two items on one basis. It names the lower-water
// option only when both sides are known on the same unit; otherwise it says why
// no ranking is shown. Never a score.
export function describeWaterComparison(firstName: string, secondName: string, figureA: WaterFigure, figureB: WaterFigure): string {
  const basis = WATER_BASIS_LABELS[figureA.basis].split(' (')[0].toLowerCase();
  const result = compareWater(figureA, figureB);
  const sure = figureA.label === 'Verified' && figureB.label === 'Verified'
    ? 'Both figures are product- or brand-specific.'
    : 'At least one figure is a category average, so treat this as a rough guide.';
  if (result === 'first_lower') return `${firstName} likely involves less ${basis} than ${secondName}. ${sure}`;
  if (result === 'second_lower') return `${secondName} likely involves less ${basis} than ${firstName}. ${sure}`;
  if (result === 'similar') return `${firstName} and ${secondName} involve a similar amount of ${basis}. ${sure}`;
  return `Not enough comparable water evidence to say which involves less ${basis}. Unknown does not mean low.`;
}
