import { CustomerActivity, Service, PricingRule, Campaign, LoyaltyProgram, Bundle } from '../types';

export interface PricingReport {
  activityId: string;
  defaultPrice: number;
  finalPrice: number;
  reason: string;
}

// This is a stub for the pricing logic. You will need to fetch all relevant data from Firebase and implement the logic for rules, campaigns, loyalty, bundles.
export async function calculatePricing(
  activity: CustomerActivity,
  services: Service[],
  pricingRules: PricingRule[],
  campaigns: Campaign[],
  loyaltyPrograms: LoyaltyProgram[],
  bundles: Bundle[]
): Promise<PricingReport> {
  // Find the default price from Service Management
  const service = services.find(s => s.id === activity.serviceId);
  const defaultPrice = service ? service.price : 0;
  let finalPrice = defaultPrice;
  let reason = 'Default price applied.';

  // Example logic: apply pricing rule if available
  const applicableRule = pricingRules.find(rule => rule.serviceIds.includes(activity.serviceId));
  if (applicableRule) {
    finalPrice = applicableRule.rate;
    reason = `Pricing rule applied: ${applicableRule.description}`;
  }

  // Example: apply campaign discount
  const applicableCampaign = campaigns.find(camp => camp.serviceIds.includes(activity.serviceId));
  if (applicableCampaign) {
    finalPrice -= applicableCampaign.discountValue;
    reason += `; Campaign discount applied: ${applicableCampaign.name}`;
  }

  // Example: apply loyalty program
  const applicableLoyalty = loyaltyPrograms.find(lp => lp.cityName === activity.city);
  if (applicableLoyalty) {
    finalPrice -= applicableLoyalty.pointsPerEuro;
    reason += `; Loyalty points applied.`;
  }

  // Example: apply bundle discount
  const applicableBundle = bundles.find(b => b.serviceIds.includes(activity.serviceId));
  if (applicableBundle) {
    finalPrice -= applicableBundle.discountValue;
    reason += `; Bundle discount applied: ${applicableBundle.name}`;
  }

  // Ensure final price is not negative
  finalPrice = Math.max(finalPrice, 0);

  // If final price differs from default, explain why
  if (finalPrice !== defaultPrice) {
    reason += `; Price differs from default.`;
  }

  return {
    activityId: activity.id,
    defaultPrice,
    finalPrice,
    reason,
  };
}
