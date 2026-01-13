/**
 * Tenant Feature Configuration
 * 
 * Maps each tenant to their available features (views/menu items).
 * When a user switches tenants, the sidebar menu automatically updates to show
 * only the features relevant to that tenant.
 * 
 * CUSTOMIZE THIS FILE to tailor feature access for different customers:
 * 1. Find your tenant ID (e.g., 'emobility-demo', 'fintech-demo')
 * 2. Add or remove view names from the features array
 * 3. Available views are listed in AVAILABLE_VIEWS constant below
 */

import { View } from './types';

// ============================================================================
// AVAILABLE VIEWS - All features available in the system
// ============================================================================

export const AVAILABLE_VIEWS = {
  // Core Features
  dashboard: 'Dashboard - Overview and analytics',
  
  // Administration Features
  users: 'User Management - Create/edit users',
  companyDetails: 'Company Details - Organization settings',
  theme: 'Theme Builder - Customize colors and branding',
  audit: 'Audit Log - Track all system changes',
  reference: 'Reference Data - Manage cities, countries, etc.',
  dataextract: 'Data Extraction - Export data and reports',
  pushTestAdmin: 'Push Test Admin - Test notifications',
  tokenListAdmin: 'Token List - Manage API tokens',
  
  // eMobility Features
  services: 'Service Management - Define available services',
  pricing: 'Pricing Rules - Configure pricing logic',
  zones: 'Pricing Zones - Geographic pricing areas',
  bundledpricing: 'Bundled Pricing - Package deals',
  loyalty: 'Loyalty Programs - Rewards and points',
  campaigns: 'Campaigns - Marketing campaigns',
  referralCodes: 'Referral Codes - MGM referral system',
  discountgroups: 'User Discount Groups - Customer tiers',
  
  // FX/Financial Features
  fxmarginbuilder: 'FX Margin Builder - Configure currency margins',
  fxpricing: 'FX Pricing - Set exchange rates',
  fxcampaigns: 'FX Campaigns - Marketing campaigns for FX',
  fxdiscountoptions: 'FX Discount Groups - FX discount tiers',
  
  // Financial Services / Simulation Features
  customerManager: 'Customers - Customer database',
  customerActivityManager: 'Customer Activities - Transaction history',
  calculatorService: 'Pricing Calculator - Calculate charges',
  campaignsReport: 'Campaigns Report - Campaign analytics',
  mgmNotifications: 'MGM Notifications - Member-get-member alerts',
} as const;

// ============================================================================
// TENANT FEATURE MAPPING
// ============================================================================

export interface TenantFeatureConfig {
  label: string;      // Display name for tenant
  description: string; // Description for demos
  views: View[];      // Which features to show
}

export const TENANT_FEATURE_MAP: Record<string, TenantFeatureConfig> = {
  
  // ============================================================================
  // DEFAULT TENANT - Basic access
  // ============================================================================
  'default-tenant': {
    label: 'Default Tenant',
    description: 'Standard access with core admin and dashboard features',
    views: [
      'dashboard',
      'services',
      'users',
      'companyDetails',
      'reference',
      'audit',
      'theme',
      'dataextract',
    ]
  },

  // ============================================================================
  // eMOBILITY - Electric vehicle and mobility services
  // ============================================================================
  'emobility-demo': {
    label: 'eMobility Demo',
    description: 'Electric vehicle services, charging networks, and pricing',
    views: [
      'dashboard',
      'services',
      'pricing',
      'zones',
      'bundledpricing',
      'loyalty',
      'campaigns',
      'referralCodes',
      'discountgroups',
      // Admin tools
      'users',
      'companyDetails',
      'reference',
      'audit',
      'theme',
      'dataextract',
      'pushTestAdmin',
      'tokenListAdmin',
    ]
  },

  // ============================================================================
  // FINTECH - Financial technology and banking
  // ============================================================================
  'fintech-demo': {
    label: 'FinTech Demo',
    description: 'Financial services, FX trading, and banking features',
    views: [
      'dashboard',
      'fxmarginbuilder',
      'fxpricing',
      'fxcampaigns',
      'fxdiscountoptions',
      'customerManager',
      'customerActivityManager',
      'calculatorService',
      'campaignsReport',
      'mgmNotifications',
      // Admin tools
      'users',
      'companyDetails',
      'reference',
      'audit',
      'theme',
      'dataextract',
      'pushTestAdmin',
      'tokenListAdmin',
    ]
  },

  // ============================================================================
  // CORPORATE BANKING - Enterprise banking solutions
  // ============================================================================
  'corporate-banking': {
    label: 'Corporate Banking',
    description: 'Enterprise-grade FX and banking features',
    views: [
      'dashboard',
      'services',
      'fxmarginbuilder',
      'fxpricing',
      'fxcampaigns',
      'fxdiscountoptions',
      'customerManager',
      'customerActivityManager',
      'calculatorService',
      'campaignsReport',
      // Admin tools
      'users',
      'companyDetails',
      'reference',
      'audit',
      'theme',
      'dataextract',
    ]
  },

  // ============================================================================
  // RETAIL BANKING - Consumer banking features
  // ============================================================================
  'retail-banking': {
    label: 'Retail Banking',
    description: 'Consumer banking, loyalty programs, and promotions',
    views: [
      'dashboard',
      'services',
      'loyalty',
      'campaigns',
      'referralCodes',
      'mgmNotifications',
      'customerManager',
      'customerActivityManager',
      // Admin tools
      'users',
      'companyDetails',
      'reference',
      'audit',
      'theme',
    ]
  },

  // ============================================================================
  // INSURANCE - Insurance platform features
  // ============================================================================
  'insurance-demo': {
    label: 'Insurance Demo',
    description: 'Insurance products, underwriting, and claims management',
    views: [
      'dashboard',
      'services',
      'pricing',
      'campaigns',
      'customerManager',
      'customerActivityManager',
      // Admin tools
      'users',
      'companyDetails',
      'reference',
      'audit',
      'theme',
    ]
  },
};

/**
 * Get features available for a specific tenant
 */
export function getTenantFeatures(tenantId: string): View[] {
  const config = TENANT_FEATURE_MAP[tenantId];
  if (!config) {
    console.warn(`Unknown tenant: ${tenantId}. Using default-tenant features.`);
    return TENANT_FEATURE_MAP['default-tenant'].views;
  }
  return config.views;
}

/**
 * Get tenant config by ID
 */
export function getTenantConfig(tenantId: string): TenantFeatureConfig {
  return TENANT_FEATURE_MAP[tenantId] || TENANT_FEATURE_MAP['default-tenant'];
}
