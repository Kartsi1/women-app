# WomenApp — единая точка запуска всех подпроектов + локальной инфраструктуры.
#
#   make install    установить зависимости (backend + admin + mobile)
#   make dev        поднять всё одной командой: Mongo + Firebase Emulators + backend + admin + mobile
#   make backend    только backend — Express на :3000
#   make admin      только admin — Vite на :5173
#   make mobile     только mobile — Expo dev server
#   make emulators  только Firebase Emulators (Auth :9099, Storage :9199, UI :4000)
#   make db-up      поднять MongoDB в docker (:27017, detached)
#   make db-down    остановить и удалить контейнеры docker
#   make down       остановить инфраструктуру (Mongo)
#
# mobile/ — отдельный git-репозиторий; Makefile лишь вызывает его npm-скрипты.

.DEFAULT_GOAL := help
.PHONY: help install dev backend admin mobile emulators db-up db-down down

help:
	@echo "WomenApp — команды запуска:"
	@echo "  make install    Установить зависимости во всех подпроектах"
	@echo "  make dev        Поднять всё: Mongo + эмуляторы + backend + admin + mobile (Ctrl+C останавливает серверы)"
	@echo "  make backend    Только backend — Express на :3000"
	@echo "  make admin      Только admin — Vite на :5173"
	@echo "  make mobile     Только mobile — Expo dev server"
	@echo "  make emulators  Только Firebase Emulators (Auth :9099, Storage :9199, UI :4000)"
	@echo "  make db-up      MongoDB в docker (:27017, detached)"
	@echo "  make down       Остановить инфраструктуру (Mongo)"

install:
	@echo ">> backend"
	cd backend && npm install
	@echo ">> admin"
	cd admin && npm install
	@echo ">> mobile"
	cd mobile && npm install

# MongoDB в docker — фоновый (detached), переживает перезапуски make dev.
db-up:
	docker compose up -d mongo

db-down:
	docker compose down

# Firebase Emulators (Auth/Storage/UI) по firebase.json + .firebaserc. Нужен Java (есть JDK 21).
emulators:
	npx -y firebase-tools emulators:start

# Полный dev-стек одной командой.
# Сначала поднимаем Mongo (detached), затем эмуляторы + три сервера в одной группе процессов.
# trap 'kill 0' на INT/TERM/EXIT завершает группу по Ctrl+C (Mongo остаётся — гасить через make down).
dev: db-up
	@if [ ! -f backend/.env ]; then \
		echo "⚠ backend/.env не найден — backend не поднимется без него (см. backend/.env.example)"; \
	fi
	@echo "Запуск эмуляторов + backend + admin + mobile… Ctrl+C останавливает серверы (Mongo — make down)."
	@trap 'kill 0' INT TERM EXIT; \
		( npx -y firebase-tools emulators:start ) & \
		( cd backend && npm run dev ) & \
		( cd admin && npm run dev ) & \
		( cd mobile && npm start ) & \
		wait

backend:
	cd backend && npm run dev

admin:
	cd admin && npm run dev

mobile:
	cd mobile && npm start

down: db-down
	@echo "Инфраструктура остановлена."
