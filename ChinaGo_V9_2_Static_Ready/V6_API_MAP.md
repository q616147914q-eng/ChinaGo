# ChinaGo V6 API Map

## Provider
- `GET /api/providers/config` — admin-only configuration summary
- `GET /api/providers/health` — admin-only supplier health probes
- `POST /api/v6/search/hotel`
- `POST /api/v6/search/train`
- `POST /api/v6/search/ticket`
- `POST /api/v6/search/transfer`
- `POST /api/v6/search/experience`

All V6 search routes normalize supplier items and use the optional quote cache.

## Commerce
- `POST /api/booking-leads` — capture a request when direct booking is unavailable
- `POST /api/orders` — create a transaction/order record
- `GET /api/orders` — current user's orders
- `POST /api/webhooks/:provider` — supplier status callback

## Operations
- `GET /api/admin/summary`
- `GET /api/admin/leads`
- `PATCH /api/admin/leads/:id`

## Supplier contract
A provider's `/search` endpoint should accept JSON and return either:

```json
{"items":[{"id":"...","title":"...","location":"...","price_from":100,"currency":"CNY","booking_url":"https://..."}]}
```

or a bare JSON array of item objects.

V6 adds `x-chinago-client: chinago-v6`, optional `Authorization: Bearer ...`, and optional `x-affiliate-id` headers.
