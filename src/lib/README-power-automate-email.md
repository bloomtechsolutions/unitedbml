# Sending email via Power Automate

`sendEmail()` in `src/lib/email.ts` posts a JSON payload to `/api/send-email`
(`src/app/api/send-email/route.ts`), a small Next.js server route that checks the caller is an
authenticated, active UnitedBML user and then forwards the request to a Power Automate Flow URL —
held in the **server-only** env var `POWER_AUTOMATE_EMAIL_WEBHOOK_URL`. This replaces the old
`send-email` Supabase Edge Function (Gmail OAuth) entirely — the Flow itself sends the mail (e.g.
via the "Office 365 Outlook — Send an email (V2)" or "Outlook.com — Send an email (V2)" action).

**The Flow's URL is a bearer credential** — its `sig=` query parameter is a signature that lets
anyone holding the URL trigger it, no further auth required. That's why the app never puts it in a
`NEXT_PUBLIC_` variable or calls it directly from the browser: it stays server-side, and the
`/api/send-email` route is what the client actually talks to.

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
- `sentByEmail` is the signed-in UnitedBML user's email address (set by `/api/send-email`, not the
  browser), for the "sent by" record.

3. Attachments need to land on **one** email as an array, not one email per attachment — so
   **don't** wrap "Send an email (V2)" in an Apply to each (that sends a separate email per
   attachment). Instead, build the array first with a **"Select"** action (Data Operation), placed
   right before "Send an email (V2)":
   - **From**: `triggerBody()?['attachments']`
   - Switch its Map to "Text" input mode isn't needed — leave it as **Map**, and enter these two
     key/value pairs (Power Automate auto-adds a second row once you fill the first):
     - `Name` → `item()?['filename']`
     - `ContentBytes` → `item()?['content']`
   (The `content` values from the app are already base64, which is exactly what `ContentBytes`
   expects — no decoding step needed.)
4. Add a **"Send an email (V2)"** action:
   - **To**: `join(triggerBody()?['to'], ';')`
   - **Cc**: `join(triggerBody()?['cc'], ';')`
   - **Subject**: `triggerBody()?['subject']`
   - **Body**: `triggerBody()?['html']` (set "Is HTML" to Yes)
   - **Attachments**: click the small **"Switch to input entire array"** icon in the top-right
     corner of the Attachments Name/Content box (it turns the two per-item fields into one array
     field), then set it to `body('Select')` — the output of the Select action above.
5. Add a **"Response"** action after the send step, status `200`, body:
   ```json
   { "ok": true, "messageId": "@{outputs('Send_an_email_(V2)')?['body/id']}" }
   ```
   (Any identifier is fine, or omit `messageId` — the app falls back to a generated id. If the send
   step fails, respond with a non-2xx status and `{ "ok": false, "error": "..." }` so the app
   surfaces the real reason instead of a generic failure.)

## 2. Wire the URL into the app

Copy the Flow's **HTTP POST URL** (shown on the trigger after saving — the full thing, including
the `?api-version=...&sp=...&sv=...&sig=...` query string) into:

- `.env.local` for local dev, and
- the `POWER_AUTOMATE_EMAIL_WEBHOOK_URL` environment variable on whatever hosts the production
  build (e.g. Vercel project settings — a plain "Environment Variable", **not** one exposed to the
  browser) — then redeploy (Next.js reads server-only env vars at request time, but a fresh
  deployment is still the reliable way to pick up a newly-added one).

Getting the URL slightly wrong (truncated, or with `&` turned into `&amp;` by a copy-paste from
rendered HTML instead of the trigger's own copy-icon button) surfaces as Azure rejecting the
request with "The request must be authenticated only by Shared Access scheme." — if you see that,
re-copy the URL from the copy icon next to the HTTP POST URL field.

The variable is unset by default; until it's set, `/api/send-email` returns a clear "Email sending
is not configured on the server" error instead of silently failing.

## 3. Delivery logging

Power Automate has no access back into Supabase, so the client writes the `email_log` row itself
right after a successful response from `/api/send-email` (same table/columns the old Edge Function
wrote to — Finance, Reimbursements, etc. keep working unchanged). If a Flow run fails, nothing is
logged and `sendEmail()` throws, so the caller's existing error handling (toasts, "Failed to
send…" banners) still applies.

## 4. Retiring the old path

`supabase/functions/send-email` (the Gmail OAuth Edge Function) is no longer called by the app and
can be deleted/undeployed along with its `GMAIL_*` secrets once the Flow above is confirmed
working.
