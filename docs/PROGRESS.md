# Implementation status

| Stage | Status |
|---|---|
| 1. Architecture: schema, RLS, permission matrix, design system | Done |
| 2. Public website (all pages, CMS-driven) | Done |
| 3. Authentication: unified login, role routing, reset, MFA, rate limits | Done |
| 4. Five portal dashboards (desktop + mobile) | Done |
| 5. Academic features: profiles, timetable, marks → results, resources, notifications | Done |
| 6. Office modules: files, accounts, tasks, correspondence, reports, help desk | Done |
| 7. Persistence, storage, permissions, payment adapter, email adapter | Done |
| 8. Tests: unit (31), database/RLS (31), e2e (public, navigation, guards) | Passing locally |
| 9. Deployment docs, env example, seed, admin bootstrap, backup guide | Done |

## Verified in development

- `npm run typecheck`, `npm run lint` and `npm run build` are clean.
- Unit tests and database tests pass. The database tests run against the real migrations on PostgreSQL 16.
- The Playwright public, navigation and route-protection suites pass at desktop (1440px) and mobile (Pixel 7) sizes.

## Requires configuration or a live environment (not claimed as done)

- **Supabase project + Vercel deployment:** credentials were not available to the build environment. Follow `docs/DEPLOYMENT.md`.
- **Authenticated end-to-end tests** (`tests/e2e/workflows.spec.ts`) need a seeded Supabase project. They are skipped until `E2E_SUPABASE=1`.
- **Razorpay live payments** need college credentials. Until then use `PAYMENT_PROVIDER=none` or the labelled `sandbox` mode.
- **Email notifications** need `RESEND_API_KEY`. In-app notifications work without it.
- **Campus photographs:** the college must upload its own. A neutral illustration is shown until then.
- **Typed Supabase client:** queries are untyped. Generate types with `npx supabase gen types typescript` once the project exists, if desired.
