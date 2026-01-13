# Multi-Tenant Data Isolation Implementation Guide

**Date:** January 12, 2026  
**Status:** In Progress  
**Priority:** High - Required for data security

## Overview

The eMobility Staff Portal has been updated to support multi-tenant data isolation. This ensures that when you add Service Management to Financial Services, Financial Services clients see **only their own services**, not eMobility's services.

## What Has Been Done

### ✅ Data Model Updates (Complete)

All data interfaces in [types.ts](types.ts) now include `tenantId` field:

- ✅ Service
- ✅ Zone
- ✅ PricingRule
- ✅ Campaign
- ✅ LoyaltyProgram
- ✅ Bundle
- ✅ UserDiscountGroup
- ✅ FXPricing
- ✅ FXCampaign
- ✅ FXDiscountOption
- ✅ AuditLog

### ✅ Multi-Tenant Query Service (Complete)

Created [services/multiTenantService.ts](services/multiTenantService.ts) with helper functions:

- `queryServicesByTenant(tenantId)` - Get services for specific tenant
- `queryPricingByTenant(tenantId)` - Get pricing rules for specific tenant
- `queryZonesByTenant(tenantId)` - Get zones for specific tenant
- `queryCampaignsByTenant(tenantId)` - Get campaigns for specific tenant
- `queryLoyaltyByTenant(tenantId)` - Get loyalty programs for specific tenant
- `queryFXPricingByTenant(tenantId)` - Get FX pricing for specific tenant
- Plus additional helpers for all data types

### ✅ User Context Updates (Complete)

- Updated [AuthContext.tsx](contexts/AuthContext.tsx) to include domain/tenant fields in AuthUser
- Updated [userManagementService.ts](components/userManagementService.ts) to populate tenantId and allowedDomains
- Updated [LandingPage.tsx](components/LandingPage.tsx) to set tenantId when user logs in

## What Still Needs Implementation

### 1. Update All Manager Components (Priority: High)

Each manager component needs to:
- Get current user's `tenantId` from AuthContext
- Use `queryXxxByTenant()` functions when fetching data
- Include `tenantId` when saving new records

**Example - ServiceManager:**

```typescript
// OLD: const services = await getServices();
// NEW:
const { currentUser } = useAuth();
const services = await queryServicesByTenant(currentUser?.tenantId || '');
```

**Managers to Update:**
- [ ] ServiceManager
- [ ] PricingManager
- [ ] ZoneManager
- [ ] CampaignManager
- [ ] LoyaltyManager
- [ ] BundledPricingManager
- [ ] FXPricingManager
- [ ] FXCampaignManager
- [ ] FXDiscountOptionManager
- [ ] UserDiscountGroupManager
- [ ] AuditManager
- [ ] DataExtractionManager

### 2. Update Save/Create Functions

When creating or updating records, ensure `tenantId` is included:

```typescript
// When saving a new service
const newService: Service = {
  id: generatedId,
  name: formData.name,
  // ... other fields
  tenantId: currentUser?.tenantId || 'default-tenant'  // ← Add this
};
```

### 3. Firebase Security Rules (Priority: Critical)

Create/update Firebase Security Rules to enforce tenant isolation at the database level.

**Required Rules Template:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper: Get user's tenantId
    function getUserTenantId() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid))
        .data.tenantId;
    }
    
    // Services: Only access own tenant's services
    match /services/{serviceId} {
      allow read: if request.auth != null && 
                     data.tenantId == getUserTenantId();
      allow write: if request.auth != null && 
                      resource.data.tenantId == getUserTenantId();
    }
    
    // Apply similar rules to: pricing, zones, campaigns, loyalty, bundles, etc.
  }
}
```

### 4. Migration: Add tenantId to Existing Data

For existing records without tenantId:

```typescript
// Run once per collection:
async function migrateTenantId(collection: string, tenantId: string) {
  const collectionRef = ref(db, collection);
  const snapshot = await get(collectionRef);
  if (!snapshot.exists()) return;
  
  const data = snapshot.val();
  const updates: any = {};
  
  Object.keys(data).forEach(key => {
    if (!data[key].tenantId) {
      updates[`${collection}/${key}/tenantId`] = tenantId;
    }
  });
  
  await update(ref(db), updates);
}
```

### 5. User Setup

Ensure all users have domain and tenant information:

```typescript
// User record in database should include:
{
  id: "user123",
  email: "user@example.com",
  name: "John Doe",
  role: "Administrator",
  // MULTI-TENANT FIELDS:
  tenantId: "emobility-city",      // Which client/tenant this user belongs to
  allowedDomains: ["admin", "emobility"],  // Which domains they can access
  defaultDomain: "emobility",      // Starting domain on login
  createdAt: "2026-01-12T...",
  lastModifiedAt: "2026-01-12T..."
}
```

## Implementation Checklist

### Phase 1: Core Data Layer (IN PROGRESS)
- [x] Add tenantId to all data model interfaces
- [x] Create multiTenantService with query helpers
- [x] Update AuthContext and user loading
- [ ] Add tenantId to existing data records
- [ ] Create Firebase Security Rules

### Phase 2: Manager Components
- [ ] Update all manager components to filter by tenantId
- [ ] Update all save/create functions to include tenantId
- [ ] Test data isolation works for each manager

### Phase 3: Security & Testing
- [ ] Deploy Firebase Security Rules
- [ ] Create user test accounts for multiple tenants
- [ ] Security testing: Verify cross-tenant access is blocked
- [ ] Document tenant setup procedures

### Phase 4: Documentation
- [ ] Update user guide for multi-tenant system
- [ ] Create tenant admin guide
- [ ] Document data migration procedures

## Testing Multi-Tenant Isolation

Once implementation is complete, test the following scenarios:

### Test Scenario 1: Financial Services User
1. Create user with `tenantId: "financial-services-demo"`
2. Create services with `tenantId: "financial-services-demo"`
3. Login as this user
4. Verify they only see their services in Service Manager
5. Verify other tenants' services are not visible

### Test Scenario 2: eMobility User
1. Create user with `tenantId: "emobility-demo"`
2. Create services with `tenantId: "emobility-demo"`
3. Login as this user
4. Verify they only see their services
5. Verify Financial Services data is hidden

### Test Scenario 3: Data Isolation
1. Create two users from different tenants
2. Have each create services with their own tenantId
3. Verify database queries only return tenant-specific data
4. Verify audit logs show correct tenantId

## Code Example: Updated ServiceManager

```typescript
// BEFORE: No tenant filtering
const fetchServices = async () => {
  const servicesRef = ref(db, 'services');
  const snapshot = await get(servicesRef);
  // Returns ALL services for ALL tenants!
};

// AFTER: With tenant filtering
const fetchServices = async () => {
  const { currentUser } = useAuth();
  if (!currentUser?.tenantId) {
    console.error('No tenantId available');
    return;
  }
  
  const allServices = await queryServicesByTenant(currentUser.tenantId);
  setServices(allServices);
};

// BEFORE: No tenantId on save
const handleCreateService = async () => {
  const newService = {
    id: generateId(),
    name: formData.name,
    // ... other fields
    lastModifiedBy: currentUser.email,
    lastModifiedAt: new Date().toISOString()
  };
  // Saved without tenantId!
};

// AFTER: With tenantId
const handleCreateService = async () => {
  const { currentUser } = useAuth();
  const newService = {
    id: generateId(),
    name: formData.name,
    // ... other fields
    tenantId: currentUser?.tenantId || 'default',  // ← CRITICAL
    lastModifiedBy: currentUser.email,
    lastModifiedAt: new Date().toISOString()
  };
  // Now saved with tenant isolation!
};
```

## Security Best Practices

1. **Always filter by tenantId at query time** - Never display unfiltered data
2. **Include tenantId on all saves** - Every new record must have tenantId
3. **Verify ownership before updates** - Use `verifyTenantOwnership()` function
4. **Log all tenant data access** - Include tenantId in audit logs
5. **Enforce in Firebase Rules** - Application filtering alone is not sufficient

## Next Steps

1. **Start with ServiceManager** - It's the most critical for demos
2. Update queryServicesByTenant calls in ServiceManager
3. Add tenantId to new service creation
4. Test thoroughly with multiple users/tenants
5. Move to next manager component
6. Once all managers updated, deploy Firebase Security Rules

## Support & Questions

- **Security concerns?** See [SECURITY_DOMAINS.md](SECURITY_DOMAINS.md)
- **Database access issues?** Check [multiTenantService.ts](services/multiTenantService.ts) for helper functions
- **User setup?** Create user records with tenantId and allowedDomains fields

---

**Created:** 2026-01-12  
**Status:** Framework Complete - Needs Component-Level Implementation  
**Estimated Completion:** 1-2 days for full implementation
