import { supabase } from './supabase';

export interface EmailAttachment {
  filename: string;
  contentType: string;
  /** Base64-encoded file content, no data: prefix. */
  content: string;
}

export interface SendEmailPayload {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  emailType?: string;
  relatedType?: string;
  relatedId?: string;
}

function toRecipientList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : value.split(/[,;]/);
  return list.map((v) => v.trim()).filter(Boolean);
}

/**
 * Sends mail via a Power Automate HTTP-triggered Flow instead of the (unreliable, Gmail-OAuth-based)
 * Supabase Edge Function this used to call. The Flow is expected to accept this JSON body and send
 * the email itself (e.g. via an Office 365 Outlook / Outlook.com "Send an email (V2)" action) — see
 * src/lib/README-power-automate-email.md for the payload contract and Flow setup notes. Delivery
 * status still lands in email_log, written directly from the client since Power Automate has no
 * access back into Supabase.
 */
export async function sendEmail(payload: SendEmailPayload) {
  const webhookUrl = process.env.NEXT_PUBLIC_POWER_AUTOMATE_EMAIL_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('Email sending is not configured — set NEXT_PUBLIC_POWER_AUTOMATE_EMAIL_WEBHOOK_URL to the Power Automate Flow URL.');
  }

  const to = toRecipientList(payload.to);
  const cc = toRecipientList(payload.cc);
  const attachments = payload.attachments ?? [];
  if (!to.length || !payload.subject || (!payload.html && !payload.text)) {
    throw new Error('Recipient, subject and email body are required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        cc,
        subject: payload.subject,
        html: payload.html || '',
        text: payload.text || '',
        attachments,
        emailType: payload.emailType || 'General',
        relatedType: payload.relatedType || null,
        relatedId: payload.relatedId ? String(payload.relatedId) : null,
        sentByEmail: user?.email ?? null,
      }),
    });
  } catch {
    throw new Error('Could not reach the Power Automate webhook — check the network and the Flow URL.');
  }

  // Power Automate's default "When an HTTP request is received" trigger can respond with an
  // empty 200/202 body unless the Flow has an explicit "Respond to a PowerApp or flow" action, and
  // an unhandled Flow failure comes back as plain text or an Azure-style `{ error: { message } }`
  // rather than the `{ ok, error }` shape documented in README-power-automate-email.md — read the
  // body as text first and only parse it as JSON, so every shape ends up as a plain string message
  // rather than accidentally stringifying an object to "[object Object]".
  const rawBody = await response.text().catch(() => '');
  let responseBody: { ok?: boolean; error?: unknown; message?: string; messageId?: string } | null = null;
  if (rawBody) {
    try {
      responseBody = JSON.parse(rawBody);
    } catch {
      // Not JSON — rawBody itself is used as the error message below.
    }
  }

  function errorMessageFrom(body: typeof responseBody, raw: string): string | null {
    const err = body?.error;
    if (typeof err === 'string' && err) return err;
    if (err && typeof err === 'object') {
      const nested = (err as { message?: string; code?: string }).message;
      if (nested) return nested;
    }
    if (typeof body?.message === 'string' && body.message) return body.message;
    if (raw.trim()) return raw.trim().slice(0, 500);
    return null;
  }

  if (!response.ok || responseBody?.ok === false) {
    throw new Error(errorMessageFrom(responseBody, rawBody) || `The email webhook rejected the request (HTTP ${response.status}).`);
  }

  const messageId = responseBody?.messageId || crypto.randomUUID();
  const sentAt = new Date().toISOString();

  const { error: logError } = await supabase.from('email_log').insert({
    email_type: payload.emailType || 'General',
    related_type: payload.relatedType || null,
    related_id: payload.relatedId ? String(payload.relatedId) : null,
    to_email: to.join(', '),
    cc_email: cc.length ? cc.join(', ') : null,
    subject: payload.subject,
    status: 'Sent',
    provider: 'Power Automate',
    provider_message_id: messageId,
    sent_by: user?.id ?? null,
    sent_at: sentAt,
    metadata: { provider: 'Power Automate', attachment_count: attachments.length, attachment_names: attachments.map((a) => a.filename) },
  });
  if (logError) console.error('email_log insert failed', logError);

  return { ok: true as const, messageId, threadId: null, attachments: attachments.length, sentAt };
}

/** Downloads a Supabase Storage object and returns it as a base64 email attachment. */
export async function downloadAsAttachment(bucket: string, path: string, filename: string, contentType: string): Promise<EmailAttachment> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Could not download ${filename} for the email attachment.`);
  const buffer = await data.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return { filename, contentType: contentType || data.type || 'application/octet-stream', content: btoa(binary) };
}

interface EmailRow {
  label: string;
  value: string;
}

/** A 680px, inline-styled, table-based email body compatible with Outlook Desktop's rendering engine. */
export function outlookEmailTemplate(opts: {
  heading: string;
  intro: string;
  rows: EmailRow[];
  itemsTable?: { headers: string[]; rows: string[][] };
  totalLabel?: string;
  totalValue?: string;
  advisory?: string;
  boxedNote?: { label: string; value: string };
  signatureName: string;
  signatureRole: string;
  signatureEmail: string;
}): string {
  const { heading, intro, rows, itemsTable, totalLabel, totalValue, advisory, boxedNote, signatureName, signatureRole, signatureEmail } = opts;
  const rowsHtml = rows
    .map(
      (r) =>
        `<tr><td width="180" style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;vertical-align:top;">${r.label}</td><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111827;font-weight:bold;">${r.value}</td></tr>`
    )
    .join('');

  const itemsHtml = itemsTable
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0;border-collapse:collapse;">
        <tr>${itemsTable.headers.map((h) => `<td style="padding:6px 8px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;">${h}</td>`).join('')}</tr>
        ${itemsTable.rows
          .map(
            (r) =>
              `<tr>${r.map((c) => `<td style="padding:6px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;">${c}</td>`).join('')}</tr>`
          )
          .join('')}
      </table>`
    : '';

  const totalHtml =
    totalLabel && totalValue
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 14px;">
          <tr><td style="padding:8px 10px;background:#eff6ff;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1d4ed8;font-weight:bold;">${totalLabel}</td>
          <td style="padding:8px 10px;background:#eff6ff;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d4ed8;font-weight:bold;text-align:right;">${totalValue}</td></tr>
        </table>`
      : '';

  const advisoryHtml = advisory
    ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;padding:10px 12px;margin:0 0 14px;">${advisory}</p>`
    : '';

  const boxedNoteHtml = boxedNote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
        <tr><td style="padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;">
          <b>${boxedNote.label}:</b> ${boxedNote.value}
        </td></tr>
      </table>`
    : '';

  return `<!--[if mso]>
<table role="presentation" width="680" cellpadding="0" cellspacing="0" align="center"><tr><td>
<![endif]-->
<table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" align="center" style="width:680px;max-width:680px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:20px 24px;background:#2563eb;">
    <span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#ffffff;font-weight:bold;">UnitedBML</span>
  </td></tr>
  <tr><td style="padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-top:none;">
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;margin:0 0 4px;font-weight:bold;">${heading}</p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;margin:0 0 16px;">${intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">${rowsHtml}</table>
    ${itemsHtml}
    ${totalHtml}
    ${boxedNoteHtml}
    ${advisoryHtml}
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;margin:16px 0 0;">Regards,<br/>
      <b>${signatureName}</b>${signatureRole ? `, ${signatureRole}` : ''}${signatureEmail ? `<br/>${signatureEmail}` : ''}
    </p>
  </td></tr>
  <tr><td style="padding:14px 24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;">
    Sent by UnitedBML Management Hub.
  </td></tr>
</table>
<!--[if mso]>
</td></tr></table>
<![endif]-->`;
}
