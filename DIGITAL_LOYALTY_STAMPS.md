# Digital Loyalty Stamps - Reference Data Manager

## Overview

Digital Loyalty Stamps have been added to the Reference Data Manager as a new reference data category. This feature allows administrators to create and manage loyalty stamp programs with flexible expiry options and customizable reward messaging.

## Features

### Data Fields

Each Digital Loyalty Stamp entry includes the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **Stamp Name** | Text | Yes | Display name of the loyalty stamp |
| **Business Name** | Text | Yes | Name of the business associated with the stamp |
| **Reward Name** | Text | Yes | Name of the reward customers receive |
| **Stamp Description** | Text | Yes | Detailed description of the stamp program |
| **Stamp Success Message** | Text | Yes | Message shown when customer earns a stamp |
| **Reward Success Message** | Text | Yes | Message shown when customer claims their reward |
| **Stamp Icon** | Image | No | Uploaded image/icon representing the stamp |
| **Expiry Type** | Dropdown | Yes | How the stamp expires (see below) |
| **Expiry Date** | Date | Conditional | Required if expiry type is "Expires on a specific date" |
| **Days After Sign-up** | Number | Conditional | Required if expiry type is "Expires X days after sign-up" |

### Expiry Type Options

1. **Never Expire** - Stamps have no expiration date
2. **Expires on a specific date** - All stamps expire on the same calendar date
3. **Expires X days after sign-up** - Each stamp expires X days after the customer earns it

### Standard Operations

#### Add New Stamp
1. Select "Digital Loyalty Stamps" from the category dropdown
2. Click the **Add** button
3. Fill in all required fields
4. Upload a stamp icon image (optional)
5. Select the expiry type and provide expiry details
6. Click **Add** to save

#### Edit Existing Stamp
1. Click the **Edit** button next to the stamp you want to modify
2. Update any fields as needed
3. Upload a new icon if desired
4. Click **Update** to save changes

#### Delete Stamp
1. Click the **Delete** button next to the stamp
2. Confirm deletion in the popup dialog
3. The record is permanently removed

## Audit Logging

All operations on Digital Loyalty Stamps are automatically logged to the audit trail:

- **Create**: Logs when a new stamp is added with all initial values
- **Update**: Logs all field changes with old and new values
- **Delete**: Logs which stamp was deleted and by whom

Audit logs include:
- User email and name
- Timestamp
- Action type (create/update/delete)
- Entity details (stamp name, ID)
- Change history (for updates)

## Image Upload

### Stamp Icon
- **Format**: PNG, JPG, or other common image formats
- **Storage**: Images are stored as base64-encoded data in Firebase
- **Size**: Recommended max 1MB for optimal performance
- **Display**: Icons appear as thumbnails in the table view (12x12px preview)

### Icon Preview
When editing a stamp, the current icon displays below the upload field for reference.

## Database Structure

Loyalty stamps are stored in Firebase Realtime Database at:
```
referenceLoyaltyStamps/
├── stampId1/
│   ├── id: "stampId1"
│   ├── name: "Weekend Traveler"
│   ├── businessName: "eMobility Plus"
│   ├── rewardName: "Free Ride Voucher"
│   ├── stampDescription: "Earn stamps with every weekend ride"
│   ├── stampSuccessMessage: "Great! You earned a stamp!"
│   ├── rewardSuccessMessage: "Congratulations! Your reward has been claimed."
│   ├── stampIcon: "data:image/png;base64,..." (base64 image)
│   ├── expiryType: "daysAfterSignup"
│   ├── expiryDays: 180
│   ├── dateAdded: "2025-12-23T10:30:00Z"
│   └── addedBy: "admin@example.com"
├── stampId2/
│   └── ...
```

## Integration Points

The Digital Loyalty Stamps reference data can be used by:
- Loyalty trigger event systems
- Customer reward programs
- Marketing campaigns
- Mobile app for displaying available rewards

## Best Practices

1. **Clear Descriptions**: Write clear, customer-friendly descriptions for stamps
2. **Meaningful Names**: Use descriptive names that explain the stamp purpose
3. **Icon Usage**: Include icons for better visual identification
4. **Message Clarity**: Craft success messages that motivate customer action
5. **Expiry Planning**: Set reasonable expiry periods to maintain program engagement
6. **Regular Review**: Periodically review and archive expired stamp programs

## Validation Rules

- All required fields must be filled before saving
- Expiry date is required when "Expires on a specific date" is selected
- Days after sign-up must be a positive number (minimum 1)
- Icon upload is optional but recommended

## Access Control

Digital Loyalty Stamps reference data management is available to users with appropriate role permissions for the Reference Data Manager. All changes are logged with the user's email address.

## Troubleshooting

### Image won't upload
- Check file size is under 5MB
- Ensure file is a valid image format (PNG, JPG, GIF, etc.)
- Try using a different image file

### Expiry fields not showing
- Ensure you've selected an expiry type from the dropdown
- Save the form to trigger conditional field display
- Refresh the page if fields still don't appear

### Audit logs not appearing
- Verify user has proper Firebase database permissions
- Check that Firebase is properly initialized
- Review browser console for error messages

## Examples

### Example 1: Weekend Rider Stamps
```
Name: Weekend Traveler
Business: eMobility Express
Reward: Free Ride Voucher
Description: Earn one stamp per weekend trip, redeem 5 stamps for a free ride
Expiry: 180 days after sign-up
```

### Example 2: Birthday Month Special
```
Name: Birthday Bonus
Business: eMobility Rewards
Reward: 20% Discount
Description: Extra stamp during your birthday month
Expiry: Expires on 12/31/2025
```

### Example 3: Permanent Loyalty Badge
```
Name: Platinum Member
Business: eMobility Club
Reward: Exclusive Benefits
Description: Permanent member status for loyal customers
Expiry: Never Expire
```

## Support

For issues or questions about Digital Loyalty Stamps, contact the development team or check the Audit Manager for a complete history of changes.
