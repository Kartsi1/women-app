# WomenApp

## What This Is

Women-only mobile platform for female travelers and women in need. Members find housing (free couch-surfing and short-term paid rentals), connect in a community feed and city-based group chats, organize local meetups, and message each other directly. All users are verified women via document photo — safety is the founding principle.

## Core Value

A verified, women-only space where any woman can find safe housing and trusted community wherever she is in the world.

## Business Context

- **Customer**: Female travelers and women seeking support/housing globally
- **Revenue model**: MVP is free; commission on paid listings post-MVP
- **Success metric**: Verified users who find housing or community within 7 days of signup
- **Strategy notes**: Trust and safety unlock everything else — no verification = no platform

## Current Milestone: v1.1 Социальные функции и медиа

**Goal:** Превратить WomenApp в полноценную соцсеть для верифицированных участниц: профили в стиле VK, друзья/подписки и медиа (фото/видео/аудио/файлы) в постах и чатах.

**Target features:**
- Профиль в стиле VK: обложка, аватар, статус, город, «Подробнее», опциональные поля (возраст, образование, работа, хобби, родной город, что ищет), стена с фото/видео/текстом, вкладки
- Друзья + подписки (запрос в друзья с подтверждением; до принятия — подписчица), счётчик друзей, запрос на общение из профиля
- Медиа в комьюнити: видео, аудиофайлы, ссылки на музыку (Яндекс Музыка/Spotify/YouTube) с превью, файлы
- Репосты постов комьюнити
- Полноэкранный просмотр медиа
- Вложения в чатах (фото/видео/файлы) — DM и городские чаты
- Язык интерфейса RU/EN с переключателем
- Примерная область (район) для объявлений жилья на карте

## Requirements

### Validated

- ✓ Women-only access with document verification + manual admin moderation — v1.0
- ✓ Housing listings (free + paid) with Google Maps location search and stay requests — v1.0
- ✓ Community feed with posts (text + photo), likes, comments — v1.0
- ✓ City-based group chats and 1:1 direct messaging via message requests — v1.0
- ✓ Bidirectional blind-release ratings and reviews — v1.0
- ✓ User profiles (photo, name, bio, home city, verification badge, stats), block/report — v1.0

### Active

- [ ] VK-style profile with optional extended fields and a wall (v1.1)
- [ ] Friends + followers social graph (v1.1)
- [ ] Rich media (video/audio/music links/files) in community posts (v1.1)
- [ ] Reposts of community posts (v1.1)
- [ ] Full-screen media viewer (v1.1)
- [ ] Media attachments in DMs and city chats (v1.1)
- [ ] RU/EN interface language with switcher (v1.1)
- [ ] Approximate area (district) for housing listings (v1.1)
- [ ] Events: create and discover local women-only meetups (deferred from v1.0)
- [ ] Remote push notifications (requires EAS projectId + FCM; deferred from v1.0)

### Out of Scope

- In-app payment processing — excluded from MVP; users coordinate directly for paid rentals
- iOS build — after Android MVP is validated
- AI moderation — manual document review for MVP

## Context

- Existing scaffold: Express + Socket.io backend (only server.js implemented), Expo 57 React Native frontend (empty screens)
- Firebase Authentication chosen for auth + push notifications
- MongoDB chosen as database (already in backend dependencies)
- Google Maps API for location/search
- State management: Zustand (lighter than Redux for MVP scope)
- Architecture: MVVM with Zustand stores
- Target: Android first via Expo, iOS export later with same codebase
- Global platform from day one — English + Russian UI (at minimum)
- Verification flow: user uploads ID document photo → manual admin moderation → account unlocked

## Constraints

- **Platform**: Android-first; must run on Expo managed workflow (no bare ejection for MVP)
- **Auth**: Firebase Authentication only (no custom auth server)
- **DB**: MongoDB (Mongoose already installed)
- **Real-time**: Socket.io already scaffolded — use it for chat and notifications
- **Maps**: Google Maps API (must handle API key management securely)
- **Verification**: Manual moderation in MVP — no automated ID-check APIs
- **Payments**: None in MVP — excluded to keep scope tight

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Women-only platform with ID verification | Core safety promise — without trust, no one uses housing feature | — Pending |
| Expo managed workflow | Faster iteration, no native build complexity for MVP | — Pending |
| MongoDB over PostgreSQL | Already in scaffold, fits document-based listing/profile model | — Pending |
| Zustand over Redux | Lower boilerplate for MVP scope, easier onboarding | — Pending |
| Free + paid listings in same feed, no payment processing | Validates demand before building payment complexity | — Pending |
| Community = feed posts + city group chats | Two modes serve different needs: async (feed) and real-time (groups) | — Pending |
| Manual ID verification in MVP | No third-party cost, full control, acceptable for early scale | — Pending |
| Profile fields visible to all verified members by default; per-field hide flag in data model, no settings UI yet | Platform already closed; unclear what needs hiding | — Pending (v1.1) |
| Friends (mutual, request-accept) + followers (pending request = follower), VK-style | User choice 2026-10-13 | — Pending (v1.1) |
| Music in posts = uploaded audio files AND service links with preview | User choice 2026-10-13 | — Pending (v1.1) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-13 after starting milestone v1.1*
