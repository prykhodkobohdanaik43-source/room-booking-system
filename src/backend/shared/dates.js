export const MINUTE_MS = 60_000;

export function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

export function parseDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

// 'YYYY-MM-DD' -> межі доби в часовому поясі сервера
export function dayRange(isoDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDay ?? ''))) return null;
  const from = new Date(`${isoDay}T00:00:00`);
  if (Number.isNaN(from.getTime())) return null;
  return { from, to: addDays(from, 1) };
}

export function parseDay(isoDay) {
  return dayRange(isoDay)?.from ?? null;
}

export function toIsoDay(date) {
  if (!date) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
