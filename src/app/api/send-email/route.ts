import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface EmailAttachmentInput {
  filename?: string;
  contentType?: string;
  content?: string;
}

interface SendEmailBody {
  to?: string[];
  cc?: string[];
  subject?: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachmentInput[];
  emailType?: string;
  relatedType?: string;
  relatedId?: string | null;
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

/**
 * Server-side proxy in front of the Power Automate email Flow. The Flow's HTTP-trigger URL is a
 * bearer credential (SAS-signed) — anyone holding it can fire it — so it must never reach the
 * browser bundle. This route holds it as a server-only env var, checks the caller is an
 * authenticated, active UnitedBML user (mirroring the old send-email Edge Function's check), and
 * only then forwards the request. The client (src/lib/email.ts) calls this same-origin route
 * instead of Power Automate directly.
 */
export async function POST(req: Request) {
  const webhookUrl = process.env.POWER_AUTOMATE_EMAIL_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return json({ ok: false, error: 'Email sending is not configured on the server (POWER_AUTOMATE_EMAIL_WEBHOOK_URL is unset).' }, 500);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ ok: false, error: 'Supabase is not configured on the server.' }, 500);
  }

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ ok: false, error: 'Authentication required.' }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ ok: false, error: 'Invalid or expired UnitedBML session.' }, 401);
  }

  const { data: profile, error: profileError } = await userClient.from('profiles').select('status').eq('id', user.id).single();
  if (profileError || !profile) {
    return json({ ok: false, error: 'UnitedBML profile not found.' }, 403);
  }
  if (String(profile.status || 'Active').toLowerCase() === 'inactive') {
    return json({ ok: false, error: 'Your UnitedBML account is inactive.' }, 403);
  }

  let body: SendEmailBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid request body.' }, 400);
  }

  const to = Array.isArray(body.to) ? body.to.filter(Boolean) : [];
  if (!to.length || !body.subject || (!body.html && !body.text)) {
    return json({ ok: false, error: 'Recipient, subject and email body are required.' }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        cc: Array.isArray(body.cc) ? body.cc.filter(Boolean) : [],
        subject: body.subject,
        html: body.html || '',
        text: body.text || '',
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        emailType: body.emailType || 'General',
        relatedType: body.relatedType || null,
        relatedId: body.relatedId ? String(body.relatedId) : null,
        sentByEmail: user.email ?? null,
      }),
    });
  } catch {
    return json({ ok: false, error: 'Could not reach the Power Automate webhook.' }, 502);
  }

  const rawBody = await upstream.text().catch(() => '');
  let upstreamBody: { ok?: boolean; error?: unknown; message?: string; messageId?: string } | null = null;
  if (rawBody) {
    try {
      upstreamBody = JSON.parse(rawBody);
    } catch {
      // Not JSON — rawBody is used as the error message below.
    }
  }

  function errorMessageFrom(parsed: typeof upstreamBody, raw: string): string | null {
    const err = parsed?.error;
    if (typeof err === 'string' && err) return err;
    if (err && typeof err === 'object') {
      const nested = (err as { message?: string }).message;
      if (nested) return nested;
    }
    if (typeof parsed?.message === 'string' && parsed.message) return parsed.message;
    if (raw.trim()) return raw.trim().slice(0, 500);
    return null;
  }

  if (!upstream.ok || upstreamBody?.ok === false) {
    return json({ ok: false, error: errorMessageFrom(upstreamBody, rawBody) || `The email webhook rejected the request (HTTP ${upstream.status}).` }, 502);
  }

  return json({ ok: true, messageId: upstreamBody?.messageId || null });
}
