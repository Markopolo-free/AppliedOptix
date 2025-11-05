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
}

export interface Service {
    id: string;
    name: string;
    description: string;
    type: string; // Changed from ServiceType enum to string
    price: number;
    minChargeAmount?: number; // Optional minimum charge amount (default 0.00)
    currency: string;
    status: ServiceStatus;
    location: string;
    effectiveDate: string; // ISO date string
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface Zone {
    id: string;
    name: string;
    type: string; // Zone type from reference data
    location: string; // e.g., 'Berlin', 'Munich'
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

export interface Campaign {
    id: string;
    name: string;
    description: string;
    serviceIds: string[];
    discountType: DiscountType;
    discountValue: number;
    startDate: string;
    endDate: string;
    cityId?: string;
    // Qualifying criteria for unlocking rewards within the campaign
    hasQualifyingCriteria?: 'Y' | 'N';
    qualifyingServiceId?: string; // Service used to qualify (e.g., eScooter, Train)
    criteriaType?: 'distance' | 'rides'; // Type of metric required
    minDistanceKm?: number; // e.g., 10 km for eScooter
    minRides?: number; // e.g., 5 rides for Train
    qualifyStartDate?: string; // ISO date string for when qualification starts
    qualifyEndDate?: string;   // ISO date string for when qualification ends
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
    entityType: 'user' | 'service' | 'zone' | 'pricing' | 'campaign' | 'loyalty' | 'bundle' | 'reference' | 'auth' | 'fxpricing' | 'discountgroup';
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


// Create a new enums.ts file to keep enums separate
export { UserRole, ServiceStatus, PricingBasis, UserGroup, DiscountType, ZoneType, ApprovalStatus };