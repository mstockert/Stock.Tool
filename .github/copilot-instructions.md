# Copilot / AI Agent Instructions for Stock.Tool

This repo is a full-stack TypeScript project (React + Express). Below are focused, actionable notes to get an AI coding agent productive quickly.

**Architecture Overview:**
- **Frontend:** `client/src` — React + TypeScript, Tailwind, shadcn/ui. Entry: `client/src/main.tsx` -> `App.tsx`.
- **Backend:** `server/*` — Express app with routes registered in `server/routes.ts`. Server entry: `server/index.ts`.
- **Shared types & schema:** `shared/schema.ts` contains Drizzle/Zod table schemas and API types used across server and client.
- **Services & storage:** Stock data logic lives in `server/services/stockApi.ts` (simulated/external data) and persistence helpers are in `server/storage.ts` (in-memory / Drizzle-ready patterns).

**Run & Build (essential commands):**
- Development (runs the Express server + Vite dev middleware):
  - `npm run dev` (equivalent to `NODE_ENV=development tsx server/index.ts`). Server listens on port `5000`.
- Build (client build + bundle server):
  - `npm run build` — `vite build && esbuild server/index.ts ...` (produces `dist/`).
- Production start:
  - `npm run start` (expects `dist/index.js`).
- TypeScript check: `npm run check`.
- Database push (Drizzle): `npm run db:push`.

**Important Conventions & Patterns**
- The Express app sets up request logging middleware in `server/index.ts` that truncates long JSON responses — keep API JSON responses reasonably small for logs.
- Vite dev middleware is only set up in development inside `server/index.ts` via `setupVite(app, server)` — when adding middleware or catch-all routes, register them before Vite setup to avoid interference.
- API routes are defined in `server/routes.ts`. Follow the existing style: try/catch per route, log errors with `console.error`, and return JSON `{ message }` on errors.
- Request validation uses Zod schemas from `shared/schema.ts` (e.g., `insertWatchlistSchema`, `insertWatchlistSymbolSchema`). Use those schemas where appropriate for new endpoints.
- API caching: some endpoints disable caching via `Cache-Control` headers (see market indices and history routes). Mirror this when adding time-sensitive endpoints.

**Key Endpoints (examples to reference)**
- `GET /api/market/indices` — timeframe via `?timeframe=1D|1W|...` (see `server/routes.ts`).
- `GET /api/stocks/search?q=...`
- `GET /api/stocks/quote/:symbol`
- `GET /api/stocks/history/:symbol?timeframe=`
- Watchlists: `GET /api/watchlists`, `POST /api/watchlists`, `POST /api/watchlists/:id/symbols`, `DELETE /api/watchlists/:id`.

**Client patterns**
- Uses TanStack Query (`@tanstack/react-query`) — query logic is wired through `client/src/lib/queryClient.ts` and components call APIs under `/api/...`.
- Components are organized under `client/src/components/` and UI primitives under `client/src/components/ui/` (shadcn-style). Follow existing component and hook patterns (e.g., `use-mobile.tsx`, `use-toast.ts`).

**Type & DB notes**
- `shared/schema.ts` is the canonical source for DB table definitions and API types — import these when generating or validating payloads.
- The project includes `drizzle-orm` + `drizzle-zod` patterns; prefer using `createInsertSchema` types for server-side validation.

**Testing & Linting**
- There are no automated test scripts in `package.json`. Use `npm run check` to validate TypeScript. Keep changes small and run `npm run dev` to manually verify behavior.

**Where to change things**
- Add or change API routes inside `server/routes.ts` (follow existing error handling + zod parsing pattern).
- Add service-level logic in `server/services/stockApi.ts` to keep route handlers thin.
- For UI additions, place components under `client/src/components/` and pages under `client/src/pages/`.

If anything here is unclear or you'd like more detail (e.g., examples of adding a new endpoint and client query), tell me which area to expand and I will update this file.
