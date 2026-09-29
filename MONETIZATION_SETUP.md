# ChinaGo Monetization Setup

## Current production state

The commercial funnel is implemented, but production has no provider credentials and no persistent lead database yet.

### Lead capture

The backend supports three modes:

1. Supabase database — durable lead storage.
2. `LEAD_WEBHOOK_URL` — forwards every lead to an external CRM/automation endpoint.
3. Demo queue — temporary in-memory queue when neither is configured.

For real operation, use Supabase or a lead webhook.

## Booking.com hotel integration

ChinaGo already contains the Booking.com Demand API 3.2 adapter.

Required Render environment variables:

- `BOOKING_COM_API_KEY`
- `BOOKING_COM_AFFILIATE_ID`

Optional:

- `BOOKING_COM_API_BASE`
  - production: `https://demandapi.booking.com/3.2`
  - sandbox: `https://demandapi-sandbox.booking.com/3.2`

Booking.com requires a Managed Affiliate Partner account, Partner Centre access, an API key and an Affiliate ID before Demand API testing/production use.

## Generic supplier adapters

For non-Booking providers:

- `HOTEL_PROVIDER_URL`
- `HOTEL_PROVIDER_TOKEN`
- `TRANSFER_PROVIDER_URL`
- `TRANSFER_PROVIDER_TOKEN`
- `EXPERIENCE_PROVIDER_URL`
- `EXPERIENCE_PROVIDER_TOKEN`
- `TRAIN_PROVIDER_URL`
- `TRAIN_PROVIDER_TOKEN`
- `TICKET_PROVIDER_URL`
- `TICKET_PROVIDER_TOKEN`

Each provider should expose a POST `/search` endpoint returning:

```json
{
  "items": [
    {
      "id": "provider-item-id",
      "title": "Example",
      "location": "Beijing",
      "description": "Short description",
      "price_from": 100,
      "currency": "CNY",
      "booking_url": "https://example.com/..."
    }
  ]
}
```

## Lead webhook

Set:

- `LEAD_WEBHOOK_URL`
- `LEAD_WEBHOOK_SECRET` (recommended)

ChinaGo sends `chinago.lead.created` with an HMAC SHA-256 signature in `x-chinago-signature` when the secret is configured.

## Admin fallback

If Supabase is not configured, `GET /api/admin/lead-queue` can be protected with:

- `ADMIN_API_KEY`

Pass it as:

`x-admin-key: <value>`

Do not put this key in frontend code.

## Security

Never commit provider API keys, database credentials, webhook secrets or admin keys to GitHub. Put them in Render Environment Variables / Secrets.

