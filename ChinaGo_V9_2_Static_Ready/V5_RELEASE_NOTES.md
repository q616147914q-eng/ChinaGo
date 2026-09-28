# ChinaGo V5 Release Notes

V5 moves the product from a feature-rich MVP toward an operable commercial stack.

## Added
- Unified provider adapter contract for hotels, trains, tickets, transfers and experiences.
- Optional bearer-token provider authentication.
- Provider request telemetry.
- Booking lead capture and customer request workflow.
- User-facing booking/lead fallback when a direct booking URL is not configured.
- Admin allowlist via `ADMIN_EMAILS`.
- Server-side admin authorization.
- Admin operations dashboard for provider status, booking clicks, searches and leads.
- Lead status update workflow and audit records.
- Supabase V5 migration for booking leads, provider telemetry and admin audit data.
- Updated deployment and commercial launch documentation.

## Important
V5 does not fabricate supplier accounts, inventory, prices or affiliate credentials.
Real booking transactions still require verified commercial suppliers/affiliate agreements.

## Database order
Run:
1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. `supabase/v5_migration.sql`
