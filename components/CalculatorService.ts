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
  breakdown: string[];
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
  // DEBUG: Log all inputs
  console.log('[PricingCalculator] activity:', activity);
  console.log('[PricingCalculator] services:', services);
  console.log('[PricingCalculator] pricingRules:', pricingRules);
  console.log('[PricingCalculator] campaigns:', campaigns);
  console.log('[PricingCalculator] loyaltyPrograms:', loyaltyPrograms);
  console.log('[PricingCalculator] bundles:', bundles);

  // Find the default price from Service Management
  const service = services.find(s => s.id === activity.serviceId);
  let defaultPrice = 0;
  let finalPrice = 0;
  let reason = '';
  const ruleDetails: PricingReport['ruleDetails'] = { service };
  const breakdown: string[] = [];

  if (service) {
    // Calculate base price based on pricing basis
    if (service.pricingBasis === 'Distance (km)' && activity.distanceTravelled) {
      defaultPrice = service.price * activity.distanceTravelled;
      reason = `Base price: ${service.price} × ${activity.distanceTravelled} km.`;
      breakdown.push(reason + ` = €${defaultPrice}`);
    } else if (service.pricingBasis === 'Time (hour)' && activity.timeUsed) {
      defaultPrice = service.price * activity.timeUsed;
      reason = `Base price: ${service.price} × ${activity.timeUsed} hours.`;
      breakdown.push(reason + ` = €${defaultPrice}`);
    } else {
      defaultPrice = service.price;
      reason = 'Default price applied.';
      breakdown.push(reason + ` = €${defaultPrice}`);
    }
    finalPrice = defaultPrice;
  }

  // Apply pricing rule as a discount (not override)
  const applicableRule = pricingRules.find(rule => rule.serviceIds.includes(activity.serviceId));
  if (applicableRule) {
    // If rule has a rate lower than default, treat as override; otherwise, treat as discount
    if (applicableRule.rate < defaultPrice) {
      reason += ` Pricing rule override: ${applicableRule.description}`;
      breakdown.push(`Pricing rule override: ${applicableRule.description} → set price to €${applicableRule.rate * (activity.distanceTravelled || 1)}`);
      finalPrice = applicableRule.rate * (activity.distanceTravelled || 1);
    } else {
      finalPrice -= applicableRule.rate * (activity.distanceTravelled || 1);
      reason += ` Pricing rule discount: ${applicableRule.description}`;
      breakdown.push(`Pricing rule discount: ${applicableRule.description} → -€${applicableRule.rate * (activity.distanceTravelled || 1)} (new price: €${finalPrice})`);
    }
    ruleDetails.pricingRule = applicableRule;
  }

  // Apply campaign discount (only if not already overridden by pricing rule)
  const now = Date.now();
  const applicableCampaign = campaigns.find(camp => {
    // Compare serviceIds as strings to avoid type mismatch
    const serviceIds = (camp.serviceIds || []).map(String);
    const activityServiceId = String(activity.serviceId);
    const serviceMatch = serviceIds.includes(activityServiceId);
    const start = camp.startDate ? new Date(camp.startDate).getTime() : -Infinity;
    const end = camp.endDate ? new Date(camp.endDate).getTime() : Infinity;
    const dateMatch = now >= start && now <= end;
    console.log('[PricingCalculator][CampaignCheck]', {
      campId: camp.id,
      campName: camp.name,
      serviceIds,
      activityServiceId,
      serviceMatch,
      start,
      end,
      now,
      dateMatch
    });
    return serviceMatch && dateMatch;
  });
  console.log('[PricingCalculator] applicableCampaign:', applicableCampaign);
  if (applicableCampaign) {
    finalPrice = finalPrice - applicableCampaign.discountValue;
    reason += `; Campaign discount applied: ${applicableCampaign.name}`;
    breakdown.push(`Campaign discount: ${applicableCampaign.name} → -€${applicableCampaign.discountValue} (new price: €${finalPrice})`);
    ruleDetails.campaign = applicableCampaign;
    console.log('[PricingCalculator] Campaign applied. New finalPrice:', finalPrice);
  } else {
    console.log('[PricingCalculator] No campaign applied.');
  }

  // Apply loyalty program discount (only if not already zero)
  const applicableLoyalty = loyaltyPrograms.find(lp => lp.cityName === activity.city);
  if (applicableLoyalty) {
    finalPrice = finalPrice - applicableLoyalty.pointsPerEuro;
    reason += `; Loyalty points applied.`;
    breakdown.push(`Loyalty program: ${applicableLoyalty.name} → -€${applicableLoyalty.pointsPerEuro} (new price: €${finalPrice})`);
    ruleDetails.loyalty = applicableLoyalty;
  }

  // Apply bundle discount (only if not already zero)
  const applicableBundle = bundles.find(b => b.serviceIds.includes(activity.serviceId));
  if (applicableBundle) {
    finalPrice = finalPrice - applicableBundle.discountValue;
    reason += `; Bundle discount applied: ${applicableBundle.name}`;
    breakdown.push(`Bundle discount: ${applicableBundle.name} → -€${applicableBundle.discountValue} (new price: €${finalPrice})`);
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
    breakdown,
  };
}
