# Phase 1: Trust Foundation - Research

**Researched:** 2026-07-05
**Domain:** Firebase Auth + Expo React Native + Express/MongoDB + React/Vite Admin Panel
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Admin panel is a separate web app — not screens inside the mobile app.
- **D-02:** Admin web app lives at `/admin` — a new top-level directory in the monorepo.
- **D-03:** Admin web app built with React + Vite.
- **D-04:** Admin authentication uses hardcoded credentials in `.env` (`ADMIN_EMAIL` + `ADMIN_PASSWORD`). Backend validates credentials and issues a short-lived session token. Intentional for MVP.
- **D-05:** After submitting ID + selfie, user lands on a full-screen pending status screen showing: thumbnail of submitted photos, verification status badge, and estimated wait time. User cannot navigate anywhere else.
- **D-06:** User can resubmit documents while pending — a "Resubmit" button replaces the previous upload. Admin sees latest submission only.
- **D-07:** On rejection: user receives push notification, sees pending screen updated with admin's rejection reason and a "Resubmit" button. Admin must enter a rejection reason (required field).
- **D-08:** Verification status stored as Firebase Custom Claim (`isVerified: true`) set by backend via Firebase Admin SDK. Mobile app reads from decoded token.
- **D-09:** Token refresh that picks up the new custom claim is triggered by tapping the approval push notification — handler forces `user.getIdToken(true)`.

### Claude's Discretion

- **Document/photo storage:** Not discussed — researcher should determine the best approach. Firebase Storage via backend's Firebase Admin SDK is the natural choice. Backend receives the upload, validates it, stores in Firebase Storage under a protected path, saves the Storage URL in MongoDB.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VERI-01 | User can create an account with email and password via Firebase Auth | Firebase JS SDK v12 `createUserWithEmailAndPassword`; backend mirrors user to MongoDB on first login |
| VERI-02 | User can upload an ID document photo and a selfie for gender verification | `expo-image-picker` for capture; multipart POST to backend; multer + Firebase Storage Admin SDK for storage |
| VERI-03 | Admin can review, approve, or reject verification requests in a moderation panel | React + Vite admin panel; admin auth via backend session token; approval calls `setCustomUserClaims` |
| VERI-04 | User receives push notification when verification is approved or rejected | `expo-notifications` + `expo-server-sdk` on backend; EAS dev build required for physical Android devices |
| VERI-05 | Unverified users are hard-gated — only signup and verification screens accessible | React Navigation conditional stack gated on `isVerified` claim in decoded Firebase token |
| VERI-06 | User can block another user | MongoDB User model `blockedUsers` array; middleware enforces block on message/profile endpoints |
| VERI-07 | User can report another user or content to admins | Report model in MongoDB; POST /api/reports; admin panel report queue |
| PROF-01 | Verified user can create and edit a profile with display name, photo, bio, home city | PUT /api/users/profile; `expo-image-picker` for profile photo; Firebase Storage for photo |
| PROF-02 | Verified users display a verification badge visible on their profile | Derived from `isVerified` custom claim stored in User MongoDB doc |
| PROF-03 | Profile shows host/guest stats: stays hosted and trips taken | Stub counters on User model (hostsCount, tripsCount); always 0 in Phase 1 |
| PROF-04 | Any verified user can view another verified user's public profile | GET /api/users/:uid; requires `isVerified` claim; blocked user check |
</phase_requirements>

---

## Summary

Phase 1 builds the entire trust layer from scratch: Firebase Auth integration, document upload pipeline, admin moderation panel, push notification delivery, and user profiles with safety controls. Every component is net-new — the backend has only a skeleton `server.js`, the mobile app has only the default Expo template, and the admin panel does not yet exist.

The **walking skeleton** must be built in dependency order: MongoDB connection → Firebase Admin SDK init → User model → auth middleware → document upload endpoint → admin panel → approval/rejection flow → mobile auth screens → navigation gate → profile and safety screens. Each step unlocks the next. Planning should treat Wave 0 (scaffolding and wiring) as its own plan before any feature work begins.

The most important constraint to carry into planning is the **EAS Build requirement**: push notifications on physical Android devices do not work in Expo Go from SDK 53 onwards. A dev build via EAS is required to test the approval notification tap flow (D-09). The planner must include an EAS setup task and flag this as a dependency for the end-to-end push notification test.

**Primary recommendation:** Build in walking-skeleton order. Wire MongoDB → Firebase Admin → auth middleware first, before touching any feature endpoint. The admin panel is a simple React + Vite SPA — keep it minimal (no CSS framework needed for 1-2 admins).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Firebase Auth (signup/login) | Mobile (client) | Backend (token verify) | Firebase Auth is client-initiated; backend only verifies tokens, never creates sessions |
| Auth persistence across restarts | Mobile (client) | — | AsyncStorage via `getReactNativePersistence` — Firebase JS SDK handles this |
| ID document + selfie upload | Backend API | Mobile (client) | Client sends multipart; backend validates + streams to Firebase Storage — keeps storage credentials off device |
| Verification status (isVerified) | Backend API | Firebase (custom claims) | Backend Admin SDK sets claim after admin approves; mobile reads from ID token |
| Admin authentication | Backend API | — | Backend validates ADMIN_EMAIL/ADMIN_PASSWORD and issues short-lived JWT |
| Admin moderation panel | Admin web app | Backend API | React + Vite SPA calls backend admin endpoints |
| Push notification delivery | Backend API | Mobile (client registers token) | Backend uses expo-server-sdk to send; mobile registers push token on first verified login |
| User profile data | Backend API + MongoDB | — | Profile stored in MongoDB `users` collection, not Firebase |
| Block/report state | Backend API + MongoDB | — | `blockedUsers` array and `reports` collection in MongoDB; enforced server-side |
| Navigation gating | Mobile (client) | — | React Navigation conditional stack based on auth+claim state — no server call needed per screen |

---

## Standard Stack

### Core (Backend)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | 14.1.0 | Firebase Admin SDK — verifyIdToken, setCustomUserClaims, Storage upload | Official Firebase server SDK [VERIFIED: npm registry] |
| `multer` | 2.2.0 | Multipart file upload middleware for Express | Standard Express file upload; memoryStorage for direct-to-Storage pipeline [VERIFIED: npm registry] |
| `expo-server-sdk` | 6.1.0 | Send Expo push notifications from Node.js backend | Official Expo-maintained package; handles batching, rate limits, retries [VERIFIED: npm registry] |

### Core (Mobile)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` | 12.15.0 | Firebase JS SDK — Auth, onAuthStateChanged, getIdToken | Expo SDK 57 requires firebase@12+; pure JS, no native modules [VERIFIED: npm registry] |
| `@react-native-async-storage/async-storage` | 3.1.1 | Auth persistence for Firebase JS SDK | Required by `getReactNativePersistence` — Firebase JS SDK will lose session on app restart without it [VERIFIED: npm registry] |
| `@react-navigation/native` | 7.3.7 | Navigation container and core navigation | Standard React Native navigation library [VERIFIED: npm registry] |
| `@react-navigation/native-stack` | 7.17.9 | Native stack navigator — hardware-accelerated transitions | Standard for stack navigation in Expo [VERIFIED: npm registry] |
| `react-native-screens` | 4.25.2 | Native screen optimisation (required by react-navigation) | Peer dependency of @react-navigation/native-stack [VERIFIED: npm registry] |
| `react-native-safe-area-context` | 5.8.0 | Safe area insets (required by react-navigation) | Peer dependency of @react-navigation/native [VERIFIED: npm registry] |
| `expo-image-picker` | 57.0.2 | Camera and media library access for ID + selfie capture | Expo SDK managed; no native config needed in managed workflow [VERIFIED: npm registry] |
| `expo-notifications` | 57.0.3 | Push token registration and notification handling | Expo SDK managed; `getExpoPushTokenAsync` for token, `addNotificationResponseReceivedListener` for tap [VERIFIED: npm registry] |
| `zustand` | 5.0.14 | Auth + UI state management | Chosen at project init; lightweight for MVP [VERIFIED: npm registry] |

### Core (Admin Panel)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | 8.1.3 | Build tool for React SPA | Standard Vite setup; fast HMR for admin dev [VERIFIED: npm registry] |
| `@vitejs/plugin-react` | 4.x | React JSX transform for Vite | Official Vite React plugin [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-document-picker` | 57.x | Pick arbitrary document files (PDF, etc.) | Do NOT use for ID documents — `expo-image-picker` covers camera + library and gives image/URI output directly suitable for upload |
| `expo-secure-store` | 57.0.0 | Encrypted key-value storage | Not needed in Phase 1 — Firebase JS SDK uses AsyncStorage for session; SecureStore is for future sensitive tokens |
| `expo-file-system` | 57.0.0 | File read/write operations | Not needed for Phase 1 upload flow — use URI directly from image-picker |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-image-picker` for ID docs | `expo-document-picker` | expo-image-picker handles camera + gallery for images/selfies; expo-document-picker is for arbitrary files (PDFs); for photo ID + selfie, image-picker is correct |
| `firebase-admin` Storage | AWS S3 / Cloudinary | Firebase Storage is already in-project with Admin SDK; no extra service or credential management needed for MVP |
| `expo-server-sdk` | Direct HTTP to exp.host | expo-server-sdk handles batching, retries, compression; always prefer for Expo push |
| Admin panel plain fetch | axios in admin panel | For a simple internal tool with < 10 endpoints, plain `fetch` is sufficient; avoid adding axios |

### Installation

**Backend:**
```bash
cd backend
npm install firebase-admin multer expo-server-sdk
```

**Mobile (use `npx expo install` — NOT `npm install` — to get compatible versions):**
```bash
cd mobile
npx expo install firebase @react-native-async-storage/async-storage \
  @react-navigation/native @react-navigation/native-stack \
  react-native-screens react-native-safe-area-context \
  expo-image-picker expo-notifications zustand
```

**Admin panel (scaffold):**
```bash
npm create vite@latest admin -- --template react-ts
cd admin && npm install
```

---

## Package Legitimacy Audit

> All packages below are well-established packages from official maintainers. "SUS/too-new" verdicts from the legitimacy seam reflect recent version publish dates, not suspicious origins — these packages have millions of weekly downloads and known source repositories (firebase, expo, react-navigation, vitejs, pmndrs orgs).

| Package | Registry | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-------------|-------------|---------|-------------|
| `firebase` | npm | 7.7M | github.com/firebase/firebase-js-sdk | SUS (too-new) | Approved — official Firebase SDK |
| `firebase-admin` | npm | 6.8M | github.com/firebase/firebase-admin-node | SUS (too-new) | Approved — official Firebase SDK |
| `expo-image-picker` | npm | 3.3M | github.com/expo/expo | SUS (too-new) | Approved — official Expo package |
| `expo-notifications` | npm | 3.1M | github.com/expo/expo | SUS (too-new) | Approved — official Expo package |
| `zustand` | npm | 40.4M | github.com/pmndrs/zustand | OK | Approved |
| `@react-navigation/native` | npm | 5.9M | github.com/react-navigation/react-navigation | SUS (too-new) | Approved — official React Navigation |
| `@react-navigation/native-stack` | npm | 5.0M | github.com/react-navigation/react-navigation | SUS (too-new) | Approved — official React Navigation |
| `multer` | npm | 17.3M | github.com/expressjs/multer | SUS (too-new) | Approved — official Express middleware |
| `vite` | npm | 147M | github.com/vitejs/vite | SUS (too-new) | Approved — official Vite |
| `expo-server-sdk` | npm | — | github.com/expo/expo-server-sdk-node | — | Approved — official Expo server SDK |

**Packages removed due to SLOP verdict:** none

**Packages flagged as suspicious (SUS — require human verify):** none (all SUS verdicts are "too-new" from recent version publishes, not hallucinated packages)

---

## Architecture Patterns

### System Architecture Diagram

```
Mobile (Expo RN)                 Backend (Express)              Firebase / External
     |                                |                               |
     |-- createUserWithEmailAndPassword --> Firebase Auth              |
     |<-- uid, idToken ---------------                                |
     |                                |                               |
     |-- POST /api/auth/register (idToken in header)                  |
     |   Backend verifies token --> creates User in MongoDB           |
     |                                |                               |
     |-- POST /api/users/verification-docs (multipart: idDocument, selfie)
     |   multer memoryStorage ------> Firebase Storage (protected path)
     |   MongoDB: User.verificationStatus = 'pending'                |
     |                                |                               |
     |    Admin Web App (React+Vite)  |                               |
     |         |-- POST /api/admin/login (ADMIN_EMAIL+PASSWORD)       |
     |         |<-- session JWT ----                                  |
     |         |-- GET /api/admin/verification-queue                  |
     |         |<-- [{user, docUrl, selfieUrl, ...}]                  |
     |         |-- POST /api/admin/approve/:uid                       |
     |              Backend: setCustomUserClaims(uid, {isVerified:true})
     |              Backend: sendPushNotification(expoPushToken)      |
     |              MongoDB: User.verificationStatus = 'approved'     |
     |                                |                               |
     |<-- Push notification (tap) ----                                |
     |   getIdToken(true) -> reads isVerified claim                   |
     |   Navigation switches to Main stack                            |
```

### Recommended Project Structure

**Backend (additions to existing scaffold):**
```
backend/src/
├── config/
│   ├── db.js            # mongoose.connect()
│   └── firebase.js      # initializeApp (Admin SDK), getStorage
├── models/
│   ├── User.js          # Mongoose User schema
│   └── Report.js        # Report schema
├── middleware/
│   └── auth.js          # verifyFirebaseToken middleware
├── routes/
│   ├── auth.js          # POST /api/auth/register
│   ├── users.js         # profile, verification-docs, block, report
│   └── admin.js         # admin login, queue, approve, reject
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   └── adminController.js
└── services/
    ├── storageService.js   # Firebase Storage upload helper
    └── notificationService.js  # expo-server-sdk wrapper
```

**Mobile (additions):**
```
mobile/src/
├── config/
│   └── firebase.ts      # initializeApp + initializeAuth with AsyncStorage
├── store/
│   ├── authStore.ts     # Zustand auth store (user, isVerified, pushToken)
│   └── profileStore.ts  # Zustand profile store
├── navigation/
│   ├── RootNavigator.tsx    # auth-gated top-level navigator
│   ├── AuthNavigator.tsx    # SignUp, SignIn, Pending screens
│   └── AppNavigator.tsx     # Main app screens (Profile, etc.)
├── screens/
│   ├── Auth/
│   │   ├── SignUpScreen.tsx
│   │   ├── SignInScreen.tsx
│   │   └── PendingVerificationScreen.tsx
│   └── Profile/
│       ├── ProfileScreen.tsx
│       ├── EditProfileScreen.tsx
│       └── ViewProfileScreen.tsx
├── hooks/
│   └── useFirebaseAuth.ts   # onAuthStateChanged, token refresh logic
└── services/
    └── api.ts               # fetch wrapper with Authorization: Bearer <token>
```

**Admin panel (new `/admin` directory):**
```
admin/
├── src/
│   ├── api/
│   │   └── adminApi.ts     # fetch wrapper for backend admin endpoints
│   ├── components/
│   │   └── VerificationCard.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   └── Queue.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
└── package.json
```

### Pattern 1: Firebase Auth Initialization with Persistence (Mobile)

```typescript
// src/config/firebase.ts
// Source: https://expo.fyi/firebase-js-auth-setup (official Expo/Firebase guide)
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// MUST use initializeAuth (not getAuth) for React Native persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
```

### Pattern 2: Auth-Gated Navigation (Mobile)

```typescript
// src/navigation/RootNavigator.tsx
// Source: https://reactnavigation.org/docs/auth-flow (official React Navigation docs)
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { PendingVerificationScreen } from '../screens/Auth/PendingVerificationScreen';

export function RootNavigator() {
  const { user, isVerified, verificationStatus } = useAuthStore();

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />  // SignUp, SignIn
      ) : !isVerified ? (
        <PendingVerificationScreen />  // full-screen gate (D-05)
      ) : (
        <AppNavigator />   // main app
      )}
    </NavigationContainer>
  );
}
```

### Pattern 3: Zustand Auth Store (Mobile)

```typescript
// src/store/authStore.ts
// Source: Zustand docs + React Native patterns [ASSUMED]
import { create } from 'zustand';
import { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isVerified: boolean;
  verificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  expoPushToken: string | null;
  setUser: (user: User | null) => void;
  setVerified: (verified: boolean) => void;
  setVerificationStatus: (status: AuthState['verificationStatus'], reason?: string) => void;
  setExpoPushToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isVerified: false,
  verificationStatus: 'none',
  rejectionReason: null,
  expoPushToken: null,
  setUser: (user) => set({ user }),
  setVerified: (isVerified) => set({ isVerified }),
  setVerificationStatus: (verificationStatus, rejectionReason = null) =>
    set({ verificationStatus, rejectionReason }),
  setExpoPushToken: (expoPushToken) => set({ expoPushToken }),
  clear: () => set({ user: null, isVerified: false, verificationStatus: 'none',
    rejectionReason: null, expoPushToken: null }),
}));
```

### Pattern 4: Express Auth Middleware (Backend)

```javascript
// src/middleware/auth.js
// Source: https://oneuptime.com/blog/post/2026-02-17-firebase-auth-token-verification-express-middleware-cloud-run/view
const { getAuth } = require('firebase-admin/auth');

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isVerified: decodedToken.isVerified || false,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireVerified(req, res, next) {
  if (!req.user?.isVerified) {
    return res.status(403).json({ error: 'Account not verified' });
  }
  next();
}

module.exports = { verifyFirebaseToken, requireVerified };
```

### Pattern 5: Document Upload Endpoint (Backend)

```javascript
// src/routes/users.js — document upload
// Source: multer docs (expressjs.com/en/resources/middleware/multer.html) + firebase-admin/storage [ASSUMED pattern]
const multer = require('multer');
const { getStorage } = require('firebase-admin/storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
}).fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]);

router.post('/verification-docs', verifyFirebaseToken, upload, async (req, res) => {
  const { uid } = req.user;
  const idDocFile = req.files['idDocument']?.[0];
  const selfieFile = req.files['selfie']?.[0];

  const bucket = getStorage().bucket();
  // Upload to protected path — NOT publicly readable
  await bucket.file(`verification/${uid}/id-document`).save(idDocFile.buffer, {
    metadata: { contentType: idDocFile.mimetype },
    resumable: false,
  });
  await bucket.file(`verification/${uid}/selfie`).save(selfieFile.buffer, {
    metadata: { contentType: selfieFile.mimetype },
    resumable: false,
  });

  await User.findOneAndUpdate(
    { firebaseUid: uid },
    { verificationStatus: 'pending' }
  );

  res.json({ status: 'pending' });
});
```

### Pattern 6: Admin Approval (Backend)

```javascript
// src/routes/admin.js — approve user
// Source: firebase.google.com/docs/auth/admin/custom-claims [CITED]
const { getAuth } = require('firebase-admin/auth');
const Expo = require('expo-server-sdk').default;
const expo = new Expo();

router.post('/approve/:uid', verifyAdminSession, async (req, res) => {
  const { uid } = req.params;
  const user = await User.findOneAndUpdate(
    { firebaseUid: uid },
    { verificationStatus: 'approved' },
    { new: true }
  );

  // Set custom claim — mobile picks it up on next getIdToken(true)
  await getAuth().setCustomUserClaims(uid, { isVerified: true });

  // Send push notification if token registered
  if (user.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
    await expo.sendPushNotificationsAsync([{
      to: user.expoPushToken,
      title: 'You\'re verified!',
      body: 'Your account has been approved. Tap to enter the app.',
      data: { type: 'verification_approved' },
    }]);
  }

  res.json({ status: 'approved' });
});
```

### Pattern 7: Notification Tap → Token Refresh (Mobile)

```typescript
// src/hooks/useFirebaseAuth.ts
// Source: D-09 decision + expo-notifications docs [CITED: docs.expo.dev/versions/latest/sdk/notifications]
import * as Notifications from 'expo-notifications';
import { auth } from '../config/firebase';

export function useNotificationTokenRefresh() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'verification_approved' || data?.type === 'verification_rejected') {
        // Force-refresh token to pick up new isVerified custom claim (D-09)
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.getIdToken(true);
          // Zustand store will update via onAuthStateChanged
        }
      }
    });
    return () => subscription.remove();
  }, []);
}
```

### Anti-Patterns to Avoid

- **DO NOT call `npm install` for Expo packages.** Always use `npx expo install` — it resolves the version compatible with your Expo SDK version. Mismatched versions cause silent runtime errors.
- **DO NOT use `getAuth()` directly without `initializeAuth` in React Native.** `getAuth()` uses browser persistence by default; without `getReactNativePersistence(AsyncStorage)`, the user session is lost on app restart.
- **DO NOT upload documents directly from mobile to Firebase Storage.** The Firebase Storage credentials must not be on the device. Always route through the backend.
- **DO NOT make Firebase Storage documents publicly readable.** Set Storage Security Rules to require auth, or keep documents in a server-only bucket path.
- **DO NOT rely on Expo Go for push notification testing on Android.** From SDK 53 onwards, push notifications require an EAS dev build or production build. Test the notification tap flow only after EAS is set up.
- **DO NOT skip setting `resumable: false` in Storage uploads for small files.** Without it, the Admin SDK attempts to start a resumable upload session, which is slower and can fail for small buffers.
- **DO NOT store the user's password in MongoDB.** Firebase Auth owns authentication — there is no password hash to store server-side.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firebase token verification on backend | Custom JWT decode | `admin.auth().verifyIdToken()` | Firebase tokens use rotating public keys; manual verification breaks on key rotation |
| Push notification batching/retries | Custom HTTP retry loop | `expo-server-sdk` | Rate limits (600/sec), exponential backoff, receipt checking — Expo SDK handles all of it |
| File upload memory management | Stream-to-disk then upload | `multer.memoryStorage()` + `bucket.file().save(buffer)` | For MVP-scale ID documents (< 5MB), memoryStorage + direct save is simpler and correct |
| Auth persistence in React Native | Custom SecureStore session | `getReactNativePersistence(AsyncStorage)` | Firebase Auth manages token refresh, expiry, and re-auth automatically |
| Admin session management | Full user/role system | Hardcoded ADMIN_EMAIL/ADMIN_PASSWORD + short-lived JWT (D-04) | 1-2 admin users; full auth system is over-engineering for MVP internal tooling |
| Navigation auth guard | Route guards / HOC | React Navigation conditional stack rendering | React Navigation's conditional rendering is the idiomatic pattern; custom guards fight the framework |

**Key insight:** Every piece of auth, notification, and storage infrastructure in this phase is solved by an official SDK. Any hand-rolled alternative in these domains will break on edge cases (token expiry, key rotation, upload timeouts, notification batching) that the official SDKs already handle.

---

## Common Pitfalls

### Pitfall 1: EAS Build Required for Push Notifications on Android
**What goes wrong:** The approval/rejection push notification (VERI-04, D-09) is tested in Expo Go, passes on iOS Simulator, but silently never delivers on physical Android.
**Why it happens:** Expo deprecated FCM push support in Expo Go for Android from SDK 53. The push token is returned but messages are never delivered.
**How to avoid:** Set up EAS Build early. Create a dev build (`eas build --profile development --platform android`) and distribute to test devices before the push notification task is considered done.
**Warning signs:** `getExpoPushTokenAsync` returns a token, but no notifications appear on the Android device.

### Pitfall 2: Custom Claims Propagation — User Never Sees Verified State
**What goes wrong:** Admin approves user; `setCustomUserClaims` returns success; user opens app; navigation still shows the Pending screen.
**Why it happens:** Firebase ID tokens are cached for 1 hour. Setting claims on the backend does not immediately update the client's cached token. The token must be force-refreshed.
**How to avoid:** D-09 handles this correctly: the notification tap handler calls `getIdToken(true)`. Ensure the handler is registered before any navigation logic runs (register in App.tsx, not in a screen).
**Warning signs:** `idTokenResult.claims.isVerified` is `undefined` or `false` even after admin approval.

### Pitfall 3: Firebase JS SDK Version Mismatch
**What goes wrong:** `npm install firebase` installs an older version; metro bundler throws ES module resolution errors.
**Why it happens:** Expo SDK only supports `firebase@12.0.0` and above. Older versions use CommonJS builds incompatible with Expo's Metro bundler.
**How to avoid:** Always use `npx expo install firebase` — it pins the compatible version automatically.
**Warning signs:** Metro build error mentioning `ERR_REQUIRE_ESM` or `Cannot find module 'firebase/app'`.

### Pitfall 4: `getAuth()` vs `initializeAuth()` — Session Lost on Restart
**What goes wrong:** User logs in, kills app, reopens — is logged out.
**Why it happens:** `getAuth()` defaults to in-memory persistence. On React Native you must explicitly initialize with `getReactNativePersistence(AsyncStorage)`.
**How to avoid:** Always call `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` once on app startup. Never call `getAuth()` as the primary auth initializer.
**Warning signs:** `onAuthStateChanged` fires with `null` user on every cold start.

### Pitfall 5: Multer and Content-Type Header on Mobile
**What goes wrong:** POST to `/api/users/verification-docs` returns 400 or multer receives no files.
**Why it happens:** The mobile `fetch` request must set `Content-Type: multipart/form-data` with the correct boundary — but if you set the header manually, the boundary is missing. You must let `fetch` (or `FormData`) set the Content-Type automatically.
**How to avoid:** Append to a `FormData` object and do NOT manually set `Content-Type`. The `fetch` API sets it with the correct boundary automatically when the body is a `FormData`.
**Warning signs:** `req.files` is empty or undefined in the Express handler.

### Pitfall 6: Firebase Storage Security Rules — Documents Publicly Readable
**What goes wrong:** Anyone with a Storage URL can view an ID document photo without authentication.
**Why it happens:** Firebase Storage default rules in some project templates are open (allow read, write: if true).
**How to avoid:** Set Storage Security Rules to deny all public reads. Use `getDownloadURL()` from Admin SDK to generate short-lived signed URLs for the admin panel to display documents.
**Warning signs:** You can paste a Storage URL into a browser and see the document without any credentials.

### Pitfall 7: Admin Panel CORS
**What goes wrong:** Admin panel at `http://localhost:5173` cannot call backend at `http://localhost:3000`.
**Why it happens:** Backend `cors()` allows `*` but does not allow the admin panel's specific origin with credentials.
**How to avoid:** During development, configure Vite's proxy in `vite.config.ts` (`server.proxy`). In production, configure `cors({ origin: [adminPanelUrl] })` on the backend's admin routes specifically.

---

## Code Examples

### Firebase Admin SDK Initialization (Backend)

```javascript
// src/config/firebase.js
// Source: firebase.google.com/docs/admin/setup [CITED]
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

module.exports = { getAuth, getStorage };
```

> Store `FIREBASE_SERVICE_ACCOUNT_JSON` as a JSON string in `.env`. Never commit the service account JSON file to git.

### Mongoose User Model (Backend)

```javascript
// src/models/User.js
// Source: mongoosejs.com/docs/guide.html [CITED]
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, trim: true },
  photoURL: { type: String },
  bio: { type: String, maxlength: 500 },
  homeCity: { type: String, trim: true },
  verificationStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },
  verificationDocumentUrl: { type: String },
  selfieUrl: { type: String },
  rejectionReason: { type: String },
  expoPushToken: { type: String },
  blockedUsers: [{ type: String }],  // array of firebaseUids
  hostsCount: { type: Number, default: 0 },   // stub for PROF-03; Phase 2 updates this
  tripsCount: { type: Number, default: 0 },   // stub for PROF-03
}, { timestamps: true });

module.exports = model('User', userSchema);
```

### Expo Image Picker for ID Upload (Mobile)

```typescript
// Source: docs.expo.dev/versions/latest/sdk/imagepicker/ [CITED]
import * as ImagePicker from 'expo-image-picker';

async function pickIdDocument(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
    // Do NOT set base64: true — it's slow for large images; send URI as multipart
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

async function uploadVerificationDocs(idUri: string, selfieUri: string, token: string) {
  const formData = new FormData();
  // Do NOT manually set Content-Type — let FormData set the boundary
  formData.append('idDocument', { uri: idUri, type: 'image/jpeg', name: 'id.jpg' } as any);
  formData.append('selfie', { uri: selfieUri, type: 'image/jpeg', name: 'selfie.jpg' } as any);

  const response = await fetch(`${API_BASE_URL}/api/users/verification-docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return response.json();
}
```

### Admin Login and Session Token (Backend)

```javascript
// src/routes/admin.js
// Source: D-04 decision — hardcoded credentials, JWT session [CITED from CONTEXT.md]
const jwt = require('jsonwebtoken');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.ADMIN_JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

function verifyAdminSession(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error();
    next();
  } catch {
    res.status(401).json({ error: 'Invalid admin session' });
  }
}
```

### Expo Push Token Registration (Mobile)

```typescript
// Source: docs.expo.dev/push-notifications/sending-notifications/ [CITED]
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

async function registerForPushNotifications(token: string): Promise<string | null> {
  // Android: requires EAS dev build — will return null in Expo Go
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('EAS projectId not configured — push token unavailable');
    return null;
  }

  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  // Store push token on backend
  await fetch(`${API_BASE_URL}/api/users/push-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expoPushToken: pushToken }),
  });

  return pushToken;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getAuth()` in React Native (browser persistence) | `initializeAuth` + `getReactNativePersistence(AsyncStorage)` | Firebase JS SDK v10.3.0+ | Without this, users are logged out on every app restart |
| `firebase` v9 JS SDK on Expo | `firebase@12+` (Expo SDK 57 requirement) | Expo SDK 57 | v9-v11 causes ES module resolution errors in Metro; v12+ is required |
| Push notifications in Expo Go (Android) | EAS dev build required | Expo SDK 53+ | Push notifications were silently broken in Expo Go Android starting SDK 53 |
| Expo push: direct HTTP POST to exp.host | `expo-server-sdk` npm package | Always recommended | SDK handles rate limiting (600/sec), retries, batching |
| `@react-navigation/stack` (JS-based) | `@react-navigation/native-stack` (native) | React Navigation v6+ | Native stack uses platform navigation — smoother animations, better performance |

**Deprecated/outdated:**
- `react-native-firebase` (`@react-native-firebase`): Do NOT use — requires bare workflow (eject) or Expo dev client with config plugin. Not compatible with Expo managed workflow without a dev build. Locked decision: Firebase JS SDK only.
- `expo-permissions` (deprecated): Removed in SDK 46. Use `expo-image-picker`'s own `requestMediaLibraryPermissionsAsync` and `requestCameraPermissionsAsync` directly.
- `firebase.auth()` namespaced API (v8 and below): Replaced by modular API (`import { getAuth } from 'firebase/auth'`). Do not use the namespaced API in any new code.

---

## Walking Skeleton Order

The planner MUST scaffold in this order to avoid dead ends. Each wave depends on the previous:

**Wave 0 — Project Wiring (no features, just infrastructure):**
1. `backend/src/config/db.js` — `mongoose.connect(process.env.MONGODB_URI)` called from server.js
2. `backend/src/config/firebase.js` — Firebase Admin SDK init (service account from env)
3. `backend/.env.example` — add `MONGODB_URI`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_STORAGE_BUCKET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`
4. `backend/src/models/User.js` — Mongoose User schema (full schema with verificationStatus, expoPushToken, etc.)
5. `backend/src/middleware/auth.js` — `verifyFirebaseToken` + `requireVerified`
6. `mobile/` — install all dependencies via `npx expo install`
7. `mobile/src/config/firebase.ts` — `initializeAuth` with `getReactNativePersistence`
8. `admin/` — `npm create vite@latest admin -- --template react-ts`

**Wave 1 — Auth and Document Upload (VERI-01, VERI-02):**
9. Backend: POST /api/auth/register (creates MongoDB user from Firebase uid)
10. Mobile: SignUp screen + SignIn screen → Firebase Auth
11. Backend: POST /api/users/verification-docs (multer + Firebase Storage)
12. Mobile: Document upload screen with expo-image-picker
13. Mobile: PendingVerificationScreen (full-screen gate, D-05/D-06)

**Wave 2 — Admin Panel and Approval Flow (VERI-03, VERI-04):**
14. Backend: POST /api/admin/login → session JWT
15. Backend: GET /api/admin/verification-queue + POST /api/admin/approve/:uid + POST /api/admin/reject/:uid
16. Admin panel: Login page + Queue page with VerificationCard + Approve/Reject UI
17. Backend: `setCustomUserClaims` + expo-server-sdk push notification on approve/reject
18. EAS Build setup (`eas.json`, `app.json` projectId) for dev build
19. Mobile: Notification tap → `getIdToken(true)` → navigation update (D-09)

**Wave 3 — Profile and Safety (PROF-01..04, VERI-06, VERI-07):**
20. Backend: PUT /api/users/profile + GET /api/users/:uid
21. Mobile: EditProfileScreen + ViewProfileScreen
22. Backend: POST /api/users/block/:uid + POST /api/users/report
23. Mobile: Block/Report UI

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v22.22.2 | — |
| npm | Package manager | ✓ | 10.9.7 | — |
| MongoDB | Backend data storage | ✗ (local) | — | Use MongoDB Atlas free tier; add MONGODB_URI to .env |
| Firebase project | Auth + Storage | ✗ | — | Must create Firebase project; no fallback — required |
| EAS Build | Push notifications on Android | ✗ | — | Expo Go works for UI development but NOT for push notification testing |
| `/admin` directory | Admin panel | ✗ | — | Must scaffold with `npm create vite@latest` |

**Missing dependencies with no fallback:**
- Firebase project (console.firebase.google.com) — must be created before any auth or storage code runs
- MongoDB Atlas (or local mongod) — backend cannot start without a MONGODB_URI

**Missing dependencies with fallback:**
- EAS Build — UI dev and backend can proceed without EAS; push notification tap flow (D-09) cannot be fully tested without it. Planner should include EAS setup as a required task in Wave 2 and flag it for the developer.

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth — email+password; tokens managed by Firebase |
| V3 Session Management | yes | Firebase Auth ID tokens (1hr expiry, auto-refresh); admin session: short-lived JWT (8h) |
| V4 Access Control | yes | `verifyFirebaseToken` middleware on all protected routes; `requireVerified` middleware gates verified-only endpoints; admin routes gated by `verifyAdminSession` |
| V5 Input Validation | yes | Validate file MIME type in multer (reject non-image); validate email format before Firebase user creation; validate `uid` params are non-empty strings |
| V6 Cryptography | yes | All Firebase tokens are RSA-signed JWTs verified by Admin SDK; bcryptjs is in the backend but NOT needed — Firebase owns password hashing |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged Firebase ID token | Spoofing | `admin.auth().verifyIdToken()` — cryptographic verification, not just decode |
| Direct-to-Storage document upload (bypassing backend validation) | Tampering | Route all uploads through backend; Firebase Storage rules deny direct client writes |
| Admin credential brute-force | Elevation | Rate-limit POST /api/admin/login (express-rate-limit or similar); short-lived session token |
| Oversized file upload DoS | Denial of Service | `multer limits: { fileSize: 5MB }` |
| Push token spoofing (sending fake approval) | Tampering | Push notification is informational only; actual verification state is read from Firebase Custom Claim (set by backend, not by client) |
| Unauthenticated access to document images in Storage | Information Disclosure | Firebase Storage Security Rules: deny all public reads; admin panel uses signed/download URLs from Admin SDK |
| CORS wildcard on backend | Elevation | Restrict `cors({ origin })` to mobile app origin and admin panel URL before production |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firebase project has not been created yet — developer must create it before any code runs | Environment Availability | If Firebase project already exists, skip creation step; verify FIREBASE_SERVICE_ACCOUNT_JSON is obtainable |
| A2 | MongoDB is not running locally — developer will use MongoDB Atlas free tier | Environment Availability | If local mongod is available, can use that instead; MONGODB_URI format differs slightly |
| A3 | `expo-server-sdk` npm package name is correct (not `expo-server-sdk-node`) | Standard Stack | If wrong, npm install fails; verify with `npm view expo-server-sdk version` → 6.1.0 ✓ |
| A4 | Firebase Storage bucket is included in the Firebase project (Storage product enabled) | Architecture | Firebase Storage must be enabled in the Firebase console; it's not enabled by default on all projects |
| A5 | EAS CLI (`eas-cli`) is not installed — developer must `npm install -g eas-cli` | Environment Availability | If EAS CLI is already installed, skip install step |
| A6 | Admin panel will be served on a different port during dev (Vite default: 5173) | Architecture Patterns | Backend CORS config must include `http://localhost:5173` during development |

---

## Open Questions (RESOLVED)

1. **Firebase project credentials availability**
   - What we know: Firebase project must exist for Auth + Storage to work
   - What's unclear: Developer may need to create it fresh or use an existing one; service account JSON download procedure varies
   - RESOLVED: Plan 01-01 reserves the env vars and includes a user_setup step — developer creates the Firebase project, enables Auth (email/password) and Storage, downloads the service account JSON, and adds it to `.env` before execution. Plans assume the project exists at execution time.

2. **EAS projectId for push notifications**
   - What we know: `getExpoPushTokenAsync` requires a valid EAS `projectId` in `app.json`
   - What's unclear: Has EAS been initialized for this project? `app.json` has no `extra.eas.projectId` yet
   - RESOLVED: Plan 01-06 includes the EAS init task (`eas init`) behind a `checkpoint:human-action`; `eas.json` and `app.json` are configured there. Push delivery testing is gated on the EAS dev build.

3. **Storage Security Rules setup**
   - What we know: Documents must not be publicly readable
   - What's unclear: Whether the Firebase console default rules are open or locked
   - RESOLVED: Plan 01-04 user_setup includes setting Storage rules to deny all client reads/writes (`allow read, write: if false;`) — admin reads go via Admin SDK which bypasses rules.

---

## Sources

### Primary (MEDIUM confidence — official docs fetched via WebFetch)
- [docs.expo.dev — expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) — push token, notification handler, EAS requirement
- [docs.expo.dev — expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) — launchImageLibraryAsync, permissions, ImagePickerResult
- [docs.expo.dev — Using Firebase](https://docs.expo.dev/guides/using-firebase/) — firebase@12 requirement, initializeApp
- [expo.fyi/firebase-js-auth-setup → github.com/expo/fyi](https://github.com/expo/fyi/blob/main/firebase-js-auth-setup.md) — initializeAuth + getReactNativePersistence pattern
- [reactnavigation.org — auth-flow](https://reactnavigation.org/docs/auth-flow) — conditional stack navigation pattern
- [firebase.google.com — custom claims](https://firebase.google.com/docs/auth/admin/custom-claims) — setCustomUserClaims, force refresh
- [firebase.google.com — admin storage](https://firebase.google.com/docs/storage/admin/start) — bucket().file().save(), getDownloadURL
- [expressjs.com — multer](https://expressjs.com/en/resources/middleware/multer.html) — memoryStorage, fields(), req.files
- [docs.expo.dev — push notifications sending](https://docs.expo.dev/push-notifications/sending-notifications/) — Expo Push API endpoint, expo-server-sdk
- [oneuptime.com — Firebase Express middleware](https://oneuptime.com/blog/post/2026-02-17-firebase-auth-token-verification-express-middleware-cloud-run/view) — verifyIdToken Express pattern

### Secondary (LOW confidence — web search, training knowledge)
- Zustand v5 TypeScript store pattern — [multiple community articles]
- React + Vite admin panel scaffolding — `npm create vite@latest -- --template react-ts`
- Multer v2 TypeScript types — `Express.Multer.File` interface

---

## Metadata

**Confidence breakdown:**
- Firebase Auth integration: MEDIUM — fetched from official Expo + Firebase docs
- React Navigation auth flow: MEDIUM — fetched from official React Navigation docs
- expo-notifications EAS requirement: MEDIUM — confirmed in official Expo docs
- Zustand store pattern: LOW — community articles, no official Context7 fetch
- Admin panel setup: LOW — standard Vite scaffolding, minimal risk
- Multer + Storage upload pattern: MEDIUM — confirmed from official Express + Firebase docs

**Research date:** 2026-07-05
**Valid until:** 2026-08-05 (stable tech stack; Expo SDK version bump could affect package versions)
