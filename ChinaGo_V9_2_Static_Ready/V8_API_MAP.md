# ChinaGo V8 API Map

## Hotel search
- `POST /api/v8/hotels/booking-com/smart-search`
- `POST /api/v8/hotels/booking-com/availability`

## Existing production APIs retained
- `POST /api/v7/hotels/booking-com/search`
- `GET /api/v7/providers/health`
- `POST /api/v6/search/:category`
- `POST /api/booking-leads`
- `POST /api/events/booking`
- `GET /api/admin/summary`

## Database
Run in order:
1. `schema.sql`
2. `seed.sql`
3. `v5_migration.sql`
4. `v6_migration.sql`
5. `v7_migration.sql`
6. `v8_migration.sql`
