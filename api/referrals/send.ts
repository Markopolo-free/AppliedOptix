import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

function initAdminOnce() {
  if (admin.apps.length > 0) return admin.app();

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) throw new Error('FIREBASE_DATABASE_URL is required');

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const creds = JSON.parse(saJson);
    admin.initializeApp({ credential: admin.credential.cert(creds as admin.ServiceAccount), databaseURL });
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      databaseURL,
    });
    return admin.app();
  }

  throw new Error('Missing Firebase Admin credentials for serverless API');
}

function response(res: VercelResponse, code: number, body: any) { res.status(code).json(body); }

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function isValidEmail(e: string) { return /.+@.+\..+/.test(e); }

function buildEmailHtml(opts: { appUrl: string; referralCode: string; fromEmail: string; memberEmail?: string | null; campaignName?: string | null; discountAmount?: number | null; discountType?: string | null; welcomeMessage?: string | null; }) {
  const {
    appUrl, referralCode, fromEmail, memberEmail, campaignName,
    discountAmount, discountType, welcomeMessage,
  } = opts;
  const link = `${appUrl.replace(/\/$/, '')}/register?ref=${encodeURIComponent(referralCode)}`;
  const discount = discountAmount != null ? `${discountAmount}${discountType === 'percentage' ? '%' : ''}` : '';
  return `<!DOCTYPE html>
  <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Your Invitation</title></head>
  <body style="margin:0;padding:0;background:#f6f8fa;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(90deg,#1e3a8a,#2563eb);color:#fff;border-radius:12px 12px 0 0;padding:24px;">
        <h1 style="margin:0;font-size:20px;font-weight:700;">You're Invited${campaignName ? `: ${campaignName}` : ''}</h1>
        <p style="margin:8px 0 0 0;opacity:.9;">${memberEmail ? `${memberEmail} has invited you to join` : 'Join us using your unique referral code'}.</p>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:24px;">
        ${welcomeMessage ? `<p style="margin-top:0;color:#374151;">${welcomeMessage}</p>` : ''}
        ${discount ? `<p style="margin:8px 0;color:#374151;">Welcome offer: <strong>${discount}</strong></p>` : ''}
        <p style="margin:8px 0;color:#374151;">Your referral code:</p>
        <div style="font-family:monospace;font-size:24px;font-weight:700;background:#f3f4f6;border-radius:8px;padding:12px 16px;display:inline-block;">${referralCode}</div>
        <div style="margin-top:16px;">
          <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600;">Register Now</a>
        </div>
        <p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">Sent from ${fromEmail}</p>
      </div>
    </div>
  </body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return response(res, 405, { error: 'Method not allowed' });

  try {
    const apiKey = requiredEnv('SENDGRID_API_KEY');
    const defaultFrom = requiredEnv('FROM_EMAIL');
    const appUrl = requiredEnv('APP_URL');

    const { referralCode, to, from } = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
    if (!referralCode || !to) return response(res, 400, { error: 'referralCode and to are required' });
    if (!isValidEmail(to)) return response(res, 400, { error: 'Invalid recipient email' });
    if (from && !isValidEmail(from)) return response(res, 400, { error: 'Invalid from address' });

    // Init admin/db
    initAdminOnce();
    const db = admin.database();

    // Fetch referral code record. Stored under referralCodes/{code}
    const refSnap = await db.ref(`referralCodes/${referralCode}`).get();
    if (!refSnap.exists()) return response(res, 404, { error: 'Referral code not found' });
    const codeData = refSnap.val() || {};

    const fromEmail = (from || defaultFrom) as string;

    // Compose email
    const html = buildEmailHtml({
      appUrl,
      referralCode,
      fromEmail,
      memberEmail: codeData.memberEmail || null,
      campaignName: codeData.campaignName || null,
      discountAmount: codeData.discountAmount ?? null,
      discountType: codeData.discountType || null,
      welcomeMessage: codeData.welcomeMessage || null,
    });
    const text = `You're invited${codeData.campaignName ? `: ${codeData.campaignName}` : ''}.\nReferral code: ${referralCode}\nRegister: ${appUrl.replace(/\/$/, '')}/register?ref=${encodeURIComponent(referralCode)}`;

    sgMail.setApiKey(apiKey);

    // Send email
    const [rsp] = await sgMail.send({
      to,
      from: fromEmail,
      subject: codeData.campaignName ? `Invitation: ${codeData.campaignName}` : 'Your invitation',
      text,
      html,
    });

    // Try to pull SendGrid message ID
    let messageId: string | undefined = undefined;
    try {
      const h = rsp.headers as any;
      messageId = (h && (h['x-message-id'] || h['X-Message-Id'])) as string | undefined;
    } catch {}

    // Record invitation
    const invRef = db.ref('referralInvitations').push();
    const nowIso = new Date().toISOString();
    const invitation = {
      id: invRef.key,
      referralCode,
      sentTo: to,
      from: fromEmail,
      sentAt: nowIso,
      status: 'sent',
      messageId: messageId || null,
    };
    await invRef.set(invitation);

    if (messageId) {
      await db.ref(`sendgridMessageIndex/${messageId}`).set({ invitationId: invRef.key, referralCode, sentTo: to });
    }

    // Audit log (best-effort)
    try {
      const auditRef = db.ref('auditLogs').push();
      await auditRef.set({
        action: 'send_referral_email',
        entityType: 'referralInvitation',
        entityId: invRef.key,
        timestamp: nowIso,
        changes: invitation,
      });
    } catch {}

    return response(res, 200, { ok: true, invitationId: invRef.key, messageId: messageId || null });
  } catch (e: any) {
    return response(res, 500, { error: e?.message || 'Server error' });
  }
}
