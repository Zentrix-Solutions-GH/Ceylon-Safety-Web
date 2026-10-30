# Auth Settings — CeylonSafety (S-031)

This document records the exact values used in the Supabase Auth dashboard for
staging and production, and provides the hook-failure recovery drill and the
email-limit reference.

**Last updated:** 2026-10-31 (initial, S-031)

---

## EC1 — OTP length fallback

The story recommended 8-digit codes (M36). The Supabase local CLI stack accepts
a maximum of 6 digits in `supabase/config.toml`. The production dashboard was
checked and also caps at 6 for the free plan.

**Chosen value: 6 digits, 600 s (10 minutes) expiry.** This is recorded here
as the EC1 fallback.

---

## Local development settings (`supabase/config.toml`)

| Setting | Value | Notes |
|---|---|---|
| `minimum_password_length` | 8 | AC2 |
| `otp_length` | 6 | EC1 fallback |
| `otp_expiry` | 600 s | 10 minutes |
| `enable_confirmations` | true | AC1 |
| `enable_anonymous_sign_ins` | false | AC1 |
| `enable_manual_linking` | false | AC1 |
| `[auth.mfa.totp] enroll_enabled` | true | AC7 |
| `[auth.mfa.totp] verify_enabled` | true | AC7 |
| `[auth.captcha] provider` | turnstile | AC5 |
| `[auth.captcha] secret` | `1x0000000000000000000000000000000AA` | Cloudflare always-pass test key |
| `[auth.hook.custom_access_token] enabled` | true | AC6 |
| `[auth.hook.custom_access_token] uri` | `pg-functions://postgres/private/custom_access_token_hook` | AC6 |
| Google provider enabled | true | AC1 |
| Phone / SMS provider | false | AC1 |

---

## Staging settings checklist

> **Instructions for the person running this:** Open the Supabase dashboard for the
> staging project, verify each value, and tick the box + add the date.

### Authentication → Providers

- [ ] Email provider: enabled. Date verified: ___________
- [ ] Google provider: enabled. Client ID ends in `.apps.googleusercontent.com`. Date: ___________
- [ ] All other providers (Phone, Apple, GitHub, etc.): **disabled**. Date: ___________
- [ ] Anonymous sign-in: **OFF**. Date: ___________

### Authentication → Email

- [ ] "Confirm email" is **ON**. Date: ___________
- [ ] Minimum password length: **8**. Date: ___________
- [ ] OTP length: **6** (EC1 fallback; record if 8 becomes available). Date: ___________
- [ ] OTP expiry: **600 seconds**. Date: ___________

### Authentication → SMTP

- [ ] Custom SMTP: **enabled** with Resend credentials. Date: ___________
- [ ] SMTP host: `smtp.resend.com`. Date: ___________
- [ ] Sender name: `CeylonSafety`. Date: ___________
- [ ] Sender email: `noreply@ceylonsafety.com` (or the verified domain address). Date: ___________
- [ ] Supabase hourly email cap set to match the Resend plan limit. Value set: _____ emails/hour. Date: ___________
- [ ] SPF record verified for sending domain. Date: ___________
- [ ] DKIM record verified for sending domain. Date: ___________
- [ ] Test code sent to a real inbox and arrived (not spam). Date: ___________

### Email limits

| Cap | Value | Notes |
|---|---|---|
| Supabase built-in sender | ~2 emails/hour | Never use in staging/production |
| Supabase hourly cap (after custom SMTP) | ~30/hour (default, adjustable) | Set to match the Resend plan |
| Resend free plan | ~100 emails/day | Likely too small for launch; budget a paid plan (Q46) |
| Alert threshold | 80% of the Resend daily cap | Alert wired in S-100/S-122 |

**Configured Supabase hourly cap:** ___________ emails/hour (fill when set on dashboard)

### Authentication → Captcha

- [ ] Captcha provider: **Turnstile**. Date: ___________
- [ ] Turnstile secret: set in dashboard only (confirm it is NOT in any environment file or repo). Date: ___________
- [ ] Turnstile site key recorded for the frontend `.env`: ___________ (public; safe to record here)

### Authentication → MFA

- [ ] TOTP (Authenticator app): **enabled** (both enrol and verify). Date: ___________
- [ ] Phone MFA: **disabled**. Date: ___________

### Authentication → Hooks

- [ ] Custom access token hook: **enabled**. URI: `pg-functions://postgres/private/custom_access_token_hook`. Date: ___________
- [ ] Hook tested: sign in as a staff user; JWT payload contains `user_role` and `account_status`. Date: ___________
- [ ] Hook tested: sign in as a customer; JWT payload has `account_status` but no `user_role`. Date: ___________

### URL Configuration

- [ ] Site URL: `https://ceylonsafety.com` (no trailing slash, no wildcard). Date: ___________
- [ ] Redirect allow-list: `https://ceylonsafety.com/api/auth/callback` only. No wildcards. Date: ___________

### Google OAuth client (production project)

- [ ] Separate Google OAuth client from development. Date: ___________
- [ ] Consent screen status: **In production** (not "Testing"). Date: ___________
- [ ] Scopes: `email` and `profile` only. Date: ___________
- [ ] Authorised redirect URI matches: `https://ceylonsafety.com/api/auth/callback`. Date: ___________

---

## Production settings checklist

> Same as staging. Repeat every row above for the production Supabase project and
> production Google OAuth client. Add dates in the column below.

| Item | Verified date |
|---|---|
| Email provider enabled | |
| Google provider enabled (production client) | |
| All other providers disabled | |
| "Confirm email" ON | |
| Password length ≥ 8 | |
| OTP length 6, expiry 600 s | |
| Custom SMTP (Resend) enabled | |
| Supabase hourly cap set (value: ___) | |
| SPF verified | |
| DKIM verified | |
| Real inbox test (not spam) | |
| Turnstile enabled; secret in dashboard only | |
| TOTP MFA enabled | |
| Custom access token hook enabled | |
| Site URL exact, no wildcards | |
| Redirect allow-list exact, no wildcards | |
| Google consent screen "In production" | |

---

## EC2 — Hook failure drill

**Symptom:** After a sign-in, the JWT payload does not contain `user_role` or
`account_status`, or sign-in fails entirely.

**Cause:** The custom access token hook (`private.custom_access_token_hook`) is
either disabled, returns an error, or the `supabase_auth_admin` role lacks
EXECUTE on it.

**Recovery steps:**

1. Open the Supabase dashboard → Authentication → Hooks.
2. Check that the custom access token hook is enabled and the URI is exactly
   `pg-functions://postgres/private/custom_access_token_hook`.
3. In the Supabase SQL editor, run:
   ```sql
   SELECT has_function_privilege('supabase_auth_admin',
     'private.custom_access_token_hook(jsonb)', 'EXECUTE');
   ```
   If this returns `false`, the grant is missing. Run the migration again or:
   ```sql
   GRANT EXECUTE ON FUNCTION private.custom_access_token_hook(jsonb)
     TO supabase_auth_admin;
   ```
4. Check the database logs for `WARNING: custom_access_token_hook error` lines
   to see the underlying error.
5. If the hook is broken and cannot be fixed immediately, disable it in the
   dashboard so sign-ins resume (tokens will lack the extra claims; staff
   routes will redirect to sign-in until the hook is restored).
6. Rehearse this drill once before launch (S-019 / section 19 of auth design).

---

## EC3 — Session cookie size

The extra claims (`user_role`, `account_status`) add approximately 30–60 bytes
to the JWT payload. Supabase stores the full session as a cookie.
Verify after enabling the hook on the local stack:

**Scope cut (S-031):** The local Supabase stack was not running during S-031.
This measurement must be done by the developer running `supabase start` during
S-032 (claims helpers) and the value recorded here.

**Steps to verify:**

1. `npx supabase start`
2. Sign in as a staff user (after inserting a `user_roles` row).
3. In the browser dev tools → Application → Cookies, check the `sb-*` cookie size.
4. Alternatively, read `Set-Cookie` header length from the network tab.
5. If the cookie exceeds 4 KB, sign-in will silently fail (browser drops the cookie).

- As of S-032 testing: ___________ bytes (fill during S-032).
- Resolution if too large: move claims to `app_metadata` or reduce payload; discuss with owner.

---

## EC4 — Resend daily cap exhausted

**What the owner sees:**

- Sign-up codes and reset codes stop arriving.
- Supabase Auth logs show email-sending errors (visible in the Supabase
  dashboard → Logs → Auth).
- The nightly alert job (S-100) fires at 80% of the daily cap.

**Alert threshold:** 80% of the Resend daily cap (exact value from the plan
selected; free plan ≈ 80 emails/day before alert).

**Immediate actions:**

1. Log in to Resend and check the sending quota.
2. If the cap is reached, upgrade the Resend plan immediately (Q46 —
   client budget required).
3. As a temporary measure, pause non-critical email types (welcome emails,
   idle warnings) from the cron settings in the Supabase dashboard.

---

*End of auth-settings.md*
