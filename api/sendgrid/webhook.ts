import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Lazy singleton init for firebase-admin in serverless context
function initAdminOnce() {
  if (admin.apps.length > 0) return admin.app();

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    throw new Error('FIREBASE_DATABASE_URL env var is required');
  }

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const creds = JSON.parse(saJson);
    admin.initializeApp({
      credential: admin.credential.cert(creds as admin.ServiceAccount),
      databaseURL,
    });
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL,
    });
    return admin.app();
  }

  throw new Error('Missing Firebase Admin credentials. Provide FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_* vars');
}

function ok(res: VercelResponse, body: any) {
  res.status(200).json(body);
}

function bad(res: VercelResponse, code: number, message: string) {
  res.status(code).json({ error: message });
}

// Normalize SendGrid message ID (strip trailing period/partition if present)
function normalizeMessageId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  // sg_message_id can look like "<id>.<partition>"
  const id = String(raw).split('.')[0].trim();
  return id || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for safety (SendGrid posts server-to-server; adjust if needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return bad(res, 405, 'Method not allowed');
  }

  // Simple shared-secret auth
  const tokenParam = (req.query.token as string) || '';
  const authHeader = req.headers['authorization'] || '';
  const suppliedToken = tokenParam || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
  const expectedToken = process.env.SENDGRID_WEBHOOK_TOKEN || '';
  if (!expectedToken || suppliedToken !== expectedToken) {
    return bad(res, 401, 'Unauthorized');
  }

  let events: any[] = [];
  try {
    if (typeof req.body === 'string') {
      events = JSON.parse(req.body);
    } else if (Array.isArray(req.body)) {
      events = req.body as any[];
    } else if (req.body) {
      // SendGrid always sends array, but guard anyway
      events = [req.body];
    }
  } catch (e) {
    return bad(res, 400, 'Invalid JSON');
  }

  if (!Array.isArray(events)) {
    return bad(res, 400, 'Expected an array of events');
  }

  try {
    const app = initAdminOnce();
    const db = admin.database();

    // Process all events; collect minimal stats
    let stored = 0;
    for (const evt of events) {
      const eventType = evt.event as string | undefined;
      const messageId = normalizeMessageId(evt.sg_message_id || evt['sg_message_id'] || evt['smtp-id']);
      const ts = evt.timestamp || Math.floor(Date.now() / 1000);

      // If no message id, store under unknown bucket
      const bucketId = messageId || `unknown-${Date.now()}`;

      // Store raw event under sendgridEvents/{messageId}
      const evRef = db.ref(`sendgridEvents/${bucketId}`).push();
      await evRef.set({ ...evt, event: eventType, timestamp: ts });
      stored++;

      // Attempt to locate corresponding invitation
      let invitationId: string | null = null;

      if (messageId) {
        const idxSnap = await db.ref(`sendgridMessageIndex/${messageId}`).get();
        if (idxSnap.exists()) {
          invitationId = idxSnap.val()?.invitationId || idxSnap.val();
        } else {
          // Fallback: query by child (requires index in DB rules for large data)
          const invSnap = await db
            .ref('referralInvitations')
            .orderByChild('messageId')
            .equalTo(messageId)
            .limitToFirst(1)
            .get();
          if (invSnap.exists()) {
            const firstKey = Object.keys(invSnap.val())[0];
            invitationId = firstKey || null;
          }
        }
      }

      if (invitationId) {
        const invRef = db.ref(`referralInvitations/${invitationId}`);
        const upd: any = { lastEvent: eventType, lastEventAt: new Date(ts * 1000).toISOString() };

        // Maintain eventCounts subobject
        const countsRef = invRef.child('eventCounts');
        const countsSnap = await countsRef.get();
        const counts = countsSnap.exists() ? countsSnap.val() : {};
        const prev = Number(counts[eventType || 'unknown'] || 0);
        counts[eventType || 'unknown'] = prev + 1;
        await countsRef.set(counts);

        // Status transitions + timestamp fields
        switch (eventType) {
          case 'delivered':
            upd.status = 'delivered';
            upd.deliveredAt = new Date(ts * 1000).toISOString();
            break;
          case 'bounce':
          case 'dropped':
            upd.status = 'bounced';
            upd.bouncedAt = new Date(ts * 1000).toISOString();
            upd.bounceReason = evt.reason || evt.response || '';
            break;
          case 'deferred':
            upd.status = 'deferred';
            upd.deferredAt = new Date(ts * 1000).toISOString();
            break;
          case 'open':
            // keep most recent event in status only if not delivered/bounced
            upd.openedAt = new Date(ts * 1000).toISOString();
            if (!counts['delivered'] && !counts['bounced']) upd.status = 'opened';
            break;
          case 'click':
            upd.clickedAt = new Date(ts * 1000).toISOString();
            if (!counts['delivered'] && !counts['bounced']) upd.status = 'clicked';
            break;
          case 'spamreport':
            upd.status = 'spamreport';
            upd.spamReportedAt = new Date(ts * 1000).toISOString();
            break;
          default:
            // leave as-is for unhandled types
            break;
        }

        await invRef.update(upd);
      }
    }

    return ok(res, { ok: true, stored });
  } catch (e: any) {
    return bad(res, 500, `Server error: ${e?.message || String(e)}`);
  }
}
