# ChinaGo V9.1 Release Notes

## Why V9.1
V9 could fail when `/api/plan` had no `OPENAI_API_KEY`, and the UI did not clearly expose AI configuration state. V9.1 makes itinerary generation resilient.

## Changes
- AI configuration status exposed through `/api/health` and `/api/config`.
- `OPENAI_MODEL` is resolved once at startup and used consistently.
- Default model: `gpt-5.6-luna`.
- `/api/plan` now validates/clamps trip length to 1–21 days.
- If AI is not configured, `/api/plan` returns a built-in starter itinerary instead of HTTP 503.
- If an AI request fails, times out after 30 seconds, or returns empty/invalid output, `/api/plan` automatically falls back to the starter itinerary.
- Frontend planner shows whether AI is connected or starter mode is active.
- Frontend reports whether the generated itinerary used AI or fallback mode.
- Other AI endpoints retain explicit configuration errors because they require AI capabilities.
- Package version updated to 9.1.0.

## Environment
`OPENAI_API_KEY` is optional for itinerary generation in V9.1.
If set, `OPENAI_MODEL` can select the model. Otherwise `gpt-5.6-luna` is used.

## Verification
- Node syntax check passed for `server.mjs`.
- Inline browser JavaScript syntax check passed.
- No live provider transaction or OpenAI API call was performed because credentials are not present in the build environment.
