# Directory Structure

**Analysis Date:** 2026-07-02

## Root Layout

```
/women-app/
├── backend/           # Node.js REST API + WebSocket server
├── mobile/            # Expo React Native app (separate git repo)
├── .claude/           # Claude Code / GSD configuration
├── .git/              # Root git repo (newly initialized)
├── .gitignore         # Root gitignore
└── .planning/         # GSD planning documents (this dir)
```

**Note:** `/mobile/` has its own `.git/` — it is a separate git repository nested inside the monorepo root. The root `.git/` was initialized during GSD setup.

## Backend Directory

```
backend/
├── package.json       # npm manifest: express, mongoose, socket.io, bcryptjs, jwt, cors, dotenv
├── .env.example       # Environment variable reference (actual .env gitignored)
└── src/
    ├── server.js      # ✓ ONLY IMPLEMENTED FILE — Express + Socket.io setup
    ├── routes/        # (empty) — planned route modules
    ├── controllers/   # (empty) — planned request handlers
    ├── services/      # (empty) — planned business logic
    ├── models/        # (empty) — planned Mongoose models
    ├── middleware/    # (empty) — planned auth/validation middleware
    ├── config/        # (empty) — planned DB/app config
    └── socket/        # (empty) — planned Socket.io event handlers
```

## Mobile Directory

```
mobile/
├── package.json       # npm manifest: expo, react, react-native, typescript
├── package-lock.json  # npm lockfile
├── app.json           # Expo config (name, slug, orientation, icons)
├── tsconfig.json      # TypeScript config (extends expo/tsconfig.base, strict: true)
├── App.tsx            # ✓ Root component — default Expo placeholder only
├── index.ts           # ✓ Expo app entry point
├── CLAUDE.md          # → @AGENTS.md
├── AGENTS.md          # Expo v57 docs note
├── LICENSE
├── assets/            # Static image assets
│   ├── icon.png
│   ├── splash-icon.png
│   ├── favicon.png
│   ├── android-icon-foreground.png
│   ├── android-icon-background.png
│   └── android-icon-monochrome.png
├── node_modules/      # Installed dependencies
└── src/
    ├── screens/       # Feature screens by domain
    │   ├── Auth/      # (empty) — login, signup, etc.
    │   ├── Chat/      # (empty) — messaging UI
    │   ├── Listings/  # (empty) — listings browse/view
    │   └── Profile/   # (empty) — user profile
    ├── navigation/    # (empty) — React Navigation setup
    ├── components/    # (empty) — shared UI components
    ├── hooks/         # (empty) — custom React hooks
    ├── store/         # (empty) — state management (Redux/Zustand)
    ├── services/      # (empty) — API client / backend communication
    ├── types/         # (empty) — TypeScript type definitions
    └── constants/     # (empty) — app-wide constants
```

## Key Locations

| What | Path |
|------|------|
| Backend entry | `backend/src/server.js` |
| Backend deps | `backend/package.json` |
| Backend env vars | `backend/.env.example` |
| Mobile root | `mobile/App.tsx` |
| Mobile entry | `mobile/index.ts` |
| Mobile config | `mobile/app.json` |
| Mobile deps | `mobile/package.json` |
| GSD planning | `.planning/` |

## Naming Conventions

**Backend:**
- Files: camelCase (`server.js`)
- Directories: lowercase plural (`routes/`, `controllers/`, `models/`, `services/`)

**Mobile:**
- Files: PascalCase for components (`App.tsx`), camelCase for utilities
- Directories: PascalCase for feature screens (`Auth/`, `Chat/`, `Listings/`, `Profile/`), camelCase for shared (`hooks/`, `store/`, `services/`, `types/`, `constants/`)
- TypeScript strict mode enabled

## Implementation Status

| Directory | Files | Status |
|-----------|-------|--------|
| `backend/src/` | 1 of ~8 expected | Skeleton |
| `mobile/src/screens/Auth/` | 0 | Empty |
| `mobile/src/screens/Chat/` | 0 | Empty |
| `mobile/src/screens/Listings/` | 0 | Empty |
| `mobile/src/screens/Profile/` | 0 | Empty |
| `mobile/src/navigation/` | 0 | Empty |
| `mobile/src/components/` | 0 | Empty |
| `mobile/src/hooks/` | 0 | Empty |
| `mobile/src/store/` | 0 | Empty |
| `mobile/src/services/` | 0 | Empty |
| `mobile/src/types/` | 0 | Empty |
| `mobile/src/constants/` | 0 | Empty |

---

*Structure analysis: 2026-07-02*
