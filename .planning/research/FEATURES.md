# Feature Research

**Domain:** Women-only, document-verified social + housing platform (v1.1 social/media layer on top of v1.0)
**Researched:** 2026-10-13
**Confidence:** MEDIUM-HIGH. Core social-graph, media and privacy patterns are well established (VK, Instagram, Facebook, Airbnb, Couchsurfing) and were cross-checked against public docs where possible. Yandex Music link previews are LOW confidence (no public oEmbed found). Moderation-volume and storage-cost estimates are judgement, not measured.

Scope note: this covers ONLY the v1.1 features (VK-style profile and wall, friends/followers, rich media, reposts, full-screen viewer, chat attachments, RU/EN, approximate housing area). Existing v1.0 features are treated as dependencies.

---

## Feature Landscape

### Table Stakes (Users Expect These)

#### A. Profile and wall (VK-style)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cover + avatar + name + verified badge header | Defines "VK-style profile"; avatar already exists | LOW-MED | Cover = second image slot using the same upload path as avatar. Needs a graceful placeholder and an `onError` fallback (already done for avatar in v1.0). |
| Status line (short free text, ~140 chars) | Signature VK element | LOW | Plain text only, no links/markup. Counts as UGC (reportable, admin-editable). |
| Home city (existing) + hometown | Travelers orient on "where she lives / where she is from" | LOW | City-level only, picked from a Places autocomplete, never a free-text address. Store a canonical place key, not just a localized name (see RU/EN). |
| "More info" section with optional fields: age, education, work, hobbies, hometown, looking-for | Explicit user requirement | MED | All optional, all empty-by-default. Render only filled fields; hide the whole section if empty. |
| Age shown as a number, computed from birth date/year | Standard; exposing DOB is a safety and ID-theft liability | LOW | Store birth year (or full date) privately, expose only age. Do not reuse the verification document data. |
| "Looking for" multi-select enum: friends, love, colleague, party, help | Explicit user requirement | LOW | Store enum keys, localize labels client-side. Multi-select recommended (one value is too restrictive). |
| Per-field visibility in the data model (no UI yet) | User decision: all visible by default, model must allow hiding | MED | See "Visibility model" below. The server serializer must enforce it, not the client. |
| Wall: author's own posts (text, photo, video) in reverse-chronological order | Core of a VK profile | MED | Reuse the community post model. Add a `scope`/target (`community` city feed vs `wall`) rather than a second post collection. |
| Tabs: Main / Posts / Photos | Requested tab structure | MED | Main = header + info + short wall preview. Posts = full wall. Photos = grid of the member's photo attachments, opens in the full-screen viewer. |
| Own-profile edit for all new fields, cover, status | Required to create any data | MED | Extend the existing "own-profile projection on update" pattern. Whitelist updatable fields; never mass-assign. |
| Wall post delete/edit by owner; likes and comments on wall posts | Parity with the community feed | LOW | Reuse existing likes/comments/report components. |
| Block-aware profile view | v1.0 block exists; new surfaces must honor it | LOW-MED | Blocked in either direction: no profile, wall, friend request, repost, DM or listing visibility. Easy to miss on each new endpoint, so centralise the check in middleware. |

#### B. Friends and followers (VK semantics)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Add friend" -> pending request -> accept/decline | Core requirement | MED | One action. Pending request = the sender is a follower (user decision). No separate "Follow" button needed. |
| Incoming-requests inbox with badge | Users must see and act on requests | LOW-MED | Reuse the message-request badge/local-notification pattern and the per-user socket room already added in v1.0. |
| Cancel outgoing request; unfriend | Basic reversibility | LOW | Unfriend removes the friendship fully (see anti-features for the VK "residual follower" behavior). |
| Friend count and follower count on profile | Requested | LOW-MED | Denormalised counters updated transactionally, with a recount job. Only count verified, non-banned, non-blocked accounts. |
| Friends list screen (own) and friends tab | Expected once friends exist | MED | Paginated. Visibility rules in the Safety section. |
| Relationship state on every profile and on author rows | The button must show: Add / Pending / Friends / Accept | LOW-MED | One `relationship` field in the profile payload (none / outgoing / incoming / friends / blocked). |
| "Message" action from profile (reuses message-request flow) | Requested ("request to chat from profile") | LOW | Non-friend -> creates a message request (existing). Friend -> opens the DM directly (see differentiators). |
| Remove follower / decline request that does not leave a trace | Protects against persistence | LOW | See Safety. |
| Rate limits on friend requests | Spam and harassment control | LOW | Max outgoing pending (for example 50), per-day cap, cooldown after cancel/decline re-send to the same person. |

#### C. Rich media in community posts

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multiple attachments per post (replacing the single photo) | Any "rich media" feed has more than one item | MED-HIGH | Introduce `attachments: [{type, mediaId, ...}]`. Keep reading legacy `photo` for v1.0 posts (backward-compatible migration). Suggested caps: up to 10 photos, at most 1 video, 1 audio/music link, up to 3 files per post. |
| Video upload with thumbnail and inline player | Requested | HIGH | Cap duration (about 60-90 s) and size (about 50 MB), compress on the client at pick time, generate a poster frame, serve progressive MP4. Do NOT build server-side transcoding in v1.1. |
| Uploaded audio file with inline player (play/pause/seek) | Requested | MED | Size cap (about 15-20 MB), common formats (mp3, m4a, ogg/opus), show title (filename or ID3). Playback must stop when the screen leaves. |
| Music service link with preview card (Spotify, YouTube, Yandex Music) | Requested | MED | Card = provider badge, title, artist, cover; tap opens the external app/browser. Spotify and YouTube expose oEmbed (no key for basic use). Yandex Music: no public oEmbed found, so fall back to server-side Open Graph tags (LOW confidence, verify in the phase). Never hit the URL from the client; resolve on the server. |
| File attachments (documents) with name, size, type icon | Requested | MED | Allowlist (pdf, doc/docx, xls/xlsx, ppt/pptx, txt, zip optional). Block executables including .apk. Open via the system handler; no inline rendering. |
| Upload progress, retry, cancel; post stays as draft on failure | Mobile uploads fail constantly | MED | Optimistic UI with a sending/failed state, like the existing optimistic-message dedupe. |
| Report path covering media and attachments | Google Play UGC policy requires in-app report and block for UGC apps | LOW-MED | Extend existing report targets to media, wall posts, reposts, cover images. The admin queue must show the media. |
| Authenticated media delivery | Photos of verified women must not be publicly guessable | MED | No public bucket. Signed expiring URLs or an authenticated proxy. Matters more now that profiles and chats hold lots of media. |
| EXIF/GPS stripping on every image and video | Photos leak home location and travel patterns | MED | See Safety. Mandatory, not optional. |

#### D. Reposts

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Repost a community post to your own wall, with optional comment | VK behavior, requested | MED | Store a reference to the original (`repostOf`), not a copy. Original deleted/hidden/blocked -> the repost shows "Original unavailable". Reposting a repost flattens to the original. |
| Repost count and attribution ("Reposted from X") | Credit and context | LOW | Link to the original author's profile (subject to block rules). |
| Author control: allow/disallow reposts per post (default allow) | Content spread control, see Safety | LOW | One boolean on the post. Cheap to add now, painful later. |

#### E. Full-screen media viewer

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pinch/double-tap zoom, swipe between items, swipe-down to dismiss | Baseline of every viewer | MED | Android back button closes; handle the edge-to-edge insets already fixed in v1.0. |
| Video playback with controls (play, seek, mute), rotate to landscape | Video without this feels broken | MED | Single shared player instance, pause on dismiss. |
| Opens from posts, wall, Photos tab, avatar/cover, chat attachments | Consistency | MED | One viewer component with a data-source adapter. |
| Report action inside the viewer | Play UGC policy, fastest place to report | LOW | Reuse report sheet. |
| Audio and files are NOT in the viewer | They open in the player or the system | LOW | Avoids scope creep. |

#### F. Chat attachments (DM and city group chats)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Photo, video, file in DMs and city chats | Requested | HIGH | `attachments[]` on messages; Socket.io payload carries media refs only, uploads go over REST/signed URLs, never through the socket. |
| Upload progress, failed-send retry, thumbnail in bubble | Messenger baseline | MED | Optimistic message first, attach media refs after upload completes. |
| Tap thumbnail -> full-screen viewer | Consistency | LOW | Same viewer. |
| Block/report applies to attachments | UGC policy | LOW-MED | Reporting a message must preserve the attachment for the admin even if the sender deletes it. Soft-delete with retention. |
| Same size/type allowlist as posts | One policy | LOW | Shared server-side validator. |

#### G. RU/EN language

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All UI strings in RU and EN | Requested; project says global from day one | MED-HIGH | The cost is the sweep over every existing screen, not the library. Build the i18n layer first so all new v1.1 screens are written with keys from the start. |
| Default from device locale, manual switcher, persisted | Standard | LOW | Persist locally. Also persist on the user record so server-generated text matches. |
| Correct Russian plurals (1/2-4/5+) | Counters (friends, followers, likes, reposts) are everywhere in v1.1 | LOW-MED | Use a library with ICU/CLDR plural support. Concatenated strings will be wrong. |
| Enum labels localized client-side (looking-for, report reasons, listing types) | Prevents mixed-language data | LOW | Store keys, never localized text. |
| Server messages as codes, not prose | Errors, validation, system chat messages, notifications | MED | Return machine codes, translate on the client. Where the server must produce text (notification titles, emails), use the stored user language. |
| Dates, numbers, relative time in the active locale | Expected | LOW | |

#### H. Approximate housing area

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Public map shows an approximate circle/area, not an exact pin | Explicit requirement, and the single biggest safety item in the milestone | MED-HIGH | Airbnb pattern: a shaded circle before booking, exact address only after a confirmed reservation ([Airbnb Help](https://www.airbnb.ca/help/article/2141)). |
| Exact coordinates and address stored privately; absent from every public API response | Hiding on the client only is useless | MED | Remove from list, detail, map and search payloads. Return only the approximate centre and radius. |
| Exact location revealed to a guest only after the host accepts her stay request | Maps onto the existing stay-request flow | MED | Gate on `stayRequest.status === accepted` and that specific guest. Decide a window (for example until stay end plus a few days). |
| District/locality label ("Tverskoy", "Kreuzberg") | The "district" wording in the requirement | LOW-MED | From Places/reverse-geocode sublocality, fall back to locality. Naming varies by country, so do not promise "district". |
| Migration of existing v1.0 listings | Existing exact pins are already exposed | MED | Backfill approximate geometry, strip exact from public responses, tell hosts. |
| Stable obfuscation (deterministic per listing) | Re-randomising per request lets an observer average the noise back to the true point | MED | Compute the offset once and store it; the circle must contain the true point but not be centred on it. Do not regenerate on small edits. |
| Coarse or hidden distance | "1.2 km away" values from several viewpoints can trilaterate the address | LOW-MED | Round distance to buckets (for example 1 km) or drop it. |

---

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mutual friends shown on profiles, stay requests and message requests | Turns the friend graph into a trust signal for the core use case (staying with a stranger), which Couchsurfing-style apps lack | MED | Show a count and a few avatars; this is more privacy-safe than exposing whole friend lists. |
| Friends skip the message-request step | Rewards the graph, keeps strangers gated | LOW-MED | If friendship exists, create/open the DM directly. |
| No attachments in pending message requests (text only until accepted) | Blocks cyberflashing and abusive media from strangers; Bumble made unsolicited lewd images a headline safety issue | LOW | One server check. High safety value for almost no cost. |
| Verified-only graph | Every follower and friend is a document-verified woman | N/A | Already true, so surface it ("all members verified") rather than building it. |
| Housing trust card on profile: verified badge, reviews, mutual friends, account age | Profile doubles as a host/guest reference | LOW-MED | Reuses existing stats and reviews. |
| Conversation media gallery (all photos/files in a chat) | Convenience, common in messengers | MED | Defer unless viewer work finishes early. |
| Per-post audience (everyone / friends only) | VK, Facebook and Instagram parity, and the most requested privacy control later | MED | Not in v1.1 UI, but reserve `audience` on posts and wall posts now. |
| Link-based music cards (no hosting of copyrighted audio) | Social music sharing with low copyright exposure | MED | The user also asked for uploaded audio, so support both, with the upload path behind caps and a report route. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Anyone can post on your wall (VK allows this) | VK parity | A harassment and spam channel in a safety-first product; needs per-wall moderation | Wall = owner's posts and reposts only. Others interact via comments. |
| Public followers list | VK shows it | Lets someone enumerate a woman's audience, find her via her contacts, and spot who is watching her | Counts public to members; full lists visible only to the owner (followers) or friends (friends). |
| VK "decline leaves the sender as a follower" | Mirrors VK | The declined woman keeps seeing and watching the profile; reads as stalking | Decline = delete the request entirely. Cancel and unfriend also leave no residual follower. Only a pending request counts as follower (user decision). |
| "People you may know" with contact import or location | Growth | Leaks the graph, exposes who knows whom, can surface an abuser or ex to a victim | None in v1.1. Discovery through feed, chats, listings, mutual friends only. |
| Global people search by name | Needed to find friends | Easy way to locate a specific woman; unclear what needs hiding | Defer. Add later with filters (same city, mutual friends) and honor visibility flags. Flagged as an open question below. |
| Online/last-seen status and "nearby members" | Social cues | Stalking aids, not requested | Do not add presence or live location. |
| Exact pin or street address shown on listings, even "temporarily" | Easier for guests | Direct physical-safety risk to hosts, and to women in need staying in free listings | Approximate circle, exact only after acceptance, per guest. |
| Downloading others' photos/videos in-app | Convenience | Weakens takedown and consent | No "save" in the viewer in v1.1 (screenshots cannot be prevented; do not add an official route). |
| Server-side video transcoding pipeline | Cleaner playback | Large infra and cost increase for MVP | Client-side compression at pick time, hard duration/size caps, serve progressive MP4. |
| In-app playback of Spotify/Yandex/YouTube tracks via embeds/SDKs | "Real" music player | SDK auth, licensing, WebView embeds, Expo-managed limits | Preview card + open in the provider's app. |
| Global music search or library | Spotify-like feel | Licensing and scope | Links and uploads only. |
| Machine translation of user content | RU/EN audience | Cost, quality, moderation ambiguity | Translate only UI. Show posts in the author's language. |
| Arbitrary file types (apk, exe, scripts) | "Files" is open-ended | Malware vector on Android, spreads through group chats | Allowlist of document types, check MIME and extension and magic bytes. |
| Public/guessable media URLs | Simplest to build | Verified women's photos leak outside the verified perimeter | Signed URLs or authenticated proxy. |
| Reposting into chats and groups in v1.1 | VK has it | Widens scope, a privacy blast radius | Repost to wall only. |
| Automated NSFW/AI moderation | Scale | Out of scope for v1.1 and conflicts with the manual-moderation decision | Reports, admin queue, no attachments in message requests, rate limits. Revisit when volume demands. |

---

## Safety Implications Specific to This Milestone

These are the cross-cutting design rules the roadmap should treat as requirements, not polish.

1. **Location leakage (highest severity).**
   - Approximate area must be enforced in the API, not the client.
   - Remove exact coordinates from every public payload and from search/sort responses (distance buckets).
   - Backfill existing listings.
   - Strip GPS EXIF from every image and video on the server. Prefer server-side re-encode for images and a metadata-strip remux for video; do not trust client flags such as `exif: false`.
   - Listing/profile text fields can contain addresses; add a gentle warning, not blocking.
   - Hometown + work + education together can be enough to identify a person, which is another reason for the per-field model.
2. **Friend-graph privacy / stalking.**
   - Counts public, lists not.
   - Mutual friends as a trust signal instead of full-list exposure.
   - No suggestions engine.
   - Declines and unfriends leave no trace.
   - Block removes friendship, follows and pending requests in both directions and hides the blocker everywhere.
3. **Reposting others' content.**
   - Reference, not copy, so deletion and moderation propagate.
   - Author can disable reposts.
   - Only visible-to-reposter content can be reposted.
   - Block between reposter and original author hides the repost from the author's side.
   - Reports on the original remove all reposts.
   - Repost-of-repost flattens to the original.
4. **Media moderation without AI.**
   - Report on every media surface including chat attachments.
   - Admin queue shows media inline and can remove one attachment without deleting the whole post.
   - Messages keep reportable attachments after sender-side delete.
   - No attachments in pending message requests.
   - Rate limits per user on uploads and friend requests.
   - Expect moderation workload to rise sharply when video and files arrive; plan for the admin tooling in the same phase.
5. **Visibility model.**
   - Store per-field visibility as `visibility: { fieldName: 'all' | 'friends' | 'me' }` (default `all`), or a minimal `hidden` set. Either way the serializer takes the viewer's relationship and strips fields; a self-view and an admin view bypass it.
   - "Looking for: help" and "love" are the most sensitive values (they signal vulnerability or romantic intent in a platform that also hosts women in need). Defaulting to visible-to-all follows the user's decision, but this is the first thing to expose in settings UI once added. Recommend the roadmap lists the per-field settings UI as the top follow-up.
6. **Account lifecycle.**
   - Ban or deletion must cascade: friend edges, counters, reposts ("Original unavailable"), media refs and storage objects.
   - Google Play requires an in-app account deletion path for apps with accounts; check whether v1.0 has one and add if missing (not verified in this research).
7. **Store policy.** Google Play UGC policy requires terms acceptance, in-app reporting, blocking and ongoing moderation ([Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937)). The v1.0 base satisfies the core; the new media surfaces must plug into the same mechanisms.

---

## Feature Dependencies

```
Media pipeline (upload, validation, EXIF strip, thumbnails, signed delivery)   [NEW, foundational]
    |-- required by --> Rich media in posts (video / audio / files)
    |-- required by --> Cover image + Photos tab
    |-- required by --> Chat attachments (DM + city)
    |-- required by --> Full-screen viewer (consumes media refs)

Attachments data model (attachments[] on posts and messages; legacy photo compat)
    |-- required by --> Rich media posts, Wall posts, Chat attachments, Reposts

Post scope/target (community | wall) + audience + allowReposts   [reserve fields now]
    |-- required by --> Wall
    |-- required by --> Reposts (reposting target = own wall)

Profile v2 (new fields + visibility model + serializer)
    |-- required by --> Wall tabs, Friends UI on profile, "More info"
    |-- required by --> Mutual-friends trust card

Friends/followers graph (edges, states, counters, rate limits)
    |-- requires --> Block system (v1.0)
    |-- enhances --> Message requests (friends skip request)
    |-- enhances --> Stay requests (mutual friends)

Approximate area
    |-- requires --> Listings + Google Maps search (v1.0)
    |-- requires --> Stay requests (v1.0) as the reveal gate
    |-- independent of --> all social features (can ship first)

i18n layer
    |-- should precede --> every new screen (retrofit cost grows with each screen)
    |-- touches --> server error codes, notifications, enum labels, city identity

Music link previews
    |-- requires --> Server-side URL resolver (allowlist, timeouts, SSRF guard)

Message-request flow (v1.0) <--gates--> Chat attachments (no media in pending requests)
Report/admin moderation (v1.0) <--must extend to--> media, wall, reposts, cover
```

### Dependency Notes

- **Media pipeline is the real foundation.** Every headline feature (video, audio, files, cover, chat attachments, viewer) depends on one generic `Media` model and upload path. Building each feature's own uploader would duplicate validation, EXIF stripping and moderation hooks.
- **Wall is a view over posts, not a new product.** Making wall posts a `scope` of the existing post model reuses likes, comments, reports and the feed UI, and makes reposting a natural extension.
- **Friends require the profile payload to carry `relationship`.** Do the profile serializer (with the visibility filter and relationship state) before friends UI.
- **Approximate area is independent** and fixes a live exposure from v1.0, so it can ship in parallel or first.
- **i18n affects city chats.** City group chats are currently keyed on city; if the key is a localized name, RU and EN users split into separate "Moscow" and "Москва" rooms. Verify that chats and listings key on a canonical place id before changing display language. This is a dependency check on existing code, not yet verified here.
- **Authenticated retry vs uploads.** The existing 401 refresh-and-retry in `authFetch` must re-create multipart bodies; a consumed upload stream cannot simply be replayed.
- **Reposts depend on the wall and on post visibility rules.** Reposting must reuse the same viewer-visibility check as the feed.
- **Existing items to extend, not rebuild:** report/block, message requests and badge/local notification, per-user socket room, optimistic message dedupe, own-profile update projection, admin moderation screens, stay requests.

---

## MVP Definition

### Launch With (v1.1)

Suggested build order follows dependencies; items marked (S) are safety-critical.

1. **Approximate housing area** (S) and listing backfill. Independent, closes a live exposure.
2. **i18n layer (RU/EN) with switcher** and the canonical city-key check. Done before the new UI is written, so v1.1 screens are born localized; then sweep the old screens.
3. **Media pipeline + attachments model + full-screen viewer** (S: EXIF strip, signed delivery, validators). Foundation for the rest.
4. **Rich media in community posts** (multi-photo, video, uploaded audio, music link cards, files) plus report/admin support for media.
5. **Profile v2 + wall + tabs** (cover, status, More info, visibility model, wall as post scope).
6. **Friends/followers** (request/accept, counters, relationship state, rate limits, mutual friends, friends skip message request, privacy rules above).
7. **Reposts** (to wall, reference-based, allowReposts flag).
8. **Chat attachments** (DM + city; no media in pending requests; reportable after delete).

If the milestone must shrink, cut in this order: file attachments, conversation gallery, Photos tab polish, music cards for Yandex Music (keep Spotify/YouTube), uploaded audio.

### Add After Validation (v1.x)

- [ ] Per-field visibility settings UI (the data model already supports it) - trigger: first user complaint or moderator report about sensitive fields.
- [ ] Per-post audience (friends only) - trigger: users asking to post privately.
- [ ] People search (same-city, mutual-friend filters) - trigger: friends graph is sparse because discovery is too hard.
- [ ] Conversation media gallery.
- [ ] Remote push for friend requests and messages (already on the Active list; needs EAS projectId + FCM).
- [ ] Voice messages in chats.
- [ ] Tap-to-reveal / blurred media for non-friends.

### Future Consideration (v2+)

- [ ] Automated media scanning (NSFW and malware) - needed when manual moderation stops scaling.
- [ ] Server-side video transcoding and adaptive streaming.
- [ ] Events (deferred from v1.0); sharing a listing/event as an attachment.
- [ ] Link previews in chat messages in general.
- [ ] Friend lists/circles and per-circle audiences.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Approximate housing area + exact reveal on acceptance | HIGH (safety) | MEDIUM | P1 |
| EXIF/GPS stripping, authenticated media delivery | HIGH (safety) | MEDIUM | P1 |
| Media pipeline + attachments model | HIGH | HIGH | P1 |
| Full-screen viewer | HIGH | MEDIUM | P1 |
| RU/EN switcher | HIGH | MEDIUM-HIGH | P1 |
| Profile v2 (cover, status, More info) with visibility model | HIGH | MEDIUM | P1 |
| Wall + tabs | HIGH | MEDIUM | P1 |
| Friends + followers (request/accept, counts) | HIGH | MEDIUM | P1 |
| Video and multi-photo in posts | HIGH | HIGH | P1 |
| Chat attachments (photo/video) | HIGH | HIGH | P1 |
| Reposts | MEDIUM | MEDIUM | P2 |
| Music link preview cards | MEDIUM | MEDIUM | P2 |
| Uploaded audio files | MEDIUM | MEDIUM | P2 |
| File attachments (posts and chats) | MEDIUM | MEDIUM | P2 |
| Mutual friends trust signal | HIGH | MEDIUM | P2 |
| No media in pending message requests | HIGH (safety) | LOW | P1 |
| Friends skip message request | MEDIUM | LOW | P2 |
| Per-field visibility settings UI | MEDIUM | MEDIUM | P3 (post-launch) |
| People search | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.1
- P2: Should have, add when possible within v1.1
- P3: Nice to have, future

---

## Competitor Feature Analysis

| Feature | VK / Facebook / Instagram | Couchsurfing / Airbnb / Peanut / Bumble BFF | Our Approach |
|---------|---------------------------|----------------------------------------------|--------------|
| Profile | VK: cover, status, "More info", tabs. Instagram: bio and grid | Couchsurfing: long profile, references. Peanut: selfie-verified profiles | VK layout, but verified-only audience, per-field hide flags, and trust card (verified, reviews, mutual friends). |
| Friends and followers | VK: friends mutual, subscribers separate, friend list public by default, hidden-friends setting ([VK privacy via Kaspersky](https://www.kaspersky.com/blog/vk-privacy/10743/)). Facebook: friends + follow | Peanut: matching and groups, no open graph | VK semantics with tighter defaults: counts public, lists limited, declines leave no trace. |
| Private profile for non-friends | VK allows a closed profile: strangers see name, avatar, wall post count and mutual friends | Peanut limits what non-matches see | Not in v1.1 (all fields visible per user decision); the data model keeps the door open. |
| Message gating | Facebook "Message requests"; Instagram requests | Bumble: women message first; unsolicited image detection | Existing message requests; add no-media-until-accepted. |
| Location privacy on housing | Airbnb: shaded approximate area, exact address after confirmed booking ([Airbnb Help](https://www.airbnb.ca/help/article/2141)) | Couchsurfing: city/neighborhood-level, host chooses to share address | Approximate circle, exact only to an accepted guest. |
| Reposts | VK: repost to wall with comment; Facebook: share | Not core | Repost to own wall only, reference-based, author can disable. |
| Music | VK: built-in audio library | Instagram: licensed music stickers | Uploaded files with caps + link cards; no library. |
| Moderation | Heavy automated + reports | Peanut: selfie verification plus paid human moderators and sensitive-content filters ([Peanut on Wikipedia](https://en.wikipedia.org/wiki/Peanut_App)); Couchsurfing criticised for weak response to harassment and misuse as a hookup platform | Verified-only perimeter, report on every surface, admin tooling to handle media. Treat "looking for: love/party" and DMs as the likely abuse vectors. |
| Link previews | Open Graph unfurling everywhere | Same | Spotify and YouTube via oEmbed ([Spotify oEmbed](https://developer.spotify.com/documentation/embeds/tutorials/using-the-oembed-api)); Yandex Music via OG scrape, to be verified. |

---

## Open Questions for the Roadmap

1. Friends list visibility: recommended friends-only (counts public), but the user decision says "all fields visible". Does that include the friends list? Decide before building the profile serializer.
2. Who can use "Add friend": any verified member (recommended), or only after a DM/message-request acceptance? Open is VK-like and simpler.
3. Is the community feed city-scoped or global? A repost onto a wall moves content across cities.
4. Audio upload copyright stance (terms text, report reason "copyright") and whether to launch with uploads at all in v1.1 (cut candidate).
5. How long an accepted guest keeps access to the exact address.
6. People search: a v1.1 need, or acceptable to rely on feed/chat/listing entry points?
7. Check that v1.0 has an in-app account deletion path (Google Play requirement); not verified here.

## Sources

- [Airbnb Help: how location is shown and when the exact address is shared](https://www.airbnb.ca/help/article/2141) (MEDIUM; official help page, plus a search summary noting a March 2026 policy change to share the exact address at confirmation)
- [Kaspersky: VK.com privacy settings (hidden friends, closed profile)](https://www.kaspersky.com/blog/vk-privacy/10743/) (MEDIUM; third-party, publication date not checked, VK UI may have changed)
- [Google Play Developer Policy: User Generated Content](https://support.google.com/googleplay/android-developer/answer/9876937) (HIGH; official)
- [Spotify Developer: using the oEmbed API](https://developer.spotify.com/documentation/embeds/tutorials/using-the-oembed-api) (HIGH; official)
- [Peanut App (Wikipedia)](https://en.wikipedia.org/wiki/Peanut_App) and App Store listing (MEDIUM; selfie verification, human moderation, sensitive-content filters)
- Couchsurfing safety coverage via search results (e.g., [NSVRC](https://www.nsvrc.org/?p=13634), [Verge Magazine](https://www.vergemagazine.com/articles/budget-travel/2496-how-to-couchsurf-safely-for-women)) (LOW-MEDIUM; journalism and advocacy summaries)
- Facebook/Instagram/Bumble behavior and Yandex Music preview feasibility: training knowledge, not re-verified in this session (LOW-MEDIUM). Verify during phase research.
- Project context: `/home/kartsi/PycharmProjects/women-app/.planning/PROJECT.md`

---
*Feature research for: WomenApp v1.1 social and media layer*
*Researched: 2026-10-13*
