import {
  DayCountConvention,
  InterestAssignment,
  InterestProduct,
  InterestRateBook,
  InterestRateTier,
} from '../types';

export interface InterestCalculationTraceRow {
  date: string;
  openingPrincipal: number;
  appliedRate: number;
  dayFraction: number;
  dayInterest: number;
  closingPrincipal: number;
}

export interface InterestCalculationCoreResult {
  days: number;
  totalInterest: number;
  closingPrincipal: number;
  annualNominalRate: number;
  rateBookAtEnd: InterestRateBook;
  trace: InterestCalculationTraceRow[];
}

const parseIsoDate = (dateIso: string): Date => {
  return new Date(`${dateIso}T00:00:00Z`);
};

const toIsoDate = (date: Date): string => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

export const getDayFraction = (date: Date, convention: DayCountConvention): number => {
  if (convention === 'ACT/360') return 1 / 360;
  if (convention === 'ACT/365F') return 1 / 365;

  const day = Math.min(date.getUTCDate(), 30);
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDay = Math.min(next.getUTCDate(), 30);
  const nextMonth = next.getUTCMonth() + 1;
  const nextYear = next.getUTCFullYear();
  const diff = (nextYear - year) * 360 + (nextMonth - month) * 30 + (nextDay - day);
  return diff / 360;
};

export const resolveTierRate = (tiers: InterestRateTier[], principal: number, dateIso: string): number => {
  const inRange = (tier: InterestRateTier) => {
    const to = tier.tierToAmount == null ? Number.POSITIVE_INFINITY : tier.tierToAmount;
    return principal >= tier.tierFromAmount && principal < to;
  };

  const promo = tiers.find((tier) => {
    if (!tier.isPromotional) return false;
    if (!inRange(tier)) return false;
    if (tier.promoFrom && dateIso < tier.promoFrom) return false;
    if (tier.promoTo && dateIso > tier.promoTo) return false;
    return true;
  });
  if (promo) return promo.annualRatePercent;

  const standard = tiers.find((tier) => inRange(tier));
  return standard?.annualRatePercent || 0;
};

export const resolveRateBookForDate = (
  assignment: InterestAssignment,
  rateBooks: InterestRateBook[],
  calcDateIso: string
): InterestRateBook | null => {
  if (assignment.rateBookId) {
    return rateBooks.find((book) => book.id === assignment.rateBookId) || null;
  }

  return (
    rateBooks
      .filter((book) => book.productId === assignment.productId)
      .find((book) => {
        if (calcDateIso < book.effectiveFrom) return false;
        if (book.effectiveTo && calcDateIso > book.effectiveTo) return false;
        return true;
      }) || null
  );
};

export const calculateInterestPreview = (params: {
  assignment: InterestAssignment;
  product: InterestProduct;
  rateBooks: InterestRateBook[];
  principalStart: number;
  startDateIso: string;
  endDateIso: string;
  maxDays?: number;
}): { result?: InterestCalculationCoreResult; error?: string } => {
  const {
    assignment,
    product,
    rateBooks,
    principalStart,
    startDateIso,
    endDateIso,
    maxDays = 366,
  } = params;

  const start = parseIsoDate(startDateIso);
  const end = parseIsoDate(endDateIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Start and end dates are required.' };
  }
  if (start > end) {
    return { error: 'Start date must be before or equal to end date.' };
  }
  if (!Number.isFinite(principalStart) || principalStart < 0) {
    return { error: 'Principal must be a valid non-negative number.' };
  }

  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (dayCount > maxDays) {
    return { error: `Date range is too large for preview (max ${maxDays} days).` };
  }

  const roundingScale = product.roundingScale || 6;
  let runningPrincipal = principalStart;
  let totalInterest = 0;
  let weightedRateAccumulator = 0;
  const trace: InterestCalculationTraceRow[] = [];

  for (let i = 0; i < dayCount; i += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const dayIso = toIsoDate(day);

    const rateBook = resolveRateBookForDate(assignment, rateBooks, dayIso);
    if (!rateBook) {
      return { error: `No approved rate book found for date ${dayIso}.` };
    }

    const rate = resolveTierRate(rateBook.tiers || [], runningPrincipal, dayIso);
    const dayFraction = getDayFraction(day, product.dayCountConvention);
    const dayInterest = runningPrincipal * (rate / 100) * dayFraction;
    const roundedInterest = Number(dayInterest.toFixed(roundingScale));

    totalInterest += roundedInterest;
    weightedRateAccumulator += rate;

    let closingPrincipal = runningPrincipal;
    if (product.compounding === 'DAILY') {
      closingPrincipal = Number((runningPrincipal + roundedInterest).toFixed(roundingScale));
    }

    trace.push({
      date: dayIso,
      openingPrincipal: runningPrincipal,
      appliedRate: rate,
      dayFraction,
      dayInterest: roundedInterest,
      closingPrincipal,
    });

    runningPrincipal = closingPrincipal;
  }

  const rateBookAtEnd = resolveRateBookForDate(assignment, rateBooks, endDateIso);
  if (!rateBookAtEnd) {
    return { error: 'No valid rate book at end date.' };
  }

  return {
    result: {
      days: dayCount,
      totalInterest: Number(totalInterest.toFixed(roundingScale)),
      closingPrincipal: Number(runningPrincipal.toFixed(roundingScale)),
      annualNominalRate: Number((weightedRateAccumulator / dayCount).toFixed(6)),
      rateBookAtEnd,
      trace,
    },
  };
};
