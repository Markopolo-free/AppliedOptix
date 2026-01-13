# Domain System Implementation - Quick Start Guide

**Implementation Date:** January 12, 2026  
**Status:** ✅ Complete and Ready for Testing

## What Was Implemented

A complete multi-portal domain system that allows you to demonstrate different product capabilities (FX, eMobility, Financial Services) to different customers while maintaining data isolation.

## Files Changed

### New Files Created
1. **`components/TopMenu.tsx`** - Horizontal domain switcher bar
2. **`DomainConfig.ts`** - Feature flags and configuration
3. **`SECURITY_DOMAINS.md`** - Complete security and rollback guide
4. **`IMPLEMENTATION_GUIDE.md`** - This file

### Modified Files
1. **`types.ts`** - Added ProductDomain type, DOMAIN_VIEW_MAP, security types
2. **`App.tsx`** - Integrated domain state management and TopMenu
3. **`components/Sidebar.tsx`** - Added domain filtering with backward compatibility
4. **`contexts/AuthContext.tsx`** - Added allowedDomains, defaultDomain, tenantId to AuthUser

## Current Domain Structure

### 🏠 Dashboard
- Overview of all capabilities

### ⚙️ Administration (Common)
- User Management
- Company Details
- Theme Builder
- Audit Log
- Reference Data
- Data Extraction
- Push Test Admin
- Token Management

### 💱 FX Services
- FX Margin Builder
- FX Pricing Manager
- FX Campaigns
- FX Discount Groups

### ⚡ eMobility Services
- Service Management
- Pricing Rules & Zones
- Bundled Pricing
- Loyalty Programs
- Campaigns
- Referral Codes

### 🏦 Financial Services (New Portal Example)
- Customer Management
- Customer Activity Simulation
- Pricing Calculator
- Campaigns Report
- MGM Notifications
- Referral Codes

## How to Test

### Test 1: Basic Functionality (All domains visible)

1. **Start the application:**
   ```powershell
   npm run dev
   ```

2. **Login to the portal**

3. **You should see:**
   - Horizontal domain menu bar below the header
   - Five domains: Dashboard, Administration, FX Services, eMobility, Financial Services
   - Sidebar filtered by selected domain

4. **Test domain switching:**
   - Click "FX Services" → Should only see FX-related menu items
   - Click "eMobility" → Should only see eMobility menu items
   - Click "Financial Services" → Should only see FinTech items

### Test 2: Disable Domain System (Rollback Test)

1. **Edit `DomainConfig.ts`:**
   ```typescript
   export const DomainConfig = {
     ENABLE_DOMAIN_SYSTEM: false,  // Changed from true
     // ... rest remains same
   };
   ```

2. **Refresh the app** → Should show original single sidebar with all items

3. **Re-enable by setting back to `true`**

### Test 3: User Access Control (Simulated)

Currently, all logged-in users see all domains. To test access control:

1. **In browser console (after login):**
   ```javascript
   // Simulate a user with limited domain access
   // Note: This won't persist, just for testing UI
   const currentUser = { 
     ...window.__currentUser, 
     allowedDomains: ['admin', 'fx']
   };
   ```

2. **Expected:** Would only see Admin and FX tabs (requires app state update to test fully)

## Demo Scenarios

### Scenario 1: FX Customer Demo
```typescript
// Configure user for FX-only access
{
  allowedDomains: ['dashboard', 'admin', 'fx'],
  defaultDomain: 'fx'
}
```
**Shows:** FX services + common administration

### Scenario 2: eMobility Customer Demo
```typescript
{
  allowedDomains: ['dashboard', 'admin', 'emobility'],
  defaultDomain: 'emobility'
}
```
**Shows:** eMobility services + common administration

### Scenario 3: New FinTech Client Demo
```typescript
{
  allowedDomains: ['dashboard', 'fintech'],
  defaultDomain: 'fintech'
}
```
**Shows:** Financial services portal (rebranded for banking)

### Scenario 4: Full Access (Internal Staff/Demos)
```typescript
{
  allowedDomains: ['dashboard', 'admin', 'fx', 'emobility', 'fintech'],
  defaultDomain: 'dashboard'
}
```
**Shows:** All domains (current default)

## Next Steps for Production

### ⚠️ CRITICAL: Before Production Deployment

The current implementation provides **UI-level filtering only**. For production use with real customer data:

1. **Implement Firebase Security Rules** (See SECURITY_DOMAINS.md)
   - Enforce tenantId filtering at database level
   - Prevent unauthorized data access

2. **Update Database Schema**
   - Add `tenantId` to all customer data collections
   - Add `allowedDomains` to user records

3. **Update API Endpoints**
   - Add tenant filtering to all queries
   - Verify user domain access before returning data

4. **Deploy Security Rules**
   - Test thoroughly before production
   - Verify data isolation between tenants

5. **Migrate Existing Data**
   - Assign tenantId to all existing records
   - Set allowedDomains for all users

### Detailed Instructions

See **`SECURITY_DOMAINS.md`** for complete documentation on:
- Firebase security rules
- API endpoint security
- Data migration scripts
- Testing procedures
- Rollback procedures

## Configuration Options

### `DomainConfig.ts` Settings

```typescript
{
  // Master on/off switch
  ENABLE_DOMAIN_SYSTEM: true,
  
  // Default domain on login
  DEFAULT_DOMAIN: 'dashboard',
  
  // Backward compatibility mode
  LEGACY_MODE: false,
  
  // Check user.allowedDomains (set false for testing)
  ENFORCE_DOMAIN_ACCESS: true,
  
  // Show top menu even if user has one domain
  ALWAYS_SHOW_TOP_MENU: false,
  
  // Demo mode: ignore all restrictions
  DEMO_MODE: false,
}
```

## Customization

### Adding a New Domain

1. **Update `types.ts`:**
   ```typescript
   export type ProductDomain = 
     | 'dashboard'
     | 'admin'
     | 'fx'
     | 'emobility'
     | 'fintech'
     | 'insurance';  // NEW
   
   export const DOMAIN_VIEW_MAP: Record<ProductDomain, View[]> = {
     // ... existing domains
     insurance: ['services', 'pricing', 'campaigns'],  // NEW
   };
   
   export const DOMAIN_METADATA: Record<ProductDomain, DomainMetadata> = {
     // ... existing metadata
     insurance: {
       id: 'insurance',
       label: 'Insurance',
       icon: '🛡️',
       description: 'Insurance products and services',
       color: 'indigo'
     },
   };
   ```

2. **No other changes needed** - UI updates automatically

### Changing Domain Colors/Icons

Edit `DOMAIN_METADATA` in `types.ts`:
```typescript
emobility: {
  id: 'emobility',
  label: 'eMobility',
  icon: '🚗',  // Change icon
  description: 'Electric vehicle services',
  color: 'emerald'  // Change color (Tailwind colors)
}
```

### Moving Views Between Domains

Edit `DOMAIN_VIEW_MAP` in `types.ts`:
```typescript
fx: [
  'fxmarginbuilder',
  'fxpricing',
  'fxcampaigns',
  'fxdiscountoptions',
  'campaigns',  // Move from emobility to fx
],
```

## Rollback Procedure

### Quick Disable (Recommended for Testing)

**File:** `DomainConfig.ts`
```typescript
ENABLE_DOMAIN_SYSTEM: false
```
Refresh app → Original behavior restored

### Full Rollback (Remove All Changes)

See **SECURITY_DOMAINS.md** section "Full Rollback" for complete instructions.

## Support

### Common Issues

**Q: Top menu doesn't appear**  
A: Check `DomainConfig.ENABLE_DOMAIN_SYSTEM` is `true`

**Q: Sidebar shows no items**  
A: Domain has no views mapped in `DOMAIN_VIEW_MAP`

**Q: Can't switch domains**  
A: Check user's `allowedDomains` includes the target domain

**Q: Want to show all menus temporarily**  
A: Set `DomainConfig.DEMO_MODE = true`

### Getting Help

- Review **SECURITY_DOMAINS.md** for security questions
- Check **types.ts** for domain mappings
- Inspect **DomainConfig.ts** for feature flags

## Architecture Benefits

✅ **Safe:** Easily disabled with one config change  
✅ **Backward Compatible:** Works with existing code  
✅ **Scalable:** Add unlimited domains without code changes  
✅ **Secure:** Ready for multi-tenant data isolation  
✅ **Demo-Ready:** Perfect for customer presentations  
✅ **Flexible:** Components can appear in multiple domains  

## What's Protected

### ✅ Already Implemented (Safe to Use)
- UI-level menu filtering
- Domain access control in TopMenu
- View restrictions per domain
- User domain preferences
- Backward compatibility
- Easy rollback

### ⚠️ Requires Additional Work (Before Production)
- Database-level data isolation
- Firebase security rules
- API endpoint access control
- TenantId enforcement
- Data migration
- Security testing

---

**Ready to test!** Start the app and click through the domains.

**Before production:** Complete security setup in SECURITY_DOMAINS.md

**Questions?** All configuration is in DomainConfig.ts
