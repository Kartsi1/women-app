# Phase 4: Localization Foundation - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

RU/EN localization layer for the mobile app with Russian as the default language, an in-app language switcher, correct Russian plurals and locale-aware date/time formatting, server error codes and server-originated notification text in the member's language — plus the one-time batch install of all v1.1 native modules and a single release-APK rebuild.

**Scope change from discussion:** the FULL translation of all existing v1.0 mobile screens (I18N-01) moves INTO this phase (previously Phase 10). Phase 10 keeps only chat attachments (CHAT-01..05). ROADMAP.md and REQUIREMENTS.md traceability updated accordingly.

Out of this phase: admin web panel (stays as is), any new product features.

</domain>

<decisions>
## Implementation Decisions

### Tone & terminology (Russian copy)
- **D-01:** Address the user informally — «ты» («Расскажи о себе», «Ты ещё не добавила фото»).
- **D-02:** Feminine grammatical gender everywhere — «ты вошла», «верифицирована», «хозяйка», «гостья», «участница». Never masculine/neutral fallbacks.
- **D-03:** Terminology: «подруги» (friends), «общие подруги», «добавить в подруги», «подписчицы» (followers), «участницы» (members/users). Not «друзья/пользователи/подписчики». Apply in all new keys, including ones pre-created for Phases 6–7.
- **D-04:** App name is «WomenApp» in both languages and on the launcher icon (change Expo `name` from "mobile" to "WomenApp").

### Language switcher
- **D-05:** Primary switcher lives on a new «Настройки / Settings» screen opened from the profile (gear button). Settings screen holds Language and Sign out now; future home for field visibility and account deletion.
- **D-06:** Selector style: list with a checkmark («Русский ✓ / English») — extensible to more languages.
- **D-07:** A small, unobtrusive RU|EN toggle on the sign-in / sign-up screens so a non-Russian speaker can register in English before logging in.
- **D-08:** Language follows the account: persisted locally AND saved to the server (`User.locale`). On login on a new device the server value is applied. The server uses it for push / socket notification text.
- **D-09:** First launch (no stored choice, not logged in) → Russian, regardless of device language (I18N-02).
- **D-10:** Switching applies immediately to all screens without app restart.

### Translation scope
- **D-11:** Translate ALL existing v1.0 mobile screens in this phase (auth, verification, housing/map/listings, stay requests, messages/DM/city chat/message requests, community feed/posts/comments, reviews, profile/edit/view, alerts, empty states, errors). No mixed-language UI after this phase.
- **D-12:** Admin panel is NOT translated.
- **D-13:** Server keeps returning the English `error` string (compat with installed v1.0 APKs) and adds a stable `code`; the client maps `code` → localized text, falling back to `error`.

### Dates & time
- **D-14:** Feed posts and comments: relative then absolute — «только что», «5 мин назад», «3 ч назад», «вчера в 18:40», then «12 окт», and «12 окт 2025» for previous years (VK style). English equivalents.
- **D-15:** Chats: time on each bubble («18:40») plus day separators «Сегодня / Вчера / 12 октября» between days (Telegram style).
- **D-16:** 12/24-hour format follows the phone's system setting (Russian is effectively 24h).
- **D-17:** Listing availability ranges compact: «13–30 окт»; year shown only when not the current year or when the range crosses a year boundary.

### Claude's Discretion
- Enum values stored in DB (housing type, report reason, request status, "looking for" options etc.): store stable codes, translate on display — standard approach, Claude decides details.
- i18n library structure, key naming, file layout, typed keys, plural polyfill strategy (research flagged Hermes `Intl.PluralRules` uncertainty — verify in release APK).
- How server push/socket text is localized (small server-side catalog keyed by `User.locale`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/ROADMAP.md` §Phase 4 — goal, success criteria, notes (native module batch list, Hermes Intl spike, error `code` compat, city-room keying check)
- `.planning/REQUIREMENTS.md` — I18N-01..05
- `.planning/PROJECT.md` — v1.1 milestone goals and key decisions

### Research
- `.planning/research/STACK.md` — i18next ^26 / react-i18next ^17 / expo-localization / intl-pluralrules; exact Expo 57 pins for expo-video, expo-audio, expo-document-picker, expo-image, expo-sharing, gesture-handler ~2.32.0, reanimated 4.5.0, worklets 0.10.0, react-native-zoom-toolkit ^5.1.1
- `.planning/research/PITFALLS.md` — i18n pitfalls (Russian plurals one/few/many, hardcoded strings, server prose errors, push text per recipient locale, ISO dates, 20–30% longer RU text)
- `.planning/research/ARCHITECTURE.md` — i18n architecture section (client i18next, server `t(locale,key)`, error `code`, `lastMessageKind`)
- `.planning/research/SUMMARY.md`

### Platform
- Expo SDK 57 docs: https://docs.expo.dev/versions/v57.0.0/ (expo-localization; do not rely on training data — CLAUDE.md requirement)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mobile/src/services/api.ts` `authFetch` — central place to attach `Accept-Language`/locale header and to map error `code` → localized message.
- `mobile/src/services/push.ts` — existing notification channel and local notification helper (server-originated text arrives here).
- `mobile/src/store/*` (zustand) — pattern for a persisted language store (AsyncStorage already installed).
- `mobile/src/navigation/AppNavigator.tsx` — tab labels/titles to localize; ProfileStack is where Settings screen goes.
- `backend/src/services/notificationService.js` + controllers calling `sendPushNotification` with hard-coded English titles/bodies (messageRequestController, requestController, commentController, adminController) — convert to locale-keyed catalog.

### Established Patterns
- All mobile screens currently hard-code English strings inline; StyleSheet.create per screen.
- Backend responds `{ error: 'English text' }` everywhere — add `code` alongside.
- Dates formatted ad-hoc with `toLocaleDateString(undefined, …)` (e.g. MapDiscoveryScreen, ListingDetailScreen) — replace with shared locale-aware helpers.
- City chat rooms keyed by `citySlug` derived from the user-entered `homeCity` string — UI language switch does not split rooms.

### Integration Points
- `User` model: add `locale` ('ru' | 'en'); endpoint to update it (or extend PUT /api/users/profile); returned in GET /api/users/me.
- Root (`App.tsx` / RootNavigator): i18n init before first render; apply server locale after auth.
- `mobile/app.config.js` / `app.json`: app name → WomenApp; native modules batch + expo-localization plugin; one `prebuild` + `assembleRelease`.

</code_context>

<specifics>
## Specific Ideas

- Relative time like VK; chat day separators like Telegram.
- Example plural strings: «1 подруга / 2 подруги / 5 подруг», «3 общие подруги».
- Russian copy should feel warm and community-like, written for women («ты», feminine forms).

</specifics>

<deferred>
## Deferred Ideas

- Admin panel translation to Russian — separate task if needed later.
- Additional languages beyond RU/EN — list-style selector chosen to make this easy later.

</deferred>

---

*Phase: 04-localization-foundation*
*Context gathered: 2026-10-13*
