const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const normalizeInterval = (interval) => {
  if (!interval || typeof interval !== 'object') return null;
  const start = String(interval.start || '').trim();
  const end = String(interval.end || '').trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  return { start, end };
};

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const getZonedDateParts = (date = new Date(), timeZone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const weekdayMap = { Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat' };
  return {
    weekday: weekdayMap[parts.weekday] || 'sun',
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

const isOverrideActive = (override, nowDate) => {
  if (!override || !override.enabled) return false;
  if (!override.until) return true;

  const untilDate = typeof override.until?.toDate === 'function' ? override.until.toDate() : new Date(override.until);
  return Number.isFinite(untilDate.getTime()) && untilDate.getTime() > nowDate.getTime();
};

const getNextOpeningTime = (storeOperacao, now = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const weekly = storeOperacao?.schedule?.weekly || {};
  const nowParts = getZonedDateParts(now, timezone);
  const currentIndex = WEEKDAY_KEYS.indexOf(nowParts.weekday);

  for (let offset = 0; offset < 7; offset += 1) {
    const dayIndex = (currentIndex + offset) % 7;
    const dayKey = WEEKDAY_KEYS[dayIndex];
    const intervals = (weekly[dayKey] || []).map(normalizeInterval).filter(Boolean);
    if (!intervals.length) continue;

    const sorted = intervals
      .map((interval) => ({ ...interval, startMinutes: toMinutes(interval.start) }))
      .filter((interval) => interval.startMinutes !== null)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    if (!sorted.length) continue;

    if (offset === 0) {
      const nowMinutes = nowParts.hour * 60 + nowParts.minute;
      const next = sorted.find((interval) => interval.startMinutes > nowMinutes);
      if (next) return { dayKey, time: next.start, offsetDays: offset };
      continue;
    }

    return { dayKey, time: sorted[0].start, offsetDays: offset };
  }

  return null;
};

const isStoreOpenNow = (storeOperacao, now = new Date(), timezoneParam) => {
  const timezone = timezoneParam || storeOperacao?.schedule?.timezone || DEFAULT_TIMEZONE;
  const nowDate = now instanceof Date ? now : new Date(now);

  const override = storeOperacao?.override;
  if (isOverrideActive(override, nowDate)) {
    if (override.mode === 'CLOSED') {
      return { isOpen: false, message: override.reason || 'Loja fechada no momento', source: 'override-closed' };
    }
    if (override.mode === 'OPEN') {
      return { isOpen: true, message: 'Loja aberta por exceção', source: 'override-open' };
    }
  }

  if (storeOperacao?.manualOpen === false) {
    return { isOpen: false, message: 'Loja fechada (pausada pelo gestor)', source: 'manual-closed' };
  }

  const weekly = storeOperacao?.schedule?.weekly || {};
  const nowParts = getZonedDateParts(nowDate, timezone);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;
  const todayIntervals = (weekly[nowParts.weekday] || []).map(normalizeInterval).filter(Boolean);

  const isOpen = todayIntervals.some((interval) => {
    const start = toMinutes(interval.start);
    const end = toMinutes(interval.end);
    return start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
  });

  if (isOpen) return { isOpen: true, message: 'Loja aberta', source: 'schedule' };

  const nextOpening = getNextOpeningTime(storeOperacao, nowDate, timezone);
  if (nextOpening?.time) {
    return { isOpen: false, message: `Loja fechada • Abre às ${nextOpening.time}`, nextOpenAt: nextOpening, source: 'schedule-closed' };
  }

  return { isOpen: false, message: 'Loja fechada', source: 'schedule-closed' };
};

module.exports = { isStoreOpenNow, getNextOpeningTime };
