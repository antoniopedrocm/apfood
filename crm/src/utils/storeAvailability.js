const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const DAY_MINUTES = 24 * 60;

const toTimestampMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const parseTimeToMinutes = (hhmm) => {
  if (typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const formatMinutes = (minutes) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const getZonedParts = (date, timezone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    weekdayIndex: weekdayMap[parts.weekday] ?? 0,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

const getDayIntervals = (storeOperacao, weekdayKey) => {
  const intervals = storeOperacao?.schedule?.weekly?.[weekdayKey];
  return Array.isArray(intervals) ? intervals : [];
};

export const getNextOpeningTime = (storeOperacao, now = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const zoned = getZonedParts(now, timezone);
  const nowMinutes = zoned.hour * 60 + zoned.minute;

  for (let offset = 0; offset < 7; offset += 1) {
    const weekdayKey = WEEKDAY_KEYS[(zoned.weekdayIndex + offset) % 7];
    const intervals = getDayIntervals(storeOperacao, weekdayKey);

    const sorted = intervals
      .map((range) => ({ ...range, startMinutes: parseTimeToMinutes(range.start) }))
      .filter((range) => range.startMinutes !== null)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const next = sorted.find((range) => (offset > 0 ? true : range.startMinutes > nowMinutes));
    if (next) {
      return { dayOffset: offset, start: next.start, label: formatMinutes(next.startMinutes) };
    }
  }

  return null;
};

export const isStoreOpenNow = (storeOperacao, now = new Date(), timezoneInput) => {
  const timezone = timezoneInput || storeOperacao?.schedule?.timezone || DEFAULT_TIMEZONE;
  const manualOpen = storeOperacao?.manualOpen !== false;
  const override = storeOperacao?.override || {};
  const overrideUntil = toTimestampMillis(override?.until);
  const hasValidOverride = Boolean(override?.enabled) && (!overrideUntil || overrideUntil > now.getTime());

  if (hasValidOverride) {
    if (override.mode === 'CLOSED') {
      return {
        isOpen: false,
        message: override.reason?.trim() || 'Loja fechada no momento',
        reason: override.reason?.trim() || null,
      };
    }

    if (override.mode === 'OPEN') {
      return { isOpen: true, message: 'Loja aberta por exceção' };
    }
  }

  if (!manualOpen) {
    return { isOpen: false, message: 'Loja fechada (pausada pelo gestor)' };
  }

  const zoned = getZonedParts(now, timezone);
  const weekdayKey = WEEKDAY_KEYS[zoned.weekdayIndex];
  const nowMinutes = zoned.hour * 60 + zoned.minute;
  const intervals = getDayIntervals(storeOperacao, weekdayKey)
    .map((range) => ({
      ...range,
      startMinutes: parseTimeToMinutes(range.start),
      endMinutes: parseTimeToMinutes(range.end),
    }))
    .filter((range) => range.startMinutes !== null && range.endMinutes !== null)
    .map((range) => ({ ...range, endMinutes: range.endMinutes === 0 ? DAY_MINUTES : range.endMinutes }));

  const isWithinAnyInterval = intervals.some((range) => nowMinutes >= range.startMinutes && nowMinutes < range.endMinutes);
  if (isWithinAnyInterval) {
    return { isOpen: true, message: 'Loja aberta' };
  }

  const nextOpening = getNextOpeningTime(storeOperacao, now, timezone);
  if (nextOpening?.label) {
    return { isOpen: false, message: `Loja fechada • Abre às ${nextOpening.label}`, nextOpenAt: nextOpening };
  }

  return { isOpen: false, message: 'Loja fechada' };
};

export const DEFAULT_OPERACAO = {
  manualOpen: true,
  schedule: {
    timezone: DEFAULT_TIMEZONE,
    weekly: {
      mon: [{ start: '08:00', end: '18:00' }],
      tue: [{ start: '08:00', end: '18:00' }],
      wed: [{ start: '08:00', end: '18:00' }],
      thu: [{ start: '08:00', end: '18:00' }],
      fri: [{ start: '08:00', end: '18:00' }],
      sat: [{ start: '09:00', end: '14:00' }],
      sun: [],
    },
  },
  override: {
    enabled: false,
    mode: 'CLOSED',
    reason: '',
    until: null,
  },
};
