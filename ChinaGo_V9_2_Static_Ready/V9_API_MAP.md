# ChinaGo V9 API Map

## Booking.com

### POST `/api/v9/hotels/booking-com/autocomplete`
Resolves a free-text China destination into a Booking.com city ID.

### POST `/api/v9/hotels/booking-com/details`
Fetches property content from Booking.com Demand API v3.2 `/accommodations/details`.

### POST `/api/v7/hotels/booking-com/search`
Stable structured accommodation search. V9 uses this path when filters/sorting are required.

### POST `/api/v8/hotels/booking-com/smart-search`
Natural-language hotel search. Beta endpoint; used only when the query is compatible with the smart-search flow.

### POST `/api/v8/hotels/booking-com/availability`
Live room/product availability and pricing gate before outbound booking.

## ChinaGo user data

### GET/POST/DELETE `/api/hotel-favorites`
Signed-in hotel favorites. Anonymous favorites stay in browser localStorage.

## V9 frontend funnel
`destination autocomplete -> structured hotel search -> hotel details -> availability -> Booking.com redirect`
