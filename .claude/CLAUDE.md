<!-- GSD:project-start source:PROJECT.md -->

## Project

**WomenApp**

Women-only mobile platform for female travelers and women in need. Members find housing (free couch-surfing and short-term paid rentals), connect in a community feed and city-based group chats, organize local meetups, and message each other directly. All users are verified women via document photo — safety is the founding principle.

**Core Value:** A verified, women-only space where any woman can find safe housing and trusted community wherever she is in the world.

### Constraints

- **Platform**: Android-first; must run on Expo managed workflow (no bare ejection for MVP)
- **Auth**: Firebase Authentication only (no custom auth server)
- **DB**: MongoDB (Mongoose already installed)
- **Real-time**: Socket.io already scaffolded — use it for chat and notifications
- **Maps**: Google Maps API (must handle API key management securely)
- **Verification**: Manual moderation in MVP — no automated ID-check APIs
- **Payments**: None in MVP — excluded to keep scope tight

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (ES6+) - Backend application (`/backend/src/server.js`)
- TypeScript 6.0.3 - Mobile application and type definitions (`/mobile/App.tsx`, `/mobile/index.ts`)
- JSON - Configuration files (package.json, app.json, tsconfig.json)

## Runtime

- Node.js - Backend runtime (version not explicitly specified, npm is package manager)
- Expo 57.0.1 - Mobile app runtime and development environment (`/mobile`)
- npm (Node Package Manager)
- Lockfiles present: `package-lock.json` (mobile), implicit in backend

## Frameworks

- Express 4.19.2 - Web framework and HTTP server (`/backend/src/server.js`)
- React Native 0.86.0 - Mobile application framework (`/mobile`)
- React 19.2.3 - UI library for mobile app (`/mobile`)
- Expo 57.0.1 - React Native development platform and build system (`/mobile`)
- Socket.io 4.7.5 - WebSocket-based real-time communication (`/backend/src/server.js`)
- Not detected
- nodemon 3.1.3 - Development server with auto-reload (`/backend`)
- TypeScript 6.0.3 - Type checking for mobile app (`/mobile`)
- Expo CLI - Development and build tool (`/mobile`)

## Key Dependencies

- mongoose 8.4.1 - MongoDB object modeling and ODM (`/backend/package.json`)
- jsonwebtoken 9.0.2 - JWT authentication token handling (`/backend/package.json`)
- bcryptjs 2.4.3 - Password hashing and validation (`/backend/package.json`)
- cors 2.8.5 - Cross-Origin Resource Sharing middleware (`/backend/src/server.js`)
- dotenv 16.4.5 - Environment variable configuration (`/backend/src/server.js`)
- @types/react ~19.2.2 - TypeScript definitions for React (`/mobile`)

## Configuration

- dotenv-based configuration in backend (`/backend/src/server.js` loads with `require('dotenv').config()`)
- Environment variables: `PORT` (default 3000 in `/backend/src/server.js`)
- `.env.example` present in `/backend/` (reference only; actual `.env` gitignored)
- `app.json` - Expo configuration with platform-specific settings (`/mobile/app.json`)
- `tsconfig.json` - TypeScript compiler options extending expo/tsconfig.base (`/mobile`)
- App orientation: portrait
- Icon and splash screen assets in `/mobile/assets/`
- Android adaptive icon with foreground/background/monochrome images
- iOS tablet support enabled
- Web favicon configuration

## Platform Requirements

- Node.js (backend development)
- npm or equivalent package manager
- Expo CLI tools
- iOS/Android SDK (for native mobile builds)
- TypeScript toolchain (for mobile type checking)
- Node.js server hosting for backend
- MongoDB database connectivity
- Mobile: iOS App Store / Google Play Store distribution via Expo EAS (not currently configured)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Backend: lowercase with extension (`server.js`)
- Mobile: PascalCase for components (`App.tsx`), lowercase for entry points (`index.ts`)
- No file suffix patterns observed (no `.controller`, `.service`, `.model` suffixes)
- camelCase for all function names and methods
- Arrow functions preferred for event handlers and callbacks
- Example: `registerRootComponent()`, event handler `(req, res) => res.json()`
- camelCase for local variables and constants
- Example: `httpServer`, `socket`, `PORT`, `io`
- Environment variables in UPPERCASE: `process.env.PORT`
- Component names in PascalCase: `App`
- Type imports from external libraries: `StatusBar`, `StyleSheet`, `Text`, `View`
- No custom type definitions observed in current codebase

## Code Style

- No formatter configured (Prettier not installed)
- 2-space indentation (observed in backend and mobile code)
- Semicolons present on statements
- No linter configured (ESLint not installed)
- Code follows basic JavaScript/TypeScript conventions

## Import Organization

- No path aliases configured
- Relative imports used: `import App from './App'`
- Backend: CommonJS (`require()`, implicit module.exports)
- Mobile: ES6 modules (`import`/`export`, `export default`)

## Error Handling

- Backend: Synchronous error handling via try-catch pattern not observed yet
- No error middleware or centralized error handling visible
- Console logging used for basic diagnostics: `console.log('Client connected:', socket.id)`

## Logging

- Used for connection events: `console.log('Client connected:', socket.id)`
- Used for server startup: `console.log(`Server running on port ${PORT}`)`
- No structured logging framework in place

## Comments

- Minimal comments observed
- Auto-generated comments included in Expo project template: `// registerRootComponent calls AppRegistry.registerComponent...`
- Comments mark areas for future development: `// Routes (to be added)`, `// Socket.io (to be added)`
- No JSDoc or TSDoc comments observed in codebase
- Not enforced or used

## Function Design

- Backend route handler: `(req, res) => res.json({ status: 'ok' })` (1 line)
- Socket event handlers: 1-2 lines of logic
- Minimal parameter passing
- Event handlers use single parameter: `(socket) => {}`
- Route handlers use request/response pattern: `(req, res) => {}`
- Express routes return via `res.json()` or `res.send()`
- React components return JSX: `return <View>...</View>`
- No explicit return for side-effect functions

## Module Design

- Default exports for React components: `export default function App() {}`
- Re-exported components: `registerRootComponent(App)`
- Not used in current codebase
- Simple entry points only (`index.ts` in mobile, `server.js` in backend)

## Project-Specific Patterns

- HTTP server created separately from Express app: `const httpServer = createServer(app)` then `new Server(httpServer, {...})`
- CORS configured at app level: `app.use(cors())`
- Socket.io handles connection/disconnection lifecycle via event listeners
- Environment-based configuration via `.env` file with dotenv
- Functional component structure with hooks-ready architecture
- Styles defined using `StyleSheet.create()` for performance
- All JSX returned from single root view component
- Entry point registers root component with Expo: `registerRootComponent(App)`
- TypeScript strict mode enabled

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern

- `/backend/` — Node.js REST API + WebSocket server (Express + Socket.io + MongoDB)
- `/mobile/` — React Native mobile app (Expo)

## Backend Architecture

```

```

- `server.js` — Express app setup, Socket.io init, HTTP server
- `src/routes/` — Route definitions (empty)
- `src/controllers/` — Request handlers (empty)
- `src/services/` — Business logic (empty)
- `src/models/` — Mongoose models (empty)
- `src/middleware/` — Auth, validation middleware (empty)
- `src/config/` — DB and app config (empty)
- `src/socket/` — Socket.io event handlers (empty)
- Creates Express app + HTTP server + Socket.io server
- Registers `cors()` and `express.json()` middleware
- Has `/health` endpoint only
- Listens on `process.env.PORT || 3000`

## Mobile Architecture

```

```

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

## Data Flow

```

```

```

```

## Key Abstractions

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

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
