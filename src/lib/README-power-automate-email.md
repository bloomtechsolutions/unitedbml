# Sending email via Power Automate

`sendEmail()` in `src/lib/email.ts` posts a JSON payload to the Power Automate Flow URL in
`NEXT_PUBLIC_POWER_AUTOMATE_EMAIL_WEBHOOK_URL`, instead of calling the old `send-email` Supabase
Edge Function (Gmail OAuth). This replaces the Gmail integration entirely — the Flow itself sends
the mail (e.g. via the "Office 365 Outlook — Send an email (V2)" or "Outlook.com — Send an email
(V2)" action).

## 1. Create the Flow

1. In Power Automate, create an **Instant cloud flow** triggered by **"When an HTTP request is
   received"**.
2. Set the trigger's **Request Body JSON Schema** to:

```json
{
  "type": "object",
  "properties": {
    "to": { "type": "array", "items": { "type": "string" } },
    "cc": { "type": "array", "items": { "type": "string" } },
    "subject": { "type": "string" },
    "html": { "type": "string" },
    "text": { "type": "string" },
    "attachments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "filename": { "type": "string" },
          "contentType": { "type": "string" },
          "content": { "type": "string" }
        }
      }
    },
    "emailType": { "type": "string" },
    "relatedType": { "type": "string" },
    "relatedId": { "type": "string" },
    "sentByEmail": { "type": "string" }
  }
}
```

- `to` / `cc` are always arrays of email addresses (possibly empty for `cc`).
- `html` is the email body (already a complete, inline-styled HTML document — see
  `outlookEmailTemplate()` in `email.ts`). `text` is a plain-text fallback and may be empty.
- `attachments[].content` is **base64-encoded file content, no `data:` prefix** — feed it straight
  into the Send Email action's attachment content field.
- `emailType` / `relatedType` / `relatedId` describe what triggered the email (e.g.
  `"Procurement Pre-Approval"` / `"reimbursement_case"` / the case id) — use them for filtering,
  routing, or in the message body if useful; not required for delivery.
- `sentByEmail` is the signed-in UnitedBML user's email address, for the "sent by" record.

3. Add a **"Send an email (V2)"** action:
   - **To**: `join(triggerBody()?['to'], ';')`
   - **Cc**: `join(triggerBody()?['cc'], ';')`
   - **Subject**: `triggerBody()?['subject']`
   - **Body**: `triggerBody()?['html']` (set "Is HTML" to Yes)
   - **Attachments**: use an **Apply to each** over `triggerBody()?['attachments']`, adding one
     attachment per item with Name = `item()?['filename']` and Content = `item()?['content']`
     (Power Automate attachment content fields already expect base64, so no decoding step is
     needed).
4. Add a **"Response"** action after the send step, status `200`, body:
   ```json
   { "ok": true, "messageId": "@{outputs('Send_an_email_(V2)')?['body/id']}" }
   ```
   (Any identifier is fine, or omit `messageId` — the app falls back to a generated id. If the send
   step fails, respond with a non-2xx status and `{ "ok": false, "error": "..." }` so the app
   surfaces the real reason instead of a generic failure.)

## 2. Wire the URL into the app

Copy the Flow's **HTTP POST URL** (shown on the trigger after saving) into:

- `.env.local` for local dev, and
- the `NEXT_PUBLIC_POWER_AUTOMATE_EMAIL_WEBHOOK_URL` environment variable on whatever hosts the
  production build (e.g. Vercel project settings) — then redeploy.

The variable is unset by default; until it's set, `sendEmail()` throws a clear
"Email sending is not configured" error instead of silently failing.

## 3. Delivery logging

Power Automate has no access back into Supabase, so the client writes the `email_log` row itself
right after a successful webhook response (same table/columns the old Edge Function wrote to —
Finance, Reimbursements, etc. keep working unchanged). If a Flow run fails, nothing is logged and
`sendEmail()` throws, so the caller's existing error handling (toasts, "Failed to send…" banners)
still applies.

## 4. Retiring the old path

`supabase/functions/send-email` (the Gmail OAuth Edge Function) is no longer called by the app and
can be deleted/undeployed along with its `GMAIL_*` secrets once the Flow above is confirmed
working.
