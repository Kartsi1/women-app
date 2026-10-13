# Pitfalls Research

**Domain:** Adding VK-style profiles/wall, friends+followers, rich media (video/audio/files/music links), reposts, full-screen viewer, RU/EN i18n and approximate listing area to an EXISTING women-only, safety-first social/housing app (Expo 57 / RN 0.86 New Arch, Android-first; Express + Mongoose + Socket.io; Firebase Auth/Storage via Admin SDK with signed URLs; uploads through backend multer memoryStorage)
**Milestone:** v1.1 (subsequent milestone; v1.0 code is in production-like use over LAN)
**Researched:** 2026-10-13
**Confidence:** MEDIUM-HIGH. Codebase facts were verified by reading the repo (HIGH). Expo v57 API facts were checked against docs.expo.dev/versions/v57.0.0 (HIGH for the points cited). Android codec behaviour, Hermes Intl, ClamAV/ffmpeg/sharp guidance, and graph-abuse patterns come from established practice plus web search (MEDIUM). Items marked VERIFY need a spike or a check against v57 docs before the owning phase plans its work (per CLAUDE.md: do not rely on training data for Expo v57 APIs).

---

## Facts verified in THIS codebase that shape the pitfalls

These are not hypothetical. They are things the v1.1 work will collide with:

| Finding | Where | Consequence for v1.1 |
|---------|-------|----------------------|
| Every upload route uses `multer.memoryStorage()` with a 5 MB cap; `uploadFile()` calls `bucket.file().save(buffer)` | `backend/src/routes/{posts,listings,users}.js`, `services/storageService.js` | Raising the cap to video sizes multiplies RAM per concurrent request. REST and Socket.io share ONE Node process, so an upload spike takes chat down too. |
| MIME check is `req.file.mimetype.startsWith('image/')` (client-declared) | `userController.js:56`, posts route | Trivially spoofed. No magic-byte check, no EXIF strip, no re-encode. Existing photos (profiles, posts, listings) are stored raw, GPS EXIF included. |
| Listing `location` is written straight from client-supplied `coordinates`; comment calls it a "neighbourhood centroid" but the server never computes or snaps it | `listingController.js:106-109` | "Approximate area" is currently an honour system. If the mobile app sends the exact pin (very likely), every v1.0 listing already stores and serves its exact coordinates. `$geoNear` also exposes a `distance` field. |
| Feed query does NOT filter blocked users in either direction; block is only enforced in `getProfile` (`blockedUsers.includes(requester)`) | `postController.getFeed`, `userController.js:180` | Reposts, wall, friends lists and chats will each re-open the block hole unless a central visibility policy is introduced first. |
| `getFeed` selects `likedBy` (full array of UIDs) and ships it to the client; signed URLs for avatars/photos are generated in serial loops per request | `postController.js:84-110` | Unbounded array growth, UID leakage, and a per-item cost that grows with media attachments and reposts. |
| `createPost` creates the Post doc FIRST, then uploads the photo, then saves the path | `postController.js:31-41` | A failed or slow video upload leaves a media-less post (or a 500 with an orphan doc). Does not scale to multi-attachment, multi-minute uploads. |
| `Message.content` is `required: true, maxlength: 2000`; chat payloads travel over Socket.io; Socket.io default `maxHttpBufferSize` is 1 MB | `models/Message.js`, `chatHandler.js` | Attachment-only messages fail validation; binary over the socket silently disconnects the client. |
| `notificationService.sendPushNotification(token, title, body)` takes pre-built strings from callers; `'Member'` fallback is hardcoded in `getFeed`; error bodies are English literals (`{error: 'text is required'}`) | `services/notificationService.js`, controllers | Server-originated text is a second i18n surface that client-side i18n will not touch. |
| Emulator host `127.0.0.1:9199`; `usesCleartextTraffic: true` in `app.json`/`app.config.js` | `config/firebase.js`, `mobile/app.json:37`, `app.config.js:82` | Every NEW URL producer (video, audio, thumbnail, file, cover) must go through the same host rewrite. Dev emulator does not enforce signed-URL expiry, so expiry bugs will hide until production. |
| No rate limiting anywhere; `CORS *` | `server.js`, CLAUDE.md | Friend-request spam, upload spam, and link-preview fetches have zero backpressure today. |
| `Post` has index `{authorUid:1}` and `{createdAt:-1,_id:-1}` but no `{authorUid, createdAt, _id}` compound | `models/Post.js` | A wall (posts by one author, cursor-paginated) will scan/sort in memory. |

---

## Critical Pitfalls

### Pitfall 1: Big-media uploads through multer memoryStorage take the whole backend (chat included) down

**What goes wrong:**
Someone raises `fileSize` from 5 MB to 50-100 MB so videos work. Each in-flight upload holds the full file in a Node Buffer, then `bucket.file().save(buffer)` may hold a second copy while writing. Five users uploading 50 MB videos at once is 250-500 MB of off-heap Buffer memory (Node's `--max-old-space-size` does NOT protect against this; the container/host memory limit does). The process is OOM-killed, and because Express and Socket.io are the same process, every connected chat drops. Slow mobile links make uploads last minutes, so concurrency is far higher than request-rate math suggests. Multi-attachment posts (e.g. 10 photos) multiply it again.

**Why it happens:**
The v1.0 pattern (memoryStorage + 5 MB) is correct for photos and was copy-pasted into every route. "Just raise the limit" is the one-line change that appears to work on a developer machine with one upload at a time.

**How to avoid:**
- Per-kind limits, enforced in multer `limits` AND re-checked: photo 10 MB (after client resize), audio 20 MB, document 20 MB, video 50 MB / 60 s (decide numbers in the media phase; keep them as one shared constants file used by backend and mobile).
- Do NOT use memoryStorage for audio/video/files. Choose one of:
  1. (Recommended for this stack) multer `diskStorage` to an OS temp dir, then `fs.createReadStream(tmp).pipe(bucket.file(path).createWriteStream({resumable:false, contentType}))`, then `unlink` in a `finally`. Keeps auth on the backend, works unchanged against the Firebase Storage emulator, bounded RAM.
  2. Direct-to-Storage uploads using a server-issued V4 signed `write` URL (client PUTs bytes straight to Storage; backend only validates and records). Best at scale, but needs a "finalize" step that re-reads the object to validate type/size, and emulator signed-URL write behaviour must be VERIFIED before committing.
- Global upload concurrency semaphore (e.g. `p-limit(3)`) around processing, plus per-user in-flight cap (1-2 uploads).
- Keep CPU-heavy work (ffmpeg, sharp on big images) OUT of the request path and out of the chat process: run as a child process / small worker with `nice` and a timeout, or at minimum bounded by the semaphore.
- Client side: send multipart from a file URI (RN's FormData streams from disk natively). Never `FileSystem.readAsStringAsync(..., base64)` a video: that OOMs the JS/Hermes heap on mid-range Android.
- Reject on the client first using `asset.fileSize` and `asset.duration` from expo-image-picker (verified: `videoQuality` and `videoExportPreset` are iOS-only, so on Android the picker gives you the ORIGINAL file with no compression and `videoMaxDuration` documents "recording", so do not assume it limits library picks).
- Media-first workflow (see Pitfall 3): upload creates a `Media` record, then the post/message references media IDs. No more "create post, then upload".

**Warning signs:**
- Backend RSS spikes during upload tests; `Error: socket hang up`/ECONNRESET on large files; chat disconnect storms coinciding with uploads; process restarts in hosting logs; multer `LIMIT_FILE_SIZE` appearing only after the whole body was buffered.

**Phase to address:**
Media foundation phase (before any feature that attaches media). Gate: a load test with 5 parallel 50 MB uploads while two socket clients chat; chat must not stall and RSS must stay flat.

---

### Pitfall 2: Android video that "uploads fine" but will not play (codec/container/moov/HDR)

**What goes wrong:**
Users upload what the phone recorded: HEVC (H.265), 10-bit/HDR10, 4K60, `.mov` from iPhone friends later, or MP4 with the `moov` atom at the END of the file. Results: black frame with audio, infinite spinner, "decoder init failed", playback that cannot start until the whole file downloads (no streaming), or works on the uploader's phone but not on a recipient's older/MediaTek device (reports exist of HEVC hardware decode rendering black on specific MediaTek chipsets after Android 15). ExoPlayer can also claim "HEVC supported" when only Main (not Main10) is. Android's own picker will not transcode for you.

**Why it happens:**
Developer tests with one modern phone and the Storage emulator. The picker returns the original bytes on Android, so nothing normalises video. Playability is a property of the (device decoder x codec profile x container layout) tuple, not of the file extension.

**How to avoid:**
- Define ONE delivery format: MP4, H.264 (High/Main profile, 8-bit), AAC audio, max 720p, ~2-3 Mbps, `-movflags +faststart`, max 60 s.
- Server-side pipeline using ffprobe + ffmpeg (static binary via `ffmpeg-static`/`ffprobe-static`, or system package; confirm the host allows it): ffprobe to validate real container/codec/duration/dimensions, then transcode to the delivery format whenever codec != h264 OR pix_fmt != yuv420p OR bitrate/resolution above caps; otherwise a cheap `-c copy -movflags +faststart` remux. Always `-map_metadata -1` (see Pitfall 7).
- Media lifecycle status: `uploading -> processing -> ready | failed`. The client renders a "processing" placeholder and the post is visible to others only when `ready` (or shows the placeholder with the poster). Never hand out a playable URL for an unprocessed original.
- Optional client-side pre-compression (custom native module, e.g. `react-native-compressor`) is feasible because the project already uses `expo-dev-client`/prebuild (managed workflow is retained via CNG), but it is an optimisation: the server pipeline is the source of truth. VERIFY compatibility with RN 0.86 New Arch before adopting.
- Extract and store `width`, `height`, `duration`, `posterPath` at processing time.
- Handle `player.status === 'error'` in the player component with a friendly fallback ("Cannot play this video", with Download) rather than an endless spinner.
- Test matrix: at least 3 physical Android devices (one low-end/MediaTek, one Samsung, one Pixel) plus a deliberately uploaded HEVC/HDR/`moov`-at-end sample.

**Warning signs:**
- "Works on my phone, not on hers" reports; video start latency equals download time; files whose ffprobe `codec_name` is `hevc`; `moov` offset near EOF; huge bitrates from 4K sources.

**Phase to address:**
Media foundation phase (pipeline) and Community media phase (player UX/error states).

---

### Pitfall 3: Orphaned, unauthorised or hijackable media (Media model skipped; IDOR on attachments)

**What goes wrong:**
Attachments are stored as bare path strings inside `Post.photoUrl`, `Message.content`, etc. Consequences: (a) orphan files after failed posts, deleted posts, edited posts; (b) a client can submit ANY storage path or media ID in `attachments[]` when creating a post or message, and the server happily signs a URL for someone else's private media (a DM attachment, a verification document path `verification/<uid>/id-document`, someone's listing photo) = IDOR and, worst case, an ID-document leak; (c) no place to record status (processing/scan), dimensions, duration, or who may see it.

**Why it happens:**
v1.0 stored a single `photoUrl` path per post which was fine for one image. Extending the same pattern to N heterogeneous attachments feels incremental.

**How to avoid:**
- Introduce a `Media` collection: `{ownerUid, kind: image|video|audio|file, storagePath, thumbPath, posterPath, mime (server-detected), size, width, height, duration, originalName (display only), status, scan, scope: {type:'post'|'message'|'profile'|'listing', refId}, createdAt}`.
- Upload endpoints return `mediaId` only. Post/message create accepts `mediaIds` and verifies `media.ownerUid === req.user.uid && media.status==='ready' && media.scope unset` before attaching. Never accept paths from clients.
- Storage path namespace is server-generated and unguessable (`media/<uid>/<mediaId>/<kind>`); never derived from user-provided filenames.
- Orphan GC job: Media not attached within 24 h is deleted from Storage and Mongo.
- Legacy: keep `Post.photoUrl` readable (map to a synthetic image attachment in the serializer) so v1.0 posts and old APKs on testers' phones keep working; backfill later.
- Storage Security Rules must remain "deny all client reads/writes" for these prefixes (everything goes through Admin SDK), same as `verification/`.

**Warning signs:**
- Endpoints that take `path`/`url`/`storagePath` in the body; storage bucket size growing faster than post count; a test where user B attaches user A's `mediaId` succeeds.

**Phase to address:**
Media foundation phase. Add an explicit authorisation test ("cannot attach media you do not own").

---

### Pitfall 4: Signed-URL expiry breaks video/audio/viewer; cached feeds serve dead URLs; URLs churn image caches

**What goes wrong:**
`getSignedUrl()` hard-codes 15 minutes. That is already a known pain point for images in cached screens. Video/audio makes it worse: (1) ExoPlayer uses HTTP Range requests; if playback is paused and resumed after expiry, or a long track is seeked, the next range request returns 403 mid-playback; (2) a feed screen cached in Zustand (`feedStore`) is opened 20 minutes later and every thumbnail/poster/avatar is a 403; (3) the full-screen viewer is opened from a stale list item; (4) a URL that changes on every fetch (new expiry timestamp in the query string) defeats `expo-image`/ExoPlayer disk caches, so every refresh re-downloads media; (5) in the Firebase emulator, signature expiry is not enforced, so none of this shows up in development.

**Why it happens:**
Signed URLs are treated as if they were stable media URLs. Dev emulator hides the failure.

**How to avoid:**
- Longer, time-bucketed expiry for media: sign with `expires` rounded up to the next N-hour boundary (e.g. 6 h) so the same media yields the same URL string for everyone within the bucket (cache-friendly), and always has at least N/2 remaining. V4 signed URLs allow up to 7 days; choose the shortest that fits the UX. DM/attachment media may use shorter buckets. Document the tradeoff: a leaked URL is usable until expiry, acceptable inside a verified women-only app for feed media, less so for private DMs.
- Return `{url, expiresAt}` (or a per-response `mediaExpiresAt`) and have ONE client `<SignedImage>`/`useMediaUrl(mediaId)` abstraction that: knows when a URL is stale, calls `POST /api/media/resolve {ids:[...]}` (batched, ownership/visibility checked) to refresh, and falls back via `onError`. The photo `key`-on-URI `onError` fix from the last quick task shows the pattern is already needed.
- Player: on `error`/status change with an HTTP 403, refresh the URL, `replaceAsync({uri})` and restore `currentTime`. Viewer always re-resolves on open rather than trusting list data.
- Stable cache keys for images: `expo-image` `cacheKey={mediaId}` so a changing query string does not bust the cache. For `expo-video` consider `useCaching: true` (verified in v57 docs) but note it is keyed by URL, which is why the time-bucketed stable URL matters.
- Alternative if buckets are not enough: an authenticated streaming endpoint `GET /api/media/:id/stream` that checks the Firebase token + visibility and 302-redirects to a fresh short-lived signed URL (or proxies Range requests). expo-video and expo-audio both accept `headers` on the source (verified), so the app can attach the bearer token. Cost: backend bandwidth if proxying; prefer redirect.
- In dev, set the signed-URL lifetime to ~60 s via an env flag so expiry paths are exercised locally.
- Centralise ALL URL production in one `mediaUrlService.resolve(media, viewer)` that also performs the emulator host rewrite (`127.0.0.1:9199` -> configured LAN host). Controllers must never call `getSignedUrl()` directly again (lint rule/grep test).

**Warning signs:**
- Broken images/videos after the app is backgrounded 15+ minutes; videos that play to the end only if never paused; image flicker/re-download on pull-to-refresh; any `getSignedUrl(` call outside `mediaUrlService`.

**Phase to address:**
Media foundation phase (resolver + client abstraction); verified again in Community media and Chat media phases.

---

### Pitfall 5: expo-video / expo-audio players in lists: decoder exhaustion, audio overlap, players alive under screens

**What goes wrong:**
A `useVideoPlayer` + `VideoView` per post in a FlatList. Android devices have a small number of hardware video decoders; mounting many players simultaneously gives `MediaCodec` init failures, black views, frame drops and rising memory until the OS kills the app. FlatList recycling/windowing mounts and unmounts rows unpredictably, so players are created/destroyed during scroll (jank) or kept alive off-screen (leak/audio bleed). Two videos or a video and a music track play at once. Navigation (native-stack from react-native-screens) keeps the previous screen MOUNTED under a pushed screen, so the feed video keeps playing under the full-screen viewer or chat. Audio continues after the user leaves the screen or backgrounds the app. Verified in v57 docs: on Android, mounting multiple `VideoView`s with the SAME player instance does not work (so "share one player between feed row and fullscreen viewer" fails); hooks auto-release on unmount but `createVideoPlayer()`/`createAudioPlayer()` require manual `release()`; Android background audio stops after ~3 min without lock-screen controls.

**Why it happens:**
The component-per-item mental model works for images. Video/audio players are heavyweight native resources with global limits.

**How to avoid:**
- Rows render a POSTER (`expo-image`) + play affordance only. A player is created only for the ONE active item (tap to play; optionally autoplay-on-visible for muted short clips later).
- A single global `useMediaPlaybackStore` (Zustand, fits the existing store pattern) holds `{activeId, kind}`. Starting anything pauses/releases the previous. Enforces "only one media plays at a time" across feed, wall, chat and viewer.
- Pause/stop on: screen blur (`useIsFocused`/`useFocusEffect`), `AppState` != active, list item leaving `viewabilityConfig` threshold, viewer opening (feed player yields to the viewer).
- Viewer creates its own player (do not move a player instance between VideoViews on Android); pass `currentTime` for a seamless hand-off.
- Audio posts and chat audio: one shared audio player; show progress UI in rows from the store, not from a player per row. Set `setAudioModeAsync` deliberately (`interruptionMode`, `shouldPlayInBackground:false` for MVP). Decide explicitly whether background audio is a feature; if yes, lock-screen controls are mandatory.
- FlatList tuning: `removeClippedSubviews`, small `windowSize`, stable `keyExtractor`, fixed `aspectRatio` from stored width/height so layout does not jump (needs Pitfall 6 metadata).
- Never use `expo-av` (deprecated/removed in current SDKs; VERIFY absence in v57). Use expo-video and expo-audio only.
- Memory test: scroll a 100-item mixed feed with 30 videos on a low-RAM Android; watch `adb shell dumpsys meminfo` for growth; run with the media pipeline's 720p files, not originals.

**Warning signs:**
- Logcat `MediaCodec`/`OMX` allocation errors; two audio sources audible; sound continuing after navigating away; native memory climbing on scroll; viewer opens and feed video keeps playing underneath.

**Phase to address:**
Community media phase (playback manager + poster-first rows), re-used by Chat media and Full-screen viewer work. Make the playback store part of the first plan, not a retrofit.

---

### Pitfall 6: No thumbnails/dimensions: janky lists, giant downloads, blank tiles

**What goes wrong:**
The feed downloads the full original photo (up to 5-10 MB) for a 400 px card; videos show a grey box until play; list items have unknown height so FlatList jumps when media loads; wall photo grid decodes full-size bitmaps (Android bitmap memory pressure, OOM on low-end devices); the video poster is generated client-side after the fact (expo-video offers `generateThumbnailsAsync` but that needs a loaded source and costs per row).

**Why it happens:**
Thumbnails are viewed as polish. In v1.0 there was 1 photo per post; v1.1 has grids, covers, video and chat media.

**How to avoid:**
- Generate at upload/process time on the server: for images `sharp(buf).rotate().resize({width:1280, withoutEnlargement:true}).jpeg({quality:80})` for the display variant and a ~320 px thumb; for video a poster frame at ~1 s via ffmpeg (`-ss 1 -frames:v 1`). Store `thumbPath`/`posterPath`, `width`, `height`, `duration`, `blurhash`/dominant colour optional.
- API contract: every media item returns `{id, kind, url, thumbUrl, width, height, duration?}`. Client sets `aspectRatio` before the image loads.
- Use `expo-image` with `cachePolicy`, `recyclingKey`, and `cacheKey=mediaId`.
- Wall grid uses `thumbUrl`; only the viewer loads the large variant.
- Do not store originals unless you have a reason; keep only the processed derivative (also solves EXIF, Pitfall 7).
- HEIC/HEIF: sharp's prebuilt libvips generally lacks the HEIC (HEVC) decoder; either convert on the client (`expo-image-manipulator` to JPEG) or reject with a clear message. VERIFY with a real Samsung/Pixel HEIC sample.

**Warning signs:**
- Feed scroll jump when images load; Network panel showing multi-MB responses for avatars/cards; `Bitmap` OOM crashes on grids.

**Phase to address:**
Media foundation (server derivatives and API contract), Profile/wall phase (grid), Community media phase.

---

### Pitfall 7: Metadata leaks in uploaded media (EXIF GPS, video location atoms, document author fields, filenames)

**What goes wrong:**
In a women's safety app, a photo of "my cozy room" or a post from home carries GPS coordinates to a fraction of a metre in EXIF, serving as a stalker's address lookup. Same for MP4/MOV (`©xyz`, `com.apple.quicktime.location.ISO6709`), audio ID3 tags (artist/owner/comment, embedded cover art), PDF/DOCX metadata (author = real name, company). Filenames like `Anna_Ivanova_passport_scan.pdf` leak identity. Note: expo-image-picker's `exif` option only RETURNS EXIF; it does not strip it (verified in docs), and on iOS camera captures omit GPS but library picks may not. The current server stores raw bytes, so EXISTING v1.0 photos (profiles, posts, listing photos) already contain whatever the phone wrote, and listing photos are shown to ALL members.

**Why it happens:**
EXIF is invisible. Developers assume the picker or Firebase Storage strips it; neither does.

**How to avoid:**
- Images: ALWAYS re-encode on the server through sharp (`rotate()` to bake in orientation, then output with default settings, which drops EXIF/ICC/XMP unless `withMetadata()` is called). Never store the raw upload. This is the same step as thumbnailing (Pitfall 6).
- Video: transcode or remux with `-map_metadata -1 -map_chapters -1` and drop data streams (`-dn`). Verify with `ffprobe -show_format -show_streams` that no location tags remain.
- Audio: re-mux with `-map_metadata -1`, optionally drop attached-pic cover streams (`-vn`) or keep a sanitised cover.
- Documents: you cannot reliably scrub arbitrary PDFs/Office files. Either restrict to a small allowlist and show the user a warning ("files may contain personal metadata"), or do not allow documents in public surfaces (city chats / wall) at all.
- Never trust or display the client filename. Store `originalName` sanitised (strip path separators, control chars, cap length) for display only; the storage object name is server-generated.
- Backfill: one-off migration that re-processes existing `posts/`, `profiles/`, `listings/` images through the same sanitiser (verification docs are private and can stay).
- Test: upload a JPEG with GPS (exiftool-crafted) and assert the stored object has none.

**Warning signs:**
- `exiftool` on a downloaded signed URL returns GPS; stored objects byte-identical to uploaded ones; listing photos matched to map positions by a curious user.

**Phase to address:**
Media foundation phase (sanitising pipeline) plus a backfill task in the approximate-area phase (since both are about location leaks).

---

### Pitfall 8: "Approximate area" implemented in the UI only; exact coordinates still stored/served; trilateration via `$geoNear`

**What goes wrong:**
The v1.1 feature adds a circle/district on the map. If only the rendering changes, the API still returns exact `location.coordinates` (today the client's value is stored verbatim, so a pin dropped on the house is "the centroid"). Even if you later add noise: (a) random noise generated per request averages out after a few calls; (b) `$geoNear` returns `distance` and accepts `near` + `maxDistance`, so an attacker queries from three known points and solves the true location; (c) search by radius around a chosen point lets a user binary-search the boundary; (d) text fields (title, description, house rules) and listing photos reveal the street, building number, or recognisable view; (e) the reverse-geocoded "district" can be so small (one building block in sparse areas) that it is as good as an address; (f) existing listings are not migrated; (g) mobile caches (listingStore) still hold old coordinates.

**Why it happens:**
It is requested as a map-UI change. The existing schema comment ("centroid, safe to send") created a false sense that the server already does this.

**How to avoid:**
- Server computes the public location, never the client. Store BOTH: `exactLocation` (private, `select:false`, never serialised, used only for the post-acceptance reveal and host-side editing) and `location` (public, approximate, 2dsphere-indexed).
- Derive public location deterministically per listing, not per request: snap to a grid (e.g. ~500 m cells) and/or apply a stable pseudo-random offset from `HMAC(secret, listingId)` within a fixed max radius, so repeated queries yield identical output and averaging reveals nothing. Display as a circle (react-native-maps `Circle`) whose centre is the OFFSET point and radius >= max offset, so the true point is inside but not at the centre.
- Choose a minimum privacy radius (e.g. >= 500 m urban, larger in sparse areas); do not use a pure reverse-geocode "district" polygon centroid as a substitute without a minimum size.
- Remove `distance` from `$geoNear` output (or round to >= 1 km buckets); keep `maxDistance` searches, but search the public approximate field only; add a minimum radius floor on the query.
- Run all geo queries against `location` (public). The post-acceptance reveal path reads `exactLocation`/`exactAddress` only after the accepted-StayRequest check that already exists.
- Migrate existing listings: copy current `location` into `exactLocation`, compute public `location`, reindex. Invalidate/clear mobile caches (bump persisted store version).
- Geocoding for the district label: Google Geocoding `sublocality`/`neighborhood` is missing in many countries (including parts of Russia); fall back to `locality`; request the label per UI language or store `place_id` and resolve names lazily. Keep the Maps key server-side.
- Add a hint on the create-listing form: do not put street/house number in title/description; consider a regex warning for digit-heavy address patterns.
- Test: create two listings at known coordinates; call search from 3 points; assert recovered position error >= privacy radius and `distance` absent.

**Warning signs:**
- API JSON containing coordinates with >3 decimal places; `distance` in search responses; two identical searches returning different coordinates (per-request noise); a listing whose pin sits on a building.

**Phase to address:**
Approximate-area phase. Recommend scheduling it EARLY (it fixes an existing live privacy leak, is independent of the social graph work, and its migration touches v1.0 data).

---

### Pitfall 9: Social graph that enables stalking (public friend/follower lists, "pending = follower", mutual-friend leakage)

**What goes wrong:**
VK semantics copied literally. (1) "A pending request makes her my follower": the requester immediately gains follower-level access to the target's content and possibly notifications, before any consent; an abuser (or a user the target declined or blocked) becomes a follower by spamming a request. (2) Public friends/followers lists let an ex or stalker map the target's social circle, find her through friends, see new followers, and infer where she is (travel companions, hosts). (3) Counts and "mutual friends" reveal graph structure even when lists are hidden. (4) "People you may know" suggestions expose who knows whom. (5) Optional profile fields (age, hometown, workplace, education, "what she is looking for") are individually harmless but combine into a de-anonymising fingerprint; with the current decision "visible to all verified members by default", a bad actor with a verified account sees all of it. (6) Showing last-seen/online status or auto-notifying "X viewed your profile" would create tracking.

**Why it happens:**
VK/Instagram conventions assume openness; this product's founding principle is safety. The per-field hide flag exists in the data model but "no settings UI yet", so nothing enforces it.

**How to avoid:**
- Define explicit visibility tiers in one policy module: `self`, `friend`, `follower(accepted)`, `verifiedMember`, `blocked`. A PENDING follower is NOT a tier; she has exactly `verifiedMember` access plus the ability to see that her request is pending. She gets no extra content, no push on the target's activity.
- Friends list: visible to the owner and (optionally) friends only; default for everyone else is COUNT ONLY. Followers list: owner only. Never expose "mutual friends" list to non-friends; counts only to friends. No suggestion/recommendation features in v1.1. No last-seen/online/"viewed you" in v1.1.
- Enforce the per-field hide flag in the SERIALIZER from day one, even without a settings UI (default sensitive fields to hidden: exact age, work, education, hometown; "what she is looking for" is a high-risk field because it invites approach). Decision for roadmap: reconsider the `.planning/PROJECT.md` default of "visible to all verified members" for sensitive fields or ship the minimal settings toggle in the same phase.
- Let a user remove a follower (soft block) and cancel pending requests, without notifying the other side.
- Blocking is a graph operation: block deletes the friendship/follow/pending edge in BOTH directions, prevents new requests either way, and the blocked user's content disappears for the blocker AND the blocker's content disappears for the blocked (Pitfall 11).
- Store `birthYear` (or birthDate privately) and derive age; show age only if the field is public. Avoid storing a stale "age" number. Consider whether minors can be present (verification process owner decision).
- Wall visibility default: verified members can read the wall; wall posting by non-friends OFF (writing on someone else's wall is a harassment vector; the milestone says wall with photos/video/text, so scope it as own posts only for v1.1).
- Moderation: reports must be possible on profile fields, cover/avatar and wall posts.

**Warning signs:**
- `GET /users/:uid/friends` returns names to arbitrary callers; profile JSON includes fields marked hidden; counts available for blocked users; a declined requester can still see "follower" state; notification fires on a pending request to a user who blocked her.

**Phase to address:**
Relationships & visibility phase (BEFORE profile/wall and reposts), with a threat-model review. Design the policy module first; later phases consume it.

---

### Pitfall 10: Friend/follow/message-request spam and race conditions

**What goes wrong:**
No rate limits anywhere, so one account can send hundreds of friend requests, re-send after every decline, and trigger a push + socket event each time (harassment channel and a notification flood). Concurrent A->B and B->A requests create two inconsistent edges; double-tapping "Accept" double-increments `friendsCount`; unfriend then re-request loops; declined requests either notify the requester (confrontation) or are invisible (resubmission loop). The profile "request to chat" button re-uses the existing MessageRequest flow, which has the same abuse surface.

**Why it happens:**
Edge collections modelled as two directed docs (`Friendship{a,b}` and `Friendship{b,a}`) plus `$inc` counters outside transactions.

**How to avoid:**
- Single relationship doc per unordered pair: `Relationship {pairKey: sorted(uidA,uidB).join(':'), requesterUid, addresseeUid, status: pending|accepted, updatedAt}` with a UNIQUE index on `pairKey`. Cross-request (B requests A while A's request to B is pending) auto-accepts via `findOneAndUpdate` with a guard on `status:'pending'` so double accepts are no-ops.
- Counters (`friendsCount`, `followersCount`) updated only on actual status transitions detected from the `findOneAndUpdate` result (returns the doc only when it matched), or simply compute `countDocuments` with an index (acceptable at this scale; denormalise later).
- Limits (enforced server-side, keyed by `uid` NOT IP since LAN/NAT): e.g. 20 new outgoing requests/day, 100 outstanding pending, 30-day cooldown after a decline (silent: the requester sees "Requested" indefinitely; no decline notification). Same limiter for message requests. Add `express-rate-limit` keyed on `req.user.uid` for write endpoints (also listed as an open critical issue in CLAUDE.md).
- Push throttling/collapsing: "3 new friend requests" instead of one push each; no push for requests from accounts the target has previously declined.
- Block/ban interplay: banned (`isBanned`) users cannot send; blocked pairs cannot create edges.
- Reportable: report action on a request/profile directly from the request inbox.

**Warning signs:**
- Duplicate `Relationship` docs for the same pair; negative or inflated counters; one uid with hundreds of pending outgoing; push logs showing many notifications to one recipient from one sender.

**Phase to address:**
Relationships & visibility phase.

---

### Pitfall 11: Reposts bypass blocks, deletions, bans and visibility; media access is signed on the wrong subject

**What goes wrong:**
A repost shows the ORIGINAL author's content on the REPOSTER's wall/feed. Bypasses: (1) Author A blocked user C; C's friend B reposts A's photo; C now sees A's photo via B's repost: block bypass of exactly the type the product exists to prevent. (2) A deletes the original; reposts that copied text/media still show it (right to be forgotten broken) or crash on a dangling reference. (3) A is banned by admin; her content lives on through reposts. (4) Reposting a repost builds chains; counts and "who reposted" leak. (5) Notification "B reposted your post" delivered to A even though A blocked B. (6) The signed URL for reposted media is generated without checking the VIEWER's relationship to the ORIGINAL author. (7) Reporting a repost removes only the repost; the source remains.

**Why it happens:**
Reposts are implemented as a copy (fast) or as a populated reference with the feed filter checking only `repost.authorUid`.

**How to avoid:**
- Model as a reference: `Post.repostOf: ObjectId` (always flattened to the ROOT; reposting a repost points to the root), optional own `text`. Never copy media or text.
- Read path resolves originals in ONE batched query per page (`Post.find({_id: {$in: rootIds}})`) and applies the SAME visibility policy to (viewer, original author) as to (viewer, repost author): block either direction, ban, deleted -> render a tombstone card ("Original post is unavailable"), not omission and not the content.
- Media for the embedded original is signed through the same `mediaUrlService.resolve(media, viewer)` which re-checks policy; viewer must be allowed to see the original author.
- Soft-delete on posts (`deletedAt`, content cleared on purge) so references degrade to tombstones; admin removal/ban triggers the same.
- Block action also: remove reposts of the blocker's posts from the blocked user's surfaces and vice versa (handled automatically if the filter is applied at read time).
- Suppress notifications to an author from users she blocked (and from users blocked by her).
- Policy: you cannot repost content from an author who has blocked you or whom you blocked (the API returns the same 404 as for a missing post, so block state is not revealed).
- Reports on a repost offer "report original" and route admin action to the root post.
- Repost counts: derive from `countDocuments({repostOf})` or `$inc` on the root with idempotent unique `{authorUid, repostOf}` index (one repost per user per post).

**Warning signs:**
- A blocked user's account sees any content from the blocker in any list; feed JSON including an `original` object when `original.authorUid` is in either block set; 500s after deleting a post that was reposted.

**Phase to address:**
Reposts phase, but only after the central visibility policy (Pitfall 9/12) exists. Do not start reposts without it.

---

### Pitfall 12: Block enforcement is per-endpoint, so every new surface (wall, friends, repost, chat media, search) leaks

**What goes wrong:**
Today block is checked in one place (`getProfile`) and one direction. Every v1.1 feature adds a new query: wall, friends list, followers, reposts, attachments, city chat history, profile search. Each developer must remember `blockedUsers`. The `blockedUsers` field lives on the BLOCKER; finding "who blocked me" means an unindexed array scan across all Users per request. City group chats place blocked pairs in the same room (the blocked user can still see and hear the blocker's messages and media).

**How to avoid:**
- Build `visibilityService` first: `getBlockSet(viewerUid)` returns the union of `viewer.blockedUsers` and `{u : u.blockedUsers contains viewer}` (add a multikey index on `blockedUsers`, or maintain a mirrored `blockedBy` array on write so the lookup is O(1) on the viewer's own doc). Cache per request (`req.blockSet`), optionally 30-60 s in memory.
- Expose reusable query helpers: `excludeBlocked(filter, blockSet, field)`; serializers call `canView(viewer, ownerUid, fieldPolicy)`.
- Apply in: feed, wall, comments, likes, repost resolution, friends/followers lists, profile search, message request creation, DM `join:dm`/`message:dm`, city chat history and live emits (filter per recipient socket, or hide at render time on client using the block set sent at login).
- Add an integration test matrix: for every list endpoint, user C (blocked by A) gets zero A-authored items; and A gets zero C-authored.

**Warning signs:**
- A new list endpoint that does not import `visibilityService`; a grep for `find(` in controllers without block handling.

**Phase to address:**
Relationships & visibility phase (foundation); every later phase's acceptance criteria must include the block matrix.

---

### Pitfall 13: Trusting client MIME/extension; dangerous file types; malware; unsafe link previews (SSRF)

**What goes wrong:**
(1) `mimetype` is whatever the client wrote; a `.apk`, `.html`, `.svg`, `.exe` or polyglot is accepted as "image" or "document". On Android, an APK posted in a chat is a stalkerware/malware delivery vector with social-engineering cover ("install this app for the meetup"). (2) SVG/HTML served from a storage URL can run script in a WebView/browser; wrong `Content-Type`/missing `nosniff` lets browsers sniff. (3) Zip bombs, decompression bombs (huge pixel dimensions: a 30000x30000 PNG kills sharp/libvips memory), pathological videos stalling ffmpeg. (4) Malware scanning is skipped and files are auto-opened. (5) Music links: `url.includes('spotify.com')` is spoofed by `spotify.com.evil.net/...`; server-side preview fetch of a user-supplied URL is SSRF (can hit `169.254.169.254`, internal Mongo/Firebase emulator ports, redirects into private ranges); previews hot-link third-party images (tracking, expiry); Yandex Music has no public oEmbed, so a preview may be unobtainable and a scraper brittle or captcha-blocked; in-app WebView embeds of YouTube/Spotify add attack surface.

**How to avoid:**
- Detect type from magic bytes server-side (`file-type`: v17+ is ESM-only and this backend is CommonJS, so use `await import('file-type')` or pin v16; VERIFY), cross-check against an ALLOWLIST per surface; the stored `contentType` is the server-detected value, never the client's.
  - Images: jpeg, png, webp (re-encoded anyway). Reject svg, gif only if you decide to support animation.
  - Video: mp4/mov/m4v verified through ffprobe.
  - Audio: mp3, m4a/aac, ogg/opus, wav (ffprobe-verified).
  - Files: small allowlist (pdf, txt, docx/xlsx optionally); explicitly deny apk, xapk, exe, bat, sh, js, html/htm, svg, jar, dex, lnk, scr, zip/rar/7z (or scan archives).
- Set `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` as Storage object metadata for file kinds; never render user files in a WebView; open via download + system share/intent (VERIFY expo-sharing/IntentLauncher flow on Android 13/14, `content://` URIs and FileProvider).
- Limit decoded image pixels (`sharp(buf, {limitInputPixels: 50e6})`) and wrap ffmpeg/ffprobe in a timeout and resource limits; cap archive support entirely.
- Malware: if files are permitted, run ClamAV (clamd INSTREAM over a socket) asynchronously; `scan: pending|clean|infected`; items are invisible to others until `clean`. If you decide not to run a scanner in v1.1, do NOT ship generic file attachments in public surfaces (city chats, wall); allow only DM files with a visible "from a stranger, open carefully" warning. Opinionated recommendation: v1.1 ships images, video, audio in posts and chats; documents ONLY in DMs between accepted conversation partners, behind the scan if available.
- Music links: parse with `new URL()`, require https, exact-match or `endsWith('.'+host)` against an allowlist (`open.spotify.com`, `music.yandex.ru`, `music.yandex.com`, `music.youtube.com`, `youtube.com`, `youtu.be`), strip tracking params, store canonical URL.
- Preview: NEVER fetch the user-supplied URL directly. For Spotify and YouTube call their official oEmbed endpoints with the URL as a parameter (fixed hosts, 3 s timeout, 64 KB cap, no redirects, response schema-validated). For Yandex Music fall back to a text-only card (service icon + hostname + path-derived title) unless a spike proves a safe metadata source. Persist the preview snapshot (title, thumbnail re-hosted through the media pipeline or omitted) at post time rather than live-fetching per view. If a generic OG fetcher is ever added: DNS-resolve and block private/link-local/loopback ranges after every redirect, cap size/time, run isolated.
- Open links with `expo-web-browser`/`Linking.openURL`; for `canOpenURL` checks on Android 11+ declare `<queries>` entries (config plugin).

**Warning signs:**
- Storage objects with `contentType` that differ from what ffprobe/file-type reports; files whose names end in `.apk`; backend outbound requests to arbitrary hosts in logs; link cards for look-alike domains.

**Phase to address:**
Media foundation (detection/allowlist/limits); Community media phase (music links and previews); Chat media phase (which surfaces may carry files).

---

### Pitfall 14: Chat attachments break the optimistic/dedupe flow, Socket.io limits, and authorisation

**What goes wrong:**
The team has already fought duplicated optimistic messages. Attachments add a long upload phase between "user taps send" and server ack, so: the optimistic bubble must show progress/failed/retry; if the socket reconnects mid-upload the retry creates a second message; the echoed server message cannot be matched to the temp one (matching by `content` fails for attachment-only messages). Trying to send bytes over Socket.io hits `maxHttpBufferSize` (default 1 MB) and silently disconnects the sender. `Message.content` is `required`, so attachment-only messages 500. Conversation list "last message" preview shows blank. Push body for an attachment is empty or English. DM attachments are resolved to signed URLs without checking that the requester is a conversation participant; city-chat media is visible to the entire city room (potentially hundreds), amplifying any abusive upload, and the blocked-user problem returns (Pitfall 12).

**How to avoid:**
- Two-step send: REST upload returns `mediaId` -> socket `message:dm`/`message:city` carries `{clientMsgId, text?, mediaIds[]}`. Never bytes over the socket.
- Client generates `clientMsgId` (UUID) at tap time; server stores and echoes it (`Message.clientMsgId`, unique per sender) and is idempotent on it (retries return the same message). Client dedupes strictly by `clientMsgId`, and replaces the optimistic row in place (state: `uploading -> sending -> sent | failed`).
- Schema: `content` optional; require `content || attachments.length`; `attachments: [{mediaId}]` resolved at read time.
- Authorisation on read: attachment URLs for DM messages only for participants; city-chat media only for the room's members and only if not blocked either way. The media resolver takes `(media, viewer, context)`.
- Push text built server-side per recipient locale: "Photo" / "Фото", "Video", "Voice message" etc. (Pitfall 16).
- Scope control for city chats (opinionated): images and short video only, no documents; per-user upload rate limit in group rooms; one-tap Report on every media message; DMs only after the existing accepted-request gate (already in place, keep it as the anti-"cyberflashing" boundary).
- Upload resilience: cancel, retry, resume-on-reconnect, discard when the app is killed; release APK over LAN will see flaky links.
- Moderation: reports must be able to target a message/attachment; admin needs a view to inspect and delete media.

**Warning signs:**
- Duplicate attachment bubbles after reconnect; DM list previews blank; `transport close` on sender during upload; attachment URL retrievable by a non-participant.

**Phase to address:**
Chat media phase (after the media foundation and playback manager).

---

### Pitfall 15: Feed/wall N+1 queries once the social graph, reposts and media arrive

**What goes wrong:**
`getFeed` already does batched author lookup, but then awaits `getSignedUrl` serially per author and per post. Adding: per-post "is the author my friend/follower?" (one query per row), viewer's block set (array scan across Users), repost original resolution (second query per row), mutual friend counts, attachment documents (a query per post), per-attachment URL signing (N x M), and `likedBy` arrays shipped to the client. Wall with `{authorUid}` + `createdAt` sort has no compound index and sorts in memory. Friends feed implemented as a giant `authorUid: {$in: [...500 uids]}` plus `$lookup` per item grows quickly. The signing itself is a local RSA operation, but in series for 100+ items per page, and with the emulator in the loop, it shows up as latency.

**How to avoid:**
- Batch-everything pattern per page: collect uids, media ids, root post ids, relationship pair keys; run ONE `$in` query for each (authors, media, originals, relationships, liked-by-me); then assemble in memory. Never query inside `map`/loops.
- Keep a documented budget: <= 6 Mongo queries per feed page regardless of page size (test it with Mongoose debug counting).
- Likes: replace `likedBy[]` (unbounded; 16 MB doc limit; leaked UIDs) with a `Like {postId, uid}` collection (unique compound) and a `likeCount`; compute `likedByMe` with a single `$in` query for the page. At minimum use a `$elemMatch`/`$in` projection so the array never leaves the server. Same for comments' likes.
- Indexes: `Post {authorUid:1, createdAt:-1, _id:-1}` (wall), `Relationship {pairKey:1}` unique, `{addresseeUid:1,status:1,updatedAt:-1}`, `{requesterUid:1,status:1}`, `User {blockedUsers:1}` (multikey), `Media {ownerUid:1,status:1,createdAt:1}` (GC), `Message {conversationId, createdAt}` (exists).
- Avatars: memoise `uid -> signed avatar URL` in a small in-process LRU keyed to the URL expiry bucket; sign in parallel with `Promise.all`.
- Feed scope: a global verified-member feed is fine at this scale; if a "friends" tab is added, do fan-out-on-READ with the friend uid list capped (e.g. 1,000) and an index-supported `$in`. Do not build fan-out-on-write.
- Counters: friend/follower/post counts stored on User with atomic `$inc` on state transitions, never computed by scanning on profile load.
- Add a `.explain('executionStats')` check to the phase's verification for feed, wall, friends list.

**Warning signs:**
- Mongo profiler showing query counts scaling with page size; wall scroll slow for prolific authors; `COLLSCAN` in explain; feed responses > 100 KB without media.

**Phase to address:**
Relationships & visibility phase (relationship indexes, batch helpers) and Profile/wall phase (wall index); re-checked in Reposts and Community media.

---

### Pitfall 16: i18n retrofitted late, wrong plural rules, server-originated text left in English

**What goes wrong:**
(1) i18n is built last, so every new v1.1 screen is written with hardcoded strings and then needs a second extraction pass. (2) Russian plural forms: English `count === 1 ? 'friend' : 'friends'` logic is wrong; Russian needs one/few/many (1 друг, 2-4 друга, 5-20 друзей, 21 друг, 22 друга, 25 друзей; fractions use "other"). Counters here are everywhere: friends, followers, likes, comments, reposts, "N minutes ago". (3) i18next plurals depend on `Intl.PluralRules`; without it (or with old v3 JSON format) Russian silently falls back to wrong forms. (4) Hardcoded literals hide in `Alert.alert`, toasts, placeholders, `accessibilityLabel`, header titles, tab labels, validation messages, empty states, permission rationale, config plugin strings. (5) Backend sends English error strings (`{error:'text is required'}`) that the app shows verbatim, a hardcoded `'Member'` fallback, and push notification titles/bodies built server-side from the SENDER's perspective or in English. (6) Dates/relative times/numbers formatted with `toLocaleString()` of the device, not the chosen UI language, and mixed month names; server sends preformatted dates. (7) The language switcher changes new renders but not strings already baked into Zustand stores, navigation header titles set at navigator creation, or module-level constants (`const TITLE = t('x')` evaluated once). (8) Locale tags: `ru-RU` vs `ru`, `uk`/`be`/`kk` device locales (common among Russian-speaking users) fall to English when you want Russian. (9) Russian strings ~20-30% longer: tab bar labels and buttons truncate. (10) User-generated content and city names (slugs like `new-york`) are not translated; district names from geocoding come in one language.

**How to avoid:**
- Make i18n infrastructure the FIRST phase of the milestone and require all later phases to ship strings via `t()`; extract existing screens in that phase (use a grep/ESLint rule such as `react-native/no-raw-text` or `i18next/no-literal-string` as a CI-ish check).
- Library: `i18next` + `react-i18next` + `expo-localization` (confirm it is SDK-57 compatible; VERIFY), JSON v4 plurals (`friends_one/_few/_many/_other`), `Intl.PluralRules` presence checked on Hermes at startup (add polyfill if absent), unit-test Russian counts 0,1,2,5,11,12,21,22,25,100,101,1.5.
- Persist the chosen language (AsyncStorage/SecureStore, whichever is already present), default to device language with mapping `ru|uk|be|kk -> ru`, else `en`; sync it to the server (`PATCH /users/me {locale}`) on login and on switch.
- Server: stop sending prose. Errors become `{error: {code: 'POST_TEXT_REQUIRED', params?}}` (keep an `error` string for backward compatibility with old APKs for one release); the client maps codes to translations. For push, the server has a small catalog and renders per RECIPIENT `User.locale` (a separate, minimal ICU-style table with the same plural logic, e.g. `i18next` on Node). Do not rely on data-only pushes with client-side localisation: Android delivery for killed apps is unreliable.
- Remove server-side display strings from API (return `null` for missing names and let the client show a translated fallback).
- Dates: server returns ISO-8601 UTC only. Client formats with `Intl.DateTimeFormat(lang)` or `dayjs/date-fns` with `ru` locale loaded and set from the app language, not the device. Relative time uses `Intl.RelativeTimeFormat` (VERIFY Hermes) or pluralised catalog keys.
- Language switch: store only raw data in Zustand (never translated strings); bump a key in the root to re-render; set navigator `screenOptions.title` via functions, not constants; reset `dayjs.locale`.
- Layout QA pass in Russian on a 360 dp-wide device.
- Android per-app language (13+) is optional; at minimum declare supported locales via the expo-localization plugin.

**Warning signs:**
- Cyrillic and Latin string literals inside JSX/`Alert`; a ".length === 1" ternary next to a noun; English text in a Russian session in push notifications; toasts that don't change after switching language until restart.

**Phase to address:**
i18n foundation phase FIRST (infrastructure, extraction of v1.0 screens, error codes, push catalog, locale sync), enforced as an acceptance criterion in every later phase.

---

## Moderate Pitfalls

### Pitfall 17: Mongoose `_id` vs `id` and raw storage paths reappear in every NEW schema

**What goes wrong:** New models (Media, Relationship, wall posts, attachments subdocs, reposts, profile fields) each return `_id` or leak `storagePath`/`thumbPath`; mobile expects `id` and absolute URLs (both bugs already hit).
**Prevention:** A shared Mongoose plugin applied globally (`toJSON: {virtuals:true, versionKey:false, transform: (d,r)=>{r.id=r._id.toString(); delete r._id;}}`) and a single serializer layer (`serializePost`, `serializeMedia`) with an explicit allowlist; a contract test that walks every API JSON response and fails if any key is `_id` or any string value starts with `posts/`, `media/`, `profiles/`, `listings/`, `verification/` or contains `127.0.0.1`. **Phase:** Media foundation (plugin + serializers) and every API phase.

### Pitfall 18: Emulator vs real-device network gotchas multiply with media

**What goes wrong:** Storage emulator URLs (`127.0.0.1:9199`) for video/audio/thumbs/files not rewritten for LAN devices; emulator may not honour HTTP Range (breaks seeking, VERIFY); emulator does not enforce signed-URL expiry or signature (hides Pitfall 4); release builds block cleartext HTTP (currently `usesCleartextTraffic: true`, which must be removed for production, so media must be HTTPS there); link-preview thumbnails over `http://` third-party CDNs get blocked; large uploads over flaky LAN time out.
**Prevention:** One host-rewrite function inside `mediaUrlService`; an env flag for short expiry in dev; a smoke test script that plays a video via LAN on a physical device in a release APK; keep a "production-like" staging run (real bucket, HTTPS) before milestone sign-off; set explicit request timeouts and `keepAlive` for long uploads. **Phase:** Media foundation; re-verified at milestone UAT.

### Pitfall 19: Profile screen architecture (VK-style header + tabs + wall) causes nested-list jank and edge-to-edge bugs

**What goes wrong:** Cover + avatar + stats + tabs in a ScrollView wrapping a FlatList (VirtualizedList nesting warnings, broken `onEndReached`); collapsible headers jank on Android; cover image behind the status bar mis-sized under edge-to-edge (known pain); each tab with its own FlatList and player; avatar overlapping cover cropped incorrectly across aspect ratios; saving profile re-fetches and flashes.
**Prevention:** Single FlatList with `ListHeaderComponent` (cover/avatar/status/tabs) and tab content as data (wall posts) or one lazily mounted list per tab inside a tab-view; cover uses fixed aspect ratio + server-side crop to 3:1; apply top inset centrally via the existing `useSafeStackScreenOptions`; test on a gesture-nav + 3-button-nav device. **Phase:** Profile/wall phase.

### Pitfall 20: Full-screen viewer library and gesture conflicts (New Arch)

**What goes wrong:** Many image-viewer libraries are unmaintained or untested on RN 0.86/New Arch/Reanimated 4; pinch-zoom vs horizontal paging vs swipe-to-dismiss conflict; Android back button doesn't close; insets wrong under edge-to-edge; video inside viewer fights the feed player (Pitfall 5); "save to gallery" adds storage permissions and lets users copy other women's photos.
**Prevention:** Spike 1 day on two options (maintained library vs custom with `react-native-gesture-handler` + `react-native-reanimated`); present as a navigation modal route (so back works) rather than RN `Modal`; resolve fresh URLs on open (Pitfall 4); decide explicitly about save/share (recommend: no save-to-gallery of others' media in v1.1). **Phase:** Full-screen viewer phase (can sit with Community media).

### Pitfall 21: Moderation and reporting not extended to new content types; no cascade on delete

**What goes wrong:** Report model targets users/posts; new surfaces (wall posts, reposts, comments on wall, covers, avatars, chat attachments, music-link cards, profile free-text fields) cannot be reported or inspected by admins; deleting a post/user leaves Storage objects, reposts, relationships and messages; no way for admin to see media in the moderation panel.
**Prevention:** Generalise `Report` to `{targetType, targetId, ownerUid}`; admin media viewer using the resolver with admin privileges; delete cascade service (post -> media -> reposts tombstoned; user ban -> hide everywhere via visibility policy). **Phase:** Each feature phase includes its report target; a small Moderation extension step in the media foundation phase.

### Pitfall 22: Backward compatibility with APKs already installed

**What goes wrong:** Testers' v1.0 APKs call endpoints expecting `photoUrl` as a string and English `error` strings; response shape changes crash them (RN red screen/white screen).
**Prevention:** Additive API changes for one release (keep `photoUrl` populated from first image attachment; keep `error` string next to `error.code`... use `errorCode` as a sibling field instead of changing the shape); add an `X-App-Version` header and a minimum-supported-version gate. **Phase:** All backend phases; decide the compatibility window in the media foundation plan.

### Pitfall 23: Orphan/Quota/cost: storage growth and egress

**What goes wrong:** Video + audio multiply Storage and egress bills; no per-user quota; no cleanup of failed/abandoned uploads; deleted users' media persists.
**Prevention:** Per-user daily upload quota and total cap, Media GC job, lifecycle rule on a `tmp/` prefix, size/duration caps from Pitfall 1, 720p delivery from Pitfall 2. **Phase:** Media foundation.

---

## Minor Pitfalls

### Pitfall 24: Picker quirks on Android
`fileName`, `mimeType`, `fileSize` may be null; library picks return `content://` or cache URIs; `allowsMultipleSelection` needs `selectionLimit`; Samsung may return HEIC. **Prevention:** derive extension/mime server-side; validate client-side for UX only; convert HEIC client-side or reject.

### Pitfall 25: Unbounded text/status fields
Status, "details", hobbies, "what she is looking for" accept long text, URLs and phone numbers (contact-info exfiltration around the platform's reporting). **Prevention:** length caps, trim, strip control chars, optional phone/URL pattern warning.

### Pitfall 26: Hardcoded accent on counters and ordering
Friends count shows stale after accept; follower badge not updated via socket. **Prevention:** emit `relationship:update` to `user:{uid}` rooms (already used for message requests) and refetch counts.

### Pitfall 27: Date and timezone drift in profile "age"
Store `birthYear`; computing age on the server at read time, not saving a number.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Raise multer `fileSize` + keep memoryStorage for video | 1-line change | OOM, chat outage (shared process) | Never for video/audio/files; photos <= 10 MB only |
| Store attachment paths on Post/Message (no Media model) | Fast first demo | IDOR, orphans, no status/scan/dimensions, migration pain | Never |
| Skip server transcode, accept any video | No ffmpeg dependency | Unplayable video on subset of devices, no streaming start, metadata leaks | Only for a time-boxed spike; not for release |
| Repost = copy of text/media | Simple read path | Block bypass, deletion not honoured, duplicate storage | Never |
| Per-endpoint block checks | Quick to add | Leaks on each new list | Never; build `visibilityService` first |
| Client-side only i18n | Faster | Push/errors/dates remain English; double work | Never for push/error codes; acceptable to defer less-visible admin text |
| Hardcode `getSignedUrl` 15-min everywhere | Already exists | Dead media, cache churn | Only for private docs (verification), not for media |
| Keep `likedBy[]` array | Already exists | 16 MB doc, UID leak, payload bloat | Until a post reaches ~1k likes; fix when touching feed (do it in v1.1) |
| Random per-request location jitter | Easy | Averaging attack, inconsistent UI | Never; use deterministic offset/grid |
| Link preview via generic URL scraper | Works for any site | SSRF, hanging requests, brittle | Never in v1.1; use allowlisted oEmbed |
| Translate with string concatenation / ternary plurals | Quick | Broken Russian | Never |
| Fan-out-on-write friends feed | Fast reads | Complexity, storage | Not needed at this scale |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Firebase Storage (Admin SDK) | `save(buffer)` of large files; raw uploads stored; 15-min URLs for media | Stream to bucket; store only processed derivatives; time-bucketed longer expiry; central resolver |
| Firebase Storage Emulator | Assuming it mirrors production (expiry, Range, host) | Rewrite host centrally; force short expiry in dev; test on real bucket before sign-off |
| expo-video | One player per row; sharing a player between two VideoViews on Android; forgetting `release()` for `createVideoPlayer` | Poster-first rows, single global active player, hooks for auto-release, viewer gets its own player; use `headers`/`useCaching` deliberately |
| expo-audio | Multiple players; unclear background policy | One shared player; explicit `setAudioModeAsync`; lock-screen controls if background playback is a feature (Android stops after ~3 min otherwise) |
| expo-image-picker | Assuming it compresses/limits video on Android; `exif` assumed to strip | Check `fileSize`/`duration` client-side; server does all sanitising |
| Google Maps/Geocoding | Using exact pin; missing `sublocality` outside some countries; key on client | Server-side geocode and snapping; fall back to locality; keep key server-side/restricted |
| Spotify/YouTube oEmbed | Fetching the user URL directly; no timeouts | Fixed-host oEmbed, timeouts, size cap, schema validation, persist snapshot |
| Yandex Music | Expecting oEmbed/OG to always work | Text-only card fallback; spike before promising rich previews |
| Socket.io | Sending files as binary events; default 1 MB buffer; no idempotency | REST upload then socket message with `mediaIds` + `clientMsgId` |
| Expo Push | Strings prebuilt by callers, one push per event | Server catalog by recipient locale; collapse/throttle; chunked sending |
| i18next on Hermes | Missing `Intl.PluralRules`; v3 plural keys | v4 JSON keys + verify Intl; test Russian plural set |
| MongoDB | `$in` with giant arrays, unindexed array scans for blockers | Multikey/mirror index; capped lists; batch `$in` per page |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Memory-buffered uploads | RSS spikes, chat drops | Disk/stream + semaphore | 3-5 concurrent big uploads |
| Serial `await getSignedUrl` per item | Slow feed responses | Parallel + LRU + resolver batching | 50+ items per page |
| Per-row queries (relationship/original/media) | Latency scales with page size | Batch `$in` per page, query budget test | Every page; visible at ~1k users |
| Unindexed wall query | In-memory sort, slow profile open | `{authorUid, createdAt, _id}` index | Authors with ~1k posts |
| `likedBy[]` in feed payload | Large JSON, doc growth | Like collection / projection | ~500+ likes on a post |
| Full-size images in cards | Jank, OOM on grids | Server thumbnails, `expo-image` caching | First wall grid |
| Players mounted per row | Decoder errors, memory growth | Poster-first, single active player | > 3-4 videos on screen/window |
| Signed URL churn | Re-downloads on refresh | Stable bucketed URL + cacheKey | Any pull-to-refresh |
| ffmpeg in the web process | Latency spikes for everyone | Worker/child process, nice, queue | A few concurrent videos |
| Push per event | Notification floods | Collapse/throttle | A single spammer |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting client paths/mediaIds without ownership check | IDOR, access to ID documents or others' DMs media | Media model + owner/status/scope check; generated paths only |
| Trusting `mimetype`/extension | Executable/HTML/SVG upload, APK delivery | Magic-byte detection + allowlist; re-encode; `nosniff`/attachment |
| EXIF/video/audio/doc metadata retained | Home address disclosure via GPS | Re-encode all; `-map_metadata -1`; backfill old photos |
| Exact listing coordinates in DB/API; `distance` in `$geoNear` | Address recovery by trilateration | `exactLocation` private, deterministic public approximation, no `distance` |
| Pending request grants follower access | Unconsented access for abusers | Pending = verifiedMember tier only |
| Public friends/followers lists, mutual friends, suggestions | Stalking, social-graph mapping | Counts only; owner/friends-only lists; no suggestions |
| Optional profile fields visible by default | De-anonymisation, approach vector | Serializer-enforced per-field flags; sensitive default hidden |
| Reposts bypass blocks/bans/deletes | Block bypass; deleted content persists | Reference model + read-time policy + tombstones |
| SSRF via link preview | Internal service access | Fixed-host oEmbed only; no arbitrary fetch |
| Spoofable link allowlist (`includes`) | Phishing links in a trusted space | Parse URL, exact host match |
| Rate limiting absent; CORS `*` | Spam, abuse, cross-origin misuse | `express-rate-limit` by uid; restrict origins (also listed in CLAUDE.md) |
| Admin/ban state not applied to media | Banned users' content still served | Visibility policy checks `isBanned`/`deletedAt` in the resolver |
| Socket events trusting client-supplied recipients/rooms for media | Cross-room leakage | Continue deriving rooms/uids server-side; resolve attachments server-side |
| Long-lived media URLs for private DMs | Leaked link remains valid | Shorter buckets for DM media; resolve on demand |
| Unscanned files forwarded in public chats | Malware spread | No documents in city chats; scan if files allowed |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Upload with no progress/cancel/retry | Frozen feeling, duplicate posts | Progress, cancel, retry; media-first flow |
| "Processing" state not communicated | Posts appear broken | Poster + "Processing video..." placeholder |
| Silent file rejection | Confusion | Specific messages ("Video longer than 60 s", "File type not allowed") in the user's language |
| Decline notifications for friend requests | Confrontation, retaliation | Silent decline; requester keeps seeing "Requested" |
| No way to remove a follower | Feels unsafe | "Remove follower" without notification |
| Hidden block effects | Users unsure if block works | Clear confirmation text; consistent disappearance |
| Auto-playing video with sound | Embarrassment, data use | Tap to play; muted preview later |
| Russian text overflow | Truncated tabs/buttons | Flexible layouts; QA at 360 dp in Russian |
| Language toggle requires restart | Seems broken | Live switch; persisted |
| Approximate-area circle that looks like exact pin | Misleading, privacy theatre | Circle + clear copy ("Exact address shared after acceptance") |
| Cached feed with dead images after resume | Looks broken | Refresh on foreground; resolver fallbacks |
| Full-screen exit with wrong status/nav bar | Layout jump under edge-to-edge | Centralised inset handling; test exit paths |

## "Looks Done But Isn't" Checklist

- [ ] **Video upload:** works on one phone only: verify HEVC, 4K, HDR, `moov`-at-end samples on 3 devices; verify processing status and failure UI.
- [ ] **Signed URLs:** works in emulator: verify with real bucket (or 60 s expiry), pause a video 2 minutes, resume; background app 20 min, return to feed.
- [ ] **Players:** scroll 100 items, check decoder errors and memory; navigate away mid-play (audio stops); open viewer (feed pauses).
- [ ] **EXIF:** upload GPS JPEG, GPS MP4, ID3 MP3, authored PDF: assert nothing identifying survives; check old v1.0 photos are backfilled.
- [ ] **Approximate area:** inspect raw API JSON for exact coords; run 3-point `$geoNear` trilateration test; check v1.0 listings migrated; caches cleared.
- [ ] **Block matrix:** for feed, wall, comments, reposts, friends lists, search, DM, city chat, attachments: A blocks C: neither sees the other's content or media; notifications suppressed.
- [ ] **Friend flow:** double-tap accept, simultaneous A->B/B->A, decline then re-request within cooldown, request after block, counters correct, rate limit returns 429 with a translated message.
- [ ] **Repost:** original deleted, banned, blocked, repost of repost, notification suppression, report routes to root.
- [ ] **File safety:** upload `.apk` renamed `.pdf`, `.svg` as image, polyglot, huge-pixel PNG: all rejected cleanly; Content-Disposition/nosniff present.
- [ ] **Music links:** `spotify.com.evil.net`, `http://`, private-IP redirect, Yandex link with no preview: safe handling.
- [ ] **Chat attachments:** reconnect during upload yields exactly one message; attachment-only message; push text localised; non-participant cannot fetch URL.
- [ ] **i18n:** Russian plural set 0/1/2/5/11/21/22/25 for every counter; push in recipient language; server error codes translated; date/relative time in app language; live switch updates headers, tabs, toasts; no Cyrillic/Latin literals left (lint).
- [ ] **API contract:** no `_id` keys, no storage paths, no `127.0.0.1` in any response (contract test).
- [ ] **Release APK over LAN:** video, audio, files and thumbnails load with cleartext policy as configured; production config uses HTTPS and no cleartext.
- [ ] **Old APK compatibility:** v1.0 client still renders posts after backend deploy.
- [ ] **Query budget:** feed/wall/friends pages stay within the documented query count; `explain` shows IXSCAN.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OOM from uploads | LOW | Add limits/semaphore immediately; move to disk streaming; restart; no data loss |
| Unplayable video backlog | MEDIUM | Batch transcode job over `Media` where codec != h264; update `status`; re-point `url` |
| Media without Media model (paths in posts) | HIGH | Write migration creating Media docs from paths; rewrite serializers; temporary dual-read |
| EXIF GPS already published | MEDIUM | One-off sanitising script over `posts/`, `profiles/`, `listings/` objects; invalidate signed URLs; notify if appropriate |
| Exact listing coordinates already served | MEDIUM | Migration to `exactLocation` + approximate `location`; rotate caches; consider notifying hosts |
| Block bypass via reposts discovered | MEDIUM | Ship read-time filter hotfix; tombstone offending reposts; audit logs |
| Friend-request spam wave | LOW | Enable rate limits, bulk-cancel pending from offender, ban; data model with unique pairKey prevents duplicates |
| Counters drifted | LOW | Recompute from collections via script |
| Malicious file circulated | HIGH | Delete objects, add hash denylist, invalidate URLs, ban user; add scanning |
| i18n gaps in push/errors | LOW | Add catalog entries; fall back to English with code logged |
| Dead signed URLs reported | LOW | Raise bucket TTL; add resolver refresh in client; no data change |

## Pitfall-to-Phase Mapping

Phases below are proposed capability groupings (the roadmap may split or merge them, but the ordering constraints are the point): **P1 i18n foundation**, **P2 Approximate area (listing privacy fix)**, **P3 Relationships & visibility policy**, **P4 Media foundation (Media model, upload pipeline, resolver, serializers, playback manager)**, **P5 Profile + wall**, **P6 Community rich media + music links + full-screen viewer**, **P7 Reposts**, **P8 Chat attachments**.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Memory uploads | P4 | 5 parallel 50 MB uploads with live chat; flat RSS |
| 2 Video codecs/faststart | P4 (pipeline), P6 (UX) | HEVC/HDR/moov-end samples play on 3 devices |
| 3 Media model / IDOR | P4 | Test: cannot attach others' media; orphan GC runs |
| 4 Signed URL expiry/caching | P4 (+P6, P8) | 60 s expiry dev flag; pause/resume; stale-feed refresh |
| 5 Player lifecycle | P6 (store in P4) | 100-item scroll memory; single active media; blur pause |
| 6 Thumbnails/dimensions | P4, P5 | API returns `thumbUrl,width,height`; no layout jump |
| 7 Metadata leaks | P4 (+backfill in P2) | exiftool/ffprobe on stored objects shows no GPS/author |
| 8 Approximate area | P2 | Trilateration test; raw JSON audit; migration verified |
| 9 Stalking-enabling graph | P3 (consumed by P5) | Visibility matrix; pending-follower tier test; hidden-field test |
| 10 Request spam/races | P3 | Rate-limit tests; unique pairKey; concurrent accept test |
| 11 Repost bypass | P7 (needs P3) | Block/delete/ban matrix on reposts |
| 12 Per-endpoint block checks | P3 | Block matrix over every list endpoint |
| 13 File/link safety, SSRF | P4 (detection), P6 (links), P8 (surfaces) | Malicious sample suite; look-alike domain tests |
| 14 Chat attachment flow | P8 | Reconnect-during-upload test; participant-only fetch |
| 15 N+1 / indexes / likes | P3, P5 (re-checked P6, P7) | Query-count budget + `explain` |
| 16 i18n | P1 (enforced all phases) | Russian plural unit tests; lint; push-in-locale test |
| 17 `_id`/paths contract | P4 (plugin) + all | Response contract test |
| 18 Emulator/LAN/cleartext | P4 + milestone UAT | Physical-device release APK smoke test; staging run |
| 19 Profile layout | P5 | Android gesture/3-button nav check; list perf |
| 20 Viewer | P6 | Spike result documented; back button and insets verified |
| 21 Moderation extension | each phase | Report + admin removal per new content type |
| 22 Old APK compatibility | P4 and later backend phases | v1.0 build renders new API responses |
| 23 Storage cost/quota | P4 | Quota enforcement test; GC job |

**Ordering implications for the roadmap:**
1. P1 (i18n) first so every later screen is written with `t()`.
2. P2 (approximate area) early and independent: fixes a live privacy leak and its data migration is isolated.
3. P3 (relationships + visibility) before P5/P7/P8 because the block/visibility policy is consumed by wall, reposts and chat media.
4. P4 (media foundation) before P5/P6/P8; it is the highest-risk infrastructure item.
5. P7 (reposts) after P3 and P6.
6. P8 (chat attachments) last: depends on P4, the playback manager, and block policy.

**Phases likely needing deeper phase-level research (flag for planner):**
- P4: ffmpeg/ffprobe hosting and worker model (hosting constraints unknown), direct-to-Storage vs streamed upload decision, emulator Range/signed-URL behaviour, file-type ESM/CJS, sharp HEIC.
- P6: expo-video v57 specifics (events, `useCaching`, fullscreen/edge-to-edge behaviour), viewer library compatibility with RN 0.86 New Arch, Yandex Music preview feasibility, Android file open/share flow.
- P1: confirm expo-localization/i18next versions and Hermes Intl support (PluralRules, RelativeTimeFormat, DateTimeFormat locales) on the target RN 0.86 build.
- P2: privacy radius policy and geocoding label coverage in target countries (product decision).
- P3, P7, P8: standard patterns once the policy is designed, but need a short threat-model review.

## Sources

- Codebase review (HIGH): `/home/kartsi/PycharmProjects/women-app/backend/src/{routes,controllers,models,services,socket}`, `/home/kartsi/PycharmProjects/women-app/mobile/{package.json,app.json,app.config.js}`, `/home/kartsi/PycharmProjects/women-app/.planning/PROJECT.md`, CLAUDE.md files.
- Expo SDK 57 docs (HIGH for cited points): https://docs.expo.dev/versions/v57.0.0/sdk/video/ (hooks auto-release, `createVideoPlayer` needs `release()`, Android limitation of one VideoView per player instance, source `headers`, `useCaching`, `generateThumbnailsAsync`, `replaceAsync`); https://docs.expo.dev/versions/v57.0.0/sdk/audio/ (`useAudioPlayer` auto-release, `setAudioModeAsync`, `headers`, Android ~3 min background limit without lock-screen controls); https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/ (`videoQuality`/`videoExportPreset` iOS-only, `exif` returned not stripped, nullable asset fields).
- Expo blog, performance-first video feed lessons (MEDIUM): https://expo.dev/blog/shipping-a-performance-first-video-feed-how-tendbble-built-a-real-time-social-app-with-expo (single active player, release on leave, conditional sources).
- Android media transcoding and HEVC compatibility (MEDIUM): https://developer.android.com/media/platform/transcoding ; https://github.com/androidx/media/issues/2711 ; Brightcove HEVC selection note https://sdks.support.brightcove.com/android/playback/hevc-selection-native-sdk-android.html (ExoPlayer HEVC profile detection caveat; MediaTek HEVC black-output reports are from forum threads, LOW-MEDIUM).
- Established practice, no single source (MEDIUM): sharp default metadata stripping, ffmpeg `-map_metadata -1` and `+faststart`, V4 signed URL max 7 days, Socket.io `maxHttpBufferSize` default 1 MB, oEmbed endpoints for Spotify/YouTube, SSRF defences, Russian CLDR plural categories (one/few/many/other), i18next v4 plural keys.
- To VERIFY during phase research: emulator Range/expiry behaviour, `file-type` module format, Hermes Intl coverage, viewer library New Arch support, react-native-compressor compatibility, expo-localization plugin options for SDK 57.

---
*Pitfalls research for: v1.1 social features and rich media on an existing women-only safety-focused housing/community app*
*Researched: 2026-10-13*
