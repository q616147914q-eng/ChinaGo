# ChinaGo V9.2 Release Notes

## Main fix
V9.2 adds a true static/offline mode for opening `public/index.html` directly with `file://`.

### Works directly from index.html
- Trip planner
- Local starter itinerary generation
- City discovery
- China Survival content
- Local trip saving via browser localStorage
- Clear offline-mode status banner

### Requires server mode
- OpenAI AI planner
- AI Assistant
- Live China search
- Booking.com live hotel search/details/availability
- Supabase cloud accounts and cloud sync

### Error handling
- Static mode no longer calls `/api/plan`, so it cannot produce `Failed to fetch` when the file is opened directly.
- Unsupported live features show a clear message explaining that server mode is required.
- `/api` failures now surface HTTP/server errors more clearly in normal server mode.

## Version
9.2.0
