export const isBankingInterestMvpEnabled = (): boolean => {
  return String(import.meta.env.VITE_ENABLE_BANKING_INTEREST_MVP || '').toLowerCase() === 'true';
};

export const BANKING_INTEREST_MVP_VIEWS = [
  'interestProducts',
  'interestRateBooks',
  'interestApprovals',
  'interestAssignments',
  'interestCalculator',
  'interestResults',
  'interestReconciliation',
  'interestAudit',
] as const;