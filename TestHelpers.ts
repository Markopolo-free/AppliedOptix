/**
 * Domain System - Test Helper Functions
 * 
 * Use these functions in the browser console to test domain access control
 * without modifying the database.
 */

// Test different user domain access scenarios
export const testScenarios = {
  
  // All access (default - for demos and internal staff)
  fullAccess: {
    allowedDomains: ['dashboard', 'admin', 'fx', 'emobility', 'fintech'],
    defaultDomain: 'dashboard',
    tenantId: 'demo-tenant'
  },
  
  // FX customer - only sees FX services
  fxCustomer: {
    allowedDomains: ['dashboard', 'admin', 'fx'],
    defaultDomain: 'fx',
    tenantId: 'fx-bank-abc'
  },
  
  // eMobility customer - only sees eMobility services
  emobilityCustomer: {
    allowedDomains: ['dashboard', 'admin', 'emobility'],
    defaultDomain: 'emobility',
    tenantId: 'emobility-city-xyz'
  },
  
  // FinTech customer - only sees financial services
  fintechCustomer: {
    allowedDomains: ['dashboard', 'fintech'],
    defaultDomain: 'fintech',
    tenantId: 'fintech-startup-123'
  },
  
  // Admin only - for user management
  adminOnly: {
    allowedDomains: ['admin'],
    defaultDomain: 'admin',
    tenantId: 'internal-hr'
  },
  
  // Multi-product customer - sees FX and eMobility
  multiProduct: {
    allowedDomains: ['dashboard', 'admin', 'fx', 'emobility'],
    defaultDomain: 'dashboard',
    tenantId: 'enterprise-corp'
  }
};

/**
 * Apply a test scenario to the current user
 * 
 * Usage in browser console:
 * import { applyTestScenario } from './TestHelpers';
 * applyTestScenario('fxCustomer');
 * 
 * Then refresh the page to see the effect
 */
export function applyTestScenario(scenarioName: keyof typeof testScenarios): void {
  const scenario = testScenarios[scenarioName];
  
  if (!scenario) {
    console.error(`Unknown scenario: ${scenarioName}`);
    console.log('Available scenarios:', Object.keys(testScenarios));
    return;
  }
  
  console.log(`Applying test scenario: ${scenarioName}`);
  console.log('Scenario details:', scenario);
  
  // Store in localStorage for testing
  localStorage.setItem('test_user_domain_access', JSON.stringify(scenario));
  
  console.log('✅ Scenario applied. Refresh the page to see changes.');
  console.log('To reset, call: clearTestScenario()');
}

/**
 * Clear test scenario and restore default behavior
 */
export function clearTestScenario(): void {
  localStorage.removeItem('test_user_domain_access');
  console.log('✅ Test scenario cleared. Refresh the page to restore defaults.');
}

/**
 * Get current test scenario (if any)
 */
export function getCurrentTestScenario(): any {
  const stored = localStorage.getItem('test_user_domain_access');
  if (stored) {
    return JSON.parse(stored);
  }
  return null;
}

/**
 * List all available test scenarios
 */
export function listScenarios(): void {
  console.log('Available Test Scenarios:');
  console.log('========================');
  
  Object.entries(testScenarios).forEach(([name, config]) => {
    console.log(`\n${name}:`);
    console.log(`  Allowed Domains: ${config.allowedDomains.join(', ')}`);
    console.log(`  Default Domain: ${config.defaultDomain}`);
    console.log(`  Tenant ID: ${config.tenantId}`);
  });
  
  console.log('\nUsage:');
  console.log('  applyTestScenario("fxCustomer")');
  console.log('  clearTestScenario()');
}

// Browser console helper
if (typeof window !== 'undefined') {
  (window as any).testDomains = {
    apply: applyTestScenario,
    clear: clearTestScenario,
    current: getCurrentTestScenario,
    list: listScenarios,
    scenarios: testScenarios
  };
  
  console.log('🔧 Domain System Test Helpers loaded!');
  console.log('Usage: testDomains.list()');
  console.log('       testDomains.apply("fxCustomer")');
  console.log('       testDomains.clear()');
}
