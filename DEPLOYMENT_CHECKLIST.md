# Deployment Checklist (Vercel + SendGrid)

This checklist configures all environment variables on Vercel, sets up the SendGrid Event Webhook, and verifies the end-to-end referral email flow.

## 1) Vercel Env Vars

Run with Vercel CLI (or set in Dashboard ⇒ Project Settings ⇒ Environment Variables):

```bash
vercel login
vercel link

# Firebase Admin + RTDB (Serverless functions)
vercel env add FIREBASE_DATABASE_URL production
# Paste: https://emobility-service-default-rtdb.firebaseio.com

# Recommended: paste full Service Account JSON
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production

# Or (alternative) individual fields
vercel env add FIREBASE_PROJECT_ID production
vercel env add FIREBASE_CLIENT_EMAIL production
vercel env add FIREBASE_PRIVATE_KEY production
# Use \n-escaped newlines when pasting PRIVATE_KEY.

# Email + App settings
vercel env add SENDGRID_API_KEY production
vercel env add FROM_EMAIL production
vercel env add APP_URL production

# Webhook auth (shared secret)
vercel env add SENDGRID_WEBHOOK_TOKEN production

# UI defaults (optional)
vercel env add VITE_FROM_EMAIL production
vercel env add VITE_APP_URL production

# Pull to local file if you want
vercel env pull .env.production.local
```

After adding env vars, trigger a redeploy:

```bash
vercel deploy --prod
```

## 2) SendGrid Event Webhook

- In SendGrid Dashboard ⇒ Settings ⇒ Mail Settings ⇒ Event Webhook ⇒ Enable
- HTTP POST URL:
  - `https://<your-vercel-domain>/api/sendgrid/webhook?token=<YOUR_SENDGRID_WEBHOOK_TOKEN>`
  - Or add header `Authorization: Bearer <YOUR_SENDGRID_WEBHOOK_TOKEN>`
- Events: delivered, deferred, bounce, dropped, open, click, spamreport
- Save.

Optional (later): Enable Signed Event Webhook security and validate signatures.

## 3) Validate

A) Webhook sanity check:

```powershell
$body = '[{"email":"test@example.com","event":"delivered","sg_message_id":"abc123","timestamp":1734400000}]'
curl -Method POST -Uri "https://<your-vercel-domain>/api/sendgrid/webhook?token=<YOUR_SENDGRID_WEBHOOK_TOKEN>" -Body $body -ContentType "application/json"
```

Expected: Response `{ ok: true, stored: 1 }`. In Firebase RTDB, `sendgridEvents/abc123` should appear.

B) Full flow from UI:
- Open the app and navigate to the Referral Code Manager.
- Send an email using "✉️ Send Email" for a code.
- Check `referralInvitations` for a new record with `messageId`.
- As events arrive from SendGrid, watch status update and view the timeline via "📬 View Events".

## 4) Troubleshooting Tips

- `401 Unauthorized` on webhook: Confirm `SENDGRID_WEBHOOK_TOKEN` matches the one used in the URL or Bearer header.
- `Missing Firebase Admin credentials`: Ensure either `FIREBASE_SERVICE_ACCOUNT_JSON` is set or the individual fields (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
- Emails rejected: Use a verified Single Sender or authenticated domain in SendGrid. Check Activity Feed for blocks/bounces.
- Links/branding: Make sure `APP_URL` is the public frontend URL and matches email templates.
- Local dev: The Vite proxy maps `/api/*` to `http://localhost:5050` when running `npm run api`. In production, Vercel handles `/api/*`.
