# ChinaGo V6 Release Notes

V6 is the transaction-readiness release.

## New
- Provider configuration and health endpoints for hotel, rail, ticket, transfer and experience suppliers.
- Affiliate ID / commission configuration passed through the provider adapter layer.
- Normalized provider search results so different suppliers can feed one ChinaGo UI.
- Quote caching to reduce duplicate supplier requests and latency.
- Unified `/api/v6/search/:category` routing.
- Orders table with lifecycle statuses: requested, confirmed, paid, cancelled, completed, refunded.
- Generic provider webhook receiver with optional shared-secret verification and idempotent event storage.
- Sales summary view for operations.
- Account page now includes request/order count.
- Admin dashboard now shows provider health and sales summary.

## Production boundary
ChinaGo still requires real supplier/affiliate credentials and contracts for actual inventory, payment and commission settlement. V6 deliberately does not invent those credentials or live inventory.

## Database migration order
1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. `supabase/v5_migration.sql`
4. `supabase/v6_migration.sql`
