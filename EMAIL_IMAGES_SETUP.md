# Email Images Setup Guide

Your referral emails now include professional marketing images! Here's how to add them:

## Quick Start

1. **Add your images** to the `public/email-assets/` folder
2. **Name them exactly** as shown below
3. **Test** by sending a referral email

## Required Images

### Logo (Required)
- **Filename**: `logo.png`
- **Size**: 200px wide (max), 80px tall (max)
- **Format**: PNG with transparent background
- **Use**: Header branding

### Hero Banner (Required)
- **Filename**: `hero-banner.jpg`
- **Size**: 600px wide x 300px tall
- **Format**: JPG or PNG
- **Use**: Eye-catching banner below header
- **Ideas**: Electric vehicles, charging stations, happy customers

### FX Feature Image (Optional)
- **Filename**: `fx-feature.jpg`
- **Size**: 280px wide x 200px tall
- **Format**: JPG or PNG
- **Use**: Displays when FX Campaign is linked to referral
- **Ideas**: Currency symbols, international payments, exchange rate graphics

## Social Media Icons (Optional)

Add 32x32px PNG icons:
- `facebook-icon.png`
- `twitter-icon.png`
- `linkedin-icon.png`
- `instagram-icon.png`

### Update Social Links

Edit the footer section in both files to add your real social media URLs:

**Files to update:**
- `api/referrals/send.ts` (production/Vercel)
- `scripts/apiServer.cjs` (local development)

**Find and replace:**
```html
<a href="https://facebook.com/your-page" ...>
<a href="https://twitter.com/your-handle" ...>
<a href="https://linkedin.com/company/your-company" ...>
<a href="https://instagram.com/your-account" ...>
```

## What Happens If Images Are Missing?

The email template has smart fallbacks:

- **Missing logo**: Shows "eMobility" text instead
- **Missing hero banner**: Shows blue gradient background
- **Missing FX feature**: Section doesn't display
- **Missing social icons**: Icons don't display

**Emails will still work perfectly!** Add images when ready.

## Testing Your Images

### Local Testing
1. Add images to `public/email-assets/`
2. Start dev server: `npm run dev`
3. Start API server: `npm run api`
4. Send a test referral email
5. Check your inbox!

### Testing Image URLs
Visit in browser:
```
http://localhost:3002/email-assets/logo.png
http://localhost:3002/email-assets/hero-banner.jpg
```

If images load, they'll work in emails!

## Where to Find Marketing Images

### Free Stock Photos
- **Unsplash**: https://unsplash.com/
- **Pexels**: https://pexels.com/
- **Pixabay**: https://pixabay.com/

Search for:
- "electric vehicle charging"
- "sustainable transport"
- "currency exchange"
- "international payment"
- "business handshake"

### Free Social Media Icons
- **Font Awesome**: https://fontawesome.com/
- **Flaticon**: https://flaticon.com/
- **IconFinder**: https://iconfinder.com/

## Image Optimization

Before adding images, optimize them:

### Online Tools
- **TinyPNG**: https://tinypng.com/ (PNG compression)
- **Squoosh**: https://squoosh.app/ (all formats)
- **Compress JPEG**: https://compressjpeg.com/

### Target File Sizes
- Logo: < 50KB
- Hero Banner: < 150KB
- Feature Image: < 100KB
- Social Icons: < 10KB each

## Production Deployment

Once you push to GitHub/Vercel:
1. Images in `public/email-assets/` deploy automatically
2. They'll be accessible at `https://your-domain.vercel.app/email-assets/...`
3. No additional configuration needed!

## Current Email Design

Your emails now include:

✅ **Professional header** with logo
✅ **Hero banner** image
✅ **Gradient backgrounds** and dividers
✅ **FX Campaign card** with amber gradient
✅ **Feature image** (when FX Campaign linked)
✅ **Social media footer** with icons
✅ **Responsive design** (works on mobile)
✅ **Copyright footer** with current year

## Next Steps

1. **Add logo.png** to `public/email-assets/` folder
2. **Add hero-banner.jpg** for visual impact
3. **Test locally** by sending a referral
4. **Optional**: Add social icons and FX feature image
5. **Deploy** to production via Git push

---

**Need help?** See [public/email-assets/README.md](README.md) for detailed image requirements.
