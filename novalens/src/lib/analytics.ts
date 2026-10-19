export type SeriesSummary = {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  variance: number;
  standardDeviation: number;
  coefficientOfVariation: number | null;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  iqr: number;
  mad: number;
  percentChange: number | null;
  cagr: number | null;
  trendSlope: number;
  trendIntercept: number;
  trendR2: number;
  volatility: number;
  maxDrawdown: number;
  outlierIndexes: number[];
  zScores: number[];
  minMaxNormalized: number[];
  rollingAverage: number[];
  forecast1: number | null;
  forecast3: number | null;
  forecast6: number | null;
};

export type PairSummary = {
  pairedCount: number;
  correlation: number | null;
  regressionSlope: number | null;
  regressionIntercept: number | null;
  regressionR2: number | null;
  meanAbsoluteError: number | null;
};

const finite = (value: number) => Number.isFinite(value) ? value : 0;

export function parseNumberSeries(input: string) {
  return input
    .split(/[\s,;|\n\r\t]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function sorted(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const s = sorted(values);
  const position = (s.length - 1) * Math.min(1, Math.max(0, q));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return s[lower];
  const weight = position - lower;
  return s[lower] * (1 - weight) + s[upper] * weight;
}

function linearRegression(y: number[]) {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0, r2: 0 };
  const xMean = (n - 1) / 2;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let sst = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - xMean;
    const dy = y[i] - yMean;
    sxx += dx * dx;
    sxy += dx * dy;
    sst += dy * dy;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = yMean - slope * xMean;
  let sse = 0;
  for (let i = 0; i < n; i += 1) {
    const residual = y[i] - (intercept + slope * i);
    sse += residual * residual;
  }
  const r2 = sst > 0 ? Math.max(0, Math.min(1, 1 - sse / sst)) : 1;
  return { slope, intercept, r2 };
}

function rollingAverage(values: number[], window = 3) {
  if (!values.length) return [];
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function maxDrawdown(values: number[]) {
  if (values.length < 2) return 0;
  let peak = values[0];
  let worst = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    if (peak !== 0) worst = Math.min(worst, (value - peak) / Math.abs(peak));
  }
  return Math.abs(worst) * 100;
}

export function analyzeSeries(raw: number[]): SeriesSummary {
  const values = raw.filter(Number.isFinite);
  const count = values.length;
  if (!count) {
    return {
      count: 0, sum: 0, min: 0, max: 0, mean: 0, median: 0, variance: 0,
      standardDeviation: 0, coefficientOfVariation: null, p10: 0, p25: 0, p75: 0,
      p90: 0, iqr: 0, mad: 0, percentChange: null, cagr: null, trendSlope: 0,
      trendIntercept: 0, trendR2: 0, volatility: 0, maxDrawdown: 0, outlierIndexes: [],
      zScores: [], minMaxNormalized: [], rollingAverage: [], forecast1: null, forecast3: null,
      forecast6: null,
    };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const variance = count > 1
    ? values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / (count - 1)
    : 0;
  const standardDeviation = Math.sqrt(variance);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const median = quantile(values, 0.5);
  const deviations = values.map((value) => Math.abs(value - median));
  const mad = quantile(deviations, 0.5);
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const outlierIndexes = values
    .map((value, index) => value < lowerFence || value > upperFence ? index : -1)
    .filter((index) => index >= 0);
  const zScores = values.map((value) => standardDeviation > 0 ? (value - mean) / standardDeviation : 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minMaxNormalized = values.map((value) => max !== min ? (value - min) / (max - min) : 0);
  const regression = linearRegression(values);
  const first = values[0];
  const last = values[count - 1];
  const percentChange = count > 1 && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  const cagr = count > 1 && first > 0 && last >= 0
    ? (Math.pow(last / first, 1 / (count - 1)) - 1) * 100
    : null;

  const periodReturns: number[] = [];
  for (let i = 1; i < count; i += 1) {
    const previous = values[i - 1];
    if (previous !== 0) periodReturns.push((values[i] - previous) / Math.abs(previous));
  }
  const returnMean = periodReturns.length ? periodReturns.reduce((a, b) => a + b, 0) / periodReturns.length : 0;
  const returnVariance = periodReturns.length > 1
    ? periodReturns.reduce((acc, value) => acc + Math.pow(value - returnMean, 2), 0) / (periodReturns.length - 1)
    : 0;

  const forecastAt = (steps: number) => count >= 2
    ? regression.intercept + regression.slope * (count - 1 + steps)
    : null;

  return {
    count,
    sum,
    min,
    max,
    mean,
    median,
    variance,
    standardDeviation,
    coefficientOfVariation: mean !== 0 ? Math.abs(standardDeviation / mean) * 100 : null,
    p10: quantile(values, 0.1),
    p25: q1,
    p75: q3,
    p90: quantile(values, 0.9),
    iqr,
    mad,
    percentChange,
    cagr,
    trendSlope: regression.slope,
    trendIntercept: regression.intercept,
    trendR2: regression.r2,
    volatility: Math.sqrt(returnVariance) * 100,
    maxDrawdown: maxDrawdown(values),
    outlierIndexes,
    zScores,
    minMaxNormalized,
    rollingAverage: rollingAverage(values, Math.min(5, Math.max(2, Math.round(Math.sqrt(count))))),
    forecast1: forecastAt(1),
    forecast3: forecastAt(3),
    forecast6: forecastAt(6),
  };
}

export function analyzePair(aRaw: number[], bRaw: number[]): PairSummary {
  const n = Math.min(aRaw.length, bRaw.length);
  const a = aRaw.slice(0, n).filter(Number.isFinite);
  const b = bRaw.slice(0, n).filter(Number.isFinite);
  const pairedCount = Math.min(a.length, b.length);
  if (pairedCount < 2) {
    return { pairedCount, correlation: null, regressionSlope: null, regressionIntercept: null, regressionR2: null, meanAbsoluteError: null };
  }

  const x = a.slice(0, pairedCount);
  const y = b.slice(0, pairedCount);
  const xMean = x.reduce((s, v) => s + v, 0) / pairedCount;
  const yMean = y.reduce((s, v) => s + v, 0) / pairedCount;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < pairedCount; i += 1) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const correlation = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  const regressionSlope = sxx > 0 ? sxy / sxx : null;
  const regressionIntercept = regressionSlope !== null ? yMean - regressionSlope * xMean : null;
  const regressionR2 = correlation === null ? null : correlation * correlation;
  const meanAbsoluteError = regressionSlope === null || regressionIntercept === null
    ? null
    : y.reduce((acc, value, index) => acc + Math.abs(value - (regressionIntercept + regressionSlope * x[index])), 0) / pairedCount;

  return { pairedCount, correlation, regressionSlope, regressionIntercept, regressionR2, meanAbsoluteError };
}

export function scenarioRange(base: number, uncertaintyPercent: number) {
  const amount = Math.abs(finite(base));
  const uncertainty = Math.min(100, Math.max(0, finite(uncertaintyPercent))) / 100;
  return {
    low: amount * (1 - uncertainty),
    base: amount,
    high: amount * (1 + uncertainty),
  };
}
