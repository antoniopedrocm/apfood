const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const parseTimeToMinutes = (value) => {
  if (typeof value !== "string") return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  return h * 60 + m;
};

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const getZonedParts = (date, timezone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  const map = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6};
  return {
    weekdayIndex: map[parts.weekday] ?? 0,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

const getNextOpeningTime = (operacao, now = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const zoned = getZonedParts(now, timezone);
  const nowMinutes = zoned.hour * 60 + zoned.minute;

  for (let offset = 0; offset < 7; offset += 1) {
    const day = WEEKDAY_KEYS[(zoned.weekdayIndex + offset) % 7];
    const intervals = Array.isArray(operacao?.schedule?.weekly?.[day]) ? operacao.schedule.weekly[day] : [];
    const sorted = intervals
      .map((it) => ({start: it.start, startMinutes: parseTimeToMinutes(it.start)}))
      .filter((it) => it.startMinutes !== null)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const candidate = sorted.find((it) => offset > 0 || it.startMinutes > nowMinutes);
    if (candidate) {
      const hh = String(Math.floor(candidate.startMinutes / 60)).padStart(2, "0");
      const mm = String(candidate.startMinutes % 60).padStart(2, "0");
      return {dayOffset: offset, start: candidate.start, label: `${hh}:${mm}`};
    }
  }
  return null;
};

const isStoreOpenNow = (operacao, now = new Date(), timezoneInput) => {
  const timezone = timezoneInput || operacao?.schedule?.timezone || DEFAULT_TIMEZONE;
  const override = operacao?.override || {};
  const until = toMillis(override.until);
  const overrideOn = Boolean(override.enabled) && (!until || until > now.getTime());

  if (overrideOn && override.mode === "CLOSED") {
    return {isOpen: false, message: override.reason || "Loja fechada no momento"};
  }
  if (overrideOn && override.mode === "OPEN") {
    return {isOpen: true, message: "Loja aberta por exceção"};
  }

  if (operacao?.manualOpen === false) {
    return {isOpen: false, message: "Loja fechada (pausada pelo gestor)"};
  }

  const zoned = getZonedParts(now, timezone);
  const day = WEEKDAY_KEYS[zoned.weekdayIndex];
  const nowMinutes = zoned.hour * 60 + zoned.minute;
  const intervals = Array.isArray(operacao?.schedule?.weekly?.[day]) ? operacao.schedule.weekly[day] : [];

  const isOpen = intervals.some((it) => {
    const start = parseTimeToMinutes(it.start);
    const end = parseTimeToMinutes(it.end);
    return start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
  });

  if (isOpen) return {isOpen: true, message: "Loja aberta"};

  const next = getNextOpeningTime(operacao, now, timezone);
  if (next) return {isOpen: false, message: `Loja fechada • Abre às ${next.label}`, nextOpenAt: next};
  return {isOpen: false, message: "Loja fechada"};
};

module.exports = {isStoreOpenNow, getNextOpeningTime};
