# Technical Concerns

**Analysis Date:** 2026-07-02

## Summary

Project is in **early scaffold stage** — directory structure and dependencies defined, but almost no implementation exists. Most concerns are pre-emptive based on scaffold state and the patterns already in `server.js`.

## Security

### Critical

**CORS wildcard on Socket.io:**
- Location: `backend/src/server.js:9`
- Code: `new Server(httpServer, { cors: { origin: '*' } })`
- Risk: Any origin can establish WebSocket connections
- Fix: Restrict to mobile app origin / known domains before production

**CORS wildcard on REST API:**
- Location: `backend/src/server.js:11`
- Code: `app.use(cors())`
- Risk: No origin restriction; all cross-origin requests accepted
- Fix: Pass `{ origin: ['<allowed-origins>'] }` to `cors()`

**No auth middleware exists:**
- Location: `backend/src/middleware/` (empty)
- Risk: When routes are added, no guard is in place yet
- Fix: Implement JWT verification middleware before adding protected routes

**No input validation:**
- No express-validator, zod, or joi in dependencies
- Risk: Route handlers will process unsanitized input
- Fix: Add validation library before implementing API endpoints

**No rate limiting:**
- No express-rate-limit in dependencies
- Risk: Login brute-force, API abuse
- Fix: Add rate limiting before auth endpoints go live

### Low

**bcryptjs vs bcrypt:**
- `bcryptjs` (pure JS) used instead of native `bcrypt`
- Not a security issue; minor performance difference at scale

## Architecture / Code Quality

### Missing MongoDB Connection
- `mongoose` is in dependencies but no `mongoose.connect()` exists in `server.js`
- Location: `backend/src/server.js` (not present)
- The app will start but cannot persist anything
- Fix: Add connection in `backend/src/config/` and call before server starts

### Monolithic `server.js`
- All Express setup, Socket.io setup, and middleware in one file
- Not yet a problem (10 lines), but a pattern to avoid as app grows
- Fix: Extract Socket.io setup to `src/socket/`, DB connection to `src/config/`

### No Error Handling Middleware
- No `app.use((err, req, res, next) => ...)` pattern in place
- Fix: Add global error handler before routes are populated

### Console.log Only Logging
- `console.log('Client connected:', socket.id)` — no structured logging
- Fix: Add winston or pino before debugging production issues

## Testing

### Zero Test Coverage
- No test framework installed (no jest, vitest, mocha)
- No test files anywhere in the project
- Mobile TypeScript strict mode enabled but no tests
- Fix: Add jest + supertest for backend; jest + React Native Testing Library for mobile

## Operations / DevOps

### No Process Manager
- `npm start` uses `node src/server.js` directly
- No PM2, forever, or equivalent for production restarts
- Fix: Add PM2 before deploying

### No CI/CD
- No `.github/workflows/`, no Docker config, no deploy scripts
- Fix: Add CI before the project has multiple contributors

### No Backend Lockfile
- `backend/` has no `package-lock.json` (mobile has one)
- Dependency versions could drift between installs
- Fix: Run `npm install` in `/backend/` and commit the lockfile

### Loose Dependency Versions
- Backend deps use `^` semver (e.g., `"express": "^4.19.2"`) without lockfile
- Fix: Commit lockfile to pin resolved versions

## Mobile

### Empty App Shell
- `App.tsx` renders default Expo placeholder — no screens, navigation, or state
- All `src/` directories empty
- This is expected for scaffold stage; not a defect

### No Navigation Library
- Screen directories exist (`Auth/`, `Chat/`, `Listings/`, `Profile/`) but no React Navigation in `package.json`
- Fix: Add `@react-navigation/native` + stack/tab navigators before implementing screens

### No State Management Installed
- `src/store/` exists but no Redux, Zustand, or equivalent in `package.json`
- Fix: Choose and install before implementing shared state

### No API Service Layer
- `src/services/` exists but no axios, fetch wrapper, or react-query installed
- Fix: Add before mobile↔backend communication is needed

## Immediate Action Items (Before First Feature)

| Priority | Item | Location |
|----------|------|----------|
| 🔴 Critical | Add MongoDB connection | `backend/src/config/db.js` |
| 🔴 Critical | Restrict CORS origins | `backend/src/server.js` |
| 🔴 Critical | Add auth middleware stub | `backend/src/middleware/auth.js` |
| 🟡 High | Add backend lockfile | `backend/` |
| 🟡 High | Add input validation library | `backend/package.json` |
| 🟡 High | Add React Navigation | `mobile/package.json` |
| 🟡 High | Add state management | `mobile/package.json` |
| 🟢 Medium | Add test framework (both) | root/backend/mobile |
| 🟢 Medium | Add structured logging | `backend/package.json` |
| 🟢 Medium | Add rate limiting | `backend/package.json` |

---

*Concerns analysis: 2026-07-02*
