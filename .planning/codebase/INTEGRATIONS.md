# External Integrations

**Analysis Date:** 2026-07-02

## Databases

### MongoDB
- **Driver:** mongoose 8.4.1 (`/backend/package.json`)
- **Connection:** Not yet implemented — mongoose imported but no `mongoose.connect()` in `/backend/src/server.js`
- **Models:** Directory exists at `/backend/src/models/` — currently empty
- **Status:** Planned, not wired

## Authentication

### JWT (JSON Web Tokens)
- **Library:** jsonwebtoken 9.0.2 (`/backend/package.json`)
- **Password hashing:** bcryptjs 2.4.3 (`/backend/package.json`)
- **Implementation:** Not yet implemented — libraries installed, no auth routes/middleware exist
- **Status:** Planned, not wired

## Real-time Communication

### Socket.io
- **Library:** socket.io 4.7.5 (`/backend/src/server.js`)
- **Configuration:** `new Server(httpServer, { cors: { origin: '*' } })` — wildcard CORS
- **Events implemented:** `connection` and `disconnect` only (skeleton)
- **Status:** Skeleton wired, no business logic

## HTTP/API

### Express REST API
- **Framework:** express 4.19.2 (`/backend/src/server.js`)
- **Routes implemented:** `/health` → `{ status: 'ok' }` only
- **Route modules:** `/backend/src/routes/` directory empty
- **CORS:** `cors()` with default settings (all origins) — `app.use(cors())`
- **Status:** Skeleton only

## Environment / Configuration

### dotenv
- **Library:** dotenv 16.4.5
- **Loaded at:** top of `server.js` — `require('dotenv').config()`
- **Known env vars:**
  - `PORT` — HTTP server port (default: 3000)
  - MongoDB URI — expected but not yet referenced in code
  - JWT secret — expected but not yet referenced in code
- **Example file:** `/backend/.env.example` (access restricted by permissions)

## Mobile External Services

### Expo Platform
- **Version:** expo 57.0.1
- **Distribution:** EAS (Expo Application Services) — not yet configured
- **No additional native integrations detected** — `package.json` contains only core expo, react, and react-native packages

## Not Yet Integrated (Directories Suggest Intent)

| Planned Integration | Evidence |
|---------------------|----------|
| REST API client (mobile ↔ backend) | `/mobile/src/services/` dir exists, empty |
| State management | `/mobile/src/store/` dir exists, empty |
| Navigation | `/mobile/src/navigation/` dir exists, empty |
| Backend services layer | `/backend/src/services/` dir exists, empty |
| Auth middleware | `/backend/src/middleware/` dir exists, empty |
| Socket.io business events | `/backend/src/socket/` dir exists, empty |

---

*Integrations analysis: 2026-07-02*
