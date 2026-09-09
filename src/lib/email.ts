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

export async function sendEmail(payload: SendEmailPayload) {
  const { data, error } = await supabase.functions.invoke('send-email', { body: payload });
  if (error) throw new Error(error.message || 'Failed to reach the email service.');
  if (!data?.ok) throw new Error(data?.error || 'The email service rejected the request.');
  return data as { ok: true; messageId: string; threadId: string | null; attachments: number; sentAt: string };
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
