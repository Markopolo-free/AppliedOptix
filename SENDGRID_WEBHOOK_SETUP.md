# SendGrid Event Webhook Setup

This API server exposes a webhook endpoint to ingest SendGrid delivery events and update referral invitation statuses in Firebase.

## Endpoint
- URL: `POST /api/sendgrid/webhook`
- Auth: Provide a shared secret either
  - As a Bearer token header: `Authorization: Bearer <SENDGRID_WEBHOOK_TOKEN>`
  - OR as a query param: `/api/sendgrid/webhook?token=<SENDGRID_WEBHOOK_TOKEN>`
- Body: JSON array of SendGrid events (as sent by SendGrid Event Webhook)

## Environment
- `SENDGRID_WEBHOOK_TOKEN`: Shared secret for webhook requests.
- `MGM_SERVICE_ACCOUNT_PATH`: Firebase Admin SDK JSON path.
- `API_PORT` (optional): Defaults to `5050`.

## Local Testing
1. Start the API server:
   - PowerShell:
     ```powershell
     $env:MGM_SERVICE_ACCOUNT_PATH="D:\secrets\emobility-service-firebase-adminsdk-fbsvc-d06db60748.json"
     $env:SENDGRID_API_KEY="<SG.x>"
     $env:SENDGRID_WEBHOOK_TOKEN="<some-strong-token>"
     npm run api
     ```
2. Send a sample event payload:
   ```powershell
   $body = '[{"email":"test@example.com","event":"delivered","sg_message_id":"abc123","timestamp":1734400000}]'
   curl -Method POST -Uri "http://localhost:5050/api/sendgrid/webhook?token=<some-strong-token>" -Body $body -ContentType "application/json"
   ```

## SendGrid Configuration
1. In SendGrid dashboard: Mail Settings → Event Webhook → Enable.
2. HTTP POST URL:
   - Use your public URL (e.g., from ngrok/dev tunnel):
     `https://<your-public-host>/api/sendgrid/webhook?token=<your-secret>`
3. Select events to send (delivered, open, click, bounce, dropped, spamreport, deferred, etc.).
4. Save.

Notes:
- For production, consider enabling SendGrid Event Webhook Security with signature verification. The current setup uses a shared secret for simplicity.
- The server stores raw events under `sendgridEvents/{messageId}` and updates `referralInvitations/{invitationId}` (status, timestamps, eventCounts) when possible by correlating `x-message-id` captured at send time.
