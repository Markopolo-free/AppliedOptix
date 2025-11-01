import { UserRole, ServiceStatus, PricingBasis, UserGroup, DiscountType, ZoneType } from './enums';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
    currency: string;
    status: ServiceStatus;
    location: string;
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface Zone {
    id: string;
    name: string;
    type: ZoneType;
    location: string; // e.g., 'Berlin', 'Munich'
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface PricingRule {
    id: string;
    description: string;
    serviceIds: string[];
    basis: PricingBasis;
    rate: number;
    userGroup: UserGroup;
    zoneId?: string; // Link to a pricing zone
    zoneDiscount?: number; // Percentage discount for this zone
    conditions?: {
        season?: 'Summer' | 'Winter' | 'Spring' | 'Autumn';
        timeOfDay?: 'Peak' | 'Off-Peak';
        dayType?: 'Weekday' | 'Weekend';
        eventName?: string;
    };
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
    lastModifiedBy: string;
    lastModifiedAt: string;
}

export interface LoyaltyProgram {
    id: string;
    name: string;
    description: string;
    pointsPerEuro: number;
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


// Create a new enums.ts file to keep enums separate
export { UserRole, ServiceStatus, PricingBasis, UserGroup, DiscountType, ZoneType };