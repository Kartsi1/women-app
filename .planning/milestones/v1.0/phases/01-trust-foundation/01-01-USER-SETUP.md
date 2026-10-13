# Plan 01-01 User Setup — Firebase + MongoDB

The backend cannot boot or verify tokens until these are configured.

## 1. Firebase

**Why:** Firebase Auth (email/password) + Firebase Storage back the entire trust layer; the Admin SDK needs a service account.

**Dashboard steps** (console.firebase.google.com):
1. Create a Firebase project
2. Build → Authentication → enable **Email/Password** provider
3. Build → Storage → enable Storage

**Environment variables** (add to `backend/.env`):

| Variable | Source |
|----------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Project Settings → Service accounts → Generate new private key; paste the whole JSON as a single-line string |
| `FIREBASE_STORAGE_BUCKET` | Storage → bucket name (e.g. `<project-id>.appspot.com`) |

## 2. MongoDB

**Why:** Backend cannot start without a Mongo connection; the `users` collection mirrors Firebase identities.

| Variable | Source |
|----------|--------|
| `MONGODB_URI` | MongoDB Atlas → Cluster → Connect → Drivers (free tier), or a local `mongod` URI |

## Verification

```bash
cd backend
npm run dev
# expect: MongoDB connected + "Server running on port 3000" with no Firebase init error
```
