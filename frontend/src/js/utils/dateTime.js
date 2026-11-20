export const INSTITUTIONAL_TIMEZONE = 'America/La_Paz';

/**
 * Retorna la fecha calendario actual (o de un Date dado) en zona horaria Bolivia ('YYYY-MM-DD').
 * Evita que pasadas las 20:00 (UTC-4) el método toISOString() devuelva el día siguiente.
 */
export function getBoliviaTodayDateString(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: INSTITUTIONAL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Normaliza una fecha/hora de base de datos o input a visualización institucional en Bolivia.
 */
export function getBoliviaNowSqlString(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: INSTITUTIONAL_TIMEZONE,
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
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
