# AP Vendor Master Change

Run `supabase/migrations/005_vendor_master.sql` once in Supabase SQL Editor, then redeploy the site.

Initial vendors:
- V01111 — Mohamed Shaig Ahmed — Worker ID 1892
- V02222 — Nahula — Worker ID 8555
- V03333 — Hussain Alu — Worker ID 3333

AP bill workflow:
1. Treasurer types vendor name, vendor account, or worker ID.
2. UnitedBML filters active `vendor_master` records.
3. Treasurer selects a result.
4. Vendor Account, Vendor Name and Worker ID are populated automatically.
5. Treasurer enters Bill Date and Bill Amount.

The selected vendor is persisted to `ap_bills`, including the Worker ID.
