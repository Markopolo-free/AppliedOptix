# SendGrid Event Webhook on Vercel

This repository includes a Vercel Serverless Function at `api/sendgrid/webhook.ts` that ingests SendGrid delivery events and updates referral invitation status in Firebase Realtime Database.

## Public Endpoint
- Method: POST
- URL: `https://<your-vercel-domain>/api/sendgrid/webhook?token=<your-secret>`
- Auth: 
  - Query token (`?token=...`) OR
  - Header `Authorization: Bearer <your-secret>`
- Body: JSON array of SendGrid events

## Required Environment Variables (Vercel)
- `SENDGRID_WEBHOOK_TOKEN`: Shared secret for webhook requests.
- `FIREBASE_DATABASE_URL`: RTDB URL, e.g. `https://<project>-default-rtdb.firebaseio.com`.
- One of the following credential setups:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`: Paste the full service account JSON as a single env var (recommended), or
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (use `\\n`-escaped newlines), or
  - For self-hosted only: `MGM_SERVICE_ACCOUNT_PATH` / `GOOGLE_APPLICATION_CREDENTIALS`.

## Behavior
- Stores raw events under `sendgridEvents/{messageId}`.
- Correlates events to invitations via `sendgridMessageIndex/{messageId}`; falls back to a query on `referralInvitations` by `messageId`.
- Updates `referralInvitations/{invitationId}` fields: `status`, `lastEvent`, `lastEventAt`, event-specific timestamps (e.g. `deliveredAt`, `bouncedAt`), and aggregates under `eventCounts`.

## Testing
```powershell
$body = '[{"email":"test@example.com","event":"delivered","sg_message_id":"abc123","timestamp":1734400000}]'
curl -Method POST -Uri "https://<your-vercel-domain>/api/sendgrid/webhook?token=<your-secret>" -Body $body -ContentType "application/json"
```

## Notes
- Consider enabling SendGrid Webhook Security (signed events) for higher assurance; this handler uses a shared secret for simplicity.
- Ensure the `messageId` captured when sending emails is saved to `referralInvitations` and the reverse index `sendgridMessageIndex/{messageId}` for best correlation.
