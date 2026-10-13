# Technology Stack - v1.1 Additions

**Project:** WomenApp (milestone v1.1 "Social features and media")
**Researched:** 2026-10-13
**Scope:** ONLY what is new for v1.1. The existing validated stack is not re-researched: Expo SDK 57 managed/CNG, RN 0.86 New Arch, React Navigation 7, Zustand 5, react-native-maps, expo-image-picker, expo-file-system `File` API, expo-notifications, Express 4, Mongoose 8, Socket.io 4, firebase-admin 14, multer 2, Firebase emulators.
**Overall confidence:** HIGH for the Expo packages (read from the v57.0.0 docs and from the SDK 57 `bundledNativeModules.json` installed in `mobile/node_modules/expo`). MEDIUM for the Hermes `Intl.PluralRules` question and for the exact ffmpeg remux behaviour (see Gaps).

## Headline decisions

1. **Video: `expo-video` (SDK-pinned). Audio: `expo-audio`. Files: `expo-document-picker`.** All three are first-party SDK 57 packages and need no extra native libraries. Do not add `expo-av`, `react-native-video` or `react-native-track-player`.
2. **Full-screen viewer: `react-native-zoom-toolkit` (Gallery + ResumableZoom) on top of SDK-pinned `react-native-gesture-handler` and `react-native-reanimated`.** This is the only new native footprint of the milestone. It needs a dev-client/APK rebuild.
3. **i18n: `i18next` + `react-i18next` + `expo-localization`, language persisted in a Zustand `persist` store backed by the already-installed AsyncStorage.** Add the `intl-pluralrules` polyfill because Russian needs one/few/many/other plural forms.
4. **Link previews: server-side only, host allowlist (YouTube, Spotify, Yandex Music), built-in Node `fetch`, no preview library.** YouTube and Spotify have public oEmbed endpoints (verified live). Yandex Music has no oEmbed; its Open Graph tags are served only to a bot-like User-Agent on `music.yandex.ru/<type>/<id>`.
5. **Large uploads: keep uploading through the Express backend, but switch these routes from multer `memoryStorage` to `diskStorage` and stream to Storage. Add `ffmpeg-static` (remux only) for video metadata stripping and poster frames, and `sharp` for image re-encode.** Client uses `File.upload()` with `onProgress`. Direct-to-Storage signed-URL upload is a deferred scale-out path.
6. **Approximate area: server-side grid snapping of the public `location` plus a Google Geocoding reverse lookup for the district name, with the exact point stored privately.** The existing code stores the host's raw map tap as the public "neighbourhood centroid", so this is a safety fix and not only a feature.

## Recommended Stack

### Mobile: media capture, playback, viewing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| expo-video | `~57.0.0` (npm tag `sdk-57` = 57.0.5; install with `npx expo install`) | Video playback on wall, feed, DMs and the viewer | Official replacement in SDK 57. `useVideoPlayer` + `VideoView`, `nativeControls`, built-in fullscreen (`fullscreenOptions`, `enterFullscreen()`), per-source `useCaching` (1 GB default cache, `setVideoCacheSizeAsync`). Plays signed HTTPS URLs directly. |
| expo-audio | `~57.0.0` (tag `sdk-57` = 57.0.5) | Playback of uploaded audio files | Replaces expo-av for audio. `useAudioPlayer` / `useAudioPlayerStatus` for a single item, `createAudioPlayer` (manual `release()`) for one shared player. Playback needs no permission. |
| expo-document-picker | `~57.0.0` (tag `sdk-57` = 57.0.3) | Generic file and audio attachment picking | `getDocumentAsync({ type, copyToCacheDirectory: true, multiple })` returns `{ uri, name, size, mimeType }`. With `copyToCacheDirectory: true` the result is immediately readable by `new File(uri)` for upload. |
| expo-image | `~57.0.0` | Photo rendering in wall, feed, viewer; video posters | Glide on Android: disk and memory cache, `placeholder` (blurhash), `recyclingKey` for lists, and `source={{ uri, cacheKey }}`. Needed because our signed URLs rotate (15 min today), which would otherwise defeat the cache. Also renders the `generateThumbnailsAsync` result if needed. |
| expo-sharing | `~57.0.1` | "Open / save" a downloaded generic file | `shareAsync(fileUri, { mimeType })` supports `file://` and `content://` on Android. Pair with the `File.downloadFileAsync` from expo-file-system (already installed). |
| react-native-gesture-handler | `~2.32.0` (SDK 57 pin; do NOT take npm latest 3.3.0) | Gesture engine for zoom/pan/swipe-to-dismiss | Required by the zoom library. In Expo Go and dev-client. Needs a `GestureHandlerRootView` at the app root. |
| react-native-reanimated | `4.5.0` (SDK 57 pin; npm latest is 4.7.1, do NOT bump) | Worklet animations for the viewer | Babel plugin is auto-configured by `babel-preset-expo`; no `babel.config.js` edit. New Architecture only, which we already run. |
| react-native-worklets | `0.10.0` (SDK 57 pin; npm latest 0.13.0, do NOT bump) | Required peer of Reanimated 4 | Installed in the same `expo install` command. |
| react-native-zoom-toolkit | `^5.1.1` (published 2026-08-30; peers `react`, `react-native`; runtime needs Reanimated + RNGH) | Pinch/double-tap zoom, paged `Gallery`, `ResumableZoom` | Actively maintained (releases in 2026), Expo-compatible, accepts any child (not image-only) so a gallery page can hold an `expo-image` or a `VideoView`. See "Viewer design" below. |

**Viewer design (integration, not a library):** build one `MediaViewerScreen` registered in the existing native-stack as `presentation: 'transparentModal'` (or `fullScreenModal`), NOT the RN `<Modal>` component. Reason: gesture-handler gestures inside RN `<Modal>` on Android need their own nested `GestureHandlerRootView`, which is a classic source of "zoom does nothing" bugs. Pages: image items use zoom-toolkit `Gallery`/`ResumableZoom` around `expo-image`; video items render `VideoView nativeControls` without zoom (zoom on video adds gesture conflicts with native controls for no user value). Swipe-down-to-dismiss via a Reanimated shared value on the screen container.

### Mobile: i18n

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| expo-localization | `~57.0.0` (npm 57.0.2) | Detect the device language for the first-run default | `getLocales()[0].languageCode` / `useLocales()`. On Android a device-language change is picked up without restart. |
| i18next | `^26.4.4` | Translation engine, plurals, interpolation | Standard, and the Expo localization guide lists react-i18next as a recommended option. Runtime `changeLanguage` supports the in-app RU/EN switcher with no restart. Typed keys via `CustomTypeOptions`. |
| react-i18next | `^17.0.16` (requires `i18next >= 26.2.0`) | `useTranslation` hook, re-render on language change | Pairs with the above; the version pair is verified compatible (peer range). |
| intl-pluralrules | `^2.0.1` | `Intl.PluralRules` polyfill | i18next v4 plural keys (`_one/_few/_many/_other`) call `Intl.PluralRules`. Hermes' documented Intl surface lists Collator, NumberFormat, DateTimeFormat and getCanonicalLocales, NOT PluralRules, and I could not confirm that Hermes V1 (default since RN 0.84) added it. The polyfill is a no-op when the API exists, so it is a safe insurance. Russian plurals ("1 подруга / 2 подруги / 5 подруг") are the visible failure. |
| @react-native-async-storage/async-storage | `2.2.0` (already installed) | Persist chosen language | Use via Zustand `persist` with `createJSONStorage(() => AsyncStorage)`; no new dependency. |

**Config plugin (optional but cheap):** add `["expo-localization", { "supportedLocales": ["en", "ru"] }]` to the plugins in `mobile/app.config.js`. This registers the app in Android 13+ per-app language settings. The persisted in-app choice must take precedence over `getLocales()`; the plugin only changes what the OS reports. Needs a native rebuild (same one as the viewer libraries).

**Resource layout:** `src/i18n/index.ts` (init), `src/i18n/locales/en.ts`, `ru.ts` (TS objects, bundled; no http backend, no namespaces needed at this size), `src/store/languageStore.ts`. Default resolution order: persisted choice, else `ru` if device `languageCode === 'ru'`, else `en`. Gate first render on store rehydration (splash) to avoid a flash of the wrong language.

### Backend: uploads, media processing, link previews, geo

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| multer | `^2.2.0` (installed; latest 2.4.0) | Multipart parsing | Keep. Change `storage` to `multer.diskStorage({ destination: os.tmpdir() })` on media routes, with per-route `limits`. In-memory buffers of 100 MB videos times concurrent users is an OOM risk. Photo-only routes can stay on `memoryStorage`. |
| @google-cloud/storage (via firebase-admin `^14.1.0`) | already transitive (npm 8.4.0 requires Node >= 22) | Stream temp file to Storage | `bucket.upload(tmpPath, { destination, resumable: false, metadata })` or `file.createWriteStream({ resumable: false })`. `resumable: false` matches the existing `storageService` pattern and works with the Storage emulator. No new package. |
| sharp | `^0.35.5` (Node >= 20.9) | Re-encode and downscale photos, strip EXIF | Phone photos carry GPS EXIF. For a women-safety product, stripping location metadata from every wall/feed/chat photo is a requirement, not a nicety. `sharp(buf).rotate().resize({ width: 1920, withoutEnlargement: true }).jpeg({ quality: 82 })` drops metadata by default and applies orientation. Also produces small thumbs. |
| ffmpeg-static | `^5.3.0` (package licence GPL-3.0-or-later; used server-side only, not shipped in the app) | Video: strip metadata, faststart remux, poster frame | Used through plain `child_process.execFile` with a timeout. Two invocations per video: (a) `-map_metadata -1 -c copy -movflags +faststart` (no re-encode, cheap; removes the GPS `udta` atom and moves `moov` to the front so signed-URL progressive playback starts quickly), (b) `-ss 1 -frames:v 1 -vf scale='min(720,iw)':-2 poster.jpg` for the feed poster. A server poster is preferred over client thumbnails because expo-video's `generateThumbnailsAsync` returns an in-memory image ref (for display with expo-image), not a file we can upload. |
| file-type | `^22.1.1` (ESM-only; load with `await import('file-type')` from CommonJS) | Magic-byte sniffing of uploads | Do not trust client `mimetype` for video/audio/file attachments. Allowlist by sniffed type. Backend runs Node 22 locally, so dynamic import is safe. |
| Node built-in `fetch` + small HTML meta parser | Node >= 18 (22 locally) | Link-preview fetching | See "Link previews" below. |
| Google Geocoding API (REST, plain `fetch`) | HTTP API | District name for approximate area | See "Approximate area" below. No SDK package needed for a single endpoint. |

### Link previews (server-side)

New endpoint, e.g. `POST /api/link-preview { url }`, called when the user pastes a link in the composer and again (re-validated) when the post is saved. Persist the resolved `{ provider, kind, title, subtitle, thumbnailUrl, canonicalUrl }` on the post so the feed never calls third parties.

| Provider | Mechanism (verified by live requests 2026-10-13) |
|----------|---------------------------------------------------|
| YouTube / YouTube Music / youtu.be | `GET https://www.youtube.com/oembed?url=<url>&format=json` returns `title`, `author_name`, `thumbnail_url` (200 OK, no key). |
| Spotify | `GET https://open.spotify.com/oembed?url=<url>` returns `title`, `thumbnail_url`, `provider_name`, `html` (200 OK, no key). |
| Yandex Music | No oEmbed (`/oembed` returned 404). Fetch the HTML and read `og:title`, `og:description` (e.g. "Imagine Dragons - Track - 2017"), `og:image`. Verified: request with `User-Agent: Mozilla/5.0 (compatible; Twitterbot/1.0)` to `https://music.yandex.ru/track/<id>` returns full OG tags; a generic browser UA, and `music.yandex.com/album/<a>/track/<t>`, returned the SPA shell with no OG data. So: parse the URL, extract `track|album|artist|users/.../playlists` ids, and rebuild the canonical `https://music.yandex.ru/track/<id>` (or `/album/<id>`, `/artist/<id>`) before fetching. This is scraping an undocumented behaviour, so cache results and degrade gracefully to a plain "Yandex Music link" card with the host icon if parsing fails. |

**Security rules (non-negotiable, this is an SSRF surface):** strict hostname allowlist (`youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`, `open.spotify.com`, `music.yandex.ru`, `music.yandex.com`, `music.yandex.by`, `music.yandex.kz`, `music.yandex.uz`); `https` only; `redirect: 'manual'` (re-validate the host on any redirect); `AbortSignal.timeout(5000)`; read at most about 256 KB of the response body; never reflect raw fetched HTML to clients; render the card from stored fields and open it with `Linking.openURL`. Because only fixed public hosts are ever fetched, DNS-rebinding to internal IPs is not a practical vector. Do NOT build a generic "preview any URL" feature in v1.1; if it is wanted later, it needs a DNS-pinning fetch (resolve once, validate IP, connect to that IP).

### Approximate area (district) for listings

| Piece | Choice | Why |
|-------|--------|-----|
| Public coordinates | Deterministic grid snapping on the server. For a cell size `s` degrees (start with `0.01`, about 1.1 km): `lat' = (floor(lat/s) + 0.5)*s`, `lng'` with the longitude step widened by `1/cos(lat)`. Store as the existing `location` (keeps the 2dsphere index and the `$geoNear` search working unchanged). | Deterministic, so repeated reads or noise-averaging cannot narrow the position, unlike per-request random jitter. Per-listing random offset is acceptable but adds nothing and cannot be unit-tested as simply. |
| Exact coordinates | New private field `exactLocation` (GeoJSON Point, `select: false`), revealed only under the existing accepted-StayRequest gate alongside `exactAddress`. | The current model treats `location` as a "neighbourhood centroid" but `createListing` writes the client's raw tapped `coordinates` straight into it and it is returned to every client. Anyone who taps their own house exposes it. Server-side snapping removes dependence on client behaviour. Needs a one-off migration to snap existing documents and copy the originals into `exactLocation`. |
| District label | Server calls Google Geocoding reverse (`https://maps.googleapis.com/maps/api/geocode/json?latlng=<snapped>&result_type=sublocality\|neighborhood\|locality&language=ru` and again with `language=en`) once at create/update time; store `area: { name: { ru, en }, placeId }` on the Listing. Pick the first of `sublocality_level_1`, `neighborhood`, `locality`, `administrative_area_level_2`. | Geocode the SNAPPED point, never the exact one. Two language calls at write time means reads are free and the label follows the RU/EN switcher with no runtime geocoding. Cost: Essentials SKU, 10,000 free calls/month, then $5 per 1,000, and only one or two calls per listing write. |
| Map rendering | `react-native-maps` (already installed, 1.27.2) `<Circle center radius />` instead of an exact-looking pin; radius >= half the cell diagonal (about 800 m for `s=0.01`) so the circle honestly contains the true location. | No new library. Circle is a standard react-native-maps component. |
| API key | A SEPARATE server key, `GOOGLE_GEOCODING_API_KEY`, restricted to the Geocoding API and, where hosting allows, by IP. | The existing mobile key is a Maps SDK for Android key restricted by package name and is embedded in the APK via `EXPO_PUBLIC_*`, so it must never be used for server calls or be allowed to call Geocoding. |

### Mobile upload strategy

| Technology | Purpose | Why |
|------------|---------|-----|
| `File.upload(url, { uploadType: UploadType.MULTIPART, fieldName, mimeType, headers, parameters, onProgress, signal })` from `expo-file-system` (already `~57.0.0`) | Video, audio and file uploads with progress and cancel | Returns `{ status, headers, body }` and resolves on non-2xx (check `status`). Streams from disk rather than building a blob. `onProgress` gives `{ bytesSent, totalBytes }` (includes multipart framing). `AbortSignal` cancels. `sessionType: 'background'` is iOS-only, so on Android the upload lives only while the app process is alive. |
| Existing `appendFile` + `fetch` + FormData (`new File(uri)` as part) | Photos and small attachments | Already works under New Arch; keep for images where progress is not needed. |

Upload limits (tunable constants, enforced on both client and server): image 10 MB (server re-encodes down), audio 25 MB, generic file 25 MB, video 100 MB and 90 s. The client checks `asset.fileSize` and `asset.duration` (ms) from expo-image-picker / document-picker before upload and shows a localized message. expo-image-picker has no Android video transcoding control (`videoExportPreset` and `videoQuality` are iOS-specific), so 4K clips will exceed the cap and be rejected, which is acceptable for MVP.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Video playback | expo-video | react-native-video, expo-av | expo-av is superseded (audio by expo-audio, video by expo-video) and not in the SDK 57 bundled module list; react-native-video is an extra native dependency with no benefit over the SDK package. |
| Audio playback | expo-audio | react-native-track-player | Track player is for queue/lock-screen music apps; we play single attachments. Revisit only if background music queues become a feature. |
| Zoom viewer | react-native-zoom-toolkit 5.1.1 | react-native-awesome-gallery 0.4.3 | Last published 2024-09, peer `react-native-reanimated ^3.2`, which conflicts with Reanimated 4.5. |
| Zoom viewer | react-native-zoom-toolkit 5.1.1 | react-native-image-viewing 0.2.2 | Last published 2022-05, unmaintained, image-only. |
| Zoom viewer | react-native-zoom-toolkit 5.1.1 | @likashefqet/react-native-image-zoom 4.3.0 | Viable (peers RNGH + Reanimated) but last published 2024-12 and has no paged Gallery; we would build paging ourselves. |
| Zoom viewer | react-native-zoom-toolkit 5.1.1 | @nandorojo/galeria 3.1.0 | Maintained, expo-image friendly, shared-element transitions, but image-centric and wants the library's own presentation; revisit if shared-element open animation becomes a requirement. |
| Video thumbnails | server ffmpeg poster | expo-video-thumbnails | Deprecated in SDK 57 (docs: use `generateThumbnailsAsync` from expo-video). |
| Video thumbnails | server ffmpeg poster | `player.generateThumbnailsAsync` on client | Returns a display image ref, not an uploadable file; per-item generation in lists is wasteful. Use it only if a local preview before upload is wanted. |
| Video compression | none in v1.1 (size and duration caps) | react-native-compressor 2.0.3 | Requires `react-native-nitro-modules >= 0.35` as a new native peer; defer until users actually hit the 100 MB cap. |
| ffmpeg wrapper | `execFile` + ffmpeg-static | fluent-ffmpeg 2.1.3 | npm marks it "no longer supported". |
| Large upload path | Via backend, disk-staged | Client uploads straight to Storage with a v4 signed PUT URL, or the Firebase client SDK `uploadBytesResumable` | Signed-PUT skips the server, which breaks EXIF/metadata stripping, MIME sniffing and moderation hooks unless we add a post-upload processing step; behaviour of write-signed URLs on the Storage emulator is unverified; client SDK upload from RN blobs is brittle under New Arch and would need open Storage rules. Keep as the scale-out path once volume justifies it. |
| Link previews | Own allowlisted fetcher | link-preview-js 5.0.0, open-graph-scraper 6.12.0, metascraper 5.58.4 | Generic "fetch any URL" libraries create an SSRF surface; link-preview-js had a DNS-rebinding SSRF bypass (CVE-2026-61704, fixed in 4.0.4) via exactly this validate-then-refetch pattern. We only need 3 known hosts. |
| Inline music/video playback | Open links with `Linking.openURL` | WebView / react-native-youtube-iframe / Spotify embeds | Adds `react-native-webview`, ads and tracking, and consent surface, for a card the user can tap to open the real app. |
| i18n | i18next + react-i18next | i18n-js | Also in the Expo guide; but i18next gives the plural-rule and typing story we need for Russian and a larger ecosystem. |
| Language detection | expo-localization | react-native-localize, i18next-browser-languagedetector | Redundant with expo-localization (already needed). |
| Relative time / dates | `Intl.DateTimeFormat` / `toLocaleDateString(lang)` plus own `timeAgo` using i18next plural keys | date-fns, dayjs, moment | Hermes documents `Intl.DateTimeFormat` and `NumberFormat` support; `RelativeTimeFormat` is not documented, so write a 15-line helper on i18next plurals instead of a date library. |
| District name | Google Geocoding REST | `@googlemaps/google-maps-services-js`, Places API | One endpoint, one `fetch`. Places adds cost and a second key for no benefit. |

## Installation

```bash
# --- mobile (from /mobile) ---
# SDK-pinned native modules: let Expo choose the versions
npx expo install expo-video expo-audio expo-document-picker expo-image expo-sharing expo-localization \
  react-native-gesture-handler react-native-reanimated react-native-worklets

# Not managed by Expo's version table
npm install react-native-zoom-toolkit@^5.1.1 i18next@^26.4.4 react-i18next@^17.0.16 intl-pluralrules@^2.0.1

# --- backend (from /backend) ---
npm install sharp@^0.35.5 ffmpeg-static@^5.3.0 file-type@^22.1.1
```

`app.config.js` plugin additions (then rebuild the dev client / APK, because Reanimated, RNGH, expo-video, expo-audio and expo-image add native code):

```js
'expo-video',
'expo-audio',
['expo-localization', { supportedLocales: ['en', 'ru'] }],
// Only if lock-screen/background playback is wanted (not required for v1.1):
//   ['expo-video', { supportsBackgroundPlayback: true }]
//   ['expo-audio', { enableBackgroundPlayback: true }]
```

Root wiring: wrap the app root in `<GestureHandlerRootView style={{ flex: 1 }}>`; import `./src/i18n` and `intl-pluralrules` once at the top of `index.ts` before `registerRootComponent`.

Backend env additions: `GOOGLE_GEOCODING_API_KEY`, optional `MEDIA_MAX_VIDEO_MB`.
Backend server tweak: Node's HTTP `requestTimeout` defaults to 300 s, so a 100 MB upload on a slow mobile link (about 1 Mbit/s needs about 13 min) is cut off. Set `httpServer.requestTimeout = 15 * 60 * 1000` (and confirm any reverse proxy `client_max_body_size` and timeouts).

## What NOT to add (summary)

| Do not add | Reason |
|------------|--------|
| expo-av | Superseded; not in the SDK 57 bundled module list. |
| expo-video-thumbnails | Deprecated in SDK 57. |
| react-native-video, react-native-track-player, react-native-webview, react-native-youtube-iframe | Redundant with expo-video / expo-audio / `Linking.openURL`. |
| react-native-awesome-gallery, react-native-image-viewing | Reanimated 3-era / unmaintained; conflict with Reanimated 4. |
| Newer gesture-handler (3.x), Reanimated (4.7.x), worklets (0.13.x) from npm latest | SDK 57 pins `~2.32.0` / `4.5.0` / `0.10.0`; native version skew breaks the build. Always install with `npx expo install`. |
| link-preview-js, open-graph-scraper, metascraper | Generic fetchers = SSRF; allowlisted 3-host fetcher is smaller and safer. |
| fluent-ffmpeg | Unsupported on npm. |
| Server-side transcoding (libx264 pipelines, job queues, BullMQ) | Out of scope for v1.1; remux-only keeps requests short. Revisit only if non-H.264/HEVC uploads show up in logs. |
| Firebase client SDK Storage uploads from the app | Bypasses server validation and metadata stripping; `storage.rules` currently allows `read, write: if true`. |
| Backend i18next | Return stable error `code`s and translate on the client; the backend has no user-facing prose of its own today. |
| Attachments over Socket.io | Default `maxHttpBufferSize` is 1 MB. Upload via REST, then emit the message with attachment references. |

## Integration points (where the new pieces plug into existing code)

- **`mobile/src/services/api.ts`**: add `uploadWithProgress(path, file, fields, { onProgress, signal })` built on `File.upload`, obtaining the Firebase ID token the same way `authFetch` does, and retrying once after a forced token refresh on 401 (to keep the existing refresh behaviour). Keep `appendFile` for images.
- **`mobile/src/utils/media.ts` (`mediaUri`)**: remains the loopback rewriter for emulator URLs; apply it to image, video, audio and poster URLs alike. expo-video `VideoSource` and expo-audio sources accept the rewritten URL string.
- **Signed-URL lifetime**: `getSignedUrl` currently expires in 15 minutes, which is fine for avatars but breaks paused videos, long audio, and cached feed pages. For media attachments raise to 1-6 h, or serve a stable `GET /api/media/:id` that 302-redirects to a fresh signed URL (then expo-image `cacheKey` is just the id).
- **`backend/src/services/storageService.js`**: add `uploadFromPath(storagePath, localPath, contentType, { contentDisposition })` (stream, `resumable: false`) next to `uploadFile`. For generic files set `contentDisposition: attachment; filename*=UTF-8''...` so a signed URL never renders HTML/SVG inline.
- **Routes**: new `multer.diskStorage` instances per route group (post media, chat attachment, wall post), each with its own `limits.fileSize` and `files`. The existing 5 MB `memoryStorage` post-photo route and the profile-photo routes can stay as they are until reworked.
- **Models**: `Post` gains `attachments[]` (`{ kind: image|video|audio|file|link, path, posterPath, mime, size, durationMs, name, preview }`) and `repostOf`; `Message.content` is `required` today, so it must become optional when an attachment is present. These are schema changes for the roadmap, listed here because the stack choices above dictate the stored fields (Storage paths, never URLs, matching the current convention).
- **Listing**: add `exactLocation` (private) and `area` (RU/EN names); `location` becomes the snapped point. `neighbourhoodCoords` in the detail response stays the snapped value.
- **Storage rules**: `storage.rules` is `allow read, write: if true`. The backend uses the Admin SDK (bypasses rules), so set `if false` before any real deployment, otherwise any client holding the default bucket name can read and write all media directly.
- **Mobile i18n rollout**: wrapping every existing screen's literals is the bulk of the work. Introduce `t()` only through the shared screen components and each screen as it is touched; do not translate backend-supplied strings.

## Gaps and verification flags

- **Hermes `Intl.PluralRules` (MEDIUM):** the Hermes Intl doc I could fetch lists Collator, NumberFormat, DateTimeFormat and getCanonicalLocales only, and may predate Hermes V1. The polyfill makes this moot; add a one-line unit/smoke check that `t('friends', { count: 2 })` yields the "few" form in the release APK.
- **Yandex Music OG scraping (MEDIUM):** works today with a Twitterbot-style UA on `music.yandex.ru/<type>/<id>`; undocumented and subject to anti-bot changes. Build the generic fallback card first.
- **ffmpeg remux (MEDIUM):** `-c copy` into MP4 assumes H.264/HEVC + AAC, true for Android camera and gallery videos. Exotic inputs (webm/VP9/Opus, some .mkv) can fail remux; reject with a clear "unsupported format" error rather than adding a transcode path.
- **Write-signed URLs on the Storage emulator (unverified):** only relevant if the direct-upload scale-out path is taken; test before committing to it.
- **Hosting target unknown:** disk staging assumes a writable temp directory. On hosts where `/tmp` is memory-backed (e.g. Cloud Run), staged files consume RAM, so the 100 MB cap and cleanup in a `finally` block matter. Always `unlink` the temp file.
- **Dev-client rebuild required:** RNGH, Reanimated, expo-video, expo-audio, expo-image and the localization plugin all add native code; the sideloaded APK pipeline must produce a fresh build before any v1.1 UI can be tested on-device.

## Sources

- Expo SDK 57 docs (HIGH, official, fetched 2026-10-13): [expo-video](https://docs.expo.dev/versions/v57.0.0/sdk/video/), [expo-audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/), [expo-document-picker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/), [expo-image](https://docs.expo.dev/versions/v57.0.0/sdk/image/), [expo-image-picker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), [expo-video-thumbnails (deprecated)](https://docs.expo.dev/versions/v57.0.0/sdk/video-thumbnails/), [expo-file-system](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/), [expo-localization](https://docs.expo.dev/versions/v57.0.0/sdk/localization/), [expo-sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/), [Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/), [Gesture Handler](https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler/), [Localization guide](https://docs.expo.dev/guides/localization/)
- SDK 57 pinned versions (HIGH): `mobile/node_modules/expo/bundledNativeModules.json` (expo-video ~57.0.0, expo-audio ~57.0.0, expo-document-picker ~57.0.0, expo-localization ~57.0.0, expo-image ~57.0.0, expo-sharing ~57.0.1, react-native-gesture-handler ~2.32.0, react-native-reanimated 4.5.0, react-native-worklets 0.10.0; no `expo-av`)
- npm registry (HIGH for versions and dates, queried 2026-10-13): react-native-zoom-toolkit 5.1.1, react-native-awesome-gallery 0.4.3, react-native-image-viewing 0.2.2, @likashefqet/react-native-image-zoom 4.3.0, @nandorojo/galeria 3.1.0, i18next 26.4.4, react-i18next 17.0.16 (peer i18next >= 26.2.0), intl-pluralrules 2.0.1, sharp 0.35.5, ffmpeg-static 5.3.0 (GPL-3.0-or-later), fluent-ffmpeg 2.1.3 (deprecated notice), file-type 22.1.1, react-native-compressor 2.0.3 (peer react-native-nitro-modules)
- react-native-zoom-toolkit [repo](https://github.com/Glazzes/react-native-zoom-toolkit) (MEDIUM; compatibility inferred from its devDependencies RNGH ~2.28 / Reanimated ~4.1 / RN 0.83-0.85 plus Expo-compatible claim; not tested on SDK 57 here, so smoke-test early in the viewer phase)
- Live endpoint checks (HIGH, performed 2026-10-13): YouTube oEmbed, Spotify oEmbed, Yandex Music OG behaviour as described above
- [Google Geocoding reverse requests](https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding) (HIGH, official); [Maps Platform pricing FAQ](https://developers.google.com/maps/billing-and-pricing/faq) and a [summary of the March 2025 pricing change](https://www.storelocatorwidgets.com/blogpost/20499/New_Google_Maps_API_free_credit_system_from_March_1st_2025) (MEDIUM)
- [CVE-2026-61704 link-preview-js DNS rebinding SSRF](https://securelayer7.net/lab/cve-2026-61704-link-preview-js-dns-rebinding-ssrf-bypass) (MEDIUM, third-party write-up)
- [Hermes Intl API doc](https://raw.githubusercontent.com/facebook/hermes/main/doc/IntlAPIs.md) (MEDIUM, may predate Hermes V1)
- Existing code read for integration points: `mobile/src/services/api.ts`, `mobile/src/utils/media.ts`, `mobile/app.config.js`, `backend/src/services/storageService.js`, `backend/src/routes/posts.js`, `backend/src/models/Listing.js`, `backend/src/controllers/listingController.js`, `backend/src/config/firebase.js`, `storage.rules`
