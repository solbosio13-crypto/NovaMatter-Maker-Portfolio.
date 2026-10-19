export type CashFlowAnalysis = {
  npv: number;
  irr: number | null;
  profitabilityIndex: number | null;
  discountedPaybackPeriod: number | null;
};

export type LoanAmortizationSummary = {
  payment: number;
  totalPaid: number;
  totalInterest: number;
  effectiveInterestShare: number;
  schedule: { month: number; principal: number; interest: number; balance: number }[];
};

const finite = (n: number) => Number.isFinite(n) ? n : 0;

export function npv(ratePercent: number, cashFlows: number[]) {
  const r = finite(ratePercent) / 100;
  return cashFlows.reduce((sum, value, index) => sum + finite(value) / Math.pow(1 + r, index), 0);
}

export function irr(cashFlows: number[]) {
  if (cashFlows.length < 2 || !cashFlows.some((v) => v < 0) || !cashFlows.some((v) => v > 0)) return null;
  let low = -0.99;
  let high = 10;
  const value = (r: number) => cashFlows.reduce((sum, flow, index) => sum + flow / Math.pow(1 + r, index), 0);
  let lowValue = value(low);
  let highValue = value(high);
  if (lowValue * highValue > 0) return null;
  for (let i = 0; i < 120; i += 1) {
    const mid = (low + high) / 2;
    const midValue = value(mid);
    if (Math.abs(midValue) < 1e-8) return mid * 100;
    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }
  return ((low + high) / 2) * 100;
}

export function analyzeCashFlows(ratePercent: number, cashFlows: number[]): CashFlowAnalysis {
  const discounted = cashFlows.map((flow, index) => finite(flow) / Math.pow(1 + finite(ratePercent) / 100, index));
  const initialOutflow = Math.abs(Math.min(0, cashFlows[0] ?? 0));
  const futureInflowsPv = discounted.slice(1).filter((v) => v > 0).reduce((a, b) => a + b, 0);
  let cumulative = discounted[0] ?? 0;
  let discountedPaybackPeriod: number | null = cumulative >= 0 ? 0 : null;
  for (let i = 1; i < discounted.length && discountedPaybackPeriod === null; i += 1) {
    const before = cumulative;
    cumulative += discounted[i];
    if (cumulative >= 0 && discounted[i] > 0) {
      discountedPaybackPeriod = (i - 1) + Math.min(1, Math.abs(before) / discounted[i]);
    }
  }
  return {
    npv: discounted.reduce((a, b) => a + b, 0),
    irr: irr(cashFlows),
    profitabilityIndex: initialOutflow > 0 ? futureInflowsPv / initialOutflow : null,
    discountedPaybackPeriod,
  };
}

export function amortizeLoan(principalInput: number, aprPercent: number, monthsInput: number): LoanAmortizationSummary {
  const principal = Math.max(0, finite(principalInput));
  const months = Math.max(1, Math.min(600, Math.round(finite(monthsInput) || 1)));
  const monthlyRate = Math.max(0, finite(aprPercent)) / 100 / 12;
  const payment = principal === 0 ? 0 : monthlyRate === 0
    ? principal / months
    : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
  let balance = principal;
  const schedule = [];
  for (let month = 1; month <= months; month += 1) {
    const interest = balance * monthlyRate;
    const principalPaid = month === months ? balance : Math.min(balance, Math.max(0, payment - interest));
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ month, principal: principalPaid, interest, balance });
  }
  const totalPaid = schedule.reduce((sum, row) => sum + row.principal + row.interest, 0);
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
  return {
    payment,
    totalPaid,
    totalInterest,
    effectiveInterestShare: totalPaid > 0 ? totalInterest / totalPaid * 100 : 0,
    schedule,
  };
}

export function straightLineDepreciation(costInput: number, salvageInput: number, yearsInput: number) {
  const cost = Math.max(0, finite(costInput));
  const salvage = Math.min(cost, Math.max(0, finite(salvageInput)));
  const years = Math.max(1, Math.round(finite(yearsInput) || 1));
  const annual = (cost - salvage) / years;
  return Array.from({ length: years + 1 }, (_, year) => ({ year, bookValue: Math.max(salvage, cost - annual * year) }));
}

export function decliningBalanceDepreciation(costInput: number, salvageInput: number, yearsInput: number) {
  const cost = Math.max(0, finite(costInput));
  const salvage = Math.min(cost, Math.max(0, finite(salvageInput)));
  const years = Math.max(1, Math.round(finite(yearsInput) || 1));
  if (cost <= 0) return [{ year: 0, bookValue: 0 }];
  const rate = salvage > 0 ? 1 - Math.pow(salvage / cost, 1 / years) : 1 - Math.pow(0.01, 1 / years);
  return Array.from({ length: years + 1 }, (_, year) => ({ year, bookValue: Math.max(salvage, cost * Math.pow(1 - rate, year)) }));
}

export function warrantyExpectedValue(warrantyCostInput: number, failureProbabilityPercent: number, coveredLossInput: number) {
  const warrantyCost = Math.max(0, finite(warrantyCostInput));
  const probability = Math.min(1, Math.max(0, finite(failureProbabilityPercent) / 100));
  const coveredLoss = Math.max(0, finite(coveredLossInput));
  const expectedCoveredLoss = probability * coveredLoss;
  return {
    expectedCoveredLoss,
    netExpectedValue: expectedCoveredLoss - warrantyCost,
    breakEvenFailureProbability: coveredLoss > 0 ? Math.min(100, warrantyCost / coveredLoss * 100) : null,
  };
}

export function repairVsReplace(input: {
  repairCost: number;
  expectedYearsAfterRepair: number;
  repairAnnualOperatingCost: number;
  replacementCost: number;
  replacementYears: number;
  replacementAnnualOperatingCost: number;
}) {
  const repairYears = Math.max(1, finite(input.expectedYearsAfterRepair));
  const replacementYears = Math.max(1, finite(input.replacementYears));
  const repairAnnualized = (Math.max(0, finite(input.repairCost)) / repairYears) + Math.max(0, finite(input.repairAnnualOperatingCost));
  const replacementAnnualized = (Math.max(0, finite(input.replacementCost)) / replacementYears) + Math.max(0, finite(input.replacementAnnualOperatingCost));
  return {
    repairAnnualized,
    replacementAnnualized,
    annualizedSavingsFromRepair: replacementAnnualized - repairAnnualized,
    preferred: repairAnnualized < replacementAnnualized ? 'repair' as const : replacementAnnualized < repairAnnualized ? 'replace' as const : 'tie' as const,
  };
}

export function cashVsFinanceOpportunityCost(input: {
  cashPrice: number;
  downPayment: number;
  aprPercent: number;
  months: number;
  alternativeReturnPercent: number;
}) {
  const cashPrice = Math.max(0, finite(input.cashPrice));
  const loan = amortizeLoan(Math.max(0, cashPrice - Math.max(0, finite(input.downPayment))), input.aprPercent, input.months);
  const years = Math.max(1 / 12, Math.max(1, finite(input.months)) / 12);
  const investableCash = Math.max(0, cashPrice - Math.max(0, finite(input.downPayment)));
  const futureValueIfInvested = investableCash * Math.pow(1 + finite(input.alternativeReturnPercent) / 100, years);
  const investmentGain = futureValueIfInvested - investableCash;
  return {
    financeInterestCost: loan.totalInterest,
    estimatedInvestmentGain: investmentGain,
    netOpportunityAdvantage: investmentGain - loan.totalInterest,
  };
}
