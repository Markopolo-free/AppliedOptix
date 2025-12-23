# Email Assets

This folder contains images used in SendGrid referral emails.

## Required Images

Add the following image files to this directory:

### 1. **logo.png** (Required)
- **Size**: 200-250px wide, max 80px tall
- **Format**: PNG with transparent background
- **Purpose**: Brand logo in email header
- **Recommendation**: High-resolution, simple design

### 2. **hero-banner.jpg** (Required)
- **Size**: 600px wide x 300-400px tall
- **Format**: JPG or PNG
- **Purpose**: Eye-catching campaign visual below header
- **Recommendation**: Professional photo showcasing emobility/FX services

### 3. **fx-feature.jpg** (Optional)
- **Size**: 280px wide x 200px tall
- **Format**: JPG or PNG
- **Purpose**: Feature highlight for FX campaigns
- **Recommendation**: Currency exchange, international payment visuals

### 4. Social Media Icons (Optional)
Add as needed:
- **facebook-icon.png** (32x32px)
- **twitter-icon.png** (32x32px)
- **linkedin-icon.png** (32x32px)
- **instagram-icon.png** (32x32px)

## Image URLs

Once deployed to Vercel, images will be accessible at:
```
https://your-domain.vercel.app/email-assets/logo.png
https://your-domain.vercel.app/email-assets/hero-banner.jpg
https://your-domain.vercel.app/email-assets/fx-feature.jpg
```

For local testing:
```
http://localhost:3002/email-assets/logo.png
```

## Email Template Configuration

Images are automatically included in referral emails. To customize:

1. **Add your images** to this folder
2. **Update .env** if using custom domain:
   ```
   APP_URL=https://your-domain.vercel.app
   ```
3. **Deploy** to Vercel or test locally

## Image Optimization Tips

- **File Size**: Keep under 200KB per image for fast loading
- **Compression**: Use tools like TinyPNG or ImageOptim
- **Format**: 
  - PNG for logos (supports transparency)
  - JPG for photos (smaller file size)
- **Resolution**: 2x size for retina displays, but compress well
- **Alt Text**: Already included in email template for accessibility

## Placeholder Images

If you don't have images ready, the email template uses fallback styling:
- Logo area shows brand name in text
- Hero banner uses gradient background
- Feature section adapts without image

## Social Media Links

Update social media URLs in the email template:
- Edit `api/referrals/send.ts` (Vercel production)
- Edit `scripts/apiServer.cjs` (local development)

Search for `<!-- Social Media -->` section and update `href` attributes.
