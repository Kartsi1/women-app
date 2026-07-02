# Technology Stack

**Analysis Date:** 2026-07-02

## Languages

**Primary:**
- JavaScript (ES6+) - Backend application (`/backend/src/server.js`)
- TypeScript 6.0.3 - Mobile application and type definitions (`/mobile/App.tsx`, `/mobile/index.ts`)

**Secondary:**
- JSON - Configuration files (package.json, app.json, tsconfig.json)

## Runtime

**Environment:**
- Node.js - Backend runtime (version not explicitly specified, npm is package manager)
- Expo 57.0.1 - Mobile app runtime and development environment (`/mobile`)

**Package Manager:**
- npm (Node Package Manager)
- Lockfiles present: `package-lock.json` (mobile), implicit in backend

## Frameworks

**Core:**
- Express 4.19.2 - Web framework and HTTP server (`/backend/src/server.js`)
- React Native 0.86.0 - Mobile application framework (`/mobile`)
- React 19.2.3 - UI library for mobile app (`/mobile`)
- Expo 57.0.1 - React Native development platform and build system (`/mobile`)

**Real-time Communication:**
- Socket.io 4.7.5 - WebSocket-based real-time communication (`/backend/src/server.js`)

**Testing:**
- Not detected

**Build/Dev:**
- nodemon 3.1.3 - Development server with auto-reload (`/backend`)
- TypeScript 6.0.3 - Type checking for mobile app (`/mobile`)
- Expo CLI - Development and build tool (`/mobile`)

## Key Dependencies

**Critical:**
- mongoose 8.4.1 - MongoDB object modeling and ODM (`/backend/package.json`)
- jsonwebtoken 9.0.2 - JWT authentication token handling (`/backend/package.json`)

**Authentication & Security:**
- bcryptjs 2.4.3 - Password hashing and validation (`/backend/package.json`)

**Infrastructure:**
- cors 2.8.5 - Cross-Origin Resource Sharing middleware (`/backend/src/server.js`)
- dotenv 16.4.5 - Environment variable configuration (`/backend/src/server.js`)

**Type Safety:**
- @types/react ~19.2.2 - TypeScript definitions for React (`/mobile`)

## Configuration

**Environment:**
- dotenv-based configuration in backend (`/backend/src/server.js` loads with `require('dotenv').config()`)
- Environment variables: `PORT` (default 3000 in `/backend/src/server.js`)
- `.env.example` present in `/backend/` (reference only; actual `.env` gitignored)

**Build:**
- `app.json` - Expo configuration with platform-specific settings (`/mobile/app.json`)
- `tsconfig.json` - TypeScript compiler options extending expo/tsconfig.base (`/mobile`)

**Mobile:**
- App orientation: portrait
- Icon and splash screen assets in `/mobile/assets/`
- Android adaptive icon with foreground/background/monochrome images
- iOS tablet support enabled
- Web favicon configuration

## Platform Requirements

**Development:**
- Node.js (backend development)
- npm or equivalent package manager
- Expo CLI tools
- iOS/Android SDK (for native mobile builds)
- TypeScript toolchain (for mobile type checking)

**Production:**
- Node.js server hosting for backend
- MongoDB database connectivity
- Mobile: iOS App Store / Google Play Store distribution via Expo EAS (not currently configured)

---

*Stack analysis: 2026-07-02*
