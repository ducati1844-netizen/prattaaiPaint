# Pratta Paint Bot 🎨

AI-продавец для Telegram. Продаёт краски **Plastogum** и **Mister Quartz** от Pratta Thailand.

## Что умеет

- Ведёт клиента по воронке Paint в Bitrix24
- Квалифицирует лида (тип клиента, объект, площадь)
- Подбирает продукт (Plastogum vs Mister Quartz)
- Делает расчёт количества и стоимости
- Мультиязычность: RU / EN / TH
- No-answer система: 2ч → 2й followup, 2дня → 3й, 3й день → база рассылок
- Умный follow-up через Claude с учётом контекста
- Записывает на встречу в шоурум (календарь Bitrix24)
- При готовности клиента платить → уведомляет менеджера + создаёт задачу
- Распознаёт фото от клиента
- Отправляет каталог продуктов и каталог цветов

## Быстрый старт

### 1. Клонируй репозиторий
```bash
git clone https://github.com/ВАШ_АККАУНТ/pratta-paint-bot
cd pratta-paint-bot
npm install
```

### 2. Переменные окружения

Создай файл `.env` (локально) или задай в Railway:

| Переменная | Описание |
|---|---|
| `TELEGRAM_TOKEN_PAINT` | Токен бота от @BotFather |
| `ANTHROPIC_KEY` | API ключ Anthropic |
| `PAINT_CATALOG_URL` | Прямая ссылка на PDF каталога продуктов |
| `PAINT_COLOR_CATALOG_URL` | Прямая ссылка на PDF каталога цветов |
| `PORT` | Порт сервера (Railway подставляет автоматически) |

### 3. Деплой на Railway

1. Создай новый сервис в Railway
2. Подключи этот GitHub репозиторий
3. Добавь переменные окружения (см. таблицу выше)
4. Railway автоматически запустит `npm start`

### 4. Установи вебхук Telegram

После деплоя открой в браузере:
```
https://api.telegram.org/bot<ТВОЙ_ТОКЕН>/setWebhook?url=https://<ДОМЕН_RAILWAY>/webhook
```

Должен вернуть: `{"ok":true,"result":true}`

### 5. Проверь что бот работает
```
https://<ДОМЕН_RAILWAY>/
```
Должно показать: `Pratta Paint Bot работает ✓`

---

## Воронка Bitrix24 (категория 9 — Paint)

| Этап бота | Этап в Bitrix24 |
|---|---|
| new_lead | C9:NEW |
| msg1_no_answer | C9:UC_BYNA4F |
| msg2_no_answer | C9:UC_1JYUK4 |
| msg3_no_answer | C9:UC_T0TZLW |
| answer | C9:UC_MEKVO0 |
| qualify | C9:PREPARATION |
| clear_task | C9:PREPAYMENT_INVOICE |
| commercial_offer | C9:EXECUTING |
| invoice | C9:FINAL_INVOICE |
| waiting_payment | C9:UC_4PV7YY |
| payed | C9:UC_RS52BI |
| colouring | C9:UC_SI3ZEE |
| delivery | C9:UC_F8VVNF |
| received | C9:UC_IN2549 |
| base_for_messages | C9:UC_FATA4L |
| won | C9:WON |
| lose | C9:LOSE |

---

## Продукты

### Plastogum
- Силоксановая краска, паропроницаемая, водоотталкивающая
- 9 900 THB / 15 л | Расход: 90 м² / 15 л
- Колеровка: светлые +95 THB/л, тёмные +165 THB/л
- Нанесение под ключ: 500 THB/м² (от 300 м²)

### Mister Quartz
- Краска с эффектом лотуса, лёгкий глянец
- 9 900 THB / 15 л | Расход: 90 м² / 15 л
- Колеровка: светлые +95 THB/л, тёмные +195 THB/л
