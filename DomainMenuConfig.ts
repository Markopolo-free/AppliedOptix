/**
 * Domain Menu Configuration
 * 
 * CUSTOMIZE THIS FILE to control which features appear in each domain's sidebar menu.
 * This allows you to tailor demonstrations for different customer types.
 * 
 * HOW TO USE:
 * 1. Find the domain you want to customize (admin, fx, emobility, fintech)
 * 2. Add or remove view names from the views array
 * 3. Available views are listed in the AVAILABLE_VIEWS constant below
 * 4. Save the file - changes take effect immediately (hot reload)
 * 
 * EXAMPLE: To add "Service Management" to Financial Services:
 *   fintech: {
 *     views: ['customerManager', 'services', 'mgmNotifications', ...],
 *   }
 */

import { View, ProductDomain } from './types';

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
  domainMenuBuilder: 'Domain Menu Builder - Customize domain menus for demos',
  audit: 'Audit Log - Track all system changes',
  reference: 'Reference Data - Manage cities, countries, etc.',
  dataextract: 'Data Extraction - Export data and reports',
  pushTestAdmin: 'Push Test Admin - Test notifications',
  tokenListAdmin: 'Token List - Manage API tokens',
  
  // FX (Foreign Exchange) Features
  fxmarginbuilder: 'FX Margin Builder - Configure currency margins',
  fxpricing: 'FX Pricing - Set exchange rates',
  fxcampaigns: 'FX Campaigns - Marketing campaigns for FX',
  fxdiscountoptions: 'FX Discount Groups - FX discount tiers',
  
  // eMobility Features
  services: 'Service Management - Define available services',
  pricing: 'Pricing Rules - Configure pricing logic',
  zones: 'Pricing Zones - Geographic pricing areas',
  bundledpricing: 'Bundled Pricing - Package deals',
  loyalty: 'Loyalty Programs - Rewards and points',
  campaigns: 'Campaigns - Marketing campaigns',
  referralCodes: 'Referral Codes - MGM referral system',
  discountgroups: 'User Discount Groups - Customer tiers',
  
  // Financial Services / Simulation Features
  customerManager: 'Customers - Customer database',
  customerActivityManager: 'Customer Activities - Transaction history',
  calculatorService: 'Pricing Calculator - Calculate charges',
  campaignsReport: 'Campaigns Report - Campaign analytics',
  mgmNotifications: 'MGM Notifications - Member-get-member alerts',
} as const;

// ============================================================================
// DOMAIN MENU CONFIGURATION
// ============================================================================
// Edit the 'views' arrays below to customize what appears in each domain

export interface DomainMenuConfig {
  label: string;           // Display name in top menu
  icon: string;            // Emoji icon
  description: string;     // Tooltip description
  color: string;           // Theme color
  views: View[];           // Which features to show in sidebar
}

export const DOMAIN_MENU_CONFIG: Record<ProductDomain, DomainMenuConfig> = {
  
  // ============================================================================
  // DASHBOARD - Landing page (usually just shows overview)
  // ============================================================================
  dashboard: {
    label: 'Dashboard',
    icon: '🏠',
    description: 'Overview of all capabilities',
    color: 'blue',
    views: ['dashboard']
  },
  
  // ============================================================================
  // ADMINISTRATION - Common tools shared across all portals
  // ============================================================================
  admin: {
    label: 'Administration',
    icon: '⚙️',
    description: 'Common administration tools',
    color: 'gray',
    views: [
      'users',
      'companyDetails',
      'theme',
      'domainMenuBuilder',  // Visual tool for customizing domain menus
      'audit',
      'reference',
      'dataextract',
      'pushTestAdmin',
      'tokenListAdmin'
    ]
  },
  
  // ============================================================================
  // FX SERVICES - Foreign exchange and currency management
  // ============================================================================
  fx: {
    label: 'FX Services',
    icon: '💱',
    description: 'Foreign exchange and currency management',
    color: 'green',
    views: [
      'fxmarginbuilder',
      'fxpricing',
      'fxcampaigns',
      'fxdiscountoptions'
    ]
  },
  
  // ============================================================================
  // eMOBILITY - Electric vehicle services and pricing
  // ============================================================================
  emobility: {
    label: 'eMobility',
    icon: '⚡',
    description: 'Electric vehicle services and pricing',
    color: 'yellow',
    views: [
      'services',
      'pricing',
      'zones',
      'bundledpricing',
      'loyalty',
      'campaigns',
      'referralCodes',
      'discountgroups'
    ]
  },
  
  // ============================================================================
  // FINANCIAL SERVICES - Banking and fintech portal
  // CUSTOMIZE THIS for your client demos!
  // ============================================================================
  fintech: {
    label: 'Financial Services',
    icon: '🏦',
    description: 'Banking and financial technology',
    color: 'purple',
    views: [
      // Core customer management
      'customerManager',
      'customerActivityManager',
      
      // ADDED: Service Management for fintech demos
      'services',  // ← Add this to show Service Management
      
      // Analytics and reporting
      'calculatorService',
      'campaignsReport',
      
      // Marketing tools
      'mgmNotifications',
      'referralCodes',
      
      // Optional: Add more features as needed
      // 'pricing',        // Uncomment to add Pricing Rules
      // 'campaigns',      // Uncomment to add Campaigns
      // 'loyalty',        // Uncomment to add Loyalty Programs
    ]
  },
  
  // ============================================================================
  // ADD MORE DOMAINS HERE for new client portals
  // ============================================================================
  // 
  // Example: Insurance Portal
  // insurance: {
  //   label: 'Insurance',
  //   icon: '🛡️',
  //   description: 'Insurance products and claims',
  //   color: 'indigo',
  //   views: [
  //     'customerManager',
  //     'services',
  //     'pricing',
  //     'campaigns'
  //   ]
  // },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the domain view map (backward compatibility with existing code)
 */
export const getDomainViewMap = (): Record<ProductDomain, View[]> => {
  const viewMap: Record<string, View[]> = {};
  
  Object.entries(DOMAIN_MENU_CONFIG).forEach(([domain, config]) => {
    viewMap[domain] = config.views;
  });
  
  return viewMap as Record<ProductDomain, View[]>;
};

/**
 * Get domain metadata (backward compatibility)
 */
export const getDomainMetadata = () => {
  const metadata: Record<string, any> = {};
  
  Object.entries(DOMAIN_MENU_CONFIG).forEach(([domain, config]) => {
    metadata[domain] = {
      id: domain,
      label: config.label,
      icon: config.icon,
      description: config.description,
      color: config.color
    };
  });
  
  return metadata;
};

/**
 * Validate that all views in config are valid
 */
export const validateMenuConfig = (): string[] => {
  const errors: string[] = [];
  const validViews = Object.keys(AVAILABLE_VIEWS);
  
  Object.entries(DOMAIN_MENU_CONFIG).forEach(([domain, config]) => {
    config.views.forEach(view => {
      if (!validViews.includes(view)) {
        errors.push(`Invalid view "${view}" in domain "${domain}"`);
      }
    });
  });
  
  return errors;
};

// Run validation on module load (development only)
if (process.env.NODE_ENV !== 'production') {
  const errors = validateMenuConfig();
  if (errors.length > 0) {
    console.warn('⚠️ Domain Menu Configuration Warnings:');
    errors.forEach(error => console.warn(`  - ${error}`));
  }
}
