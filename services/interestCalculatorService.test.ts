import { describe, expect, it } from 'vitest';
import {
  calculateInterestPreview,
  getDayFraction,
  resolveTierRate,
} from './interestCalculatorService';
import {
  InterestAssignment,
  InterestProduct,
  InterestRateBook,
  InterestRateTier,
} from '../types';

const baseProduct = (overrides: Partial<InterestProduct> = {}): InterestProduct => ({
  id: 'prod-1',
  productCode: 'SAV001',
  name: 'Savings Basic',
  productType: 'SAVINGS',
  currency: 'USD',
  dayCountConvention: 'ACT/360',
  accrualFrequency: 'DAILY',
  payoutFrequency: 'MONTHLY',
  compounding: 'NONE',
  roundingScale: 6,
  roundingMode: 'HALF_UP',
  allowNegativeRates: false,
  status: 'Approved',
  tenantId: 'tenant-1',
  lastModifiedBy: 'tester',
  lastModifiedAt: '2026-03-08T00:00:00.000Z',
  ...overrides,
});

const baseAssignment = (overrides: Partial<InterestAssignment> = {}): InterestAssignment => ({
  id: 'assign-1',
  accountId: 'ACC-1',
  productId: 'prod-1',
  productCode: 'SAV001',
  productName: 'Savings Basic',
  startDate: '2026-03-01',
  status: 'Approved',
  tenantId: 'tenant-1',
  lastModifiedBy: 'tester',
  lastModifiedAt: '2026-03-08T00:00:00.000Z',
  ...overrides,
});

const baseTier = (overrides: Partial<InterestRateTier> = {}): InterestRateTier => ({
  id: 'tier-1',
  tierFromAmount: 0,
  tierToAmount: null,
  annualRatePercent: 36,
  isPromotional: false,
  ...overrides,
});

const baseRateBook = (tiers: InterestRateTier[], overrides: Partial<InterestRateBook> = {}): InterestRateBook => ({
  id: 'rb-1',
  rateBookCode: 'RB-1',
  productId: 'prod-1',
  productCode: 'SAV001',
  productName: 'Savings Basic',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  tiers,
  status: 'Approved',
  version: 1,
  tenantId: 'tenant-1',
  lastModifiedBy: 'tester',
  lastModifiedAt: '2026-03-08T00:00:00.000Z',
  ...overrides,
});

describe('interestCalculatorService', () => {
  it('computes day fractions by convention', () => {
    const date = new Date('2026-01-31T00:00:00.000Z');
    expect(getDayFraction(date, 'ACT/360')).toBeCloseTo(1 / 360, 10);
    expect(getDayFraction(date, 'ACT/365F')).toBeCloseTo(1 / 365, 10);
    expect(getDayFraction(date, '30E/360')).toBeCloseTo(1 / 360, 10);
  });

  it('prefers promotional tier rate when date and balance match', () => {
    const tiers: InterestRateTier[] = [
      baseTier({ annualRatePercent: 5, tierFromAmount: 0, tierToAmount: 5000 }),
      baseTier({
        id: 'promo-tier',
        annualRatePercent: 8,
        tierFromAmount: 0,
        tierToAmount: 5000,
        isPromotional: true,
        promoFrom: '2026-03-01',
        promoTo: '2026-03-31',
      }),
    ];

    expect(resolveTierRate(tiers, 1000, '2026-03-08')).toBe(8);
    expect(resolveTierRate(tiers, 1000, '2026-04-01')).toBe(5);
  });

  it('includes the exact upper bound when no adjacent tier starts there', () => {
    const tiers: InterestRateTier[] = [
      baseTier({ annualRatePercent: 5, tierFromAmount: 0, tierToAmount: 10000 }),
    ];

    expect(resolveTierRate(tiers, 10000, '2026-03-25')).toBe(5);
  });

  it('prefers the next tier when principal hits a shared boundary', () => {
    const tiers: InterestRateTier[] = [
      baseTier({ id: 'tier-1', annualRatePercent: 5, tierFromAmount: 0, tierToAmount: 10000 }),
      baseTier({ id: 'tier-2', annualRatePercent: 7, tierFromAmount: 10000, tierToAmount: 50000 }),
    ];

    expect(resolveTierRate(tiers, 9999.99, '2026-03-25')).toBe(5);
    expect(resolveTierRate(tiers, 10000, '2026-03-25')).toBe(7);
  });

  it('calculates deterministic preview with daily compounding', () => {
    const product = baseProduct({ compounding: 'DAILY' });
    const assignment = baseAssignment();
    const rateBook = baseRateBook([baseTier({ annualRatePercent: 36 })]);

    const preview = calculateInterestPreview({
      assignment,
      product,
      rateBooks: [rateBook],
      principalStart: 1000,
      startDateIso: '2026-03-01',
      endDateIso: '2026-03-02',
    });

    expect(preview.error).toBeUndefined();
    expect(preview.result).toBeDefined();
    expect(preview.result?.days).toBe(2);
    expect(preview.result?.totalInterest).toBeCloseTo(2.001, 6);
    expect(preview.result?.closingPrincipal).toBeCloseTo(1002.001, 6);
    expect(preview.result?.annualNominalRate).toBe(36);
    expect(preview.result?.trace).toHaveLength(2);
    expect(preview.result?.trace[0].dayInterest).toBeCloseTo(1, 6);
    expect(preview.result?.trace[1].dayInterest).toBeCloseTo(1.001, 6);
  });

  it('keeps principal static when compounding is NONE', () => {
    const product = baseProduct({ compounding: 'NONE' });
    const assignment = baseAssignment();
    const rateBook = baseRateBook([baseTier({ annualRatePercent: 36 })]);

    const preview = calculateInterestPreview({
      assignment,
      product,
      rateBooks: [rateBook],
      principalStart: 1000,
      startDateIso: '2026-03-01',
      endDateIso: '2026-03-02',
    });

    expect(preview.result?.totalInterest).toBeCloseTo(2, 6);
    expect(preview.result?.closingPrincipal).toBe(1000);
  });

  it('returns a clear error when no rate book applies', () => {
    const product = baseProduct();
    const assignment = baseAssignment();

    const preview = calculateInterestPreview({
      assignment,
      product,
      rateBooks: [],
      principalStart: 1000,
      startDateIso: '2026-03-01',
      endDateIso: '2026-03-01',
    });

    expect(preview.result).toBeUndefined();
    expect(preview.error).toContain('No approved rate book found');
  });

  it('honors assignment rateBookId override selection', () => {
    const product = baseProduct({ compounding: 'NONE' });
    const assignment = baseAssignment({ rateBookId: 'rb-override' });

    const defaultBook = baseRateBook(
      [baseTier({ annualRatePercent: 2 })],
      {
        id: 'rb-default',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      }
    );

    const overrideBook = baseRateBook(
      [baseTier({ annualRatePercent: 36 })],
      {
        id: 'rb-override',
        effectiveFrom: '2025-01-01',
        effectiveTo: '2025-12-31',
      }
    );

    const preview = calculateInterestPreview({
      assignment,
      product,
      rateBooks: [defaultBook, overrideBook],
      principalStart: 1000,
      startDateIso: '2026-03-01',
      endDateIso: '2026-03-01',
    });

    expect(preview.error).toBeUndefined();
    expect(preview.result).toBeDefined();
    expect(preview.result?.annualNominalRate).toBe(36);
    expect(preview.result?.totalInterest).toBeCloseTo(1, 6);
    expect(preview.result?.rateBookAtEnd.id).toBe('rb-override');
  });

  it('returns error when assignment rateBookId override is missing', () => {
    const product = baseProduct({ compounding: 'NONE' });
    const assignment = baseAssignment({ rateBookId: 'rb-missing' });
    const defaultBook = baseRateBook([baseTier({ annualRatePercent: 4 })], { id: 'rb-default' });

    const preview = calculateInterestPreview({
      assignment,
      product,
      rateBooks: [defaultBook],
      principalStart: 1000,
      startDateIso: '2026-03-01',
      endDateIso: '2026-03-01',
    });

    expect(preview.result).toBeUndefined();
    expect(preview.error).toContain('No approved rate book found');
  });

  it('applies the configured tier rate when principal equals the tier upper bound', () => {
    const product = baseProduct({
      compounding: 'NONE',
      dayCountConvention: 'ACT/365F',
      roundingScale: 6,
    });
    const assignment = baseAssignment();
    const rateBook = baseRateBook([
      baseTier({ annualRatePercent: 5, tierFromAmount: 0, tierToAmount: 10000 }),
    ]);

    const preview = calculateInterestPreview({
      assignment,
      product,
      rateBooks: [rateBook],
      principalStart: 10000,
      startDateIso: '2026-03-25',
      endDateIso: '2026-03-25',
    });

    expect(preview.error).toBeUndefined();
    expect(preview.result).toBeDefined();
    expect(preview.result?.annualNominalRate).toBe(5);
    expect(preview.result?.trace[0].appliedRate).toBe(5);
    expect(preview.result?.totalInterest).toBeCloseTo(1.369863, 6);
  });
});
