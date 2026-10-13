---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Социальные функции и медиа
status: planning
last_updated: "2026-10-13T20:30:00.000Z"
last_activity: 2026-10-13
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-13)

**Core value:** A verified, women-only space where any woman can find safe housing and trusted community wherever she is in the world.
**Current focus:** Phase 4 — Localization Foundation

## Current Position

Phase: 4 of 10 (Localization Foundation) — first of 7 phases in v1.1 (phases 4–10)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-10-13 — v1.1 roadmap created (7 phases, 37/37 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed (v1.1): 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: none yet (v1.0 plans averaged ~10 min; see milestones/v1.0)
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v1.1 roadmap]: Order is i18n foundation + single native rebuild (4) → approximate area (5) → VK profile without wall (6) → friends/followers + visibility policy (7) → media foundation inside community rich media (8) → wall + reposts (9) → chat attachments + legacy i18n sweep (10)
- [v1.1 locked]: Default language RU; friend-request decline fully severs the connection (no residual follower)
- [v1.1 locked]: Counts public; friends list visible to owner + friends; followers list owner-only; mutual friends and friends-skip-message-request in scope
- [v1.1 locked]: Approximate area = ~500 m circle with stable offset + district name
- [v1.0 carry-over]: Never raw-spread docs into API responses (explicit projection), store-first message pattern (DB write before socket emit)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4]: Hermes Intl support (PluralRules/DateTimeFormat/RelativeTimeFormat) in the release APK must be spiked; city chat room key must be canonical, not localized
- [Phase 6]: Covers uploaded before Phase 8 bypass metadata stripping until the MEDIA-02 backfill runs (or add a sharp re-encode to the v1.0 image path early)
- [Phase 7]: Central visibilityService built here must be consumed by wall, reposts and chat-media surfaces in Phases 9–10
- [Phase 8]: Highest-risk phase. Needs spikes on ffmpeg hosting, emulator signed-URL/Range, sharp HEIC, Yandex Music preview, zoom-toolkit on SDK 57
- [Milestone]: In-app account deletion (ACCT-01) is a Google Play requirement before store release (deferred to v2). Backward compatibility with installed v1.0 APKs must hold in every backend phase

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260706-s6n | Единая команда запуска (Makefile) для backend + mobile + admin | 2026-07-06 | a945b82 | [260706-s6n-makefile-backend-mobile-admin](./quick/260706-s6n-makefile-backend-mobile-admin/) |
| 261013-tu0 | Release APK для теста на телефоне (ПК как сервер в LAN) | 2026-10-13 | df2dc18 | [261013-tu0-release-apk-for-lan-phone-testing-pc-as-](./quick/261013-tu0-release-apk-for-lan-phone-testing-pc-as-/) |
| 261013-umq | Фиксы после теста на телефоне: имена в запросах/диалогах, фото профиля, дубль сообщений, safe area, бейдж запросов | 2026-10-13 | 010f612 | [261013-umq-fix-phone-test-bugs-request-names-profil](./quick/261013-umq-fix-phone-test-bugs-request-names-profil/) |
| 261013-v47 | Фиксы: кнопка View на карте, обновление токена при 401, отступ карты, диагностика фото профиля | 2026-10-13 | 9fc698e | [261013-v47-fix-map-view-button-token-refresh-on-401](./quick/261013-v47-fix-map-view-button-token-refresh-on-401/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Feature | Remote push notifications (NOTF-01, needs EAS projectId + FCM) | v2 | v1.1 start |
| Feature | Events (EVNT-01..03) | v2 | v1.1 start |

## Session Continuity

Last session: 2026-10-13
Stopped at: v1.1 roadmap created, ready for `/gsd-plan-phase 4`
Resume file: None
