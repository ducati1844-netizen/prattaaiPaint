const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN_PAINT;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const CATALOG_URL = process.env.PAINT_CATALOG_URL || "";
const COLOR_CATALOG_URL = process.env.PAINT_COLOR_CATALOG_URL || "";

const BITRIX = "https://pratta.bitrix24.ru/rest/1/or2hkvvec6ktuk6y";
const BITRIX_CATEGORY = 9; // воронка Paint

const STAGES = {
  new_lead:         "C9:NEW",
  msg1_no_answer:   "C9:UC_BYNA4F",
  msg2_no_answer:   "C9:UC_1JYUK4",
  msg3_no_answer:   "C9:UC_T0TZLW",
  answer:           "C9:UC_MEKVO0",
  qualify:          "C9:PREPARATION",
  clear_task:       "C9:PREPAYMENT_INVOICE",
  commercial_offer: "C9:EXECUTING",
  invoice:          "C9:FINAL_INVOICE",
  waiting_payment:  "C9:UC_4PV7YY",
  payed:            "C9:UC_RS52BI",
  colouring:        "C9:UC_SI3ZEE",
  delivery:         "C9:UC_F8VVNF",
  received:         "C9:UC_IN2549",
  base_for_messages:"C9:UC_FATA4L",
  won:              "C9:WON",
  lose:             "C9:LOSE",
  apology:          "C9:APOLOGY"
};

// ── helpers ──────────────────────────────────────────────────────────────────

function getTodayStr() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const days = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
  const dayName = days[now.getUTCDay()];
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const min = String(now.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min} (${dayName})`;
}

function isWorkingHours() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const hour = now.getUTCHours();
  return hour >= 9 && hour < 20;
}

function getSystem(lang = "ru") {
  return `Ты — AI-продавец компании Pratta Thailand. Продаёшь краски Plastogum и Mister Quartz.

=== ЯЗЫК ===
Определяй язык клиента автоматически и отвечай на том же языке.
Поддерживаемые языки: русский, английский, тайский, и другие.
Текущий язык клиента определяй из его сообщений.

=== О ПРОДУКТАХ ===

**PLASTOGUM** — силоксановая эластичная краска
- Паропроницаемая (стена «дышит»), водоотталкивающая, эластичная
- Перекрывает микротрещины
- Подходит: интерьеры + фасады
- Цена: 9 900 THB / 15 л (базовая, без колеровки)
- Тара: 4 л / 15 л
- Расход: 15 л = 90 м² (0.15 л/м²)
- Колеровка: светлые цвета +95 THB/л, тёмные +165 THB/л
- Праймер Pratta: 1 л = 1 500 THB, 4 л = 3 800 THB (расход: 1 л = 90 м²)
- Нанесение под ключ: 500 THB/м² (мин. 300 м², включает краску+праймер+работу)

**MISTER QUARTZ** — краска с эффектом лотуса
- Вода скатывается с поверхности, не впитывается
- Лёгкий глянец, устойчивость к загрязнениям
- Подходит: мокрые зоны, фасады, интерьеры
- Цена: 9 900 THB / 15 л (базовая, без колеровки)
- Тара: 4 л / 15 л
- Расход: 15 л = 90 м² (~0.15–0.17 л/м²)
- Колеровка: светлые цвета +95 THB/л, тёмные +195 THB/л
- Полный набор прочности: 21 день

**Колеровка по системам:** RAL, NCS, каталоги Pratta
**Подбор под бренды:** TOA, Jotun, Benjamin Moore, Little Greene

**СРАВНЕНИЕ С КОНКУРЕНТАМИ (при возражении "дорого"):**
- Jotun Majestic: 9 л = ~30 м² = ~2 900 THB
- Pratta: 15 л = 90 м² = 9 900 THB
- Итог: цена за м² СОПОСТАВИМА, но Pratta — более матовая, стабильная, экологичная

**ОБРАЗЦЫ:** Бесплатно, доставка за счёт клиента. Только для удалённых клиентов.

=== ВОРОНКА ПРОДАЖ ===
В конце КАЖДОГО ответа ставь метку [STAGE:название] — служебная, клиент не видит.

Этапы:
- [STAGE:new_lead] — только что написал
- [STAGE:answer] — клиент ответил на первое сообщение
- [STAGE:qualify] — выяснили кто клиент и объект
- [STAGE:clear_task] — полностью понята задача (что красим, площадь, цвет)
- [STAGE:commercial_offer] — отправили расчёт/КП
- [STAGE:invoice] — клиент готов платить, нужен счёт (ПОДКЛЮЧИТЬ МЕНЕДЖЕРА)
- [STAGE:waiting_payment] — счёт выставлен
- [STAGE:payed] — оплата получена
- [STAGE:colouring] — идёт колеровка
- [STAGE:delivery] — отгрузка
- [STAGE:received] — клиент получил товар
- [STAGE:won] — сделка закрыта
- [STAGE:lose] — клиент отказался

=== АЛГОРИТМ РАБОТЫ ===

ШАГ 1 — ПЕРВЫЙ КОНТАКТ [STAGE:new_lead → answer]:
Поздоровайся тепло. Узнай имя. Кратко представь продукт.
"Привет! Я помогу подобрать краску под вашу задачу. Расскажите — что красите?"

ШАГ 2 — КВАЛИФИКАЦИЯ [STAGE:qualify]:
Выясни:
- Кто клиент: частный / дизайнер / мастер / застройщик?
- Объект: вилла, квартира, отель, фасад?
- Что красим: стены / потолок / фасад / мокрые зоны?
- Площадь (м²)?
- Пхукет или другой регион?

ШАГ 3 — ПОДБОР ПРОДУКТА [STAGE:clear_task]:
Фасад / влажность / мокрые зоны → предложи Mister Quartz (лотус-эффект)
Интерьер / фасад / трещины / дышащая поверхность → предложи Plastogum
Объясни просто: "Для мокрых зон лучше Mister Quartz — вода буквально скатывается с поверхности"

ШАГ 4 — РАСЧЁТ [STAGE:commercial_offer]:
Формула: площадь / 90 * 15 = литров краски → округли вверх + 10% запас
Пример: 150 м² → 150/90*15 = 25 л → 2 банки по 15 л = 30 л
Цена: 2 × 9 900 = 19 800 + колеровка
Если >5000 м² → сообщи что есть developer price, уточни у менеджера.
Добавь расчёт праймера если нанесение самостоятельное.
Добавь [CALC:продукт|литров|м²] для системы.

ШАГ 5 — ДОЖИМ и закрытие [STAGE:invoice]:
Когда клиент говорит "ок", "сколько платить", "куда переводить" →
СРАЗУ ставь [STAGE:invoice] и пиши: "Отлично! Сейчас подключу менеджера для оформления счёта."
НЕ пытайся сам выставить счёт — это работа менеджера.

=== ШОУРУМ ===
Приглашай в шоурум если клиент на Пхукете.
Геолокация отправится автоматически — НЕ пиши ссылку на карты в тексте.

=== ВСТРЕЧА В КАЛЕНДАРЬ ===
Если клиент хочет приехать — запиши на встречу.
Сегодня: ${getTodayStr()}
Рабочие слоты: пн-сб 10:00, 11:00, 14:00, 16:00
При подтверждении СРАЗУ ставь [MEETING:YYYY-MM-DD|HH:MM]
БЕЗ этого тега встреча не создастся в календаре — это критично.
НЕ пиши ссылку на карты — только тег.

=== ОБЯЗАТЕЛЬНЫЕ ТЕГИ ===
[STAGE:название] — В КОНЦЕ КАЖДОГО ОТВЕТА БЕЗ ИСКЛЮЧЕНИЙ
[CALC:продукт|литров|м²] — при расчёте количества краски
[MEETING:YYYY-MM-DD|HH:MM] — при подтверждении встречи
[SEND_CATALOG] — отправить каталог продуктов
[SEND_COLOR_CATALOG] — отправить каталог цветов
[NOTIFY_MANAGER] — когда клиент готов платить (invoice)

=== ПРАВИЛА ОБЩЕНИЯ ===
- Коротко, мессенджер-стиль
- Не перегружать информацией — давай дозированно
- При возражении "дорого" → объясни экономику за м²
- Экологичность и климат Таиланда — весомые аргументы
- Не пиши ссылки на карты — геолокация автоматически`;
}

// ── state ─────────────────────────────────────────────────────────────────────

const histories = {};
const dealIds = {};
const clientNames = {};
const currentStage = {};
const locationSent = {};
const meetingBooked = {};
const followUpTimers = {};
const noAnswerTimers = {};
const lastActivity = {};
const calendarEventIds = {};
const reminderTimers = {};
const managerNotified = {};

// ── Bitrix ───────────────────────────────────────────────────────────────────

async function bitrixCall(method, params) {
  try {
    const res = await fetch(`${BITRIX}/${method}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch(e) {
    console.error("Bitrix error:", e);
    return null;
  }
}

async function createDeal(chatId, name) {
  const result = await bitrixCall("crm.deal.add", {
    fields: {
      TITLE: `Paint Bot: ${name}`,
      CATEGORY_ID: BITRIX_CATEGORY,
      STAGE_ID: STAGES.new_lead,
      SOURCE_ID: "WEBFORM",
      SOURCE_DESCRIPTION: `Telegram chat ID: ${chatId}`,
      COMMENTS: `Клиент написал в Telegram бота Pratta Paints.\nTelegram ID: ${chatId}`
    }
  });
  if (result && result.result) {
    dealIds[chatId] = result.result;
    console.log(`Deal created: ${result.result} for chat ${chatId}`);
  }
}

async function updateDealStage(chatId, stage) {
  if (!dealIds[chatId] || !STAGES[stage]) return;
  await bitrixCall("crm.deal.update", {
    id: dealIds[chatId],
    fields: { STAGE_ID: STAGES[stage] }
  });
}

async function addComment(chatId, text, fromClient) {
  if (!dealIds[chatId]) return;
  await bitrixCall("crm.timeline.comment.add", {
    fields: {
      ENTITY_ID: dealIds[chatId],
      ENTITY_TYPE: "deal",
      COMMENT: fromClient ? `👤 Клиент: ${text}` : `🤖 Бот: ${text}`
    }
  });
}

async function notifyManager(chatId, clientName, stage) {
  if (managerNotified[chatId]) return;
  const dealLink = dealIds[chatId]
    ? `https://pratta.bitrix24.ru/crm/deal/details/${dealIds[chatId]}/`
    : "";

  await bitrixCall("im.notify.personal.add", {
    USER_ID: 1,
    MESSAGE: `🔔 Клиент готов к оплате!\n\nКлиент: ${clientName}\nEtap: ${stage}\nTelegram ID: ${chatId}${dealLink ? `\nСделка: ${dealLink}` : ""}`
  });

  await bitrixCall("tasks.task.add", {
    fields: {
      TITLE: `Выставить счёт: ${clientName}`,
      RESPONSIBLE_ID: 1,
      CREATED_BY: 1,
      DESCRIPTION: `Клиент из Telegram Paint Bot готов к оплате.\nTelegram ID: ${chatId}${dealLink ? `\nСделка: ${dealLink}` : ""}`,
      PRIORITY: 2
    }
  });

  managerNotified[chatId] = true;
  console.log(`Manager notified for chat ${chatId}`);
}

// ── Calendar ─────────────────────────────────────────────────────────────────

async function createMeeting(chatId, clientName, dateStr, timeStr) {
  const [hh, mm] = timeStr.split(":");
  const endHour = String(parseInt(hh) + 1).padStart(2, "0");
  const fromDt = `${dateStr}T${hh}:${mm}:00+07:00`;
  const toDt = `${dateStr}T${endHour}:${mm}:00+07:00`;
  const dealLink = dealIds[chatId]
    ? `https://pratta.bitrix24.ru/crm/deal/details/${dealIds[chatId]}/`
    : "";

  const sectionsRes = await bitrixCall("calendar.section.get", { type: "user", ownerId: 1 });
  console.log("AVAILABLE SECTIONS:", JSON.stringify(sectionsRes));
  let sectionId = undefined;
  if (sectionsRes?.result?.length > 0) {
    sectionId = sectionsRes.result[0].ID;
  }

  if (calendarEventIds[chatId]) {
    await bitrixCall("calendar.event.delete", { type: "user", ownerId: 1, id: calendarEventIds[chatId] });
  }

  const calParams = {
    type: "user", ownerId: 1,
    name: `Paint: встреча с ${clientName}`,
    from: fromDt, to: toDt,
    timezone: "Asia/Bangkok",
    timezone_from: "Asia/Bangkok",
    timezone_to: "Asia/Bangkok",
    description: `Клиент из Telegram Paint Bot.\nДата: ${dateStr} в ${timeStr}\nМесто: Шоурум Pratta Thailand, Пхукет\nChat ID: ${chatId}${dealLink ? `\nСделка: ${dealLink}` : ""}`,
    location: "Шоурум Pratta Thailand, Пхукет",
    color: "#0088CC",
    is_full_day: "N"
  };
  if (sectionId) calParams.section = sectionId;

  const calResult = await bitrixCall("calendar.event.add", calParams);
  console.log("CAL PARAMS:", JSON.stringify(calParams));
  console.log("CAL RESULT:", JSON.stringify(calResult));
  if (calResult?.result) calendarEventIds[chatId] = calResult.result;

  await bitrixCall("im.notify.personal.add", {
    USER_ID: 1,
    MESSAGE: `📅 Новая встреча (Paint Bot)!\n\nКлиент: ${clientName}\nДата: ${dateStr} в ${timeStr}\nМесто: Шоурум Pratta Thailand${dealLink ? `\nСделка: ${dealLink}` : ""}`
  });

  console.log(`Meeting created for ${clientName} on ${dateStr} at ${timeStr}`);
}

async function scheduleReminder(chatId, dateStr, timeStr) {
  const meetingTime = new Date(`${dateStr}T${timeStr}:00+07:00`);
  const reminderTime = new Date(meetingTime.getTime() - 60 * 60 * 1000);
  const delay = reminderTime.getTime() - Date.now();
  if (delay <= 0) return;
  if (reminderTimers[chatId]) clearTimeout(reminderTimers[chatId]);
  reminderTimers[chatId] = setTimeout(async () => {
    await sendMessage(chatId, `Напоминание! Сегодня в ${timeStr} ждём вас в шоуруме Pratta Thailand.\n\nЕсли планы изменились — напишите нам.`);
  }, delay);
  console.log(`Reminder scheduled for ${chatId} in ${Math.round(delay/60000)} min`);
}

// ── Telegram ─────────────────────────────────────────────────────────────────

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  });
}

async function sendDocument(chatId, fileUrl, caption) {
  await fetch(`${TELEGRAM_API}/sendDocument`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, document: fileUrl, caption })
  });
}

async function sendLocation(chatId) {
  await fetch(`${TELEGRAM_API}/sendLocation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, latitude: 7.9519, longitude: 98.3381 })
  });
}

async function sendTyping(chatId) {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" })
  });
}

async function getPhotoBase64(fileId) {
  const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();
  if (!fileData.ok) return null;
  const imgRes = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileData.result.file_path}`);
  const buffer = await imgRes.buffer();
  return buffer.toString("base64");
}

// ── Follow-up / No-answer system ──────────────────────────────────────────────

async function sendSmartFollowUp(chatId) {
  if (meetingBooked[chatId]) return;
  if (Date.now() - (lastActivity[chatId] || 0) < 5 * 60 * 1000) return;

  const stage = currentStage[chatId] || "new_lead";
  const hist = histories[chatId] || [];

  const prompt = `Клиент замолчал. Текущий этап: "${stage}".
Напиши короткий (1-2 предложения) живой follow-up чтобы возобновить диалог.
Этап qualify/new_lead → спроси про объект и площадь.
Этап clear_task → предложи расчёт.
Этап commercial_offer → спроси остались ли вопросы по цене.
Только текст, без тегов [STAGE] и прочего.`;

  try {
    const msgs = [...hist.slice(-6), { role: "user", content: prompt }];
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 150, system: getSystem(), messages: msgs })
    });
    const data = await res.json();
    const text = data.content.map(b => b.type === "text" ? b.text : "").join("").trim();
    if (text) await sendMessage(chatId, text);
    console.log("Smart follow-up sent, stage:", stage);
  } catch(e) {
    console.error("Follow-up error:", e);
  }
}

// No-answer sequence: 2h → msg2, +2d → msg3, +1d → base_for_messages
function scheduleNoAnswerSequence(chatId) {
  // Clear existing
  if (noAnswerTimers[chatId]) {
    noAnswerTimers[chatId].forEach(t => clearTimeout(t));
  }
  noAnswerTimers[chatId] = [];

  // 2 hours → 2nd message + move stage
  const t1 = setTimeout(async () => {
    if (currentStage[chatId] !== "new_lead" && currentStage[chatId] !== "msg1_no_answer") return;
    if (!isWorkingHours()) return;
    await updateDealStage(chatId, "msg2_no_answer");
    currentStage[chatId] = "msg2_no_answer";
    const msg2 = `Здравствуйте! Хотел уточнить — актуален ли ещё вопрос по краске?\n\nЕсли нужен каталог или расчёт — просто напишите 😊`;
    await sendMessage(chatId, msg2);
    if (CATALOG_URL) await sendDocument(chatId, CATALOG_URL, "Каталог красок Pratta 📋");
    console.log("No-answer msg2 sent for", chatId);
  }, 2 * 60 * 60 * 1000);

  // 2 days → 3rd message
  const t2 = setTimeout(async () => {
    if (currentStage[chatId] !== "msg2_no_answer") return;
    if (!isWorkingHours()) return;
    await updateDealStage(chatId, "msg3_no_answer");
    currentStage[chatId] = "msg3_no_answer";
    const msg3 = `Добрый день! Напоминаю о нашем разговоре 🙂\n\nЕсли проект ещё в планах — с удовольствием помогу с подбором и расчётом.`;
    await sendMessage(chatId, msg3);
    console.log("No-answer msg3 sent for", chatId);
  }, (2 * 24 + 2) * 60 * 60 * 1000);

  // 3 days → move to base_for_messages
  const t3 = setTimeout(async () => {
    if (currentStage[chatId] !== "msg3_no_answer") return;
    await updateDealStage(chatId, "base_for_messages");
    currentStage[chatId] = "base_for_messages";
    console.log("Moved to base_for_messages:", chatId);
  }, (3 * 24 + 2) * 60 * 60 * 1000);

  noAnswerTimers[chatId] = [t1, t2, t3];
}

function setFollowUpTimer(chatId) {
  if (followUpTimers[chatId]) clearTimeout(followUpTimers[chatId]);
  followUpTimers[chatId] = setTimeout(() => sendSmartFollowUp(chatId), 5 * 60 * 1000);
}

// ── Claude ────────────────────────────────────────────────────────────────────

function extractStage(reply) {
  const match = reply.match(/\[STAGE:([a-z_]+)\]/);
  return match ? match[1] : null;
}

function extractMeeting(reply) {
  const match = reply.match(/\[MEETING:([0-9-]+)\|([0-9:]+)\]/);
  return match ? { date: match[1], time: match[2] } : null;
}

async function askClaude(chatId, userMessage) {
  if (!histories[chatId]) histories[chatId] = [];
  histories[chatId].push({ role: "user", content: userMessage });
  if (histories[chatId].length > 30) histories[chatId] = histories[chatId].slice(-30);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: getSystem(), messages: histories[chatId] })
  });
  const data = await res.json();
  const reply = data.content.map(b => b.type === "text" ? b.text : "").join("");
  histories[chatId].push({ role: "assistant", content: reply });
  return reply;
}

async function askClaudeWithPhoto(chatId, userMessage, photoBase64) {
  if (!histories[chatId]) histories[chatId] = [];
  const userContent = [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: photoBase64 } },
    { type: "text", text: userMessage || "Клиент прислал фото." }
  ];
  histories[chatId].push({ role: "user", content: userContent });
  if (histories[chatId].length > 30) histories[chatId] = histories[chatId].slice(-30);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: getSystem(), messages: histories[chatId] })
  });
  const data = await res.json();
  const reply = data.content.map(b => b.type === "text" ? b.text : "").join("");
  histories[chatId].push({ role: "assistant", content: reply });
  return reply;
}

// ── Webhook ───────────────────────────────────────────────────────────────────

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.message;
  if (!msg) return;

  const hasText = !!msg.text;
  const hasPhoto = !!(msg.photo?.length > 0);
  if (!hasText && !hasPhoto) return;

  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || "";
  const userName = msg.from.first_name || "Клиент";
  lastActivity[chatId] = Date.now();

  // /start
  if (text === "/start") {
    histories[chatId] = [];
    locationSent[chatId] = false;
    managerNotified[chatId] = false;
    await createDeal(chatId, userName);
    currentStage[chatId] = "new_lead";
    await updateDealStage(chatId, "msg1_no_answer");
    const greeting = `Привет! 👋 Это Pratta Thailand — краски Plastogum и Mister Quartz.\n\nЧто красите — фасад, интерьер или мокрые зоны?`;
    await sendMessage(chatId, greeting);
    scheduleNoAnswerSequence(chatId);
    setFollowUpTimer(chatId);
    return;
  }

  if (!dealIds[chatId]) {
    await createDeal(chatId, userName);
    currentStage[chatId] = "new_lead";
    scheduleNoAnswerSequence(chatId);
  }

  // Клиент ответил — отменяем no-answer таймеры
  if (noAnswerTimers[chatId]) {
    noAnswerTimers[chatId].forEach(t => clearTimeout(t));
    noAnswerTimers[chatId] = [];
  }

  clientNames[chatId] = userName;

  const commentText = hasPhoto ? `[Фото]${text ? " " + text : ""}` : text;
  await addComment(chatId, commentText, true);

  // Задержка 3–5 сек
  const delay = 3000 + Math.floor(Math.random() * 2000);
  await new Promise(r => setTimeout(r, delay));
  await sendTyping(chatId);

  try {
    let reply;
    if (hasPhoto) {
      const photo = msg.photo[msg.photo.length - 1];
      const photoBase64 = await getPhotoBase64(photo.file_id);
      reply = photoBase64
        ? await askClaudeWithPhoto(chatId, text, photoBase64)
        : await askClaude(chatId, text || "Клиент прислал фото.");
    } else {
      reply = await askClaude(chatId, text);
    }

    console.log("RAW REPLY:", reply);

    const stage = extractStage(reply);
    const meeting = extractMeeting(reply);
    const sendCatalog = reply.includes("[SEND_CATALOG]");
    const sendColorCatalog = reply.includes("[SEND_COLOR_CATALOG]");
    const notifyMgr = reply.includes("[NOTIFY_MANAGER]") || stage === "invoice";

    // Очищаем теги из текста для клиента
    let cleanReply = reply
      .replace(/\[STAGE:[a-z_]+\]/g, "")
      .replace(/\[CALC:[^\]]+\]/g, "")
      .replace(/\[MEETING:[^\]]+\]/g, "")
      .replace(/\[SEND_CATALOG\]/g, "")
      .replace(/\[SEND_COLOR_CATALOG\]/g, "")
      .replace(/\[NOTIFY_MANAGER\]/g, "")
      .replace(/https:\/\/maps\.app\.goo\.gl\/\S+/g, "")
      .trim();

    // Геолокация — один раз за диалог при упоминании шоурума
    if (!locationSent[chatId] && (meeting || cleanReply.toLowerCase().includes("шоурум") || cleanReply.toLowerCase().includes("showroom"))) {
      await sendLocation(chatId);
      locationSent[chatId] = true;
    }

    await sendMessage(chatId, cleanReply);
    await addComment(chatId, cleanReply, false);

    // Обновляем этап
    if (stage) {
      currentStage[chatId] = stage;
      await updateDealStage(chatId, stage);
    } else if (currentStage[chatId] === "new_lead") {
      // Первый ответ клиента → answer
      currentStage[chatId] = "answer";
      await updateDealStage(chatId, "answer");
    }

    // Каталоги
    if (sendCatalog && CATALOG_URL) {
      await sendDocument(chatId, CATALOG_URL, "Каталог красок Pratta 📋");
    }
    if (sendColorCatalog && COLOR_CATALOG_URL) {
      await sendDocument(chatId, COLOR_CATALOG_URL, "Каталог цветов Pratta 🎨");
    }

    // Встреча
    if (meeting) {
      await createMeeting(chatId, clientNames[chatId] || userName, meeting.date, meeting.time);
      meetingBooked[chatId] = true;
      await scheduleReminder(chatId, meeting.date, meeting.time);
    }

    // Уведомление менеджера при invoice
    if (notifyMgr) {
      await notifyManager(chatId, clientNames[chatId] || userName, stage || "invoice");
    }

  } catch(e) {
    console.error(e);
    await sendMessage(chatId, "Произошла ошибка, попробуйте ещё раз.");
  }

  setFollowUpTimer(chatId);
});

app.get("/", (req, res) => res.send("Pratta Paint Bot работает ✓"));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Paint Bot running on port ${PORT}`));
