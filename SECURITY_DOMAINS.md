# Domain System - Security & Data Isolation Guide

**Created:** 2026-01-12  
**Purpose:** Multi-portal support with customer data isolation

## Overview

The domain system enables the eMobility Staff Portal to support multiple product verticals (FX, eMobility, FinTech, etc.) with isolated data access for demonstrations and client-specific deployments.

## ⚠️ CRITICAL SECURITY REQUIREMENTS

### UI-Level vs Database-Level Security

**IMPORTANT:** The domain filtering implemented in the UI is **NOT sufficient** for data security. It only controls which menu items users can see. **Database-level access control MUST be enforced separately.**

### Required Security Layers

#### 1. Frontend (Implemented)
- ✅ Domain-based menu filtering in Sidebar
- ✅ User access control in TopMenu
- ✅ View restrictions per domain
- ⚠️ **This is UI-only protection** - can be bypassed

#### 2. Backend (MUST BE IMPLEMENTED)
- ❌ **TODO: Firebase Security Rules** - Enforce tenantId filtering
- ❌ **TODO: API Access Control** - Verify user domain permissions
- ❌ **TODO: Data Queries** - Always filter by tenantId
- ❌ **TODO: User Authentication** - Store allowed domains in user claims

## Data Isolation Strategy

### Multi-Tenant Architecture

Each portal/domain should use a **tenantId** to isolate customer data:

```typescript
// Example: Customer data with tenantId
interface Customer {
  id: string;
  tenantId: string;  // 'emobility', 'fintech', 'fx', etc.
  name: string;
  email: string;
  // ... other fields
}

// Example: User with domain access
interface User {
  id: string;
  allowedDomains: ProductDomain[];  // ['admin', 'emobility']
  defaultDomain: ProductDomain;     // 'emobility'
  tenantId: string;                 // Primary tenant
  // ... other fields
}
```

### Firebase Security Rules (REQUIRED)

**File:** `firestore.rules` (or equivalent)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to get user's allowed domains
    function getAllowedDomains() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.allowedDomains;
    }
    
    // Helper function to check tenant access
    function hasTenantAccess(tenantId) {
      let userTenantId = get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId;
      let allowedDomains = getAllowedDomains();
      
      // Allow if user's tenant matches OR user has admin domain access
      return userTenantId == tenantId || 'admin' in allowedDomains;
    }
    
    // Customers collection - enforce tenantId filtering
    match /customers/{customerId} {
      allow read: if request.auth != null && 
                     hasTenantAccess(resource.data.tenantId);
      
      allow create: if request.auth != null && 
                       hasTenantAccess(request.resource.data.tenantId);
      
      allow update: if request.auth != null && 
                       hasTenantAccess(resource.data.tenantId);
      
      allow delete: if request.auth != null && 
                       hasTenantAccess(resource.data.tenantId) &&
                       'admin' in getAllowedDomains();
    }
    
    // Services collection - domain-specific
    match /services/{serviceId} {
      allow read: if request.auth != null;
      // Services are typically read-only for most users
      allow write: if request.auth != null && 
                      ('admin' in getAllowedDomains() || 
                       'emobility' in getAllowedDomains());
    }
    
    // User management - admin only
    match /users/{userId} {
      allow read: if request.auth != null && 
                     (request.auth.uid == userId || 'admin' in getAllowedDomains());
      
      allow write: if request.auth != null && 'admin' in getAllowedDomains();
    }
    
    // Add similar rules for other collections:
    // - pricing
    // - campaigns
    // - loyalty
    // - etc.
  }
}
```

### API Endpoint Security

For serverless functions or API endpoints:

```typescript
// Example: Vercel API endpoint with tenant filtering
import { verifyAuth } from './auth';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  // 1. Verify authentication
  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // 2. Get user's tenant and allowed domains
  const db = getFirestore();
  const userDoc = await db.collection('users').doc(user.uid).get();
  const userData = userDoc.data();
  const tenantId = userData.tenantId;
  const allowedDomains = userData.allowedDomains || [];
  
  // 3. Query with tenant filter
  const customersQuery = db.collection('customers')
    .where('tenantId', '==', tenantId);
  
  // 4. Additional domain-specific filtering if needed
  if (req.query.domain) {
    if (!allowedDomains.includes(req.query.domain)) {
      return res.status(403).json({ error: 'Access denied to domain' });
    }
  }
  
  const snapshot = await customersQuery.get();
  const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  return res.status(200).json(customers);
}
```

## User Setup Guide

### Setting Up Domain Access

When creating or updating users in the database:

```typescript
// Example: Create user with domain access
const newUser = {
  id: 'user123',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'Administrator',
  // DOMAIN ACCESS CONTROL
  allowedDomains: ['admin', 'emobility'],  // Can access admin and emobility
  defaultDomain: 'emobility',              // Starts in emobility domain
  tenantId: 'emobility-corp',              // Primary tenant identifier
  createdAt: new Date().toISOString()
};

// Save to Firebase
await db.collection('users').doc(newUser.id).set(newUser);
```

### Domain Access Patterns

**Pattern 1: Single Portal User**
```typescript
{
  allowedDomains: ['fintech'],
  defaultDomain: 'fintech',
  tenantId: 'fintech-bank-xyz'
}
// Can only see Financial Services portal data
```

**Pattern 2: Multi-Domain User**
```typescript
{
  allowedDomains: ['admin', 'fx', 'emobility'],
  defaultDomain: 'admin',
  tenantId: 'internal-staff'
}
// Can switch between Admin, FX, and eMobility domains
```

**Pattern 3: Super Admin**
```typescript
{
  allowedDomains: ['dashboard', 'admin', 'fx', 'emobility', 'fintech'],
  defaultDomain: 'dashboard',
  tenantId: 'system-admin'
}
// Can access all domains (for demos and administration)
```

## Migration Guide

### Existing Data Migration

If you have existing data without tenantId:

```typescript
// Migration script example
async function migrateTenantIds() {
  const db = getFirestore();
  
  // 1. Update all existing customers with default tenant
  const customersSnapshot = await db.collection('customers').get();
  
  const batch = db.batch();
  customersSnapshot.docs.forEach(doc => {
    batch.update(doc.ref, { tenantId: 'emobility-default' });
  });
  
  await batch.commit();
  console.log(`Migrated ${customersSnapshot.size} customers`);
  
  // 2. Update existing users with domain access
  const usersSnapshot = await db.collection('users').get();
  
  const userBatch = db.batch();
  usersSnapshot.docs.forEach(doc => {
    userBatch.update(doc.ref, {
      allowedDomains: ['admin', 'emobility'], // Default access
      defaultDomain: 'dashboard',
      tenantId: 'emobility-staff'
    });
  });
  
  await userBatch.commit();
  console.log(`Migrated ${usersSnapshot.size} users`);
}
```

## Rollback Procedure

If you need to disable the domain system and revert to the original single-menu behavior:

### Quick Rollback (No Code Changes)

1. **Edit DomainConfig.ts:**
   ```typescript
   export const DomainConfig = {
     ENABLE_DOMAIN_SYSTEM: false,  // Set to false
     // ... rest of config
   };
   ```

2. **Restart the application** - domain system will be completely disabled

### Full Rollback (Remove All Changes)

1. **Restore types.ts:**
   - Remove ProductDomain type
   - Remove DOMAIN_VIEW_MAP
   - Remove DOMAIN_METADATA
   - Remove allowedDomains and tenantId from User interface

2. **Delete new files:**
   - `components/TopMenu.tsx`
   - `DomainConfig.ts`
   - `SECURITY_DOMAINS.md` (this file)

3. **Restore Sidebar.tsx:**
   - Remove `currentDomain` prop
   - Remove domain filtering logic
   - Remove `isDomainSystemEnabled` checks

4. **Restore App.tsx:**
   - Remove domain state
   - Remove TopMenu component
   - Remove domain auto-switching useEffect
   - Remove currentDomain prop from Sidebar

5. **Commit and deploy**

## Testing Security

### Security Test Checklist

- [ ] Create user with only 'fintech' domain access
- [ ] Verify they cannot see eMobility menu items
- [ ] Try to manually navigate to restricted view (URL hack)
- [ ] Verify Firebase rules reject unauthorized data access
- [ ] Test API endpoints reject requests for wrong tenant
- [ ] Verify tenantId filtering in all database queries
- [ ] Test domain switching for multi-domain users
- [ ] Verify admin users can access all domains

### Manual Test Script

```typescript
// Test 1: UI Access Control
// Login as user with allowedDomains: ['fintech']
// Expected: Only see Dashboard, Admin (if allowed), and FinTech tabs

// Test 2: Data Isolation
// Login as fintech user
// Try to query: db.collection('customers').where('tenantId', '==', 'emobility')
// Expected: Firebase rules should reject the query

// Test 3: API Security
// Make API call: GET /api/customers?tenantId=emobility
// Expected: 403 Forbidden (if user is fintech-only)
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Firebase security rules deployed and tested
- [ ] All users have allowedDomains configured
- [ ] All data has tenantId assigned
- [ ] API endpoints enforce domain access control
- [ ] Audit logging captures domain access attempts
- [ ] Demo mode disabled in production (DomainConfig.DEMO_MODE = false)
- [ ] Access control enforcement enabled (DomainConfig.ENFORCE_DOMAIN_ACCESS = true)
- [ ] Security testing completed
- [ ] Rollback procedure documented and tested

## Support & Troubleshooting

### Common Issues

**Issue:** User can't see any menu items
- **Solution:** Check user.allowedDomains is set correctly in database

**Issue:** User can access data from wrong domain
- **Solution:** Firebase security rules not deployed or incorrect

**Issue:** Domain switching doesn't work
- **Solution:** Check DomainConfig.ENABLE_DOMAIN_SYSTEM is true

**Issue:** Need to temporarily disable domain system
- **Solution:** Set DomainConfig.DEMO_MODE = true for testing

## Next Steps

1. **Deploy Firebase Security Rules** - Highest priority
2. **Update API Endpoints** - Add tenant filtering
3. **Migrate Existing Data** - Add tenantId to all records
4. **Update User Records** - Add allowedDomains to all users
5. **Test Security** - Complete security test checklist
6. **Documentation** - Update user guides with domain access info

---

**Last Updated:** 2026-01-12  
**Version:** 1.0  
**Maintainer:** eMobility Development Team
