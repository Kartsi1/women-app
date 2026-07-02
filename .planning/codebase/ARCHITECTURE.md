# Architecture

**Analysis Date:** 2026-07-02

## Pattern

**Monorepo — two separate sub-projects:**
- `/backend/` — Node.js REST API + WebSocket server (Express + Socket.io + MongoDB)
- `/mobile/` — React Native mobile app (Expo)

Architecture is **scaffold/skeleton only** — directory structure establishes intent, but virtually no business logic is implemented yet.

## Backend Architecture

**Intended pattern:** MVC-ish layered architecture

```
HTTP Request → Routes → Controllers → Services → Models (MongoDB)
                                              ↗ Socket.io (real-time)
```

**Layers (all empty except entry point):**
- `server.js` — Express app setup, Socket.io init, HTTP server
- `src/routes/` — Route definitions (empty)
- `src/controllers/` — Request handlers (empty)
- `src/services/` — Business logic (empty)
- `src/models/` — Mongoose models (empty)
- `src/middleware/` — Auth, validation middleware (empty)
- `src/config/` — DB and app config (empty)
- `src/socket/` — Socket.io event handlers (empty)

**Entry point:** `src/server.js`
- Creates Express app + HTTP server + Socket.io server
- Registers `cors()` and `express.json()` middleware
- Has `/health` endpoint only
- Listens on `process.env.PORT || 3000`

## Mobile Architecture

**Intended pattern:** Feature-based screen organization with shared services

```
App.tsx → Navigation → Screens → Components
                    ↘ Hooks / Store / Services
```

**Layers (all empty except entry point):**
- `App.tsx` — Root component (default Expo template only)
- `index.ts` — Expo entry point
- `src/screens/` — Feature screens by domain (Auth, Chat, Listings, Profile)
- `src/navigation/` — React Navigation setup (empty)
- `src/components/` — Shared UI components (empty)
- `src/hooks/` — Custom React hooks (empty)
- `src/store/` — State management (empty)
- `src/services/` — API client + backend communication (empty)
- `src/types/` — TypeScript type definitions (empty)
- `src/constants/` — App-wide constants (empty)

**Entry point:** `App.tsx` (renders default placeholder text)

## Data Flow

**Current (skeleton):**
```
Mobile: Static placeholder screen only
Backend: /health → { status: 'ok' }
Socket.io: connection/disconnect log only
MongoDB: Not connected
```

**Intended (based on directory structure):**
```
Mobile Screen → Service layer → Backend REST API → Controller → Service → MongoDB
Mobile Screen → Socket.io client → Backend socket handler → Broadcast to clients
Auth: JWT token issued on login → stored on mobile → sent in Authorization header
```

## Key Abstractions

None implemented yet. Directory names suggest:
- Service layer for business logic separation
- Controller layer for HTTP handler isolation
- Model layer for MongoDB schema definition
- Store for mobile client-side state (likely Redux or Zustand)
- Custom hooks for data-fetching logic on mobile

## Entry Points

| Entry Point | Path | Status |
|-------------|------|--------|
| Backend HTTP server | `/backend/src/server.js` | ✓ Running skeleton |
| Mobile app root | `/mobile/App.tsx` | ✓ Default Expo template |
| Mobile entry | `/mobile/index.ts` | ✓ Expo registration |

## Communication Between Sub-projects

- REST API: Mobile → `http://<host>:3000/api/*` (not yet implemented)
- WebSocket: Mobile → Socket.io client (not yet implemented in mobile)
- Auth: JWT in Authorization header (not yet implemented)

---

*Architecture analysis: 2026-07-02*
