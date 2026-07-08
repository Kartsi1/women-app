# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Структура проекта

Единый git-монорепо с двумя подпроектами:

- `/backend/` — Node.js REST API + WebSocket (Express, MongoDB, Socket.io)
- `/mobile/` — React Native приложение (Expo 57)

Один общий `.git` в корне (`mobile/` влит через `git subtree`, история сохранена). Коммиты в обе части делаются из корня репозитория — отдельного git-репо у `mobile/` больше нет. Секреты (`mobile/.env`, `mobile/firebase-adminsdk.json`) в `.gitignore` — не коммитить.

## Backend (`/backend/`)

### Запуск

```bash
cd backend
npm install
cp .env.example .env   # заполнить переменные
npm run dev            # nodemon, hot-reload
npm start              # production
```

### Переменные окружения

Смотри `backend/.env.example`. Обязательные поля: `PORT`, MongoDB URI, JWT secret.

### Архитектура

Слоистая MVC-архитектура (пока только scaffold):

```
src/server.js          # точка входа — Express + Socket.io + HTTP server
src/routes/            # маршруты
src/controllers/       # обработчики запросов
src/services/          # бизнес-логика
src/models/            # Mongoose-схемы
src/middleware/        # JWT-auth, валидация
src/config/            # подключение к MongoDB и прочее
src/socket/            # Socket.io события
```

Текущее состояние: реализован только `src/server.js` (skeleton). MongoDB-соединение не добавлено — нужно сделать перед первым роутом.

### Стек

Express 4.19, Mongoose 8.4, Socket.io 4.7, JWT (`jsonwebtoken`), bcryptjs, dotenv. Нет тестового фреймворка.

## Mobile (`/mobile/`)

### Важно: Expo v57

Перед любым кодом для Expo — читать документацию именно этой версии: `https://docs.expo.dev/versions/v57.0.0/`  
API изменилось — не полагаться на знания из training data.

### Запуск

```bash
cd mobile
npm install
npm start             # Expo Dev Server
npm run android       # Android
npm run ios           # iOS
npm run web           # Web
```

### Архитектура

```
App.tsx               # корневой компонент (сейчас — шаблон Expo)
index.ts              # точка входа Expo
src/screens/          # экраны по фичам: Auth/, Chat/, Listings/, Profile/
src/navigation/       # React Navigation (не установлен — добавить)
src/components/       # переиспользуемые UI-компоненты
src/hooks/            # кастомные хуки
src/store/            # глобальное состояние (не установлено — добавить)
src/services/         # API-клиент для backend
src/types/            # TypeScript типы
src/constants/        # константы приложения
```

Текущее состояние: все директории пустые, `App.tsx` — дефолтный шаблон. TypeScript strict mode включён.

### Чего не хватает (нужно установить перед реализацией)

- Навигация: `@react-navigation/native`
- Состояние: Redux Toolkit или Zustand
- API-клиент: axios или react-query
- Тесты: Jest + React Native Testing Library

## Критические проблемы (решить до продакшена)

- CORS настроен на `*` и в REST (`app.use(cors())`), и в Socket.io — ограничить конкретными origin
- MongoDB не подключена — добавить `mongoose.connect()` в `src/config/`
- Нет middleware аутентификации — добавить до создания защищённых роутов
- Нет rate limiting и валидации входных данных
