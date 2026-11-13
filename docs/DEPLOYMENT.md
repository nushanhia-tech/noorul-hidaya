# Deployment (Vercel + Supabase)

## 1. Supabase (production project)

1. Create a project. Pick a region close to the college (e.g. Mumbai, `ap-south-1`).
2. Apply the migrations in `supabase/migrations/` in order, using either `npx supabase db push` or the SQL editor.
3. Authentication:
   - **Sign-ups disabled.**
   - Site URL = `https://<your-domain>`.
   - Redirect URLs include `https://<your-domain>/auth/confirm`.
   - **Email templates:** for Reset Password and Invite, use the token-hash link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` (use `type=invite` for invitations).
   - Configure custom SMTP for reliable delivery (the built-in mailer is heavily rate-limited).
   - Enable MFA (TOTP).
4. Storage: the `public-media` and `documents` buckets are created by migration `…0700_storage.sql`. Confirm that `documents` is **private**.
5. Copy the project URL, the anon/publishable key and the service-role/secret key.

## 2. Vercel

1. Go to Vercel → **Add New Project** → import the GitHub repository `nushanhia-tech/noorul-hidaya`. The framework is detected as Next.js.
2. Environment variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://<your-domain>`, `NEXT_PUBLIC_TIMEZONE=Asia/Kolkata`
   - `CRON_SECRET`: a long random string. Vercel Cron sends it automatically.
   - `PAYMENT_PROVIDER` (`none` | `sandbox` | `razorpay`), plus the `RAZORPAY_*` variables for live payments
   - Optional: `RESEND_API_KEY`, `EMAIL_FROM`
3. Deploy. `vercel.json` registers the daily reminder job (`/api/cron/daily`, 07:00 IST).
4. Add the custom domain. Then update the Supabase Site URL and redirect URLs to match it.
5. Create the first administrator:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SITE_URL=https://<domain> npm run create-admin -- --email ... --name "..."
   ```

## 3. Razorpay (live online payments)

1. Create API keys in the Razorpay Dashboard and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Add a webhook: URL `https://<domain>/api/payments/webhook`, events `payment.captured`, `order.paid` and `payment.failed`. Put its secret in `RAZORPAY_WEBHOOK_SECRET`.
3. Set `PAYMENT_PROVIDER=razorpay` and redeploy. Test with Razorpay *test-mode* keys before switching to live keys.

Until real credentials exist, either leave `PAYMENT_PROVIDER=none` (students are told to pay at the office) or use `sandbox` for demonstrations. Sandbox payments are labelled, watermarked and excluded from all totals.

## 4. Post-deploy checklist

- [ ] Admin → Settings: college name, logo, contact details, currency, MFA requirement, backup notes
- [ ] Admin → Website: hero photograph, About / Mission / Administration pages, departments, news
- [ ] Academic setup: year, current term, programmes, courses, batches, offerings, timetable
- [ ] Users: office staff (with sections), faculty, students, parents (verify links)
- [ ] Accounts: fee heads, structures, assignment
- [ ] Sign in once with each role and confirm the portals behave as expected
