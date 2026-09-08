# UnitedBML - Vercel Deployment

This package is the Vercel version of the latest UnitedBML secure approval application.

## 1. Import to Vercel

Create a new Vercel project and upload/import this project folder.

Framework Preset:
- **Other**

Build Command:
- Leave blank

Output Directory:
- Leave blank

Install Command:
- Leave blank

The application is a static HTML application with one Vercel Serverless Function at `/api/config`.

## 2. Vercel Environment Variables

In **Vercel > Project > Settings > Environment Variables**, add:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

You may use `SUPABASE_PUBLISHABLE_KEY` instead of `SUPABASE_ANON_KEY`; `/api/config` supports either.

Add the variables to **Production** and, if you use preview deployments, also to **Preview**.

Redeploy after adding or changing environment variables.

## 3. Supabase Edge Functions

These remain hosted in Supabase, not Vercel:

- `send-email`
- `expense-approval`

Keep your Gmail secrets in **Supabase Edge Function Secrets**, not Vercel:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM_EMAIL`

For the `expense-approval` Edge Function, keep **Verify JWT OFF** because the secure approval link is intentionally usable without login. The function validates its one-time token server-side.

## 4. Supabase migrations

Use the migrations already included in `supabase/migrations/`. For the latest secure-approval email pipeline, make sure migration `010_secure_approval_email_pipeline_fix.sql` has been run.

## 5. Approval URLs

Approval URLs automatically use the deployed Vercel domain through `location.origin`.

For example:

`https://your-project.vercel.app/?approval=expense&id=...&token=...`

No hard-coded Netlify URL is used.

## 6. Vercel routing

`vercel.json` preserves real files and `/api/*` functions first, then sends other routes to `index.html`. This keeps the single-page application and approval links working when refreshed directly.

## 7. Custom domain

If you later add a custom domain in Vercel, approval links will automatically use that domain when generated from the production app.
