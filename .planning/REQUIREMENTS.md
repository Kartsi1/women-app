# Requirements: WomenApp

**Defined:** 2026-10-13 (milestone v1.1 — Социальные функции и медиа)
**Core Value:** A verified, women-only space where any woman can find safe housing and trusted community wherever she is in the world.

v1.0 requirements (VERI, PROF-01..04, LIST, REQT, MSG, COMM, REVW) shipped — archived in `.planning/milestones/v1.0/REQUIREMENTS.md`.

## v1.1 Requirements

### Language (I18N)

- [ ] **I18N-01**: User sees every interface string in Russian or English
- [ ] **I18N-02**: On first launch the interface is in Russian (default language RU)
- [ ] **I18N-03**: User can switch language (RU/EN) in the profile; the choice persists and applies immediately without restart
- [ ] **I18N-04**: User sees correct Russian plural forms ("1 подруга / 2 подруги / 5 подруг") and dates formatted for the chosen language
- [ ] **I18N-05**: User receives server error messages and push notifications in her chosen language

### Approximate Housing Area (AREA)

- [ ] **AREA-01**: User sees a listing on the map and in details as a ~500 m circle with a stable offset instead of the exact point
- [ ] **AREA-02**: User sees the district name of a listing
- [ ] **AREA-03**: Only the host and a guest with an accepted stay request see the exact address
- [ ] **AREA-04**: API responses never contain exact listing coordinates or distances; existing v1.0 listings are migrated to the approximate scheme

### Media Foundation (MEDIA)

- [ ] **MEDIA-01**: User can upload photos, videos, audio and files with progress, cancel and retry
- [ ] **MEDIA-02**: Uploaded media is stripped of metadata (GPS/EXIF), including already-uploaded v1.0 photos
- [ ] **MEDIA-03**: Unsupported or dangerous files are rejected with a clear message (content-based type check, size/duration limits)
- [ ] **MEDIA-04**: User can open photos and videos full-screen: pinch-zoom, swipe between attachments, swipe down to close, video controls
- [ ] **MEDIA-05**: Video and audio play in feed and chats without breaking after pause; only one player plays at a time

### Profile (PROF)

- [ ] **PROF-05**: Profile shows cover image, avatar, name, verification badge, status line and city
- [ ] **PROF-06**: User can optionally fill age (computed from a private birth date), education, work, hobbies, hometown and "looking for" (friends, love, colleague, party, help, etc.)
- [ ] **PROF-07**: Filled fields are visible to all verified members under "More info"; per-field hiding is enforced server-side (no settings UI yet)
- [ ] **PROF-08**: Profile has a wall with the owner's posts (text, photos, video), newest first
- [ ] **PROF-09**: Profile has tabs "Main", "Posts" and "Photos" (grid of all wall photos)
- [ ] **PROF-10**: From another member's profile user can add friend, follow, or send a message

### Friends & Followers (SOC)

- [ ] **SOC-01**: User can send a friend request; until accepted, the requester follows the recipient's wall
- [ ] **SOC-02**: Recipient can accept, decline (silently, fully severing the connection) or the requester can cancel; incoming requests are listed with a badge
- [ ] **SOC-03**: User can unfriend and unfollow
- [ ] **SOC-04**: Friend and follower counts are visible to all; friends list visible to owner and her friends; followers list visible only to the owner
- [ ] **SOC-05**: User sees the number of mutual friends on profiles and requests
- [ ] **SOC-06**: Friends can message each other directly without a message request
- [ ] **SOC-07**: Blocked users disappear for each other everywhere: feed, wall, lists, reposts, chats
- [ ] **SOC-08**: Friend requests are rate-limited (anti-spam)

### Community Posts (POST)

- [ ] **POST-01**: User can attach multiple photos, a video, an audio file or a file to a community post
- [ ] **POST-02**: Spotify, YouTube and Yandex Music links render as preview cards
- [ ] **POST-03**: User can repost a community post to her wall with a comment; a repost of a repost points to the original
- [ ] **POST-04**: A repost of a deleted post or blocked author shows "Post unavailable"; authors can disable reposts of their post

### Chat Attachments (CHAT)

- [ ] **CHAT-01**: User can send photos and videos in DMs and city chats
- [ ] **CHAT-02**: User can send files in DMs
- [ ] **CHAT-03**: An attachment is delivered as exactly one message even on reconnect; non-participants cannot obtain its URL
- [ ] **CHAT-04**: Attachments are not allowed in pending message requests
- [ ] **CHAT-05**: Conversation list previews attachments in the user's language ("📷 Фото")

## v2 Requirements

- **PROF-11**: User can choose which profile fields are hidden (settings UI)
- **POST-05**: User can restrict a post's audience to friends
- **SOC-09**: User can search members by name
- **CHAT-06**: User can browse a conversation's media gallery
- **CHAT-07**: User can send files in city chats
- **ACCT-01**: User can delete her account in-app (Google Play requirement — mandatory before store release)
- **EVNT-01..03**: Local events (create, browse by city/map, RSVP)
- **NOTF-01**: Remote push notifications (requires EAS projectId + FCM)
- **SAFE-01..03**, **PAY-01**, **PLAT-01** — carried over from v1.0

## Out of Scope

| Feature | Reason |
|---------|--------|
| Public follower lists | Enables stalking in a women-safety product |
| "People you may know" | Graph exposure / stalking vector |
| Online / last-seen status | Location/activity tracking risk |
| Server-side video transcoding | Infra cost; cap + remux instead |
| AI/automated moderation | Manual moderation in MVP |
| Declined request leaves follower | Safety: decline fully severs connection |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| I18N-01 | Phase 4 | Pending |
| I18N-02 | Phase 4 | Pending |
| I18N-03 | Phase 4 | Pending |
| I18N-04 | Phase 4 | Pending |
| I18N-05 | Phase 4 | Pending |
| AREA-01 | Phase 5 | Pending |
| AREA-02 | Phase 5 | Pending |
| AREA-03 | Phase 5 | Pending |
| AREA-04 | Phase 5 | Pending |
| MEDIA-01 | Phase 8 | Pending |
| MEDIA-02 | Phase 8 | Pending |
| MEDIA-03 | Phase 8 | Pending |
| MEDIA-04 | Phase 8 | Pending |
| MEDIA-05 | Phase 8 | Pending |
| PROF-05 | Phase 6 | Pending |
| PROF-06 | Phase 6 | Pending |
| PROF-07 | Phase 6 | Pending |
| PROF-08 | Phase 9 | Pending |
| PROF-09 | Phase 9 | Pending |
| PROF-10 | Phase 7 | Pending |
| SOC-01 | Phase 7 | Pending |
| SOC-02 | Phase 7 | Pending |
| SOC-03 | Phase 7 | Pending |
| SOC-04 | Phase 7 | Pending |
| SOC-05 | Phase 7 | Pending |
| SOC-06 | Phase 7 | Pending |
| SOC-07 | Phase 7 | Pending |
| SOC-08 | Phase 7 | Pending |
| POST-01 | Phase 8 | Pending |
| POST-02 | Phase 8 | Pending |
| POST-03 | Phase 9 | Pending |
| POST-04 | Phase 9 | Pending |
| CHAT-01 | Phase 10 | Pending |
| CHAT-02 | Phase 10 | Pending |
| CHAT-03 | Phase 10 | Pending |
| CHAT-04 | Phase 10 | Pending |
| CHAT-05 | Phase 10 | Pending |

**Coverage:**
- v1.1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---
*Requirements defined: 2026-10-13*
*Last updated: 2026-10-13 after v1.1 roadmap creation (traceability mapped)*
