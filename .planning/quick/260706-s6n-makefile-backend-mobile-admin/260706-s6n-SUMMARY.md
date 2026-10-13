---
quick_id: 260706-s6n
slug: makefile-backend-mobile-admin
description: Единая команда запуска (Makefile) для backend + mobile + admin
status: complete
completed: 2026-07-06
---

# Quick Task 260706-s6n Summary

**Root `Makefile` — одна команда `make dev` поднимает backend + admin + mobile; `make install` ставит зависимости во всех трёх.**

## Accomplishments

- `Makefile` в корне репо. Цели:
  - `help` (default) — список команд.
  - `install` — `npm install` последовательно в `backend/`, `admin/`, `mobile/`.
  - `dev` — параллельный запуск всех dev-серверов в одной группе процессов;
    `trap 'kill 0' INT TERM EXIT` → Ctrl+C завершает всё без сирот. Пред-проверка `backend/.env`.
  - `backend` / `admin` / `mobile` — по одному серверу.
- `.PHONY` на все цели (имена совпадают с каталогами → иначе make считал бы их «up to date»).

## Command map

| Цель          | Действие                          |
|---------------|-----------------------------------|
| `make install`| deps: backend + admin + mobile    |
| `make dev`    | backend :3000 + admin :5173 + Expo|
| `make backend`| Express dev (nodemon)             |
| `make admin`  | Vite dev                          |
| `make mobile` | Expo dev server                   |

## Verification

- `make help` → печатает список целей ✓
- `make -n dev` → рецепт с `trap 'kill 0'` + три фоновых `npm` + `wait` ✓
- `grep '^\.PHONY' Makefile` ✓
- `make -n install` → три `npm install` по подпроектам ✓

## Notes / Deviations

- Выполнено оркестратором последовательно (без worktree-исполнителя): задача — один файл,
  а `commit_docs=false` + worktree-режим ломают материализацию PLAN.md (exit 42). Все гейты
  GSD сохранены: PLAN.md, SUMMARY.md, STATE-строка, атомарный коммит кода.
- `mobile/` — отдельный git-репо; Makefile его не коммитит, только вызывает `npm start` через `cd`.
- Expo dev server в `make dev` работает в фоне группы — интерактивное TUI Expo (клавиши) недоступно;
  для интерактива использовать `make mobile` в отдельном терминале.

## Follow-up: инфраструктура (после первого `make dev`)

Первый прогон `make dev` показал: app-серверы стартуют, но падают backends-сервисы —
MongoDB (`ECONNREFUSED 127.0.0.1:27017`) и Firebase Emulators (`auth/network-request-failed`).
`make dev` не поднимал инфраструктуру. Исправлено:

- `docker-compose.yml` (new) — MongoDB `mongo:7` на `:27017`, volume `mongo-data`.
- `.firebaserc` (new) — проект `woman-app-46cd2`, чтобы эмуляторы стартовали без логина.
- `Makefile` — новые цели `db-up`, `db-down`, `emulators`, `down`; `dev` теперь зависит от `db-up`
  и запускает эмуляторы (`npx firebase-tools emulators:start`) вместе с тремя серверами в группе.
- README — раздел про Makefile и эмуляторы обновлён.

Проверено: `make -n dev` → `docker compose up -d mongo` + группа (эмуляторы + backend + admin + mobile);
`docker compose config` валиден. Реальный `make dev` не запускался (long-running) — запускает пользователь.

**Осталось на стороне пользователя (`.env`, недоступен для правки):**
- `backend/.env`: `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199` —
  чтобы backend Admin SDK проверял токены против эмулятора.

**Мелочь (не трогал):** в `backend/src/config/firebase.js` блок эмулятора перезаписывает host
только если переменная уже задана (`if (env.X) { env.X = '127.0.0.1:9099' }`) — работает при явном
значении в `.env`, но логика перевёрнута. Кандидат на правку.

## Commit

- `Makefile` — код-коммит (docs-артефакты .planning не коммитятся: `commit_docs=false`).
- Follow-up (infra): `docker-compose.yml`, `.firebaserc`, обновлённый `Makefile`, `README.md` — не закоммичены (жду решения).
