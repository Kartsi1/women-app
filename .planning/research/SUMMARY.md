# Project Research Summary

**Project:** WomenApp — v1.1 "Социальные функции и медиа"
**Domain:** Women-only, document-verified social + housing platform (adding VK-style profiles, friends graph, rich media, RU/EN i18n, approximate listing areas)
**Researched:** 2026-10-13
**Confidence:** HIGH for stack and features; MEDIUM-HIGH for architecture; MEDIUM for pitfalls with specific spikes needed

## Executive Summary

WomenApp v1.1 extends the v1.0 app (Expo 57 / RN 0.86 New Arch, Express + Mongoose backend, women-only verified users) with social features (VK-style profiles, friends/followers, walls, reposts) and media-rich content (video, audio, files, music links) while enforcing the safety-first principle through EXIF stripping, location obfuscation, and graph-based access controls.

The recommended approach models this as three tracks: (1) infrastructure (i18n, media foundation), (2) social graph (friends/followers, visibility policy), (3) user-facing features (profile/wall, community media, reposts, chat attachments). The highest risks are memory-bounded uploads, EXIF/metadata leakage, exact-location exposure (already a v1.0 bug), and social-graph design enabling stalking.

## Key Findings

### Recommended Stack

- **expo-video** (~57.0.0) — replacement for expo-av; progressive MP4 via signed URLs.
- **expo-audio** (~57.0.0) — audio playback.
- **expo-document-picker** (~57.0.0) — generic files.
- **expo-image** (~57.0.0) — `cacheKey` keeps caching working with rotating signed URLs.
- **expo-sharing** (~57.0.1) — open/share files.
- **react-native-zoom-toolkit** (^5.1.1) — zoom/gallery viewer on SDK-pinned gesture-handler ~2.32.0, reanimated 4.5.0, worklets 0.10.0 (NOT npm latest). Register viewer as native-stack `transparentModal`.
- **i18next ^26.4.4 + react-i18next ^17.0.16 + expo-localization** — Russian plurals, typed keys, language persisted via zustand `persist` + AsyncStorage; `intl-pluralrules` polyfill.
- **sharp ^0.35.5** — re-encode images, strip EXIF GPS, display 2048px + thumb 400px.
- **ffmpeg-static ^5.3.0** via `execFile` — strip video metadata, faststart remux, poster frame. No full transcode in v1.1.
- **file-type ^22.1.1** — magic-byte sniffing (ESM-only → dynamic `import()`).
- **express-rate-limit** — missing in v1.0; needed for friend requests, uploads, link previews.
- Do NOT add: expo-av, expo-video-thumbnails (deprecated), react-native-awesome-gallery, react-native-image-viewing, fluent-ffmpeg, link-preview-js / open-graph-scraper / metascraper (SSRF).
- All SDK-pinned modules installed in ONE batch via `npx expo install` → single native rebuild.

### Expected Features

**Table stakes:**
- Profile (VK-style): cover, avatar, name, verified badge, status, home city, hometown, "More info" fields, per-field visibility model
- Wall: own posts reverse-chronological; Main/Posts/Photos tabs
- Friends & followers: request/accept/decline/cancel/unfriend; incoming-requests inbox; counts; relationship button
- Rich media in posts: photos, video, uploaded audio, music links (Spotify/YouTube oEmbed; Yandex Music fallback card), files; upload with progress/retry/cancel
- Reposts: reference-based; author can disable; delete/block/ban propagate; tombstone
- Full-screen viewer: pinch/zoom, swipe between items, swipe-down dismiss, video controls
- Chat attachments: photos, videos, files in DMs and city chats
- RU/EN: all UI strings, Russian plurals, device default, manual switcher, persisted; server error codes; push text in recipient locale
- Approximate housing area: public circle, exact only to accepted guest, stable offset, district label, v1.0 migration

**Differentiators:** mutual friends as trust signal; friends skip message-request step; no attachments in pending message requests (anti-cyberflashing).

**Defer:** per-field visibility settings UI; per-post audience; global people search; conversation media gallery; documents in city chats.

**Anti-features:** public friend/follower lists; "people you may know"; online/last-seen; server-side transcode; AI moderation.

### Architecture Approach

1. **Media collection + embedded attachment schema** — upload → complete (validate, process) → one-time claim → embed in Post/Message. Prevents IDOR, tracks orphans.
2. **Post unification with `scope: 'community' | 'wall'`** + `wallOwnerUid`; reposts via `repostOf` flattened to root; backfill `scope` on v1.0 posts.
3. **Friendship (one doc per pair, `pairKey`)** + directed **Follow** edge; atomic single-doc transitions; counts via indexed `countDocuments`; viewer-relative `relation` in profile payload; socket events to `user:<uid>`.
4. **User extension:** `coverPhoto`, `status`, `details` (age from private `birthDate`), `hiddenFields[]`, `locale`; enforced in one `profileService.buildPublicProfile`.
5. **Listing location split:** private `exactLocation` (select:false) + public `location` with stable HMAC offset / grid snap; drop `$geoNear` distance; Circle ≥ 500 m; reverse-geocoded `area.name.{ru,en}` with a server-only geocoding key.
6. **Central visibilityService** (block set both directions) applied to feed, wall, friends lists, reposts, chat history. v1.0 gap: `getFeed` has no block filter.
7. **Signed URLs at read time** only; thumbnails eager, video/audio/file lazy via `GET /api/media/:id/url` authorized through parent entity; longer (time-bucketed) expiry for streaming.
8. **i18n:** client i18next; server small `t(locale,key)` for push/socket text; stable error `code` next to English `error`; `lastMessageKind` instead of localized preview strings.

### Critical Pitfalls

1. **memoryStorage uploads OOM the process shared with Socket.io** → disk staging + stream to Storage, per-kind caps (video 100 MB / 90 s, audio & files 25 MB, image 10 MB), concurrency limit, raise Node `requestTimeout`.
2. **Unplayable video (HEVC/HDR/moov-at-end)** → ffprobe validate, remux faststart; Android picker has no compression control.
3. **EXIF/metadata leaks home location** → always re-encode images with sharp, ffmpeg `-map_metadata -1`, backfill v1.0 photos.
4. **Exact listing coordinates exposed in v1.0** → private exact point, public stable approximation, no distance, migration.
5. **Social graph enables stalking** → counts public, lists limited, pending gives no extra access, block = full severance, rate limits.
- Also: signed-URL expiry breaking paused video; player lifecycle leaks in FlatList (single active player store); block checks per endpoint; reposts bypassing blocks; `Message.content` required; Socket.io 1 MB buffer (upload via REST, send ids); authFetch 401 retry cannot replay consumed multipart bodies; `storage.rules` currently `if true`.

## Implications for Roadmap

Suggested order:
1. **Foundation & i18n infrastructure** — native module batch + one rebuild, i18n scaffold, error codes, server `t()`.
2. **Approximate listing area** (independent, fixes live v1.0 privacy defect).
3. **Relationships & visibility policy** (visibilityService, Friendship/Follow, rate limits).
4. **Media foundation** (highest risk: Media model, pipeline, sharp/ffmpeg/file-type, URL resolver, viewer, playback store, link previews).
5. **Profile v2 + wall.**
6. **Friends/followers UI** (inbox, buttons, lists, mutual friends).
7. **Community rich media + reposts.**
8. **Chat attachments.**
9. **i18n sweep of legacy screens** (can run alongside).

## Research Flags

- Media foundation: ffmpeg hosting model, emulator Range/signed-URL behavior, file-type ESM/CJS, sharp HEIC.
- Viewer: expo-video fullscreen under edge-to-edge, zoom-toolkit on SDK 57 (smoke test early), Yandex Music preview.
- i18n: Hermes `Intl.PluralRules` in release APK.
- Approximate area: privacy radius policy, geocoding coverage.

## Gaps to Address

1. In-app account deletion (Google Play requirement) — verify existence.
2. Backward compatibility with installed v1.0 APKs (`photoUrl` string, English `error`).
3. Admin moderation tooling for new media/report types.
4. Relative time formatting helper if Hermes lacks `Intl.RelativeTimeFormat`.

## Decision Conflicts

**OPEN: friend-request decline semantics** — FEATURES.md: decline severs entirely (no residual follower); ARCHITECTURE.md: follow edge remains (VK). Safety-first recommended; product decision required.

## Sources

See STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md for full source lists (Expo v57 docs, bundledNativeModules.json, live oEmbed checks, Airbnb location-privacy docs, Google Play UGC policy, codebase reads).
