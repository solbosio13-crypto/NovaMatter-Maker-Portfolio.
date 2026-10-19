import type { AgeBand, ChatMessage, Domain, WellnessEntry } from '@/types';
import { localDateKey } from './local-date';

export type ReplyStyle = 'concise' | 'standard' | 'detailed';

export type AdaptiveCommunicationProfile = {
  detail: ReplyStyle;
  structure: 'conversational' | 'balanced' | 'structured';
  directness: 'direct' | 'balanced' | 'exploratory';
  initiative: 'reactive' | 'balanced' | 'proactive';
  acknowledgement: 'minimal' | 'normal';
  basis: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function recent<T extends { createdAt: string }>(items: T[], days: number, nowMs: number) {
  const cutoff = nowMs - days * DAY_MS;
  return items.filter(item => {
    const time = Date.parse(item.createdAt);
    return Number.isFinite(time) && time >= cutoff && time <= nowMs + 5 * 60 * 1000;
  });
}

function cleanLabel(value: unknown, max = 64) {
  return String(value ?? '').replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function deriveReplyStyle(messages: ChatMessage[]): ReplyStyle {
  const user = messages.filter(message => message.role === 'user').slice(-6);
  if (!user.length) return 'standard';
  const lengths = user.map(message => String(message.text ?? '').trim().length).sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)] ?? 0;
  if (median <= 80) return 'concise';
  if (median >= 420) return 'detailed';
  return 'standard';
}

export function buildAutomaticPersonalizationSummary(
  domain: Domain,
  messages: ChatMessage[],
  entries: WellnessEntry[],
  ageBand: AgeBand,
  nowMs = Date.now(),
): string[] {
  const recentMessages = recent(messages, 14, nowMs).filter(message => message.role === 'user');
  const recentEntries = recent(entries, 14, nowMs);
  const activeDays = new Set([
    ...recentMessages.map(message => localDateKey(message.createdAt)),
    ...recentEntries.map(entry => localDateKey(entry.createdAt)),
  ]).size;

  const lines: string[] = [
    `Same-domain activity over the last 14 days: ${recentMessages.length} user message${recentMessages.length === 1 ? '' : 's'} and ${recentEntries.length} structured log${recentEntries.length === 1 ? '' : 's'} across ${activeDays} active day${activeDays === 1 ? '' : 's'}.`,
  ];

  const recentTopics = [...new Set(
    recentEntries
      .slice(-8)
      .map(entry => cleanLabel(entry.title))
      .filter(Boolean),
  )].slice(-3);
  if (recentTopics.length) lines.push(`Recent recorded topics: ${recentTopics.join('; ')}.`);

  const metricLabels = recentEntries
    .map(entry => cleanLabel(entry.metricLabel, 32).toLowerCase())
    .filter(Boolean);
  const uniqueMetrics = [...new Set(metricLabels)].slice(0, 4);
  if (uniqueMetrics.length) {
    if (domain === 'nutrition' && ageBand === 'teen' && uniqueMetrics.includes('calories')) {
      const nonCalorie = uniqueMetrics.filter(label => label !== 'calories');
      lines.push(`Structured nutrition tracking fields used: ${['optional calorie field', ...nonCalorie].join(', ')}. Do not infer adequacy, deficit, weight-loss targets, or compensation from this.`);
    } else {
      lines.push(`Structured tracking fields used recently: ${uniqueMetrics.join(', ')}. Values are not included in this compact summary.`);
    }
  }

  if (domain === 'mind') {
    lines.push('Mind personalization is descriptive only: do not infer diagnoses, motives, personality traits, or causes from repetition or wording.');
  } else if (domain === 'health') {
    lines.push('Health personalization is organizational only: do not infer a diagnosis, severity, or treatment need from this compact activity summary.');
  } else if (domain === 'nutrition') {
    lines.push('Nutrition personalization must support adequate nourishment and neutral food language; never use this summary to create restrictive targets or compensation rules.');
  } else if (domain === 'movement') {
    lines.push('Movement personalization must not turn frequency into pressure for more training or use exercise as compensation for food.');
  } else {
    lines.push('Life personalization should support priorities and tradeoffs without treating recorded consistency as a requirement to optimize more.');
  }

  return lines.slice(0, 5);
}


function ratio(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

export function deriveAdaptiveCommunicationProfile(messages: ChatMessage[]): AdaptiveCommunicationProfile {
  const recentUser = messages.filter(message => message.role === 'user').slice(-8);
  const detail = deriveReplyStyle(messages);
  if (!recentUser.length) {
    return {
      detail,
      structure: 'balanced',
      directness: 'balanced',
      initiative: 'balanced',
      acknowledgement: 'normal',
      basis: ['No recent user language available; use selected assistant settings.'],
    };
  }

  const texts = recentUser.map(message => String(message.text ?? '').trim()).filter(Boolean);
  const joined = texts.join('\n');
  const structuredSignals = texts.filter(text => /(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+/m.test(text) || text.split('\n').filter(Boolean).length >= 3).length;
  const directSignals = texts.filter(text => /\b(be direct|just answer|just tell me|no need to explain|keep it short|concise|skip the preamble|bottom line)\b/i.test(text)).length;
  const exploratorySignals = texts.filter(text => /\b(walk me through|explain why|help me think|talk it through|reason through|pros and cons|what am i missing)\b/i.test(text)).length;
  const proactiveSignals = texts.filter(text => /\b(next steps|what should i do|make a plan|plan this|help me decide|give me actions|what now|recommend a routine)\b/i.test(text)).length;
  const reactiveSignals = texts.filter(text => /\b(just listen|don't advise|do not advise|no advice|only answer|answer only|don't add|do not add)\b/i.test(text)).length;
  const minimalAckSignals = texts.filter(text => /\b(don't repeat|do not repeat|don't rephrase|do not rephrase|stop repeating|no recap|skip recap)\b/i.test(text)).length;

  const structure = ratio(structuredSignals, texts.length) >= 0.34 || detail === 'detailed'
    ? 'structured'
    : ratio(structuredSignals, texts.length) === 0 && detail === 'concise'
      ? 'conversational'
      : 'balanced';

  const directness = directSignals > exploratorySignals
    ? 'direct'
    : exploratorySignals > directSignals
      ? 'exploratory'
      : 'balanced';

  const initiative = proactiveSignals > reactiveSignals
    ? 'proactive'
    : reactiveSignals > proactiveSignals
      ? 'reactive'
      : 'balanced';

  const acknowledgement = minimalAckSignals > 0 ? 'minimal' : 'normal';
  const basis: string[] = [];
  basis.push(`Observed recent message length supports ${detail} responses.`);
  if (structure !== 'balanced') basis.push(`Observable formatting supports a ${structure} response shape.`);
  if (directness !== 'balanced') basis.push(`Explicit wording supports a ${directness} delivery style.`);
  if (initiative !== 'balanced') basis.push(`Explicit requests support a ${initiative} level of initiative.`);
  if (acknowledgement === 'minimal') basis.push('The user explicitly asked to reduce repetition or recap.');

  return { detail, structure, directness, initiative, acknowledgement, basis: basis.slice(0, 5) };
}
