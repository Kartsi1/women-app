---
phase: 02-housing-core
plan: "02"
subsystem: api, mobile
tags: [listings, geo-search, maps, address-hiding, react-native-maps, expo-location, zustand, safety]

requires:
  - phase: 02-housing-core
    plan: "01"
    provides: "Socket auth, tab shell (Housing/Messages/Profile), react-native-maps + expo-location installed, chatHandler.js"

provides:
  - "Listing Mongoose model with 2dsphere index on location (GeoJSON Point [lng,lat])"
  - "createListing API: stores exactAddress + neighbourhood centroid + photos via Firebase Storage"
  - "searchListings API: $geoNear aggregation with date overlap filter; explicit $project omits exactAddress (T-02-02-01)"
  - "getListingDetail API: addressRevealed=false, exactAddress=null in this slice; explicit projection (getProfile pattern)"
  - "All /api/listings routes behind verifyFirebaseToken + requireVerified (T-02-02-03)"
  - "listingStore.ts: Zustand store (listings[], selectedListing)"
  - "AvailabilityDatePicker: native datetimepicker, enforces to>=from"
  - "PhotoGridUploader: 3-col grid, expo-image-picker, add/remove, max 10"
  - "CreateListingScreen: tap-to-place map pin, coordinate flip [lng,lat] commented, citySlug from homeCity"
  - "MapDiscoveryScreen: expo-location permission, MapView with NeighbourhoodPin markers, coordinate flip, FilterSheet"
  - "ListingDetailScreen: photo carousel, SafetyChip (addressRevealed=false), isOwner-aware CTA"
  - "HousingStack navigator: MapDiscovery→CreateListing/ListingDetail; HousingStackParamList exported"
  - "SafetyChip: amber #fff3e0/#e65100, lock icon, accessibilityRole=text (LIST-03)"
  - "NeighbourhoodPin: purple circle, house icon, selected accent fill"
  - "FilterSheet: slide-up modal, local DateRange draft, Apply emits to MapDiscovery"
  - "ListingCard: 80x80 thumb, title/area/dates/Free-stay tag"

affects:
  - 02-03-stay-requests (Listing model + getListingDetail needed for REQT-01..04 address reveal)
  - 02-04-dm-messaging (citySlug on Listing used for Socket.io group chat room names)

tech-stack:
  added:
    - "@expo/vector-icons (installed — was missing, Rule 3 auto-fix)"
  patterns:
    - "exactAddress omitted from all API responses via explicit projection (never spread raw doc)"
    - "GeoJSON [lng,lat] stored; MapView Marker uses {latitude:coords[1], longitude:coords[0]} flip"
    - "createListing: photo upload after Listing.create() so _id is available for storage path"
    - "listingStore mirrors profileStore shape (listings[], selectedListing, setListings, setSelectedListing, clear)"
    - "FilterSheet manages local draft DateRange; emits final range via onApply callback"
    - "SearchListings $geoNear radiusM clamped 1..50000 (T-02-02-02 Tampering)"

key-files:
  created:
    - backend/src/models/Listing.js
    - backend/src/controllers/listingController.js
    - backend/src/routes/listings.js
    - mobile/src/types/listing.ts
    - mobile/src/store/listingStore.ts
    - mobile/src/components/Common/AvailabilityDatePicker.tsx
    - mobile/src/components/Common/PhotoGridUploader.tsx
    - mobile/src/components/Map/NeighbourhoodPin.tsx
    - mobile/src/components/Map/FilterSheet.tsx
    - mobile/src/components/Listings/ListingCard.tsx
    - mobile/src/components/Listings/SafetyChip.tsx
    - mobile/src/screens/Housing/CreateListingScreen.tsx
    - mobile/src/screens/Housing/MapDiscoveryScreen.tsx
    - mobile/src/screens/Housing/ListingDetailScreen.tsx
  modified:
    - backend/src/server.js (register /api/listings)
    - mobile/src/services/api.ts (searchListings, createListing, getListingDetail)
    - mobile/src/navigation/AppNavigator.tsx (HousingStack, HousingStackParamList)
    - mobile/package.json (added @expo/vector-icons)

key-decisions:
  - "addressRevealed=false hardcoded in getListingDetail for plan 02-02; StayRequest reveal wired in 02-03 (REQT-03)"
  - "exactAddress deliberately set to null in controller response — never exposed to non-accepted guests (T-02-02-01)"
  - "citySlug derived client-side from homeCity: toLowerCase().replace(/\s+/g, '-') — matches Socket.io room naming convention"
  - "NeighbourhoodPin rendered as Marker child (custom view) not as pinColor — allows selected state visual"
  - "FilterSheet manages its own local draft DateRange; parent gets final range only on Apply"
  - "@expo/vector-icons installed via npx expo install (Rule 3 — was missing, TypeScript blocked)"

metrics:
  duration: 10min
  completed: "2026-07-08"
  tasks: 3
  files: 17

status: complete
---

# Phase 02 Plan 02: Housing Discovery — Listings + Map Summary

**Listing model + geo-search API with address hiding (exactAddress never sent to client); mobile create/discovery/detail screens with MapView neighbourhood pins, date filter, photo upload, and SafetyChip. Implements LIST-01..05.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-08T12:20:46Z
- **Completed:** 2026-07-08T12:30:58Z
- **Tasks:** 3
- **Files created/modified:** 17

## Accomplishments

### Task 1: Backend — Listing model, geo-search API, address hiding, mobile types

- Created `backend/src/models/Listing.js`: GeoJSON Point with 2dsphere index on location (Pitfall 3 — declared in schema); exactAddress field (stored, never sent); citySlug index; availabilityDates array
- Created `backend/src/controllers/listingController.js`:
  - `createListing`: validates title/coords (T-02-02-02), uploads photos via storageService.uploadFile at `listings/{id}/photos/{i}`; exactAddress stored, never returned
  - `searchListings`: $geoNear aggregation with date overlap $elemMatch; radiusM clamped 1..50000 (T-02-02-02); explicit $project omits exactAddress (T-02-02-01)
  - `getListingDetail`: explicit data object construction (getProfile pattern — never spread raw doc); addressRevealed=false, exactAddress=null this slice; isOwner flag
- Created `backend/src/routes/listings.js`: multer 5MB/10-photo limit (T-02-02-04); /search BEFORE /:id (static-before-dynamic); all routes behind verifyFirebaseToken + requireVerified (T-02-02-03)
- Registered `/api/listings` in `backend/src/server.js`
- Created `mobile/src/types/listing.ts`: Listing, AvailabilityDate, SearchListingsParams, CreateListingPayload
- Extended `mobile/src/services/api.ts`: searchListings, createListing (FormData multipart, Authorization-only header per Pitfall 5), getListingDetail

### Task 2: Mobile — CreateListingScreen, Housing stack, listingStore

- Created `mobile/src/store/listingStore.ts`: Zustand store mirroring profileStore (listings[], selectedListing, setListings, setSelectedListing, clear)
- Created `AvailabilityDatePicker`: @react-native-community/datetimepicker wrapper; two tappable rows (check-in/check-out); enforces to>=from; iOS Done button; UI-SPEC tokens
- Created `PhotoGridUploader`: expo-image-picker, 3-col 100x100 grid, add/remove tiles, accessibilityLabel per tile, max 10 photos
- Created `CreateListingScreen`: tap-to-place MapView pin; coordinate flip comment ([lng,lat] for GeoJSON); citySlug from homeCity; exactAddress TextInput; CTA disabled until title+dates+location; "Publishing…" at opacity 0.6
- Updated `AppNavigator.tsx`: HousingStackNavigator (MapDiscovery → CreateListing/ListingDetail) replaces HousingPlaceholderScreen; HousingStackParamList + ListingDetail:{listingId} exported

### Task 3: MapDiscoveryScreen, FilterSheet, components, ListingDetailScreen

- Created `NeighbourhoodPin`: purple circle + house Ionicons; accent #6200ea fill when selected; accessibilityLabel "Listing in [area], [dates]"
- Created `SafetyChip`: amber pill #fff3e0/#e65100; lock icon; "Address hidden until accepted"; accessibilityRole="text" (LIST-03 / T-02-02-01)
- Created `ListingCard`: 80x80 photo thumb, title Heading, area label, date range Label, "Free stay" tag
- Created `FilterSheet`: RN Modal slide-up (#f5f5f5); local DateRange draft; AvailabilityDatePicker; Apply CTA emits final range
- Created `MapDiscoveryScreen`: expo-location permission + error copy on deny; MapView with NeighbourhoodPin markers; coordinate flip at usage site `latitude:coords[1], longitude:coords[0]` (Pitfall 2 commented); FilterSheet FAB; onRegionChangeComplete re-queries; empty state copy; selected-pin summary card; "List your space" FAB → CreateListing
- Created `ListingDetailScreen`: getListingDetail fetch; horizontal photo carousel (full-width 200dp); SafetyChip for guests (addressRevealed=false — always in this slice); "Request stay" placeholder (wired in 02-03); "Manage listing" for owners

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Backend + mobile types | `5c0b3b4` | Listing model, geo-search API, address hiding, mobile types |
| Task 2: Mobile create + store + nav | `e5b42a3` | CreateListingScreen, Housing stack, listingStore |
| Task 3: Map + detail + components | `f6d4117` | MapDiscoveryScreen, ListingDetailScreen, map/listing components |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @expo/vector-icons not installed**
- **Found during:** Task 2 (TypeScript check after creating PhotoGridUploader/NeighbourhoodPin using Ionicons)
- **Issue:** `Cannot find module '@expo/vector-icons'` — package not installed in mobile despite being bundled with Expo
- **Fix:** Ran `npx expo install @expo/vector-icons` from mobile/ — resolved to SDK 57 compatible version
- **Files modified:** mobile/package.json, mobile/package-lock.json
- **Committed in:** e5b42a3

**2. [Rule 1 - Bug] `StyleSheet.absoluteFillObject` not a valid property**
- **Found during:** Task 3 (TypeScript check of MapDiscoveryScreen)
- **Issue:** `Property 'absoluteFillObject' does not exist on type 'typeof StyleSheet'` — correct API is `StyleSheet.absoluteFill`
- **Fix:** Replaced with `StyleSheet.absoluteFill`
- **Files modified:** mobile/src/screens/Housing/MapDiscoveryScreen.tsx
- **Committed in:** f6d4117

None of the other deviation rules (4 — architectural) were triggered.

## Security Coverage (STRIDE Threat Register)

| Threat ID | Status | Evidence |
|-----------|--------|---------|
| T-02-02-01 (exactAddress leak) | Mitigated | `searchListings` explicit $project omits exactAddress; `getListingDetail` builds explicit data object with exactAddress=null, addressRevealed=false; grep confirmed 7 "deliberately omitted" / null occurrences |
| T-02-02-02 (geo query tampering) | Mitigated | lat validated [-90,90], lng [-180,180], radiusM clamped 1..50000 before $geoNear |
| T-02-02-03 (unverified access) | Mitigated | All /api/listings routes: verifyFirebaseToken + requireVerified middleware |
| T-02-02-04 (oversized uploads) | Mitigated | multer fileSize: 5MB, .array('photos', 10) cap |
| T-02-02-05 (coordinate triangulation) | Mitigated | location stores neighbourhood centroid tapped on map; exactAddress is a separate string; client never reverse-geocodes |

## Known Stubs

- `ListingDetailScreen` "Request stay" button: placeholder onPress (wired to stay request compose flow in plan 02-03)
- `ListingDetailScreen` "Manage listing" button: placeholder onPress (wired in plan 02-03)
- `getListingDetail` addressRevealed=false, exactAddress=null: intentional stub — reveal implemented in plan 02-03 when StayRequest model exists. Not a blocker for this plan's goal (listing discovery works; address hiding is correct for this slice)

## Threat Flags

No new security-relevant surface beyond the plan's threat model.

## Self-Check: PASSED

**Files verified on disk:**

- backend/src/models/Listing.js ✓
- backend/src/controllers/listingController.js ✓
- backend/src/routes/listings.js ✓
- mobile/src/types/listing.ts ✓
- mobile/src/store/listingStore.ts ✓
- mobile/src/components/Common/AvailabilityDatePicker.tsx ✓
- mobile/src/components/Common/PhotoGridUploader.tsx ✓
- mobile/src/components/Map/NeighbourhoodPin.tsx ✓
- mobile/src/components/Map/FilterSheet.tsx ✓
- mobile/src/components/Listings/ListingCard.tsx ✓
- mobile/src/components/Listings/SafetyChip.tsx ✓
- mobile/src/screens/Housing/CreateListingScreen.tsx ✓
- mobile/src/screens/Housing/MapDiscoveryScreen.tsx ✓
- mobile/src/screens/Housing/ListingDetailScreen.tsx ✓

**Commits verified in git history:**
- 5c0b3b4 ✓
- e5b42a3 ✓
- f6d4117 ✓

**TypeScript:** `cd mobile && npx tsc --noEmit` — exit 0 ✓
**Backend syntax:** `node --check` on all 4 files — OK ✓
**Security:** exactAddress grep confirms no leak in controller responses ✓

---
*Phase: 02-housing-core*
*Completed: 2026-07-08*
