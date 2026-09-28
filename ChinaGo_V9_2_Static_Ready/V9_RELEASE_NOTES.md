# ChinaGo V9 Release Notes

## Goal
Turn the V8 hotel flow into a foreigner-friendly hotel discovery funnel without requiring Booking.com internal IDs.

## Added
- Booking.com destination autocomplete via `/common/autocomplete` (Beta).
- City selection stores the opaque Booking.com city ID and coordinates for downstream search.
- Stable Booking.com `/accommodations/details` integration.
- Hotel detail view with description, photos, facilities and live-stay actions.
- Live availability check remains the gate before redirecting to Booking.com.
- Hotel price range filtering and free-cancellation filter through the stable accommodation search path.
- Hotel sorting support.
- Local hotel favorites for anonymous users.
- Cloud hotel favorites for signed-in Supabase users.
- Add a selected hotel to the current ChinaGo itinerary.
- V9 rate limit and provider telemetry categories.

## Important
- Booking.com Demand API credentials remain server-side.
- `/common/autocomplete` and `/accommodations/smart-search` are Beta capabilities; V9 does not make them the only hotel-search path.
- Stable `/accommodations/search`, `/accommodations/details`, and `/accommodations/availability` remain the production backbone.
- Real inventory, rates, availability and commissions require valid Booking.com partner credentials and enabled access.

## Verification
- `node --check server.mjs` passed.
- `node --check src/providers.mjs` passed.
- Browser JavaScript syntax check passed.
