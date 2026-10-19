import {
  compareWater,
  describeWaterComparison,
  describeWaterFigure,
  latestVerifiedDate,
  formatLitres,
  parseWaterEvidence,
  resolveWaterFigure,
  summarizeLifecycleWater,
  summarizeUsePhaseWater,
  waterLabel,
  waterStressContext,
  type WaterEvidence,
} from '../water';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const shirt = (overrides: Partial<WaterEvidence>): WaterEvidence => ({
  basis: 'blue',
  litres: 1200,
  functionalUnit: 'per shirt',
  scope: 'category',
  sourceId: 'wfn-cotton',
  ...overrides,
});

export function verifyWaterEvidence() {
  // Unknown never becomes zero.
  assert(waterLabel(shirt({ litres: null })) === 'Unknown', 'missing litres must be Unknown');
  assert(waterLabel(shirt({ litres: -5 })) === 'Unknown', 'negative litres must be Unknown');
  assert(waterLabel(shirt({ sourceId: '' })) === 'Unknown', 'figures without a source must be Unknown');
  assert(resolveWaterFigure([], 'blue').litres === null, 'no evidence must stay null, not zero');

  // Category averages are Estimated; product or brand figures are Verified.
  assert(waterLabel(shirt({})) === 'Estimated', 'category average must be Estimated');
  assert(waterLabel(shirt({ scope: 'product' })) === 'Verified', 'product figure must be Verified');
  const mixed = resolveWaterFigure([shirt({}), shirt({ scope: 'brand', litres: 900, sourceId: 'brand-report' })], 'blue');
  assert(mixed.label === 'Verified' && mixed.litres === 900, 'product-specific evidence must win over category average');

  // Blue, green and grey are never summed into a total.
  const lifecycle = summarizeLifecycleWater([
    shirt({ basis: 'blue', litres: 1200 }),
    shirt({ basis: 'green', litres: 1500 }),
    shirt({ basis: 'grey', litres: 300 }),
  ]);
  const total = lifecycle.find(figure => figure.basis === 'total');
  assert(total?.litres === null && total.label === 'Unknown', 'total must stay Unknown unless a source reports it');
  const reported = summarizeLifecycleWater([shirt({ basis: 'total', litres: 2700 })]).find(figure => figure.basis === 'total');
  assert(reported?.litres === 2700, 'a source-reported total is shown as reported');

  // Conflicting sources stay Unknown and are flagged for review.
  const conflict = resolveWaterFigure([shirt({ litres: 1200 }), shirt({ litres: 2600, sourceId: 'other' })], 'blue');
  assert(conflict.litres === null && conflict.conflict, 'conflicting sources must stay Unknown and flagged');
  const units = resolveWaterFigure([shirt({}), shirt({ functionalUnit: 'per kg', sourceId: 'other' })], 'blue');
  assert(units.litres === null && units.conflict, 'mixed functional units must not be averaged');
  const agree = resolveWaterFigure([shirt({ litres: 1200 }), shirt({ litres: 1220, sourceId: 'other' })], 'blue');
  assert(agree.litres === 1210 && agree.sourceIds.length === 2, 'agreeing sources keep both citations');

  // Use-phase water only appears when there is evidence for it.
  assert(summarizeUsePhaseWater([shirt({})]).length === 0, 'non-water-using products show no use-phase figure');
  const washer = summarizeUsePhaseWater([shirt({ basis: 'use_per_cycle', litres: 48, functionalUnit: 'per cycle', scope: 'product', sourceId: 'eprel-123' })]);
  assert(washer.length === 1 && washer[0].label === 'Verified', 'labelled appliance water use is shown as Verified');

  // Comparisons refuse to rank when either side is unknown.
  const a = resolveWaterFigure([shirt({ litres: 1200 })], 'blue');
  const b = resolveWaterFigure([shirt({ litres: 600, sourceId: 'other-fibre' })], 'blue');
  assert(compareWater(a, b) === 'second_lower', 'lower-water option is identified when both sides are known');
  assert(compareWater(a, resolveWaterFigure([], 'blue')) === 'unknown', 'unknown side must not be ranked');
  assert(compareWater(a, resolveWaterFigure([shirt({ litres: 1150 })], 'blue')) === 'similar', 'close figures read as similar');
  assert(compareWater(a, units) === 'unknown', 'conflicting side must not be ranked');

  assert(formatLitres(null) === 'Unknown', 'null formats as Unknown');
  assert(formatLitres(2.5) === '2.5 L', 'small volumes keep one decimal');
  assert(formatLitres(1200) === '1.2 m³', 'large volumes use cubic metres');

  // Water stress is regional context only, and unknown stays unknown.
  const stressed = waterStressContext({ category: 'High (40-80%)', region: 'Punjab, India', sourceId: 'wri-aqueduct-4' });
  assert(stressed.level === 'high', 'Aqueduct category labels are recognized');
  assert(stressed.sentence === 'Sourced from Punjab, India, an area with high baseline water stress.', 'stress is phrased as regional context');
  assert(!/score|rating|rank|\d+\s*\/\s*100/i.test(stressed.sentence), 'stress context must not read as a product score');
  assert(waterStressContext({ category: 'High', region: null, sourceId: 'wri' }).level === null, 'unknown region stays unknown');
  assert(waterStressContext({ category: 'High', region: 'Punjab', sourceId: '' }).level === null, 'context without a source stays unknown');
  assert(waterStressContext({ category: 'severe-ish', region: 'Punjab', sourceId: 'wri' }).level === null, 'unrecognized categories stay unknown');
  assert(waterStressContext({ category: 'Extremely high', region: 'Murcia, Spain', sourceId: 'wri' }).level === 'extremely_high', 'case and spacing are tolerated');
  for (const inherited of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert(waterStressContext({ category: inherited, region: 'Punjab', sourceId: 'wri' }).level === null, `inherited object key "${inherited}" is not a stress level`);
  }
  // API rows are parsed defensively: nothing is guessed, missing stays null.
  const parsed = parseWaterEvidence([
    { basis: 'Blue', scope: 'category', functional_unit: 'per shirt', litres: '1200', source_id: 'wfn-cotton' },
    { basis: 'blue', scope: 'category', functional_unit: 'per shirt', litres: null, source_id: 'wfn-cotton' },
    { basis: 'purple', scope: 'category', functional_unit: 'per shirt', litres: 10, source_id: 'x' },
    { basis: 'green', scope: 'somewhere', functional_unit: 'per shirt', litres: 10, source_id: 'x' },
    { basis: 'grey', scope: 'product', litres: 10, source_id: 'x' },
    null,
    'not a row',
  ]);
  assert(parsed.length === 2, 'unrecognized basis, scope or missing unit is dropped');
  assert(parsed[0].basis === 'blue' && parsed[0].litres === 1200 && parsed[0].sourceId === 'wfn-cotton', 'snake_case rows are accepted');
  assert(parsed[1].litres === null && waterLabel(parsed[1]) === 'Unknown', 'missing litres stays Unknown after parsing');
  assert(parseWaterEvidence(undefined).length === 0 && parseWaterEvidence({}).length === 0, 'non-arrays parse to no evidence');

  assert(describeWaterFigure(resolveWaterFigure([], 'blue')) === 'Unknown', 'no evidence describes as Unknown');
  assert(describeWaterFigure(conflict).startsWith('Unknown'), 'conflicts describe as Unknown');
  assert(describeWaterFigure(a) === '1.2 m³ per shirt · Estimated · 1 source', 'figures carry unit, label and source count');
  assert(!/score|rating|rank/i.test(describeWaterFigure(a)), 'figure text must not read as a score');

  // Each figure says when its sources were last checked, and only real dates count.
  const dated = resolveWaterFigure([
    shirt({ litres: 1200, verifiedAt: '2026-03-01' }),
    shirt({ litres: 1210, sourceId: 'other', verifiedAt: '2026-09-15T10:00:00Z' }),
  ], 'blue');
  assert(dated.lastVerifiedAt === '2026-09-15', 'latest verification date is kept');
  assert(describeWaterFigure(dated).endsWith('· checked 2026-09-15'), 'figure text shows when it was checked');
  assert(latestVerifiedDate([shirt({ verifiedAt: 'last spring' })]) === null, 'unparseable dates are not guessed');
  assert(resolveWaterFigure([], 'blue').lastVerifiedAt == null, 'unknown figures carry no date');

  // Comparison text names the lower-water option only when both sides are known.
  assert(describeWaterComparison('Shirt A', 'Shirt B', a, b).startsWith('Shirt B likely involves less blue water than Shirt A.'), 'lower-water option is named');
  assert(describeWaterComparison('Shirt A', 'Shirt B', a, b).includes('category average'), 'estimated comparisons are hedged');
  const unknownText = describeWaterComparison('Shirt A', 'Shirt B', a, resolveWaterFigure([], 'blue'));
  assert(unknownText.includes('Not enough comparable') && unknownText.includes('Unknown does not mean low'), 'unknown comparisons do not rank');
  assert(!/score|rating|rank|%/i.test(describeWaterComparison('Shirt A', 'Shirt B', a, b)), 'comparison text must not read as a score');
  return true;
}
