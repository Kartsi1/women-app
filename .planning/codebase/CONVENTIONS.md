# Coding Conventions

**Analysis Date:** 2026-07-02

## Naming Patterns

**Files:**
- Backend: lowercase with extension (`server.js`)
- Mobile: PascalCase for components (`App.tsx`), lowercase for entry points (`index.ts`)
- No file suffix patterns observed (no `.controller`, `.service`, `.model` suffixes)

**Functions:**
- camelCase for all function names and methods
- Arrow functions preferred for event handlers and callbacks
- Example: `registerRootComponent()`, event handler `(req, res) => res.json()`

**Variables:**
- camelCase for local variables and constants
- Example: `httpServer`, `socket`, `PORT`, `io`
- Environment variables in UPPERCASE: `process.env.PORT`

**Types:**
- Component names in PascalCase: `App`
- Type imports from external libraries: `StatusBar`, `StyleSheet`, `Text`, `View`
- No custom type definitions observed in current codebase

## Code Style

**Formatting:**
- No formatter configured (Prettier not installed)
- 2-space indentation (observed in backend and mobile code)
- Semicolons present on statements

**Linting:**
- No linter configured (ESLint not installed)
- Code follows basic JavaScript/TypeScript conventions

## Import Organization

**Order:**
1. External library imports (React, React Native, Expo, Express, Node.js built-ins)
2. Internal application imports

**Path Aliases:**
- No path aliases configured
- Relative imports used: `import App from './App'`

**Module Systems:**
- Backend: CommonJS (`require()`, implicit module.exports)
- Mobile: ES6 modules (`import`/`export`, `export default`)

## Error Handling

**Patterns:**
- Backend: Synchronous error handling via try-catch pattern not observed yet
- No error middleware or centralized error handling visible
- Console logging used for basic diagnostics: `console.log('Client connected:', socket.id)`

## Logging

**Framework:** Console (browser/Node.js built-in)

**Patterns:**
- Used for connection events: `console.log('Client connected:', socket.id)`
- Used for server startup: `console.log(`Server running on port ${PORT}`)`
- No structured logging framework in place

## Comments

**When to Comment:**
- Minimal comments observed
- Auto-generated comments included in Expo project template: `// registerRootComponent calls AppRegistry.registerComponent...`
- Comments mark areas for future development: `// Routes (to be added)`, `// Socket.io (to be added)`

**JSDoc/TSDoc:**
- No JSDoc or TSDoc comments observed in codebase
- Not enforced or used

## Function Design

**Size:** Single-purpose small functions preferred
- Backend route handler: `(req, res) => res.json({ status: 'ok' })` (1 line)
- Socket event handlers: 1-2 lines of logic

**Parameters:** 
- Minimal parameter passing
- Event handlers use single parameter: `(socket) => {}`
- Route handlers use request/response pattern: `(req, res) => {}`

**Return Values:** 
- Express routes return via `res.json()` or `res.send()`
- React components return JSX: `return <View>...</View>`
- No explicit return for side-effect functions

## Module Design

**Exports:**
- Default exports for React components: `export default function App() {}`
- Re-exported components: `registerRootComponent(App)`

**Barrel Files:**
- Not used in current codebase
- Simple entry points only (`index.ts` in mobile, `server.js` in backend)

## Project-Specific Patterns

**Backend (Express + Socket.io):**
- HTTP server created separately from Express app: `const httpServer = createServer(app)` then `new Server(httpServer, {...})`
- CORS configured at app level: `app.use(cors())`
- Socket.io handles connection/disconnection lifecycle via event listeners
- Environment-based configuration via `.env` file with dotenv

**Mobile (React Native + Expo):**
- Functional component structure with hooks-ready architecture
- Styles defined using `StyleSheet.create()` for performance
- All JSX returned from single root view component
- Entry point registers root component with Expo: `registerRootComponent(App)`
- TypeScript strict mode enabled

---

*Convention analysis: 2026-07-02*
