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

> ⚠ **Expo Go не подходит.** Проект на Expo SDK 57 / RN 0.86 и использует нативный `react-native-maps` — generic Expo Go его не запустит («requires a newer version of Expo Go»). Нужен **собственный dev build** (это по-прежнему managed workflow, не ejection).

### Вариант A — нативный dev build (полный функционал, карты)

Разовая настройка Android-тулчейна (Linux):

1. Установить Android Studio → пройти Setup Wizard (качает SDK в `~/Android/Sdk`).
2. В **SDK Manager → SDK Tools** добавить **NDK (Side by side)** + **CMake** (нужны для нативной сборки RN). Проект собран на `ndk;27.1.12297006` + `cmake;3.22.1`.
3. Env (в `~/.bashrc`):
   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   export ANDROID_SDK_ROOT="$ANDROID_HOME"
   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
   ```
4. Телефон: включить **Developer options → USB debugging**, подключить по USB, разрешить отладку. Проверка: `adb devices`.

Сборка и запуск (из `mobile/`):
```bash
npx expo run:android
```
Первый раз долго (Gradle тянет зависимости + компилит натив). Дальше — `npx expo start --dev-client`. Пакет приложения: `com.kartsi.mobile`. Сгенерированный `mobile/android/` — в `.gitignore` (managed prebuild, не коммитится).

**Backend с телефона (USB):** пробросить порт, тогда `localhost:3000` в приложении бьёт в PC:
```bash
adb reverse tcp:3000 tcp:3000
```
Либо в `mobile/.env` указать LAN IP (`make ip` → `EXPO_PUBLIC_API_BASE_URL=http://<LAN_IP>:3000`), телефон и ПК в одной Wi-Fi.

Требуется работающий backend: `make dev` (Mongo + Firebase Emulators + backend :3000).

### Вариант B — web в браузере телефона (мгновенно, без сборки)

`make dev` → открыть `http://<LAN_IP>:8081` в браузере телефона (LAN IP — `make ip`). Карта на web = плейсхолдер (`react-native-maps` — native-only, есть platform-shim `MapView.web.tsx`); загрузка фото/документов работает (FormData на web шлёт реальный Blob). Телефон и ПК в одной Wi-Fi.

> Эмуляторы Firebase слушают `0.0.0.0` (`firebase.json`) — доступны в локальной сети; backend слушает все интерфейсы; CORS в dev открыт. Привязка к `0.0.0.0` — только для разработки.

---

## Дорожная карта GSD (фазы разработки)

Проект ведётся по методологии **GSD** (планы в `.planning/`). Каждая фаза — набор планов, каждый план исполнен атомарными коммитами и имеет `SUMMARY.md`. Артефакты фазы лежат в `.planning/phases/NN-<slug>/` (`PLAN`, `SUMMARY`, `RESEARCH`, `UI-SPEC`, `VERIFICATION`). Пройтись по фазе: читать её SUMMARY + `git show <commit>`; закрыть визуальную приёмку — `/gsd-verify-work <N>`.

Прогресс: **3 из 3 фаз запушены** (origin/master) — milestone v1.0 code-complete (16 планов). Осталась визуальная приёмка (`/gsd-verify-work 2` / `3`).

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

### ✅ Phase 3 — Community & Trust Layer (4 плана, завершена 2026-07-10)

Требования: COMM-01..03, REVW-01..03. Лента сообщества (посты/лайки/комменты) и двусторонние blind-release отзывы после проживания. Верификация 10/10 (0 блокеров; 6 пунктов — визуальная UAT).

| План | Что доставляет | Требования | Коммиты |
|------|----------------|-----------|---------|
| 03-01 | Лента: создание поста (текст+опц.фото), глобальный реверс-хрон feed с cursor-пагинацией и signed-URL | COMM-01 | `aed76e9` `d7732bc` |
| 03-02 | Идемпотентные лайки (без дрейфа счётчика), комменты (отдельная коллекция) + push автору, Report-reuse, PostDetail | COMM-02,03 | `ce3c539` `de421b1` |
| 03-03 | Blind-release backend: Review model (immutable), eligibility-gate, lazy-on-read reveal + leak-test, аггрегация | REVW-01/02/03 | `a8b8893` `eb249c9` |
| 03-04 | Mobile: звёздный ввод, compose (immutable-notice), amber/green blind-release chips, сводка на профиле | REVW-01/02/03 | `809e63c` `3f62781` |

**Safety-инварианты фазы 3 (все проверены в коде, server-side):** blind-release reveal вычисляется на сервере при чтении (оба сдали ИЛИ ≥ checkOut+14д) · встречный отзыв отсутствует в ответе до раскрытия (явная projection, не raw-spread; held-out leak-test) · клиент не гейт (WaitingChip без текст-prop) · reviewerUid/subjectUid не от клиента · отзывы immutable · лайки без дрейфа. 25/25 backend-тестов.

> Известный долг: удаление постов админом не реализовано (только автором) — задокументировано, отложено.

**Ограничения MVP:**

- Платформа: Android-first, Expo managed workflow (без bare ejection)
- Аутентификация: только Firebase Auth (без собственного auth-сервера)
- Верификация: ручная модерация (без автоматических API проверки документов)
- Карты: Google Maps API
- Платежи: отсутствуют (выведены за рамки MVP)
