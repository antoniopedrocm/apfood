const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const parseTimeToMinutes = (hhmm) => {
  if (typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const getZonedParts = (date, timezone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
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

const resolveScheduleDay = (storeConfig, weekdayKey) => {
  const dayConfig = storeConfig?.schedule?.[weekdayKey];
  if (dayConfig && typeof dayConfig === 'object' && !Array.isArray(dayConfig)) {
    return {
      enabled: Boolean(dayConfig.enabled),
      open: dayConfig.open || '08:00',
      close: dayConfig.close || '18:00',
    };
  }

  const legacyRanges = Array.isArray(storeConfig?.schedule?.weekly?.[weekdayKey]) ? storeConfig.schedule.weekly[weekdayKey] : [];
  const firstRange = legacyRanges[0];
  if (firstRange) {
    return {
      enabled: true,
      open: firstRange.start || '08:00',
      close: firstRange.end || '18:00',
    };
  }

  return { enabled: false, open: '08:00', close: '18:00' };
};

const getNextOpeningTime = (storeConfig, now = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const zoned = getZonedParts(now, timezone);
  const nowMinutes = zoned.hour * 60 + zoned.minute;

  for (let offset = 0; offset < 7; offset += 1) {
    const weekdayKey = WEEKDAY_KEYS[(zoned.weekdayIndex + offset) % 7];
    const day = resolveScheduleDay(storeConfig, weekdayKey);
    if (!day.enabled) continue;

    const start = parseTimeToMinutes(day.open);
    if (start === null) continue;
    if (offset > 0 || start > nowMinutes) {
      return { dayOffset: offset, start: day.open, label: day.open };
    }
  }

  return null;
};

export const isStoreOpenNow = (rawStoreConfig, now = new Date()) => {
  const storeConfig = rawStoreConfig?.storeAvailability || rawStoreConfig || {};
  const timezone = storeConfig?.timezone || storeConfig?.schedule?.timezone || DEFAULT_TIMEZONE;
  const mode = storeConfig?.manualOverride?.mode || 'auto';

  if (mode === 'force_open') {
    return { isOpen: true, message: 'Loja aberta por ação do gestor' };
  }
  if (mode === 'force_closed') {
    return { isOpen: false, message: 'A loja está fechada no momento. Volte em nosso horário de atendimento.' };
  }

  const zoned = getZonedParts(now, timezone);
  const weekdayKey = WEEKDAY_KEYS[zoned.weekdayIndex];
  const nowMinutes = zoned.hour * 60 + zoned.minute;
  const day = resolveScheduleDay(storeConfig, weekdayKey);

  if (!day.enabled) {
    const nextOpen = getNextOpeningTime(storeConfig, now, timezone);
    return {
      isOpen: false,
      message: nextOpen?.label ? `A loja está fechada no momento. Abrimos às ${nextOpen.label}.` : 'A loja está fechada no momento. Volte em nosso horário de atendimento.',
      nextOpenAt: nextOpen || null,
    };
  }

  const openMinutes = parseTimeToMinutes(day.open);
  const closeMinutes = parseTimeToMinutes(day.close);

  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
    return { isOpen: false, message: 'A loja está fechada no momento. Volte em nosso horário de atendimento.' };
  }

  const isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  if (isOpen) {
    return { isOpen: true, message: 'Loja aberta' };
  }

  const nextOpen = getNextOpeningTime(storeConfig, now, timezone);
  return {
    isOpen: false,
    message: nextOpen?.label ? `A loja está fechada no momento. Abrimos às ${nextOpen.label}.` : 'A loja está fechada no momento. Volte em nosso horário de atendimento.',
    nextOpenAt: nextOpen || null,
  };
};

const DEFAULT_DAY = { enabled: true, open: '08:00', close: '18:00' };

export const DEFAULT_OPERACAO = {
  timezone: DEFAULT_TIMEZONE,
  schedule: {
    mon: { ...DEFAULT_DAY },
    tue: { ...DEFAULT_DAY },
    wed: { ...DEFAULT_DAY },
    thu: { ...DEFAULT_DAY },
    fri: { ...DEFAULT_DAY },
    sat: { enabled: true, open: '09:00', close: '14:00' },
    sun: { enabled: false, open: '08:00', close: '18:00' },
  },
  manualOverride: {
    mode: 'auto',
    updatedAt: null,
    updatedBy: null,
  },
};

export const WEEK_SCHEDULE_KEYS = WEEKDAY_KEYS;
