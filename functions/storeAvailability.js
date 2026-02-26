const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const parseTimeToMinutes = (value) => {
  if (typeof value !== "string") return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
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

const resolveScheduleDay = (storeConfig, dayKey) => {
  const day = storeConfig?.schedule?.[dayKey];
  if (day && typeof day === "object" && !Array.isArray(day)) {
    return {
      enabled: Boolean(day.enabled),
      open: day.open || "08:00",
      close: day.close || "18:00",
    };
  }

  const legacyRanges = Array.isArray(storeConfig?.schedule?.weekly?.[dayKey]) ? storeConfig.schedule.weekly[dayKey] : [];
  const firstRange = legacyRanges[0];
  if (firstRange) {
    return {
      enabled: true,
      open: firstRange.start || "08:00",
      close: firstRange.end || "18:00",
    };
  }

  return {enabled: false, open: "08:00", close: "18:00"};
};

const getNextOpeningTime = (storeConfig, now = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const zoned = getZonedParts(now, timezone);
  const nowMinutes = zoned.hour * 60 + zoned.minute;

  for (let offset = 0; offset < 7; offset += 1) {
    const day = WEEKDAY_KEYS[(zoned.weekdayIndex + offset) % 7];
    const dayConfig = resolveScheduleDay(storeConfig, day);
    if (!dayConfig.enabled) continue;
    const start = parseTimeToMinutes(dayConfig.open);
    if (start === null) continue;
    if (offset > 0 || start > nowMinutes) {
      return {dayOffset: offset, start: dayConfig.open, label: dayConfig.open};
    }
  }

  return null;
};

const isStoreOpenNow = (rawStoreConfig, now = new Date()) => {
  const storeConfig = rawStoreConfig?.storeAvailability || rawStoreConfig || {};
  const timezone = storeConfig?.timezone || storeConfig?.schedule?.timezone || DEFAULT_TIMEZONE;
  const mode = storeConfig?.manualOverride?.mode || "auto";

  if (mode === "force_open") {
    return {isOpen: true, message: "Loja aberta por ação do gestor"};
  }

  if (mode === "force_closed") {
    return {isOpen: false, message: "A loja está fechada no momento. Volte em nosso horário de atendimento."};
  }

  const zoned = getZonedParts(now, timezone);
  const dayKey = WEEKDAY_KEYS[zoned.weekdayIndex];
  const nowMinutes = zoned.hour * 60 + zoned.minute;
  const day = resolveScheduleDay(storeConfig, dayKey);

  if (!day.enabled) {
    const next = getNextOpeningTime(storeConfig, now, timezone);
    return {
      isOpen: false,
      message: next?.label ? `A loja está fechada no momento. Abrimos às ${next.label}.` : "A loja está fechada no momento. Volte em nosso horário de atendimento.",
      nextOpenAt: next || null,
    };
  }

  const openMinutes = parseTimeToMinutes(day.open);
  const closeMinutes = parseTimeToMinutes(day.close);

  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
    return {isOpen: false, message: "A loja está fechada no momento. Volte em nosso horário de atendimento."};
  }

  const isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  if (isOpen) return {isOpen: true, message: "Loja aberta"};

  const next = getNextOpeningTime(storeConfig, now, timezone);
  return {
    isOpen: false,
    message: next?.label ? `A loja está fechada no momento. Abrimos às ${next.label}.` : "A loja está fechada no momento. Volte em nosso horário de atendimento.",
    nextOpenAt: next || null,
  };
};

module.exports = {isStoreOpenNow, getNextOpeningTime};
