# Roadmap: WomenApp

v1.0 shipped (phases 1–3) — see .planning/milestones/v1.0/ROADMAP.md

## Milestone v1.1: Социальные функции и медиа

**Milestone Goal:** Turn WomenApp into a full social network for verified members: VK-style profiles, friends and followers, and media (photo/video/audio/files/music links) in posts and chats. The whole interface is available in RU/EN, and the housing map stops exposing exact listing locations.

## Overview

v1.1 starts with two small foundation phases. The first adds the RU/EN localization layer and installs every native module the milestone needs in one release-APK rebuild, so all new screens are written with `t()` from the start and no later phase needs another native build. The second fixes the live v1.0 privacy leak: listings are shown as an approximate area instead of an exact point. Next comes the user's top priority, the VK-style profile (cover, status, city, "More info" fields). It ships before the media foundation because it does not need wall media. The social graph follows: friends, followers, mutual friends and a central block/visibility policy. The media foundation then lands inside a real feature, rich media in community posts, which brings safe uploads, metadata stripping, a full-screen viewer and playback. The wall and reposts build on both the social graph and the media layer. The milestone ends with attachments in chats (the most sensitive real-time path) and a sweep that localizes every remaining v1.0 screen.

## Phases

**Phase Numbering:**

- Integer phases (4, 5, 6, ...): Planned milestone work (continues from v1.0, which ended at Phase 3)
- Decimal phases (4.1, 4.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 4: Localization Foundation** - RU/EN i18n layer (default RU, switcher, plurals, dates, server-side localized errors/notifications) and one native rebuild with every v1.1 module
- [ ] **Phase 5: Approximate Housing Area** - Listings shown as a stable ~500 m circle with a district name; exact point only for host and accepted guest; v1.0 listings migrated
- [ ] **Phase 6: VK-Style Profile** - Cover, avatar, status, city and optional "More info" fields with server-side per-field hiding
- [ ] **Phase 7: Friends & Followers** - Friend requests, following, mutual friends, friends skip message requests, rate limits, and blocking that separates members everywhere
- [ ] **Phase 8: Rich Media in Community** - Safe uploads (progress/cancel/retry, metadata stripping, validation), photos/video/audio/files and music link cards in posts, full-screen viewer and playback
- [ ] **Phase 9: Profile Wall & Reposts** - Wall of the owner's posts with Main/Posts/Photos tabs; reposting community posts to the wall
- [ ] **Phase 10: Chat Attachments & Full Localization** - Photos/videos in DMs and city chats, files in DMs, exactly-once delivery; every remaining screen localized RU/EN

## Phase Details

### Phase 4: Localization Foundation

**Goal**: Members use the app in Russian by default and can switch to English at any moment. Counts, dates and server messages read naturally in their language.
**Depends on**: Nothing in v1.1 (builds on shipped v1.0)
**Requirements**: I18N-02, I18N-03, I18N-04, I18N-05
**Success Criteria** (what must be TRUE):

  1. On a fresh install the interface opens in Russian (navigation tabs, profile and settings screens, auth and system messages)
  2. User can switch RU/EN in her profile. Translated screens change language immediately without restarting the app, and the choice is still in effect after the app is closed and reopened
  3. Counters use correct Russian plural forms ("1 подруга / 2 подруги / 5 подруг") and dates are formatted for the chosen language, including in the release APK on the test phone
  4. Server error messages (e.g. validation failures) and server-originated notifications arrive in the member's chosen language, and switching language changes them for subsequent messages
  5. A new release APK with all v1.1 native modules installs on the test phone, and every v1.0 flow (verification, listings, stay requests, chats, community, reviews) still works

**Plans**: TBD
**UI hint**: yes
**Notes**: Install all SDK-pinned native modules (expo-video, expo-audio, expo-document-picker, expo-image, expo-sharing, expo-localization, gesture-handler/reanimated/worklets at Expo 57 pins, react-native-zoom-toolkit) in ONE `npx expo install` batch, then ONE rebuild. Spike: Hermes `Intl.PluralRules`/`DateTimeFormat`/`RelativeTimeFormat` in the release APK (`intl-pluralrules` polyfill if needed). Keep the English `error` field next to a new stable `code` so installed v1.0 APKs keep working. Before switching display language, check that city chat rooms key on a canonical city id rather than a localized name. Full sweep of legacy v1.0 screens is deferred to Phase 10 (I18N-01). From this phase on, every new screen is written with `t()`.

### Phase 5: Approximate Housing Area

**Goal**: Members can judge where a listing is without anyone learning a host's exact location, unless that person is the host or the guest whose stay request was accepted.
**Depends on**: Phase 4 (district labels and new strings use the i18n layer). Otherwise independent of all social/media work
**Requirements**: AREA-01, AREA-02, AREA-03, AREA-04
**Success Criteria** (what must be TRUE):

  1. On the map and in listing details, a member sees a ~500 m circle instead of a pin. The circle is offset from the true point and stays in the same place across reloads, sessions and devices
  2. Listing cards and details show the listing's district name in the member's chosen language
  3. The host and a guest with an accepted stay request see the exact address and point. Every other member sees only the circle and district
  4. Raw API responses for listing search and details (as a non-accepted member) contain no exact coordinates and no distance values. Listings created in v1.0 appear as circles with district names after migration

**Plans**: TBD
**UI hint**: yes
**Notes**: Private `exactLocation` (`select: false`) plus public location with a stable HMAC offset/grid snap. Drop `$geoNear` distance output (trilateration). Use a server-only geocoding key for the reverse-geocoded `area.name.{ru,en}`. Decision locked: ~500 m circle + district. Research flag: geocoding label coverage in target countries.

### Phase 6: VK-Style Profile

**Goal**: Every member has a VK-style profile that shows who she is (cover, avatar, status, city and optional details) while private data stays private.
**Depends on**: Phase 4 (age/plurals/dates and all new strings use i18n)
**Requirements**: PROF-05, PROF-06, PROF-07
**Success Criteria** (what must be TRUE):

  1. Opening any member's profile shows a cover image, avatar, name, verification badge, status line and city. The owner can upload or change her cover and edit her status
  2. Owner can optionally fill or clear birth date, education, work, hobbies, hometown and "looking for" (friends, love, colleague, party, help, etc.) and see them saved
  3. Other verified members see filled fields under "More info" (empty fields are not shown). Birth date is never shown, only the computed age
  4. A field marked hidden in the data model is absent from the profile API response for other members (enforced server-side) but still visible to the owner
  5. The profile screen lays out correctly on the test phone with edge-to-edge Android (status bar, gesture and 3-button navigation)

**Plans**: TBD
**UI hint**: yes
**Notes**: Ships before the media foundation by design (user priority). The cover upload reuses the existing v1.0 image upload path. Phase 8's metadata-stripping backfill (MEDIA-02) explicitly covers avatars and covers uploaded before then; the planner may add a sharp re-encode to this path early. All profile reads go through one `profileService.buildPublicProfile` (birthDate private, `hiddenFields[]`, bounded text lengths). Reserve the profile payload slot for the viewer-relative `relation` that Phase 7 fills.

### Phase 7: Friends & Followers

**Goal**: Members can build a trusted circle (friend requests, following, mutual friends) without exposing their social graph to strangers. Blocking fully separates two members.
**Depends on**: Phase 6 (the relation button, counts and lists live on the new profile)
**Requirements**: SOC-01, SOC-02, SOC-03, SOC-04, SOC-05, SOC-06, SOC-07, SOC-08, PROF-10
**Success Criteria** (what must be TRUE):

  1. From another member's profile, a user can add her as a friend, follow her, or write to her. While a friend request is pending, the requester counts as a follower. The recipient sees incoming requests in a list with a badge and can accept or decline. The requester can cancel. A decline silently removes every connection (no residual follower, no notification to the requester)
  2. User can unfriend and unfollow, and counts update on both profiles
  3. Friend and follower counts are visible on every profile. The friends list opens only for the owner and her friends, the followers list only for the owner. Mutual-friend counts appear on profiles and on incoming requests
  4. Friends can start a direct chat and message each other without a message request. Non-friends still go through the v1.0 message-request flow
  5. After a block, any friendship/follow between the two is removed and they disappear for each other from the community feed, profiles, friends/follower lists, mutual counts and conversation lists. Sending friend requests too fast is stopped with a clear message

**Plans**: TBD
**UI hint**: yes
**Notes**: Decisions locked: decline severs fully; counts public, friends list owner+friends, followers owner-only; mutual friends and friends-skip-message-request in scope. Model: one Friendship doc per pair (unique `pairKey`) plus a directed Follow edge, with atomic single-doc transitions. Build a central `visibilityService` (block set in both directions) here. Phases 9 and 10 must consume it on wall, repost and chat-media surfaces (v1.0 `getFeed` currently has no block filter). Add `express-rate-limit`. Needs a short threat-model review (stalking vectors).

### Phase 8: Rich Media in Community

**Goal**: Members can share photos, videos, audio, files and music links in community posts and view or play them comfortably. Every file is made safe before anyone else sees it.
**Depends on**: Phase 4 (native module batch and i18n). Independent of Phases 5–7
**Requirements**: MEDIA-01, MEDIA-02, MEDIA-03, MEDIA-04, MEDIA-05, POST-01, POST-02
**Success Criteria** (what must be TRUE):

  1. User can attach multiple photos, a video, an audio file or a file to a community post. She sees upload progress, can cancel an upload and retry a failed one, and the post publishes with its attachments
  2. Spotify, YouTube and Yandex Music links in a post render as preview cards that open the service
  3. Tapping a photo or video opens a full-screen viewer with pinch-zoom, swipe between attachments, swipe down to close, and video controls. Video and audio play inline in the feed, starting one pauses any other, and playback resumes correctly after a long pause
  4. Downloaded copies of uploaded photos and videos carry no GPS/EXIF/location metadata. This includes photos uploaded earlier (v1.0 profile, listing and post photos, plus Phase 6 avatars and covers)
  5. An unsupported or dangerous file (e.g. a renamed executable, an over-size file, an over-length video) is rejected with a clear message in the member's language

**Plans**: TBD
**UI hint**: yes
**Notes**: Highest-risk phase. Media collection + embedded attachment descriptor with a one-time claim (prevents IDOR, tracks orphans). Use disk staging, not multer memoryStorage (shared process with Socket.io), per-kind caps and a concurrency limit. sharp re-encode, ffmpeg-static `-map_metadata -1` + faststart remux + poster frame, file-type magic-byte checks (ESM via dynamic import). Signed URLs at read time with time-bucketed expiry, single active-player store, `authFetch` 401 retry must rebuild multipart bodies, `storage.rules` currently `if true`. Link preview resolver: allowlist plus SSRF guard. Spikes: ffmpeg hosting model, emulator signed-URL/Range behavior, sharp HEIC, Yandex Music preview feasibility, zoom-toolkit on SDK 57, expo-video fullscreen under edge-to-edge. Extend report/admin moderation to media.

### Phase 9: Profile Wall & Reposts

**Goal**: Every profile becomes a living page with a wall of the owner's posts and photo/post tabs. Members can repost community posts to their wall without bypassing deletions or blocks.
**Depends on**: Phase 7 (visibility/block policy, relation), Phase 8 (attachments, viewer, playback)
**Requirements**: PROF-08, PROF-09, POST-03, POST-04
**Success Criteria** (what must be TRUE):

  1. A profile has "Main", "Posts" and "Photos" tabs. "Posts" shows the owner's wall posts (text, photos, video) newest first. "Photos" shows a grid of all wall photos that opens the full-screen viewer
  2. The owner can publish a post with text, photos or video to her wall, and it appears at the top of her "Posts" tab
  3. User can repost a community post to her wall with a comment. A repost of a repost shows and links to the original post and its author
  4. A repost whose original was deleted, or whose author the viewer has blocked (or who blocked the viewer), shows "Post unavailable". An author can disable reposts of her post, and the repost action then disappears for others
  5. Blocked members cannot see each other's walls or reposts

**Plans**: TBD
**UI hint**: yes
**Notes**: Unify Post with `scope: 'community' | 'wall'` plus `wallOwnerUid`, and backfill `scope` on v1.0 posts. `repostOf` is flattened to the root, with an `allowReposts` flag and a tombstone presenter. Reuse the Phase 7 `visibilityService`, and watch N+1 queries (query-count budget). Profile header + tabs + wall needs a single virtualized list (nested-list jank pitfall).

### Phase 10: Chat Attachments & Full Localization

**Goal**: Members can safely share photos, videos and files in conversations, and the entire app reads correctly in Russian and English.
**Depends on**: Phase 8 (media pipeline, viewer, playback), Phase 7 (friend vs message-request state gates attachments)
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, I18N-01
**Success Criteria** (what must be TRUE):

  1. User can send photos and videos in DMs and city chats and files in DMs. Recipients see them in the conversation and can open them in the full-screen viewer or open/share the file
  2. An attachment sent while the connection drops and reconnects arrives as exactly one message. Someone who is not a participant cannot open the attachment's link
  3. In a pending message request the attach option is unavailable, and the server rejects attachments sent there anyway
  4. The conversation list previews attachment messages in the member's language (e.g. "Фото" / "Photo")
  5. Every screen, including all v1.0 screens (auth, verification, listings, map, stay requests, chats, community, reviews, profile), shows no untranslated or hard-coded strings in either RU or EN

**Plans**: TBD
**UI hint**: yes
**Notes**: Upload over REST and send media ids over the socket (1 MB Socket.io buffer). A client idempotency key gives exactly-once delivery and keeps the store-first + optimistic dedupe flow. `Message.content` is currently required. Store `lastMessageKind` instead of a localized preview string. Resolve URLs for participants only. Files in city chats are deferred (CHAT-07, v2). The I18N-01 sweep covers all remaining legacy screens and confirms no hard-coded strings remain.

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6 → 7 → 8 → 9 → 10
(Phase 8 depends only on Phase 4 and could run in parallel with Phases 6–7 if desired.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Localization Foundation | 0/TBD | Not started | - |
| 5. Approximate Housing Area | 0/TBD | Not started | - |
| 6. VK-Style Profile | 0/TBD | Not started | - |
| 7. Friends & Followers | 0/TBD | Not started | - |
| 8. Rich Media in Community | 0/TBD | Not started | - |
| 9. Profile Wall & Reposts | 0/TBD | Not started | - |
| 10. Chat Attachments & Full Localization | 0/TBD | Not started | - |
