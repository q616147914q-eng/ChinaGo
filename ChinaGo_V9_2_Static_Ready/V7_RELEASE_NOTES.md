# ChinaGo V7 — Real Supplier Integration

V7 adds the first production-oriented real supplier adapter: **Booking.com Demand API 3.2** for accommodation search + redirect.

## What is real
- Server-side Booking.com API authentication.
- Current Demand API 3.2 `/accommodations/search` integration.
- Normalized hotel results for ChinaGo.
- Booking.com web/deep links returned by the supplier.
- Affiliate ID passed server-side via `X-Affiliate-Id`.
- Quote caching and provider request telemetry.
- Provider health check.
- Attribution event schema for clicks/searches.

Booking.com currently documents Demand API 3.2 as the latest stable version. New partners need Managed Affiliate Partner access, an API key and Affiliate ID. Search & look & redirect can be used to send travellers to Booking.com; fully integrated Search, look & book requires appropriate approval/agreement.

## Environment
Set:
- BOOKING_COM_API_BASE=https://demandapi.booking.com/3.2
- BOOKING_COM_API_KEY=...
- BOOKING_COM_AFFILIATE_ID=...

Never expose the API key in the browser or commit it to source control.

## Search example
POST `/api/v7/hotels/booking-com/search`

```json
{
  "city_id": -2140479,
  "checkin": "2026-11-10",
  "checkout": "2026-11-12",
  "adults": 2,
  "rooms": 1,
  "booker_country": "gb",
  "currency": "GBP"
}
```

Important: Booking.com city IDs are not ChinaGo city slugs. The production UI should resolve a destination through Booking.com's locations API and store the provider city ID alongside the ChinaGo city.

## Database
Run:
1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. `supabase/v5_migration.sql`
4. `supabase/v6_migration.sql`
5. `supabase/v7_migration.sql`

## Commercial limitation
V7 does not invent or bypass supplier credentials. Booking.com access and commercial terms must be obtained directly from Booking.com.
