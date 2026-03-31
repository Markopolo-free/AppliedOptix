export const isBankingInterestMvpEnabled = (): boolean => {
  const raw = String(import.meta.env.VITE_ENABLE_BANKING_INTEREST_MVP || '').trim().toLowerCase();
  if (!raw) return true;
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
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
  'ebppCampaigns',
] as const;