# WomenApp — единая точка запуска всех подпроектов.
#
#   make install   установить зависимости (backend + admin + mobile)
#   make dev       запустить всё одной командой (Ctrl+C останавливает все)
#   make backend   только backend — Express на :3000
#   make admin     только admin — Vite на :5173
#   make mobile    только mobile — Expo dev server
#
# mobile/ — отдельный git-репозиторий; Makefile лишь вызывает его npm-скрипты.

.DEFAULT_GOAL := help
.PHONY: help install dev backend admin mobile

help:
	@echo "WomenApp — команды запуска:"
	@echo "  make install   Установить зависимости во всех подпроектах"
	@echo "  make dev       Запустить всё одной командой (Ctrl+C останавливает все)"
	@echo "  make backend   Только backend — Express на :3000"
	@echo "  make admin     Только admin — Vite на :5173"
	@echo "  make mobile    Только mobile — Expo dev server"

install:
	@echo ">> backend"
	cd backend && npm install
	@echo ">> admin"
	cd admin && npm install
	@echo ">> mobile"
	cd mobile && npm install

# Все dev-серверы стартуют в одной группе процессов.
# trap 'kill 0' на INT/TERM/EXIT завершает всю группу по Ctrl+C — без осиротевших процессов.
dev:
	@if [ ! -f backend/.env ]; then \
		echo "⚠ backend/.env не найден — backend не поднимется без него (см. backend/.env.example)"; \
	fi
	@echo "Запуск backend + admin + mobile… Ctrl+C останавливает все."
	@trap 'kill 0' INT TERM EXIT; \
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
