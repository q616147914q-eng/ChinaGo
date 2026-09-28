# ChinaGo V8

## Real hotel conversion layer
- Booking.com Demand API 3.2 Smart Search adapter
- Booking.com accommodation availability adapter
- Standardized hotel results
- Quote/search telemetry
- Hotel search session persistence
- Cached supplier responses
- Server-side credentials only
- Existing generic ticket/transfer/experience provider adapters remain available

## New endpoints
- POST `/api/v8/hotels/booking-com/smart-search`
- POST `/api/v8/hotels/booking-com/availability`

## Database
Run `supabase/v8_migration.sql` after the V7 migration.

## Production requirement
Real Booking.com API credentials and affiliate access are still required. V8 does not invent inventory, prices, availability or commissions.
