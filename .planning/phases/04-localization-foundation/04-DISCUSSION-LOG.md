# Phase 4: Localization Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-13
**Phase:** 04-localization-foundation
**Areas discussed:** Тон и термины, Переключатель языка, Что переводим сейчас, Даты и время

---

## Тон и термины

| Question | Options | Selected |
|----------|---------|----------|
| Обращение | «ты» / «вы» | «ты» ✓ |
| Род | Везде женский / Нейтральные формулировки | Везде женский ✓ |
| Термины | Подруги/участницы / Друзья/пользователи / Друзья, но участницы | Подруги/участницы ✓ |
| Название | Пока не трогать / WomenApp | WomenApp ✓ |

## Переключатель языка

| Question | Options | Selected |
|----------|---------|----------|
| Место | Экран «Настройки» из профиля / Прямо в профиле | Настройки ✓ |
| До входа | Да, маленький RU\|EN / Нет | Да ✓ |
| Аккаунт | Сохраняется на сервере / Только на устройстве | На сервере ✓ |
| Вид | Список с галочкой / Сегмент RU\|EN / На усмотрение | Список ✓ |

## Что переводим сейчас

| Question | Options | Selected |
|----------|---------|----------|
| Объём | Перевести всё сразу / Как в плане (ключевые экраны) | Всё сразу ✓ — I18N-01 moved from Phase 10 to Phase 4 |
| Админка | Нет / Сразу на русский | Нет ✓ |
| Значения из БД | На усмотрение / Обсудить | На усмотрение ✓ |

## Даты и время

| Question | Options | Selected |
|----------|---------|----------|
| Лента | Относительно, потом дата / Всегда точная дата | Относительно ✓ |
| Чаты | Время + разделители дней / Только время | Время + разделители ✓ |
| 12/24ч | Как в системе / Всегда 24ч | Как в системе ✓ |
| Жильё | Компактно / Полностью | Компактно ✓ |

---

## Claude's Discretion

- Enum values: stored as codes, translated on display.
- i18n library structure, key naming, plural polyfill strategy, server catalog shape.

## Deferred Ideas

- Admin panel translation.
- Languages beyond RU/EN.
