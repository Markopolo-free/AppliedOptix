// Helper: Filter out expired activities based on a date range
export function filterActivitiesByDateRange(activities: CustomerActivity[], startDate: string, endDate: string): CustomerActivity[] {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return activities.filter(a => {
    const ts = new Date(a.timestamp).getTime();
    return ts >= start && ts <= end;
  });
}

// Bundle qualification using only valid activities
export function qualifiesForBundle(activities: CustomerActivity[], bundle: Bundle): boolean {
  const validActivities = filterActivitiesByDateRange(activities, bundle.startDate, bundle.endDate);
  const usedServiceIds = new Set(validActivities.map(a => a.serviceId));
  return bundle.serviceIds.every(id => usedServiceIds.has(id));
}
// Helper: Check if customer qualifies for a bundle discount
// ...existing code...

// ...existing code...
import { CustomerActivity, Service, PricingRule, Campaign, LoyaltyProgram, Bundle } from '../types';

export interface PricingReport {
  activityId: string;
  defaultPrice: number;
  finalPrice: number;
  reason: string;
  ruleDetails: {
    pricingRule?: PricingRule;
    campaign?: Campaign;
    loyalty?: LoyaltyProgram;
    bundle?: Bundle;
    service?: Service;
  };
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
  let defaultPrice = 0;
  let finalPrice = 0;
  let reason = '';
  const ruleDetails: PricingReport['ruleDetails'] = { service };

  if (service) {
    // Calculate base price based on pricing basis
    if (service.pricingBasis === 'Distance (km)' && activity.distanceTravelled) {
      defaultPrice = service.price * activity.distanceTravelled;
      reason = `Base price: ${service.price} × ${activity.distanceTravelled} km.`;
    } else if (service.pricingBasis === 'Time (hour)' && activity.timeUsed) {
      defaultPrice = service.price * activity.timeUsed;
      reason = `Base price: ${service.price} × ${activity.timeUsed} hours.`;
    } else {
      defaultPrice = service.price;
      reason = 'Default price applied.';
    }
    finalPrice = defaultPrice;
  }

  // Apply pricing rule as a discount (not override)
  const applicableRule = pricingRules.find(rule => rule.serviceIds.includes(activity.serviceId));
  if (applicableRule) {
    // If rule has a rate lower than default, treat as override; otherwise, treat as discount
    if (applicableRule.rate < defaultPrice) {
      reason += ` Pricing rule override: ${applicableRule.description}`;
      finalPrice = applicableRule.rate * (activity.distanceTravelled || 1);
    } else {
      finalPrice -= applicableRule.rate * (activity.distanceTravelled || 1);
      reason += ` Pricing rule discount: ${applicableRule.description}`;
    }
    ruleDetails.pricingRule = applicableRule;
  }

  // Apply campaign discount (only if not already overridden by pricing rule)
  const applicableCampaign = campaigns.find(camp => camp.serviceIds.includes(activity.serviceId));
  if (applicableCampaign && finalPrice > 0) {
    finalPrice = Math.max(finalPrice - applicableCampaign.discountValue, 0);
    reason += `; Campaign discount applied: ${applicableCampaign.name}`;
    ruleDetails.campaign = applicableCampaign;
  }

  // Apply loyalty program discount (only if not already zero)
  const applicableLoyalty = loyaltyPrograms.find(lp => lp.cityName === activity.city);
  if (applicableLoyalty && finalPrice > 0) {
    finalPrice = Math.max(finalPrice - applicableLoyalty.pointsPerEuro, 0);
    reason += `; Loyalty points applied.`;
    ruleDetails.loyalty = applicableLoyalty;
  }

  // Apply bundle discount (only if not already zero)
  const applicableBundle = bundles.find(b => b.serviceIds.includes(activity.serviceId));
  if (applicableBundle && finalPrice > 0) {
    finalPrice = Math.max(finalPrice - applicableBundle.discountValue, 0);
    reason += `; Bundle discount applied: ${applicableBundle.name}`;
    ruleDetails.bundle = applicableBundle;
  }

  // If final price differs from default, explain why
  if (finalPrice !== defaultPrice) {
    reason += `; Price differs from default.`;
  }

  return {
    activityId: activity.id,
    defaultPrice,
    finalPrice,
    reason,
    ruleDetails,
  };
}
