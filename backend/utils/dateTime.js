export const INSTITUTIONAL_TIMEZONE = 'America/La_Paz';

/**
 * Extrae partes de fecha/hora en la zona horaria oficial de Bolivia (UTC-4).
 * Evita desfases de día después de las 20:00 hora local por conversión a UTC.
 */
function getZonedParts(dateInput = new Date(), timeZone = INSTITUTIONAL_TIMEZONE) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) {
    throw new Error('Fecha inválida para formateo institucional.');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }
  return parts;
}

/**
 * Retorna la fecha actual o dada en Bolivia con formato 'YYYY-MM-DD'.
 */
export function getBoliviaTodayDateString(dateInput = new Date()) {
  const p = getZonedParts(dateInput);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Retorna fecha y hora en Bolivia con formato SQL 'YYYY-MM-DD HH:MM:SS'.
 */
export function getBoliviaNowSqlString(dateInput = new Date()) {
  const p = getZonedParts(dateInput);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/**
 * Retorna fecha y hora ISO con offset explícito de Bolivia (-04:00).
 */
export function getBoliviaNowIsoOffset(dateInput = new Date()) {
  const p = getZonedParts(dateInput);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}-04:00`;
}

/**
 * Calcula diferencia entera de días calendario entre una fecha 'YYYY-MM-DD'
 * y el día actual en Bolivia sin verse afectada por UTC.
 */
export function diffCalendarDaysBolivia(targetDateStr, refDate = new Date()) {
  if (!targetDateStr || typeof targetDateStr !== 'string') return null;
  const match = targetDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const targetMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const todayStr = getBoliviaTodayDateString(refDate);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayMs = Date.UTC(ty, tm - 1, td);

  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}
