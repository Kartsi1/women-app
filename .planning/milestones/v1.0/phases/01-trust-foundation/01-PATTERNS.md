# Phase 1: Trust Foundation - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 27 new files (near-greenfield project)
**Analogs found:** 2 / 27 (only `backend/src/server.js` and `mobile/App.tsx` exist)

> **Context:** This is a near-greenfield monorepo. The only existing source files are `backend/src/server.js` (25-line Express + Socket.io skeleton) and `mobile/App.tsx` (10-line default Expo template). All patterns below are therefore sourced from: (a) those two files for structural conventions, and (b) RESEARCH.md code examples (sourced from official docs) where no codebase analog exists. The planner must use RESEARCH.md patterns directly for the majority of new files.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/src/config/db.js` | config | request-response | `backend/src/server.js` (env var + startup pattern) | partial |
| `backend/src/config/firebase.js` | config | request-response | `backend/src/server.js` (require + module.exports pattern) | partial |
| `backend/.env.example` | config | — | existing `backend/.env.example` (extend it) | exact |
| `backend/src/models/User.js` | model | CRUD | none | no analog |
| `backend/src/models/Report.js` | model | CRUD | none | no analog |
| `backend/src/middleware/auth.js` | middleware | request-response | `backend/src/server.js` (Express middleware pattern) | partial |
| `backend/src/routes/auth.js` | route | request-response | `backend/src/server.js` (Express route pattern) | partial |
| `backend/src/routes/users.js` | route | file-I/O + CRUD | `backend/src/server.js` (Express route pattern) | partial |
| `backend/src/routes/admin.js` | route | request-response | `backend/src/server.js` (Express route pattern) | partial |
| `backend/src/controllers/authController.js` | controller | request-response | none | no analog |
| `backend/src/controllers/userController.js` | controller | file-I/O + CRUD | none | no analog |
| `backend/src/controllers/adminController.js` | controller | request-response | none | no analog |
| `backend/src/services/storageService.js` | service | file-I/O | none | no analog |
| `backend/src/services/notificationService.js` | service | event-driven | none | no analog |
| `mobile/src/config/firebase.ts` | config | request-response | `mobile/App.tsx` (ES6 import, export default pattern) | partial |
| `mobile/src/store/authStore.ts` | store | event-driven | none | no analog |
| `mobile/src/store/profileStore.ts` | store | CRUD | none | no analog |
| `mobile/src/navigation/RootNavigator.tsx` | component | request-response | `mobile/App.tsx` (functional component, StyleSheet pattern) | partial |
| `mobile/src/navigation/AuthNavigator.tsx` | component | request-response | `mobile/App.tsx` | partial |
| `mobile/src/navigation/AppNavigator.tsx` | component | request-response | `mobile/App.tsx` | partial |
| `mobile/src/screens/Auth/SignUpScreen.tsx` | component | request-response | `mobile/App.tsx` | partial |
| `mobile/src/screens/Auth/SignInScreen.tsx` | component | request-response | `mobile/App.tsx` | partial |
| `mobile/src/screens/Auth/PendingVerificationScreen.tsx` | component | request-response | `mobile/App.tsx` | partial |
| `mobile/src/screens/Profile/ProfileScreen.tsx` | component | CRUD | `mobile/App.tsx` | partial |
| `mobile/src/screens/Profile/EditProfileScreen.tsx` | component | CRUD | `mobile/App.tsx` | partial |
| `mobile/src/screens/Profile/ViewProfileScreen.tsx` | component | CRUD | `mobile/App.tsx` | partial |
| `mobile/src/hooks/useFirebaseAuth.ts` | hook | event-driven | none | no analog |
| `mobile/src/services/api.ts` | service | request-response | none | no analog |
| `admin/` (entire Vite SPA) | — | request-response | none | no analog |

---

## Shared Patterns

### Backend: Module System
**Source:** `backend/src/server.js` lines 1–6
**Apply to:** All backend files (`config/`, `models/`, `middleware/`, `routes/`, `controllers/`, `services/`)

```javascript
require('dotenv').config();                    // only in entry/config files
const express = require('express');            // CommonJS require() — never import/export
const { createServer } = require('http');      // destructured require is fine
```

Rule: all backend files use CommonJS (`require` / `module.exports`). No ES modules in `/backend`.

### Backend: Route Registration
**Source:** `backend/src/server.js` lines 14–15
**Apply to:** `backend/src/routes/*.js`, `backend/src/server.js` (mount point)

```javascript
// server.js mount pattern — add before the health route:
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

// Inside a route file:
const router = require('express').Router();
router.get('/health', (req, res) => res.json({ status: 'ok' }));
module.exports = router;
```

### Backend: Error Response Shape
**Source:** RESEARCH.md Pattern 4 (auth middleware excerpt) — no codebase analog
**Apply to:** All controllers and middleware

```javascript
return res.status(401).json({ error: 'Missing or invalid authorization header' });
// Always: { error: '<message>' } for errors
// Always: { status: 'ok' } or { data: ... } for success
```

### Mobile: Component Structure
**Source:** `mobile/App.tsx` lines 1–20
**Apply to:** All `.tsx` screen and navigator files

```typescript
import { StyleSheet, View } from 'react-native';   // ES6 imports — never require()

export default function ComponentName() {           // named function, default export
  return (
    <View style={styles.container}>
      {/* content */}
    </View>
  );
}

const styles = StyleSheet.create({                  // always StyleSheet.create, never plain object
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
```

Rules: functional components only; hooks-ready; `StyleSheet.create()` always; ES6 imports; TypeScript strict.

### Mobile: Named Export for Non-Default Components
**Apply to:** navigators, hooks, stores (not screens — screens are default exports)

```typescript
export function RootNavigator() { ... }   // named export for navigators/hooks
export const useAuthStore = create<AuthState>()(...);  // named export for stores
```

### Mobile: 2-Space Indent + Semicolons
**Source:** Both `backend/src/server.js` and `mobile/App.tsx`
**Apply to:** All files in all three sub-projects

---

## Pattern Assignments

### `backend/src/config/db.js` (config, startup)

**Analog:** `backend/src/server.js` — env var consumption + startup side effect pattern

**Copy pattern** (adapt from server.js lines 1, 23–24):
```javascript
const mongoose = require('mongoose');

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
}

module.exports = connectDB;
```

Call from `server.js` before `httpServer.listen()`: `await connectDB();`

---

### `backend/src/config/firebase.js` (config, startup)

**Analog:** `backend/src/server.js` (require + destructure + module.exports)
**Pattern source:** RESEARCH.md "Firebase Admin SDK Initialization" code example

```javascript
// Exact pattern from RESEARCH.md Code Examples section:
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

Must be `require()`d before any route file that uses Firebase Auth or Storage.

---

### `backend/src/models/User.js` (model, CRUD)

**Analog:** None in codebase.
**Pattern source:** RESEARCH.md "Mongoose User Model" code example

```javascript
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
  blockedUsers: [{ type: String }],
  hostsCount: { type: Number, default: 0 },
  tripsCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model('User', userSchema);
```

---

### `backend/src/models/Report.js` (model, CRUD)

**Analog:** None. Copy structural pattern from User.js above.

```javascript
const { Schema, model } = require('mongoose');

const reportSchema = new Schema({
  reporterUid: { type: String, required: true },
  reportedUid: { type: String },           // null for content reports
  contentType: { type: String },           // 'listing' | 'message' | 'user'
  contentId: { type: String },
  reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
}, { timestamps: true });

module.exports = model('Report', reportSchema);
```

---

### `backend/src/middleware/auth.js` (middleware, request-response)

**Analog:** `backend/src/server.js` lines 11–12 show `app.use(middleware)` convention.
**Pattern source:** RESEARCH.md Pattern 4 (Express Auth Middleware)

```javascript
// Full pattern from RESEARCH.md Pattern 4:
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

---

### `backend/src/routes/auth.js` (route, request-response)

**Analog:** `backend/src/server.js` line 15 — `app.get('/health', (req, res) => res.json(...))` is the base route shape.
**Pattern source:** RESEARCH.md Architecture Patterns (Pattern 4 + admin login)

```javascript
const router = require('express').Router();
const { verifyFirebaseToken } = require('../middleware/auth');
const authController = require('../controllers/authController');

// POST /api/auth/register — creates MongoDB user from verified Firebase token
router.post('/register', verifyFirebaseToken, authController.register);

module.exports = router;
```

Thin route file — pass work to controller. No business logic in route files.

---

### `backend/src/routes/users.js` (route, file-I/O + CRUD)

**Analog:** `backend/src/server.js` line 15
**Pattern source:** RESEARCH.md Pattern 5 (Document Upload Endpoint)

```javascript
const router = require('express').Router();
const multer = require('multer');
const { verifyFirebaseToken, requireVerified } = require('../middleware/auth');
const userController = require('../controllers/userController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
]);

router.post('/verification-docs', verifyFirebaseToken, upload, userController.submitVerificationDocs);
router.put('/profile', verifyFirebaseToken, requireVerified, userController.updateProfile);
router.get('/:uid', verifyFirebaseToken, requireVerified, userController.getProfile);
router.post('/block/:uid', verifyFirebaseToken, requireVerified, userController.blockUser);
router.post('/report', verifyFirebaseToken, requireVerified, userController.reportUser);
router.post('/push-token', verifyFirebaseToken, userController.savePushToken);

module.exports = router;
```

---

### `backend/src/routes/admin.js` (route, request-response)

**Analog:** `backend/src/server.js` line 15
**Pattern source:** RESEARCH.md "Admin Login and Session Token" + Pattern 6 (Admin Approval)

```javascript
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const adminController = require('../controllers/adminController');

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

router.post('/login', adminController.login);
router.get('/verification-queue', verifyAdminSession, adminController.getQueue);
router.post('/approve/:uid', verifyAdminSession, adminController.approveUser);
router.post('/reject/:uid', verifyAdminSession, adminController.rejectUser);

module.exports = router;
```

---

### `backend/src/controllers/authController.js` (controller, request-response)

**Analog:** None. Use route handler shape from `server.js` line 15 + async try/catch.

```javascript
const User = require('../models/User');

async function register(req, res) {
  try {
    const { uid, email } = req.user;  // set by verifyFirebaseToken middleware
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = await User.create({ firebaseUid: uid, email });
    }
    res.status(201).json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register };
```

Pattern: async function, try/catch, `console.error` on server errors, `{ error: ... }` / `{ data: ... }` shape.

---

### `backend/src/controllers/userController.js` (controller, file-I/O + CRUD)

**Analog:** None. Combine controller pattern above + RESEARCH.md Pattern 5.

Core upload pattern from RESEARCH.md Pattern 5:
```javascript
const { getStorage } = require('firebase-admin/storage');
const User = require('../models/User');

async function submitVerificationDocs(req, res) {
  try {
    const { uid } = req.user;
    const idDocFile = req.files['idDocument']?.[0];
    const selfieFile = req.files['selfie']?.[0];
    if (!idDocFile || !selfieFile) {
      return res.status(400).json({ error: 'Both idDocument and selfie are required' });
    }
    const bucket = getStorage().bucket();
    await bucket.file(`verification/${uid}/id-document`).save(idDocFile.buffer, {
      metadata: { contentType: idDocFile.mimetype },
      resumable: false,   // MUST be false for small files — see RESEARCH.md pitfalls
    });
    await bucket.file(`verification/${uid}/selfie`).save(selfieFile.buffer, {
      metadata: { contentType: selfieFile.mimetype },
      resumable: false,
    });
    await User.findOneAndUpdate({ firebaseUid: uid }, { verificationStatus: 'pending' });
    res.json({ status: 'pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

### `backend/src/controllers/adminController.js` (controller, request-response)

**Analog:** None. Pattern source: RESEARCH.md Pattern 6 + "Admin Login" code example.

```javascript
const jwt = require('jsonwebtoken');
const { getAuth } = require('firebase-admin/auth');
const Expo = require('expo-server-sdk').default;
const User = require('../models/User');
const expo = new Expo();

async function login(req, res) {
  const { email, password } = req.body;
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.ADMIN_JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
}

async function approveUser(req, res) {
  try {
    const { uid } = req.params;
    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      { verificationStatus: 'approved' },
      { new: true }
    );
    await getAuth().setCustomUserClaims(uid, { isVerified: true });
    if (user.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
      await expo.sendPushNotificationsAsync([{
        to: user.expoPushToken,
        title: 'You\'re verified!',
        body: 'Your account has been approved. Tap to enter the app.',
        data: { type: 'verification_approved' },
      }]);
    }
    res.json({ status: 'approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// rejectUser: same shape; sets verificationStatus='rejected', rejectionReason (required),
// sends push notification with type:'verification_rejected', does NOT set custom claim.
```

---

### `backend/src/services/storageService.js` (service, file-I/O)

**Analog:** None. Extract repeated Firebase Storage logic from userController into a helper.

```javascript
const { getStorage } = require('firebase-admin/storage');

async function uploadVerificationDoc(uid, field, buffer, mimetype) {
  const bucket = getStorage().bucket();
  await bucket.file(`verification/${uid}/${field}`).save(buffer, {
    metadata: { contentType: mimetype },
    resumable: false,
  });
}

async function getSignedUrl(path) {
  const bucket = getStorage().bucket();
  const [url] = await bucket.file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes for admin panel
  });
  return url;
}

module.exports = { uploadVerificationDoc, getSignedUrl };
```

---

### `backend/src/services/notificationService.js` (service, event-driven)

**Analog:** None. Pattern source: RESEARCH.md Pattern 6 (expo-server-sdk usage).

```javascript
const Expo = require('expo-server-sdk').default;
const expo = new Expo();

async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !Expo.isExpoPushToken(expoPushToken)) return;
  await expo.sendPushNotificationsAsync([{ to: expoPushToken, title, body, data }]);
}

module.exports = { sendPushNotification };
```

---

### `mobile/src/config/firebase.ts` (config, startup)

**Analog:** `mobile/App.tsx` lines 1–2 (ES6 import pattern), but pattern comes from RESEARCH.md Pattern 1.

```typescript
// Pattern from RESEARCH.md Pattern 1:
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

// MUST use initializeAuth (not getAuth) — see RESEARCH.md Pitfall 4
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
```

---

### `mobile/src/store/authStore.ts` (store, event-driven)

**Analog:** None. Pattern source: RESEARCH.md Pattern 3 (Zustand Auth Store).

```typescript
// Full pattern from RESEARCH.md Pattern 3:
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

---

### `mobile/src/store/profileStore.ts` (store, CRUD)

**Analog:** None. Copy Zustand store structure from authStore.ts.

```typescript
import { create } from 'zustand';

interface Profile {
  displayName: string;
  photoURL: string | null;
  bio: string;
  homeCity: string;
  hostsCount: number;
  tripsCount: number;
}

interface ProfileState {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  clear: () => void;
}

export const useProfileStore = create<ProfileState>()((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  clear: () => set({ profile: null }),
}));
```

---

### `mobile/src/navigation/RootNavigator.tsx` (component, request-response)

**Analog:** `mobile/App.tsx` — functional component with default export.
**Pattern source:** RESEARCH.md Pattern 2 (Auth-Gated Navigation).

```typescript
// Pattern from RESEARCH.md Pattern 2:
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { PendingVerificationScreen } from '../screens/Auth/PendingVerificationScreen';

export function RootNavigator() {
  const { user, isVerified } = useAuthStore();

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : !isVerified ? (
        <PendingVerificationScreen />   // full-screen gate — D-05
      ) : (
        <AppNavigator />
      )}
    </NavigationContainer>
  );
}
```

Note: `RootNavigator` is a named export (not default). It is rendered from `App.tsx` which keeps the default export.

---

### `mobile/src/navigation/AuthNavigator.tsx` and `AppNavigator.tsx` (components, request-response)

**Analog:** `mobile/App.tsx` (component structure)
**Pattern source:** `@react-navigation/native-stack` (native stack, not JS stack)

```typescript
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SignUpScreen } from '../screens/Auth/SignUpScreen';
import { SignInScreen } from '../screens/Auth/SignInScreen';

const Stack = createNativeStackNavigator();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
    </Stack.Navigator>
  );
}
```

Use `createNativeStackNavigator` (not `createStackNavigator`) — see RESEARCH.md State of the Art table.

---

### `mobile/src/screens/Auth/SignUpScreen.tsx`, `SignInScreen.tsx`, `PendingVerificationScreen.tsx` (components, request-response)

**Analog:** `mobile/App.tsx` lines 1–20 — functional component + StyleSheet.create pattern.

```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function SignUpScreen() {
  return (
    <View style={styles.container}>
      {/* content */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
});
```

Screens use `export default`. Screen-specific state via `useState`. Auth calls via Firebase Auth SDK (`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`). After sign-up, call POST `/api/auth/register` with the Firebase ID token to mirror user to MongoDB.

---

### `mobile/src/hooks/useFirebaseAuth.ts` (hook, event-driven)

**Analog:** None.
**Pattern source:** RESEARCH.md Pattern 7 (Notification Tap → Token Refresh) + `onAuthStateChanged`.

```typescript
import { useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { auth } from '../config/firebase';
import { useAuthStore } from '../store/authStore';

export function useFirebaseAuth() {
  const { setUser, setVerified, clear } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tokenResult = await getIdTokenResult(user);
        setUser(user);
        setVerified(!!tokenResult.claims.isVerified);
      } else {
        clear();
      }
    });
    return unsubscribe;
  }, []);

  // D-09: notification tap forces token refresh
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'verification_approved' || data?.type === 'verification_rejected') {
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.getIdToken(true);
          // onAuthStateChanged will fire again and update the store
        }
      }
    });
    return () => subscription.remove();
  }, []);
}
```

Register this hook in `App.tsx`, not in a screen — it must run before navigation renders.

---

### `mobile/src/services/api.ts` (service, request-response)

**Analog:** None. Pattern source: RESEARCH.md "Expo Push Token Registration" + document upload code example.

```typescript
import { auth } from '../config/firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function registerUser() {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', headers });
  return res.json();
}

export async function uploadVerificationDocs(idUri: string, selfieUri: string) {
  const token = await auth.currentUser?.getIdToken();
  const formData = new FormData();
  // Do NOT set Content-Type manually — see RESEARCH.md Pitfall 5
  formData.append('idDocument', { uri: idUri, type: 'image/jpeg', name: 'id.jpg' } as any);
  formData.append('selfie', { uri: selfieUri, type: 'image/jpeg', name: 'selfie.jpg' } as any);
  const res = await fetch(`${API_BASE_URL}/api/users/verification-docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}
```

Plain `fetch` — no axios. See RESEARCH.md alternatives table.

---

### Admin Panel (`/admin/` — entire React + Vite SPA)

**Analog:** None — directory does not exist.
**Scaffold command:** `npm create vite@latest admin -- --template react-ts` from monorepo root.

**`admin/src/api/adminApi.ts`** (service, request-response):
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

let sessionToken: string | null = null;
export function setSessionToken(token: string) { sessionToken = token; }

async function authedFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json', ...options.headers },
  });
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json(); // { token }
}

export async function getVerificationQueue() {
  const res = await authedFetch('/api/admin/verification-queue');
  return res.json();
}

export async function approveUser(uid: string) {
  const res = await authedFetch(`/api/admin/approve/${uid}`, { method: 'POST' });
  return res.json();
}

export async function rejectUser(uid: string, reason: string) {
  const res = await authedFetch(`/api/admin/reject/${uid}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return res.json();
}
```

**`admin/vite.config.ts`** — add proxy to avoid CORS during dev (RESEARCH.md Pitfall 7):
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

**Admin page components (`Login.tsx`, `Queue.tsx`, `VerificationCard.tsx`):** Plain React functional components, no CSS framework. Inline styles or a minimal CSS file is fine — admin panel is internal tooling for 1-2 users.

---

## No Analog Found

All files below have no close match in the codebase. Planner should use the RESEARCH.md code examples directly.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/src/models/User.js` | model | CRUD | No Mongoose models exist yet |
| `backend/src/models/Report.js` | model | CRUD | No Mongoose models exist yet |
| `backend/src/controllers/*.js` | controller | various | No controllers exist yet |
| `backend/src/services/storageService.js` | service | file-I/O | No services exist yet |
| `backend/src/services/notificationService.js` | service | event-driven | No services exist yet; no push notification code exists |
| `mobile/src/store/authStore.ts` | store | event-driven | No Zustand stores exist yet |
| `mobile/src/hooks/useFirebaseAuth.ts` | hook | event-driven | No custom hooks exist yet |
| `mobile/src/services/api.ts` | service | request-response | No API client exists yet |
| `admin/` (entire SPA) | — | request-response | Directory does not exist; must scaffold with Vite |

---

## Metadata

**Analog search scope:** `/backend/src/`, `/mobile/` (root and `src/`)
**Files scanned:** 2 source files (`backend/src/server.js`, `mobile/App.tsx`)
**Why so few analogs:** Near-greenfield project — all feature directories are empty scaffolds.
**Pattern extraction date:** 2026-07-05
**Primary pattern source for new files:** RESEARCH.md code examples (sourced from official Firebase, Expo, and React Navigation documentation)
