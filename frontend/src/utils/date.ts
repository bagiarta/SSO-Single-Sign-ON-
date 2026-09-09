// SQL Server DATETIME2 is a wall-clock value without timezone metadata.
// The MSSQL driver serializes it with a trailing Z; interpret it as the
// configured server timezone so the browser does not shift it twice.
export const APP_TIMEZONE = process.env.REACT_APP_TIMEZONE || 'Asia/Shanghai';

export function parseServerDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(raw)) {
    return new Date(`${raw.slice(0, -1)}+08:00`);
  }
  return new Date(raw);
}

export function formatServerDate(value?: string | Date, withTime = true): string {
  if (!value) return '—';
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: APP_TIMEZONE,
  }).format(date);
}
