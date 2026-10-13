---
status: partial
phase: 01-trust-foundation
source: [01-VERIFICATION.md]
started: 2026-07-05T19:10:00Z
updated: 2026-07-06T00:00:00Z
---

## Current Test

[testing paused — 11 items outstanding; test 1 passed]

## Tests

### 1. Sign-up → pending gate → no escape route
expected: Sign Up in app → MongoDB user document created (`verificationStatus: 'none'`) → full-screen pending gate, no way to navigate past it (VERI-01, VERI-05)
result: pass

### 2. Session persists across app restart
expected: Kill and reopen app → still signed in, still on pending screen (AsyncStorage persistence)
result: [pending]

### 3. Document upload reaches private Firebase Storage
expected: Pick ID photo + selfie → Submit → files land under `verification/<uid>/` in Firebase Storage → MongoDB `verificationStatus` becomes `'pending'` (VERI-02)
result: [pending]

### 4. Resubmit replaces previous documents (D-06)
expected: While pending, tap Resubmit → upload new photos → previous docs replaced, status stays `'pending'`
result: [pending]

### 5. Admin queue renders signed document URLs
expected: Login to admin SPA (hardcoded credentials) → pending queue lists user with visible doc/selfie images via 15-min signed URLs (VERI-03)
result: [pending]

### 6. Approve sets Firebase custom claim (D-08)
expected: Admin Approve → `isVerified: true` custom claim on Firebase user → MongoDB `verificationStatus: 'approved'`
result: [pending]

### 7. Reject requires reason and persists it (D-07)
expected: Reject button disabled until reason typed → reason stored in MongoDB → user's pending screen shows rejection box with reason
result: [pending]

### 8. Approval push unlocks app (VERI-04, D-09)
expected: EAS dev build on physical Android device → admin approves → push delivered → tap → token force-refresh → navigation switches from pending gate to main app
result: [pending]

### 9. Rejection push surfaces reason + Resubmit
expected: Admin rejects → push delivered → pending screen shows reason and Resubmit button
result: [pending]

### 10. Profile edit + public profile with badge (PROF-01..04)
expected: Verified user edits display name/bio/city/photo → persists; viewing another verified user shows public profile with verification badge and stat counters (stubbed 0)
result: [pending]

### 11. Block prevents profile viewing (VERI-06)
expected: User A blocks User B → B gets 403 when opening A's profile
result: [pending]

### 12. Report persists with reason (VERI-07)
expected: Report user with reason → `reports` collection document created (`status: 'open'`, reporterUid from token)
result: [pending]

## Summary

total: 12
passed: 1
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps
