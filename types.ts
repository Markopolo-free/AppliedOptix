export type View =
    | 'dashboard'
    | 'users'
    | 'services'
    | 'pricing'
    | 'campaigns'
    | 'loyalty'
    | 'zones'
    | 'theme'
    | 'reference'
    | 'audit'
    | 'fxpricing'
    | 'fxmarginbuilder'
    | 'discountgroups'
    | 'fxcampaigns'
    | 'fxdiscountoptions'
    | 'dataextract'
    | 'simulation'
    | 'customerManager'
    | 'customerActivityManager'
    | 'calculatorService'
    | 'campaignsReport'
    | 'bundledpricing'
    | 'companyDetails'
    | 'discountAmountTypes';
export interface Customer {
    id: string;
    name: string;
    email: string;
    country?: string;
    city?: string;
    userGroup?: string;
    zone?: string;
    createdAt: string;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
}

export interface CustomerActivity {
    id: string;
    customerId: string;
    serviceId: string;
    serviceType: string;
    country: string;
    city: string;
    zone?: string;
    pricingBasis: PricingBasis;
    distanceTravelled?: number;
    timeUsed?: number;
    timestamp: string; // ISO date string
}
export interface Badge {
    id: string;
    name: string;
    description: string;
    iconUrl?: string;
}
import { UserRole, ServiceStatus, PricingBasis, UserGroup, DiscountType, ZoneType, ApprovalStatus } from './enums';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profilePicture?: string; // Base64 encoded image or URL
  createdAt: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  company?: string;
}

export interface Service {
    id: string;
    name: string;
    description: string;
    type: string; // Changed from ServiceType enum to string
    price: number;
    minChargeAmount?: number; // Optional minimum charge amount (default 0.00)
    currency: string;
    pricingBasis: PricingBasis;
    status: ServiceStatus;
    country: string; // Country from reference data
    location: string; // City from reference data (filtered by country)
    effectiveDate: string; // ISO date string
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface Zone {
    id: string;
    name: string;
    type: string; // Zone type from reference data
    country: string; // Country from reference data
    location: string; // City from reference data (filtered by country)
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface ServiceTypeEntry {
    serviceTypeId: string;
    serviceTypeName: string;
    provider?: string;
    model?: string;
}

export interface PricingRule {
    id: string;
    serviceReferenceNumber: string;
    description: string;
    serviceIds: string[]; // Legacy: kept for backward compatibility
    serviceTypeEntries?: ServiceTypeEntry[]; // New: service type + provider + model
    basis: PricingBasis;
    rate: number;
    userGroup: UserGroup;
    minimumUsage?: number; // Minimum km (Distance), hours (Time), or spend (Cost) to qualify
    zoneId?: string; // Link to a pricing zone
    zoneDiscount?: number; // Percentage discount for this zone
    conditions?: {
        season?: 'Summer' | 'Winter' | 'Spring' | 'Autumn';
        timeOfDay?: 'Peak' | 'Off-Peak';
        dayType?: 'Weekday' | 'Weekend';
        eventName?: string;
    };
    status: ApprovalStatus;
    makerName?: string;
    makerEmail?: string;
    makerTimestamp?: string;
    checkerName?: string;
    checkerEmail?: string;
    checkerTimestamp?: string;
    lastModifiedBy: string;
    lastModifiedAt: string;
}

// Per-service qualifying criteria
export interface ServiceQualifyingCriteria {
    serviceId: string;
    criteriaType: 'distance' | 'rides';
    minDistanceKm?: number;
    minRides?: number;
    qualifyStartDate: string;
    qualifyEndDate: string;
    operator?: 'AND' | 'OR'; // Logical operator to combine with next service
}

export interface Campaign {
    id: string;
    name: string;
    description: string;
    serviceIds: string[];
    discountType: DiscountType;
    discountValue: number;
    startDate: string;
    endDate: string;
    countryId?: string;
    cityId?: string;
    zoneId?: string; // Link to a pricing zone
    // Qualifying criteria for unlocking rewards within the campaign
    hasQualifyingCriteria?: 'Y' | 'N';
    // New: How to combine multiple criteria when more than one is provided
    qualifyingOperator?: 'AND' | 'OR';
    qualifyingServiceId?: string; // Legacy: single service (kept for backward compatibility)
    qualifyingServiceIds?: string[]; // Legacy: Multiple services (kept for backward compatibility)
    criteriaType?: 'distance' | 'rides'; // Legacy: Type of metric required
    minDistanceKm?: number; // Legacy: e.g., 10 km for eScooter
    minRides?: number; // Legacy: e.g., 5 rides for Train
    qualifyStartDate?: string; // Legacy: ISO date string for when qualification starts
    qualifyEndDate?: string;   // Legacy: ISO date string for when qualification ends
    // New: Per-service qualifying criteria
    qualifyingCriteria?: ServiceQualifyingCriteria[];
    rewardAvailableFrom?: string; // When the reward becomes available
    status: ApprovalStatus;
    makerName?: string;
    makerEmail?: string;
    makerTimestamp?: string;
    checkerName?: string;
    checkerEmail?: string;
    checkerTimestamp?: string;
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface LoyaltyProgram {
    id: string;
    name: string;
    description: string;
    cityName?: string;
    pointsPerEuro: number;
    maxPointsPerUser?: number;
    totalPointsAvailable?: number;
    pointsConsumed?: number;
    startDate?: string;
    endDate?: string;
    triggerEvent?: string;
    status: ApprovalStatus;
    makerName?: string;
    makerEmail?: string;
    makerTimestamp?: string;
    checkerEmail?: string;
    checkerTimestamp?: string;
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface Bundle {
    id: string;
    name: string;
    description: string;
    serviceIds: string[];
    discountType: DiscountType;
    discountValue: number;
    startDate: string;
    endDate: string;
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface AuditLogChange {
    field: string;
    oldValue: any;
    newValue: any;
}

export interface AuditLog {
    id: string;
    timestamp: string; // ISO 8601 timestamp
    userId: string;
    userName: string;
    userEmail: string;
    action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'login' | 'logout' | 'initialize';
    entityType: 'user' | 'service' | 'zone' | 'pricing' | 'campaign' | 'loyalty' | 'bundle' | 'reference' | 'auth' | 'fxpricing' | 'discountgroup' | 'fxcampaign' | 'fxdiscountoption';
    entityId?: string; // ID of the affected entity (optional for login/logout)
    entityName?: string; // Name/description of the entity for easy reference
    changes?: AuditLogChange[]; // Detailed changes for update operations
    ipAddress?: string; // Optional IP address tracking
    metadata?: Record<string, any>; // Additional context
}

// FX Pricing Types
export interface FXPricingTier {
    minValue: number;
    maxValue: number;
    marginPercentage: number;
}

export interface FXPricing {
    id: string;
    referenceNumber: string;
    entity: string; // 6-char alphanumeric Business Unit/Organisation
    country: string; // Country name from reference data
    baseCurrency: string; // e.g., 'GBP' from reference data
    quoteCurrency: string; // e.g., 'USD' from reference data
    tiers: FXPricingTier[]; // Multiple tiers in a single record
    activeFromDate: string; // ISO date string
    activeToDate: string; // ISO date string
    segment: string; // FX Segment from reference data
    channel: 'Branch' | 'Mobile' | 'Web';
    loyaltyStatus: 'High' | 'Medium' | 'Low' | 'None';
    status: ApprovalStatus;
    makerName?: string;
    makerEmail?: string;
    makerTimestamp?: string;
    checkerName?: string;
    checkerEmail?: string;
    checkerTimestamp?: string;
    lastModifiedBy: string;
    lastModifiedAt: string;
}

// User Discount Groups
export interface UserDiscountGroup {
    id: string;
    name: string; // e.g., 'Seniors', 'Students'
    serviceIds: string[]; // Selected services this discount applies to
    discountType: 'percentage' | 'fixed'; // Type of discount
    discountValue: number; // Percentage (e.g., 15) or fixed amount (e.g., 5.00)
    capType: 'km' | 'trips' | 'amount'; // Type of cap
    capValue: number; // Maximum value for the cap
    capPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly'; // Period for the cap
    effectiveDate: string; // ISO date string
    expiryDate?: string; // Optional expiry date
    lastModifiedBy: string;
    lastModifiedAt: string;
}

// FX Campaigns
export interface FXCampaign {
    id: string;
    campaignNumber: string; // Auto-generated unique campaign number
    name: string;
    description: string;
    countryId?: string; // Country from reference data
    cityId?: string; // City from reference data
    currency: string; // Currency code from reference data
    serviceItem: string; // Specific FX service/product
    discountType: 'Cashback' | 'Discount' | 'Bonus Points' | 'Fee Waiver';
    discountAmount: string; // e.g., "$1 for every $100 spent" or "0.5% cashback"
    qualifyingEvent: string; // e.g., "Debit Card used overseas"
    startDate: string; // Campaign start date
    endDate: string; // Campaign end date
    qualifyStartDate: string; // Qualifying period start
    qualifyEndDate: string; // Qualifying period end
    rewardAvailableFrom: string; // When rewards become available
    lastModifiedBy: string;
    lastModifiedAt: string;
}

// FX Discount Groups
export interface FXDiscountOption {
    id: string;
    optionNumber: string; // Auto-generated unique option number
    name: string;
    description: string;
    serviceItem: string; // Specific FX service/product
    fxSegment: string; // FX Segment from reference data
    discountType: 'Cashback' | 'Discount' | 'Bonus Points' | 'Fee Waiver';
    discountAmountType: 'value' | 'percentage' | 'pips'; // Type of discount amount
    discountAmount: number; // Numeric value
    maxCapType: string; // e.g., 'Total Value Converted'
    currency: string; // Currency code from reference data
    capPeriodStart: string; // Cap period start date
    capPeriodEnd: string; // Cap period end date
    startDate: string; // Offer start date
    endDate: string; // Offer end date
    lastModifiedBy: string;
    lastModifiedAt: string;
}


// Create a new enums.ts file to keep enums separate
export { UserRole, ServiceStatus, PricingBasis, UserGroup, DiscountType, ZoneType, ApprovalStatus };