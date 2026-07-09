# WomenApp

WomenApp — это мобильная платформа только для женщин, доступ на которую получают исключительно верифицированные пользователи. Каждая участница подтверждает личность, загрузив фото документа; модерация производится вручную. Платформа позволяет женщинам-путешественницам и женщинам в трудной ситуации находить безопасное жильё (бесплатный «диван» по обмену или краткосрочная аренда), общаться в ленте сообщества, городских групповых чатах, организовывать локальные встречи и переписываться напрямую. Основополагающий принцип проекта — **безопасность**.

---

## Структура репозитория

Единый git-монорепо с тремя подпроектами:

| Подпроект | Путь | Описание |
|-----------|------|----------|
| **Backend** | `/backend/` | Node.js REST API + WebSocket (Express 4, Mongoose 8, Socket.io 4, Firebase Admin, JWT) |
| **Mobile** | `/mobile/` | Мобильное приложение (React Native 0.86, Expo 57, Firebase JS SDK, React Navigation, Zustand) |
| **Admin** | `/admin/` | Панель модерации (React 19, Vite 8, TypeScript) |

> **Один общий `.git` в корне.** `mobile/` влит в монорепо через `git subtree` (история сохранена) — отдельного git-репозитория у него больше нет. Коммиты во все части делаются из корня. Секреты (`mobile/.env`, `mobile/firebase-adminsdk.json`) в `.gitignore`.

---

## Стек

### Backend (`/backend/`)

- **Runtime:** Node.js
- **Фреймворк:** Express 4.19
- **БД:** MongoDB + Mongoose 8.4
- **Real-time:** Socket.io 4.7
- **Auth:** Firebase Admin SDK 14 (верификация токенов), jsonwebtoken 9 (сессионные JWT)
- **Хранилище файлов:** Firebase Storage (через firebase-admin)
- **Прочее:** multer 2 (загрузка файлов), bcryptjs 2.4, cors 2.8, dotenv 16, expo-server-sdk 6 (push-уведомления)

### Mobile (`/mobile/`)

- **Платформа:** Expo ~57.0.1, React Native 0.86, React 19
- **Язык:** TypeScript (strict mode)
- **Навигация:** @react-navigation/native
- **Состояние:** Zustand
- **Auth:** Firebase JS SDK v12 (email/password)
- **Медиа:** expo-image-picker, expo-notifications

### Admin (`/admin/`)

- **Фреймворк:** React 19 + react-dom 19
- **Сборка:** Vite 8
- **Язык:** TypeScript ~6.0
- **Lint:** oxlint

---

## Быстрый старт

### Всё сразу (Makefile)

Из корня репозитория:

```bash
make install   # установить зависимости во всех подпроектах (backend + admin + mobile)
make dev       # поднять ВСЁ: MongoDB + Firebase Emulators + backend + admin + mobile
```

`make dev` поднимает и инфраструктуру, и приложения:
- MongoDB в docker (`:27017`, detached — переживает перезапуски)
- Firebase Emulators (Auth `:9099`, Storage `:9199`, UI `:4000`)
- backend `:3000`, admin `:5173`, Expo dev server

Ctrl+C останавливает серверы и эмуляторы; MongoDB продолжает работать — гасить через `make down`.

**Требуется:** Docker + Docker Compose (для Mongo) и JDK (для эмуляторов Firebase).

Отдельные цели: `make backend`, `make admin`, `make mobile`, `make emulators`, `make db-up`, `make down`. `make help` — список всех команд.

> В `make dev` Expo работает в фоне общей группы процессов, поэтому интерактивное меню Expo (нажатия клавиш) недоступно — для него используйте `make mobile` в отдельном терминале.

### Backend

```bash
cd backend
npm install
cp .env.example .env   # заполнить переменные (см. раздел «Переменные окружения»)
npm run dev            # режим разработки (nodemon, hot-reload), порт 3000
npm start              # production-запуск
```

### Mobile

```bash
cd mobile
npm install
npm start              # Expo Dev Server (QR-код для Expo Go)
npm run android        # запуск на Android-эмуляторе / устройстве
npm run ios            # запуск на iOS-симуляторе / устройстве
npm run web            # запуск в браузере
```

> **Перед написанием кода для мобильного приложения** обязательно читайте документацию именно версии Expo 57:
> https://docs.expo.dev/versions/v57.0.0/
> API меняется между версиями — не полагайтесь на устаревшие примеры.

### Admin

```bash
cd admin
npm install
npm run dev            # Vite dev-сервер
npm run build          # tsc + Vite production-сборка
npm run preview        # предпросмотр production-сборки
```

---

## Переменные окружения

Источник истины — файлы с примерами:

- `backend/.env.example` — все переменные backend
- `mobile/.env.example` — переменные мобильного приложения

Файлы `.env` **добавлены в .gitignore** и никогда не должны попадать в репозиторий.

`FIREBASE_SERVICE_ACCOUNT_JSON` принимает как сам JSON одной строкой, так и путь к файлу ключа — backend определяет формат автоматически (`backend/src/config/firebase.js`).

### Обязательные переменные backend

| Переменная | Назначение | Где получить |
|------------|------------|--------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Приватный ключ Firebase Admin SDK — весь JSON одной строкой **или** путь к JSON-файлу ключа | Firebase Console → Project Settings → Service accounts → Generate new private key |
| `FIREBASE_STORAGE_BUCKET` | Имя бакета Firebase Storage | Firebase Console → Storage (например, `<project-id>.appspot.com`) |
| `MONGODB_URI` | Строка подключения к MongoDB | MongoDB Atlas → Cluster → Connect → Drivers, или локальный `mongod` |
| `PORT` | Порт HTTP-сервера | По умолчанию `3000` |
| `JWT_SECRET` | Секрет для подписи JWT-токенов | Любая длинная случайная строка (≥ 32 символа) |

---

## Локальная разработка через Firebase Emulators

Backend умеет работать против локальных Firebase Emulators — без реального Firebase-проекта.

Конфигурация в корне репозитория:

- `firebase.json` — эмуляторы: Auth (`:9099`), Storage (`:9199`), Emulator UI (`:4000`)
- `.firebaserc` — проект по умолчанию (`woman-app-46cd2`), чтобы эмуляторы стартовали без логина
- `storage.rules` — правила Firebase Storage
- `docker-compose.yml` — MongoDB (`:27017`)

> ⚠ Текущие `storage.rules` открыты (`allow read, write: if true`) — это допустимо **только для локального эмулятора**. Перед продакшеном правила обязательно ужесточить.

Всё поднимается через `make dev`. Отдельно эмуляторы — `make emulators` (использует `npx firebase-tools`, отдельная установка Firebase CLI не нужна; требуется JDK).

Чтобы **backend** проверял токены против Auth-эмулятора, задайте в `backend/.env`:

| Переменная | Назначение | Значение для локали |
|------------|------------|---------------------|
| `FIREBASE_AUTH_EMULATOR_HOST` | Хост Auth-эмулятора | `127.0.0.1:9099` |
| `FIREBASE_STORAGE_EMULATOR_HOST` | Хост Storage-эмулятора | `127.0.0.1:9199` |

Либо задайте один флаг `FIREBASE_USE_EMULATORS=true` — backend подставит хосты по умолчанию, если они не указаны явно.

Mobile подключается к эмуляторам автоматически в `__DEV__`, выводя хост из `EXPO_PUBLIC_API_BASE_URL` (`mobile/src/config/firebase.ts`).

---

## Адреса и доступ

| Что | URL | Примечание |
|-----|-----|-----------|
| Backend API | http://localhost:3000 | REST + Socket.io |
| Админ-панель | http://localhost:5173 | Vite, проксирует `/api` → `:3000` |
| Firebase Emulator UI | http://localhost:4000 | обзор Auth / Storage |
| Пользовательское приложение (web) | http://localhost:8081 | Expo web (точный порт — в выводе `make mobile`) |
| Пользовательское приложение (телефон) | `exp://<LAN_IP>:8081` | скан QR из `make mobile` в Expo Go |

### Учётные данные админ-панели

Логин админки проверяется по переменным окружения (без хардкода в коде — `backend/src/controllers/adminController.js`):

| Переменная | Назначение |
|-----------|-----------|
| `ADMIN_EMAIL` | e-mail для входа в админку |
| `ADMIN_PASSWORD` | пароль для входа в админку |

Заданы в `backend/.env`. Вход: открыть http://localhost:5173 → форма логина → значения `ADMIN_EMAIL` / `ADMIN_PASSWORD` из `backend/.env`.

---

## Открыть приложение с телефона

Телефон и компьютер должны быть в одной Wi-Fi сети.

1. Узнать LAN IP компьютера — `make ip` (например `192.168.10.93`).
2. В `mobile/.env` прописать этот IP:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://192.168.10.93:3000
   ```
   Из него mobile выводит и адрес эмуляторов Firebase (`192.168.10.93:9099` / `:9199`).
3. `make dev` (или `make mobile`) → в приложении **Expo Go** на телефоне отсканировать QR-код из терминала.

Эмуляторы Firebase слушают `0.0.0.0` (`firebase.json`) — доступны в локальной сети; backend слушает все интерфейсы; CORS в dev открыт.

> ⚠ Привязка эмуляторов к `0.0.0.0` открывает их всей локальной сети — только для разработки.

---

## Дорожная карта GSD (фазы разработки)

Проект ведётся по методологии **GSD** (планы в `.planning/`). Каждая фаза — набор планов, каждый план исполнен атомарными коммитами и имеет `SUMMARY.md`. Артефакты фазы лежат в `.planning/phases/NN-<slug>/` (`PLAN`, `SUMMARY`, `RESEARCH`, `UI-SPEC`, `VERIFICATION`). Пройтись по фазе: читать её SUMMARY + `git show <commit>`; закрыть визуальную приёмку — `/gsd-verify-work <N>`.

Прогресс: **2 из 3 фаз запушены** (origin/master). Проект — pre-MVP.

### ✅ Phase 1 — Trust Foundation (7 планов, завершена 2026-07-05)

Требования: VERI-01..07, PROF-01..04. Регистрация, верификация по документу, ручная модерация, профили.

| План | Что доставляет | Коммиты |
|------|----------------|---------|
| 01-01 | User-модель, Firebase-token middleware, регистрация (Firebase→MongoDB) | `4b69cec` `cfaaaa9` `c7f29cc`(test) `68e45b1` |
| 01-02 | Firebase init, Zustand auth-store, auth-экраны, nav-гейт | `8fbec7c` `b5c6127` |
| 01-03 | Пайплайн загрузки документа (backend storage + mobile upload) | `8a38a29` `294971c` |
| 01-04 | Админ-панель: API + React/Vite SPA (логин, очередь, approve/reject) | `ac836d2` `00795db` |
| 01-05 | Профили: endpoints + экраны + навигация | `79303bb` `19f197f` |
| 01-06 | EAS-конфиг + регистрация Expo push-токена при логине | `a1a6825` |
| 01-07 | Block + Report (Report-модель, backend endpoints, UI-действия) | `d71e827` `289facf` |

### ✅ Phase 2 — Housing Core (5 планов, завершена 2026-07-09)

Требования: LIST-01..05, REQT-01..04, MSG-01..05. Жильё, карта, заявки на проживание, личка, городские чаты. Верификация 14/15 (0 блокеров; 2 пункта — визуальная UAT).

| План | Что доставляет | Требования | Коммиты |
|------|----------------|-----------|---------|
| 02-01 | Socket.io auth-handshake, сужение CORS, mobile socket service/store, bottom-tab shell | (foundation) | `5c83a81` `757f251` |
| 02-02 | Листинги + гео-поиск на карте (точный адрес скрыт за SafetyChip), фильтр дат | LIST-01..05 | `5c0b3b4` `e5b42a3` `f6d4117` |
| 02-03 | Заявки на проживание, host-инбокс accept/decline, push, раскрытие адреса на accept | REQT-01..04 | `16c9893` `e816966` `81cf4b4` |
| 02-04 | 1:1 личка: message-request gate (server-side), real-time DM (store-first), offline push | MSG-01,02,03,05 | `664927a` `208247a` |
| 02-05 | City group chat (citySlug из профиля, real-time, offline push) | MSG-04,05 | `74c8c1f` `24179e8` `57fac1a` |

**Safety-инварианты фазы 2 (все проверены в коде, server-side):** точный адрес скрыт без принятой заявки · gate личек на сервере · store-first (запись в БД до socket-emit) · citySlug выводится из профиля, не из клиента · senderUid из аутентифицированного сокета · Firebase-аутентификация при handshake.

### ⬜ Phase 3 — Community & Trust Layer (не начата)

Требования: COMM-01..03, REVW-01..03. Лента сообщества, взаимодействия с постами, двусторонние blind-release отзывы после проживания. Запуск: `/gsd-plan-phase 3`.

**Ограничения MVP:**

- Платформа: Android-first, Expo managed workflow (без bare ejection)
- Аутентификация: только Firebase Auth (без собственного auth-сервера)
- Верификация: ручная модерация (без автоматических API проверки документов)
- Карты: Google Maps API
- Платежи: отсутствуют (выведены за рамки MVP)
