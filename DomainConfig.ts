import { ProductDomain } from './types';

/**
 * Domain System Configuration
 * 
 * FEATURE FLAG: Set ENABLE_DOMAIN_SYSTEM to false to completely disable
 * the domain/portal system and restore original single-menu behavior.
 * 
 * ROLLBACK: Change ENABLE_DOMAIN_SYSTEM to false and restart app.
 */

export const DomainConfig = {
  // Master switch for domain system
  ENABLE_DOMAIN_SYSTEM: true,
  
  // Default domain when user logs in (if not specified in user profile)
  DEFAULT_DOMAIN: 'dashboard' as ProductDomain,
  
  // When domain system is disabled, show all features in sidebar
  LEGACY_MODE: false,
  
  // Enforce domain access control (check user.allowedDomains)
  // Set to false during testing/demos to allow all users access to all domains
  ENFORCE_DOMAIN_ACCESS: true,
  
  // Show domain switcher even if user only has access to one domain
  ALWAYS_SHOW_TOP_MENU: false,
  
  // Demo mode: ignore domain restrictions (for demonstrations only)
  DEMO_MODE: false,
};

/**
 * Helper function to check if domain system is active
 */
export const isDomainSystemEnabled = (): boolean => {
  return DomainConfig.ENABLE_DOMAIN_SYSTEM && !DomainConfig.LEGACY_MODE;
};

/**
 * Helper function to check if domain access should be enforced
 */
export const shouldEnforceDomainAccess = (): boolean => {
  return DomainConfig.ENFORCE_DOMAIN_ACCESS && !DomainConfig.DEMO_MODE;
};

/**
 * Get default domain for user
 */
export const getDefaultDomain = (userDefaultDomain?: ProductDomain): ProductDomain => {
  return userDefaultDomain || DomainConfig.DEFAULT_DOMAIN;
};
