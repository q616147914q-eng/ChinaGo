# ChinaGo V5 — commercial MVP

ChinaGo is a foreigner-first China travel operating system:
- AI itinerary planner
- AI travel assistant
- current-info web search
- China survival guide
- city / attraction / food / experience discovery
- saved trips
- Supabase/Postgres schema with RLS
- provider abstraction for hotels / trains / tickets / transfers / experiences / maps
- booking lead capture + conversion events
- admin operations dashboard with provider health and lead workflow
- mobile-first PWA
- deployment config for Render / Docker

## 1. Run locally

Requirements: Node.js 20+

```bash
cp .env.example .env
npm install
npm start
```

Open:
http://localhost:3000

At minimum set:
OPENAI_API_KEY=...

The frontend works in demo mode without Supabase. AI requires an OpenAI API key.

## 2. Production database

Create a Supabase project, open SQL Editor, and run:

supabase/schema.sql
supabase/seed.sql

Then set:
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

The browser should only receive the publishable/anon key. Never expose the service role key to the browser.

## 3. Architecture

Browser/PWA
  -> Express API
      -> OpenAI Responses API
          -> structured itinerary
          -> web search for current facts
      -> Supabase/Postgres
      -> provider adapters

The current build intentionally keeps external hotel/train/ticket providers behind adapters. Real booking requires commercial partner/API credentials and should be connected one provider at a time.

## 4. Important product boundary

AI is not the source of truth for live schedules, prices or availability. Live answers are explicitly labeled as current-search results, and booking links should come from verified providers.

## 5. Deployment

Render:
- create a Web Service from this repository
- build: npm install
- start: npm start
- add environment variables from .env.example

Docker:
```bash
docker build -t chinago .
docker run -p 3000:3000 --env-file .env chinago
```

## 6. Next commercial integrations

1. Hotel affiliate / inventory provider
2. attraction ticket provider
3. train / transport provider
4. maps / routing provider
5. airport transfer provider
6. local experience supplier onboarding
7. analytics + conversion tracking


## 7. V5 commercial layer

V5 adds a provider adapter contract: each provider endpoint receives JSON at `/search` and may return `{ "items": [...] }` or an array. Configure the base URL and optional bearer token in `.env`.

Provider environment variables:
- `HOTEL_PROVIDER_URL` / `HOTEL_PROVIDER_TOKEN`
- `TRAIN_PROVIDER_URL` / `TRAIN_PROVIDER_TOKEN`
- `TICKET_PROVIDER_URL` / `TICKET_PROVIDER_TOKEN`
- `TRANSFER_PROVIDER_URL` / `TRANSFER_PROVIDER_TOKEN`
- `EXPERIENCE_PROVIDER_URL` / `EXPERIENCE_PROVIDER_TOKEN`
- `MAP_PROVIDER_URL`

Run `supabase/v5_migration.sql` after the existing schema/seed. It creates booking leads, provider request telemetry and admin audit records.

Set `ADMIN_EMAILS` to a comma-separated allowlist. The browser never receives this allowlist; admin access is verified server-side against the authenticated email.

### V5 launch order
1. Create Supabase project and run `schema.sql`, `seed.sql`, then `v5_migration.sql`.
2. Set OpenAI and Supabase environment variables.
3. Create/verify at least one commercial supplier account and put its `/search` API behind the corresponding provider adapter.
4. Set `ADMIN_EMAILS` and test the operations dashboard.
5. Deploy to Render/Docker.
6. Only then replace demo `#` booking links with verified commercial URLs or live provider results.

V5 still does not invent supplier credentials, prices or inventory. Real transactions require real supplier/affiliate agreements and credentials.


## V7 real supplier integration

V7 includes a server-side Booking.com Demand API 3.2 adapter for hotel search and affiliate redirect. See `V7_RELEASE_NOTES.md` and `supabase/v7_migration.sql`. Real Booking.com partner credentials are required.


## V8 migration

After the V7 migration, run:

```sql
supabase/v8_migration.sql
```

V8 adds the hotel search funnel, quote events and hotel search sessions.

### V8 Booking.com configuration

Set these server-side environment variables:

- `BOOKING_COM_API_BASE`
- `BOOKING_COM_API_KEY`
- `BOOKING_COM_AFFILIATE_ID`
- `BOOKING_COM_ENABLE_SMART_SEARCH=true`

The API credentials must never be placed in browser code.


## V9
V9 adds Booking.com destination autocomplete, hotel details, filters, favorites and itinerary hotel stays. See `V9_RELEASE_NOTES.md` and `V9_API_MAP.md`.


## V9.2
You can open `public/index.html` directly. In `file://` offline mode, the trip planner runs entirely in the browser and does not require Node, OpenAI, or Supabase. Live hotel search, AI chat, and live search require server mode.
