/**
 * Multi-Tenant Database Service
 * 
 * Provides utility functions to enforce tenantId filtering on all database queries.
 * This ensures data isolation between different client portals.
 * 
 * Usage:
 *   const services = await queryServicesByTenant(tenantId);
 *   await savePricingWithTenant(pricingRule, tenantId);
 */

import { ref, get } from 'firebase/database';
import { db } from './firebase';

/**
 * Query builder for tenant-filtered queries
 * For Realtime Database, we need to filter in application since it doesn't support complex WHERE clauses
 */

/**
 * Get all services for a specific tenant
 */
export async function queryServicesByTenant(tenantId: string) {
  try {
    const servicesRef = ref(db, 'services');
    const snapshot = await get(servicesRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(service => !service.tenantId || service.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying services:', error);
    return [];
  }
}

/**
 * Get all pricing rules for a specific tenant
 */
export async function queryPricingByTenant(tenantId: string) {
  try {
    const pricingRef = ref(db, 'pricing');
    const snapshot = await get(pricingRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(pricing => pricing.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying pricing:', error);
    return [];
  }
}

/**
 * Get all zones for a specific tenant
 */
export async function queryZonesByTenant(tenantId: string) {
  try {
    const zonesRef = ref(db, 'zones');
    const snapshot = await get(zonesRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(zone => zone.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying zones:', error);
    return [];
  }
}

/**
 * Get all campaigns for a specific tenant
 */
export async function queryCampaignsByTenant(tenantId: string) {
  try {
    const campaignsRef = ref(db, 'campaigns');
    const snapshot = await get(campaignsRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(campaign => campaign.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying campaigns:', error);
    return [];
  }
}

/**
 * Get all loyalty programs for a specific tenant
 */
export async function queryLoyaltyByTenant(tenantId: string) {
  try {
    const loyaltyRef = ref(db, 'loyaltyPrograms');
    const snapshot = await get(loyaltyRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    const allPrograms = Object.keys(data)
      .map(key => ({ id: key, ...data[key] }));
    
    console.log('All loyalty programs from DB:', allPrograms);
    allPrograms.forEach((prog, idx) => {
      console.log(`Program ${idx}:`, prog.id, 'tenantId:', prog.tenantId);
    });
    console.log('Filtering by tenantId:', tenantId);
    
    const filtered = allPrograms.filter(loyalty => !loyalty.tenantId || loyalty.tenantId === tenantId);
    console.log('Filtered loyalty programs:', filtered);
    
    return filtered;
  } catch (error) {
    console.error('Error querying loyalty:', error);
    return [];
  }
}

/**
 * Get all bundles for a specific tenant
 */
export async function queryBundlesByTenant(tenantId: string) {
  try {
    const bundlesRef = ref(db, 'bundles');
    const snapshot = await get(bundlesRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(bundle => bundle.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying bundles:', error);
    return [];
  }
}

/**
 * Get all discount groups for a specific tenant
 */
export async function queryDiscountGroupsByTenant(tenantId: string) {
  try {
    const discountRef = ref(db, 'userDiscountGroups');
    const snapshot = await get(discountRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(group => group.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying discount groups:', error);
    return [];
  }
}

/**
 * Get all FX pricing records for a specific tenant
 */
export async function queryFXPricingByTenant(tenantId: string) {
  try {
    const fxRef = ref(db, 'fxPricing');
    const snapshot = await get(fxRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(fx => fx.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying FX pricing:', error);
    return [];
  }
}

/**
 * Get all FX campaigns for a specific tenant
 */
export async function queryFXCampaignsByTenant(tenantId: string) {
  try {
    const campaignsRef = ref(db, 'fxCampaigns');
    const snapshot = await get(campaignsRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(campaign => campaign.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying FX campaigns:', error);
    return [];
  }
}

/**
 * Get all FX discount options for a specific tenant
 */
export async function queryFXDiscountOptionsByTenant(tenantId: string) {
  try {
    const discountRef = ref(db, 'fxDiscountOptions');
    const snapshot = await get(discountRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(option => option.tenantId === tenantId);
  } catch (error) {
    console.error('Error querying FX discount options:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific tenant
 */
export async function queryAuditLogsByTenant(tenantId: string) {
  try {
    const auditRef = ref(db, 'auditLogs');
    const snapshot = await get(auditRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(log => log.tenantId === tenantId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('Error querying audit logs:', error);
    return [];
  }
}

/**
 * Get all users for a specific tenant
 */
export async function queryUsersByTenant(tenantId: string) {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(key => ({ id: key, ...data[key] }))
      .filter(user => {
        // If viewing default-tenant, show users with no tenant or default-tenant
        if (tenantId === 'default-tenant') {
          return !user.tenantId || user.tenantId === 'default-tenant';
        }
        // For all other tenants, only show exact matches
        return user.tenantId === tenantId;
      });
  } catch (error) {
    console.error('Error querying users:', error);
    return [];
  }
}

/**
 * Verify that a record belongs to the specified tenant
 * Use this before allowing updates/deletes to ensure authorization
 */
export async function verifyTenantOwnership(collection: string, recordId: string, tenantId: string): Promise<boolean> {
  try {
    const recordRef = ref(db, `${collection}/${recordId}`);
    const snapshot = await get(recordRef);
    if (!snapshot.exists()) return false;
    
    const record = snapshot.val();
    return record.tenantId === tenantId;
  } catch (error) {
    console.error('Error verifying tenant ownership:', error);
    return false;
  }
}

/**
 * IMPORTANT SECURITY NOTE:
 * 
 * These query functions filter data in the application layer.
 * For production, you MUST also enforce these restrictions at the database level using Firebase Security Rules.
 * 
 * Example Firebase Rule:
 * ```
 * "services": {
 *   "$serviceId": {
 *     ".read": "root.child('users').child(auth.uid).child('tenantId').val() === data.child('tenantId').val()",
 *     ".write": "root.child('users').child(auth.uid).child('tenantId').val() === data.child('tenantId').val()"
 *   }
 * }
 * ```
 */
