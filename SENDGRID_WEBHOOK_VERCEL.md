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
- `SENDGRID_PUBLIC_KEY`: SendGrid Signed Event Webhook public key (enables signature verification).
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
- Signature verification: If `SENDGRID_PUBLIC_KEY` is set, the handler validates `X-Twilio-Email-Event-Webhook-Signature` and `X-Twilio-Email-Event-Webhook-Timestamp` against the request body. If signature verification fails and no valid `SENDGRID_WEBHOOK_TOKEN` is provided, the request is rejected.
- Ensure the `messageId` captured when sending emails is saved to `referralInvitations` and the reverse index `sendgridMessageIndex/{messageId}` for best correlation.

## Enable Signed Webhooks in SendGrid
1. In SendGrid Dashboard: Settings → Mail Settings → Event Webhook → Security → Enable "Signed Event Webhook".
2. Copy the Public Key and set it as the `SENDGRID_PUBLIC_KEY` in Vercel.
3. Save settings. Subsequent event posts will include signature headers that the function validates.
