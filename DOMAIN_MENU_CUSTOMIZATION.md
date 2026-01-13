# Domain Menu Customization Guide

## Quick Start - Adding Features to Domains

### Example: Add "Service Management" to Financial Services

**Option 1: Using the Visual Menu Builder (Easiest)**

1. Navigate to **Administration** → **Domain Menu Builder**
2. Select **Financial Services** domain
3. Click on **"services - Service Management"** in the Available Features list
4. Reorder features using ▲▼ buttons if needed
5. Click **"Copy to Clipboard"**
6. Open `DomainMenuConfig.ts` and paste the configuration
7. Save - changes apply immediately!

**Option 2: Edit Configuration File Directly**

1. Open **`DomainMenuConfig.ts`**
2. Find the `fintech` section (around line 120)
3. Add `'services'` to the views array:

```typescript
fintech: {
  label: 'Financial Services',
  icon: '🏦',
  description: 'Banking and financial technology',
  color: 'purple',
  views: [
    'customerManager',
    'customerActivityManager',
    'services',  // ← ADD THIS LINE
    'calculatorService',
    'campaignsReport',
    'mgmNotifications',
    'referralCodes',
  ]
},
```

4. Save the file - changes take effect immediately with hot reload!

## Available Features Reference

All available features are listed in `DomainMenuConfig.ts` under `AVAILABLE_VIEWS`:

### Administration Features
- `users` - User Management
- `companyDetails` - Company Details
- `theme` - Theme Builder
- `domainMenuBuilder` - Domain Menu Builder (this tool!)
- `audit` - Audit Log
- `reference` - Reference Data
- `dataextract` - Data Extraction
- `pushTestAdmin` - Push Test Admin
- `tokenListAdmin` - Token List

### FX Features
- `fxmarginbuilder` - FX Margin Builder
- `fxpricing` - FX Pricing
- `fxcampaigns` - FX Campaigns
- `fxdiscountoptions` - FX Discount Groups

### eMobility Features
- `services` - Service Management
- `pricing` - Pricing Rules
- `zones` - Pricing Zones
- `bundledpricing` - Bundled Pricing
- `loyalty` - Loyalty Programs
- `campaigns` - Campaigns
- `referralCodes` - Referral Codes
- `discountgroups` - User Discount Groups

### Financial Services Features
- `customerManager` - Customers
- `customerActivityManager` - Customer Activities
- `calculatorService` - Pricing Calculator
- `campaignsReport` - Campaigns Report
- `mgmNotifications` - MGM Notifications

## Common Demo Scenarios

### Scenario 1: Financial Services with Full Features
```typescript
fintech: {
  views: [
    'customerManager',
    'services',           // Added
    'pricing',            // Added
    'campaigns',          // Added
    'loyalty',            // Added
    'mgmNotifications',
    'referralCodes',
  ]
}
```

### Scenario 2: Minimal FX Demo
```typescript
fx: {
  views: [
    'fxmarginbuilder',
    'fxpricing',
    // Removed campaigns and discount options for simpler demo
  ]
}
```

### Scenario 3: eMobility Focused on Pricing
```typescript
emobility: {
  views: [
    'services',
    'pricing',
    'zones',
    'bundledpricing',
    // Removed loyalty and campaigns
  ]
}
```

## Creating a New Client Portal

To add a completely new domain (e.g., Insurance):

1. **Add to ProductDomain type** in `types.ts`:
```typescript
export type ProductDomain = 
    | 'dashboard'
    | 'admin'
    | 'fx'
    | 'emobility'
    | 'fintech'
    | 'insurance';  // ← ADD NEW DOMAIN
```

2. **Add configuration** in `DomainMenuConfig.ts`:
```typescript
insurance: {
  label: 'Insurance',
  icon: '🛡️',
  description: 'Insurance products and claims',
  color: 'indigo',
  views: [
    'customerManager',
    'services',
    'pricing',
    'campaigns',
  ]
},
```

3. **Save and test** - the new domain appears in the top menu immediately!

## Tips for Demo Preparation

### Before a Demo
1. Use the Domain Menu Builder to customize the menu
2. Test all features work in the selected domain
3. Copy the configuration to `DomainMenuConfig.ts` to save it

### During a Demo
- Switch between domains using the top menu bar
- Each domain shows only relevant features
- The sidebar updates automatically

### After a Demo
- Restore original configuration from git if needed
- Or keep customizations for future demos

## Troubleshooting

**Q: Changes aren't showing up?**
- Make sure you saved `DomainMenuConfig.ts`
- Refresh the browser (hot reload should work automatically)
- Check browser console for validation warnings

**Q: Feature not working in new domain?**
- Some features may have backend dependencies
- Check that the feature works in its original domain first
- Database access control may need updating (see SECURITY_DOMAINS.md)

**Q: Want to reset to defaults?**
- Revert `DomainMenuConfig.ts` from git
- Or use the Domain Menu Builder to rebuild configuration

## File Locations

- **Menu Configuration**: `DomainMenuConfig.ts` (edit this!)
- **Domain Types**: `types.ts`
- **Visual Builder**: Navigate to Administration → Domain Menu Builder
- **Security Guide**: `SECURITY_DOMAINS.md`

---

**Last Updated:** 2026-01-12  
**Quick Access:** Administration → Domain Menu Builder
