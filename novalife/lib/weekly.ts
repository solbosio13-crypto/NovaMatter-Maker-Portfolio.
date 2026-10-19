import type { ChatMessage, Domain, LifeDomain, LifePermissions, WellnessEntry, WeeklyReview } from '@/types';

const titles: Record<Domain, string> = {
  nutrition: 'Your nutrition week', movement: 'Your movement week', mind: 'Your reflection week', health: 'Your health week', life: 'Your week in context',
};

// Same rule as lib/local-date.ts, kept inline so `node --test` can load this file without a
// module resolver. Local calendar day, not the UTC day from createdAt.slice(0, 10).
export function localDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function withinWeek(value: string) {
  return new Date(value).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000;
}

export function buildWeeklyReview(domain: Domain, messages: ChatMessage[], entries: WellnessEntry[]): WeeklyReview {
  const recentMessages = messages.filter(message => withinWeek(message.createdAt));
  const recentEntries = entries.filter(entry => withinWeek(entry.createdAt));
  const userMessages = recentMessages.filter(message => message.role === 'user');
  const activeDays = new Set([...userMessages.map(message => localDateKey(message.createdAt)), ...recentEntries.map(entry => localDateKey(entry.createdAt))]).size;

  if (!userMessages.length && !recentEntries.length) {
    return {
      domain,
      title: titles[domain],
      summary: 'There is not enough recorded activity for a meaningful weekly analysis yet.',
      insights: [
        { label: 'Observed', text: 'No user messages or structured logs were recorded in this specialist during the last seven days.' },
        { label: 'Pattern', text: 'No pattern is claimed from missing data.' },
        { label: 'Uncertain', text: 'NovaLife cannot infer what happened outside the information you chose to record.' },
        { label: 'Next step', text: 'Use this specialist naturally; the review will become more useful as real data accumulates.' },
      ],
    };
  }

  let observed = `${userMessages.length} conversation message${userMessages.length === 1 ? '' : 's'} and ${recentEntries.length} structured log${recentEntries.length === 1 ? '' : 's'} were recorded across ${activeDays} day${activeDays === 1 ? '' : 's'}.`;
  let pattern = activeDays >= 3 ? 'Use occurred on multiple days, which supports a consistency observation but not a causal conclusion.' : 'There is not yet enough repeated activity to claim a stable weekly pattern.';
  let uncertain = 'Recorded activity is incomplete by definition; unlogged behavior should not be treated as absent behavior.';
  let next = 'Keep recording only the information that improves your decisions.';

  if (domain === 'nutrition') {
    const calorieEntries = recentEntries.filter(entry => entry.metricLabel === 'calories' && entry.metric != null);
    observed = `${recentEntries.length} meal or food log${recentEntries.length === 1 ? ' was' : 's were'} recorded${calorieEntries.length ? `; ${calorieEntries.length} included optional calorie data` : ''}.`;
    pattern = activeDays >= 3 ? 'Nutrition logging occurred on multiple days. NovaLife does not interpret higher or lower calories as better without appropriate context.' : 'There is not enough repeated nutrition data to describe a reliable pattern.';
    uncertain = 'Missing meal logs cannot be treated as skipped meals, and calorie entries do not establish nutritional adequacy.';
    next = 'Use the log for awareness and planning rather than punishment or compensation.';
  } else if (domain === 'movement') {
    const minuteEntries = recentEntries.filter(entry => entry.metricLabel === 'minutes' && entry.metric != null);
    const totalMinutes = minuteEntries.reduce((sum, entry) => sum + (entry.metric ?? 0), 0);
    observed = `${recentEntries.length} movement session${recentEntries.length === 1 ? ' was' : 's were'} logged${minuteEntries.length ? `, with ${Math.round(totalMinutes)} recorded minutes` : ''}.`;
    pattern = activeDays >= 3 ? 'Movement was recorded across multiple days. More volume is not automatically better; recovery and context matter.' : 'There is not enough repeated movement data to infer a training pattern.';
    uncertain = 'Unlogged recovery, pain, intensity, and medical context limit what can be concluded from minutes alone.';
    next = 'Use the Movement AI to adapt the next session to recovery and current goals.';
  } else if (domain === 'mind') {
    observed = `${userMessages.length} reflection message${userMessages.length === 1 ? '' : 's'} and ${recentEntries.length} quick reflection${recentEntries.length === 1 ? '' : 's'} were recorded.`;
    pattern = userMessages.length >= 3 ? 'There is enough repeated reflection to look for themes, but motives and diagnoses should not be inferred from frequency alone.' : 'There is not enough repeated reflection to claim a stable psychological pattern.';
    uncertain = 'Other people’s internal states and the causes of your own reactions remain uncertain unless supported by evidence.';
    next = 'When useful, ask for competing explanations instead of forcing one interpretation.';
  } else if (domain === 'health') {
    observed = `${recentEntries.length} health note${recentEntries.length === 1 ? '' : 's'} and ${userMessages.length} health question${userMessages.length === 1 ? '' : 's'} were recorded.`;
    pattern = recentEntries.length >= 3 ? 'Repeated health notes can help organize a timeline, but they are not enough to diagnose a condition.' : 'There is not enough repeated health data to describe a reliable trend.';
    uncertain = 'Symptoms, sleep, labs, and medications require clinical context that the app may not have.';
    next = 'Keep the timeline clear enough to share with a clinician when needed.';
  } else if (domain === 'life') {
    observed = `${recentEntries.length} life note${recentEntries.length === 1 ? '' : 's'} and ${userMessages.length} planning message${userMessages.length === 1 ? '' : 's'} were recorded.`;
    pattern = activeDays >= 3 ? 'Planning activity appeared on multiple days. NovaLife should not turn consistency into a demand for constant optimization.' : 'There is not enough repeated information to claim a broad life pattern.';
    uncertain = 'Cross-domain relationships are correlations unless stronger evidence supports causation.';
    next = 'Protect one useful priority rather than optimizing every part of life at once.';
  }

  return {
    domain,
    title: titles[domain],
    summary: 'This review uses only information recorded in NovaLife during the last seven days and avoids filling gaps with assumptions.',
    insights: [
      { label: 'Observed', text: observed },
      { label: 'Pattern', text: pattern },
      { label: 'Uncertain', text: uncertain },
      { label: 'Next step', text: next },
    ],
  };
}

export function buildPermissionedLifeContext(
  messages: Record<Domain, ChatMessage[]>,
  entries: Record<Domain, WellnessEntry[]>,
  permissions: LifePermissions,
) {
  const domains: LifeDomain[] = ['nutrition', 'movement', 'mind', 'health'];
  return domains.filter(domain => permissions[domain]).map(domain => {
    const review = buildWeeklyReview(domain, messages[domain] ?? [], entries[domain] ?? []);
    const observed = review.insights.find(item => item.label === 'Observed')?.text ?? review.summary;
    const uncertain = review.insights.find(item => item.label === 'Uncertain')?.text ?? '';
    return `${domain.toUpperCase()} weekly summary — ${observed} Uncertainty: ${uncertain}`;
  });
}

export function buildLifeWeeklyReview(
  messages: Record<Domain, ChatMessage[]>,
  entries: Record<Domain, WellnessEntry[]>,
  permissions: LifePermissions,
): WeeklyReview {
  const base = buildWeeklyReview('life', messages.life ?? [], entries.life ?? []);
  const allowed = (Object.keys(permissions) as LifeDomain[]).filter(domain => permissions[domain]);
  const active = allowed.filter(domain => {
    const review = buildWeeklyReview(domain, messages[domain] ?? [], entries[domain] ?? []);
    return !review.summary.startsWith('There is not enough recorded activity');
  });
  if (!allowed.length) return base;
  return {
    ...base,
    summary: `Life may use weekly summaries from ${allowed.join(', ')} because you enabled those permissions. Raw specialist chats are not automatically shared.`,
    insights: [
      { label: 'Observed', text: active.length ? `${active.length} permissioned specialist area${active.length === 1 ? '' : 's'} had recorded activity in the last seven days: ${active.join(', ')}.` : 'None of the permissioned specialist areas had enough recorded activity this week to add cross-domain context.' },
      { label: 'Pattern', text: active.length >= 2 ? 'Multiple domains have data available for comparison, but co-occurring changes should not be treated as causal.' : 'There is not enough cross-domain activity to claim a broad pattern.' },
      { label: 'Uncertain', text: 'Life receives compact weekly summaries only. Missing records, private unshared conversations, and outside events remain unknown.' },
      { label: 'Next step', text: 'Use Life to compare priorities only when cross-domain context is genuinely useful; you can turn any sharing permission off.' },
    ],
  };
}
