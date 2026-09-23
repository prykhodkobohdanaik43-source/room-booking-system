const time = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' });
const dayWithWeekday = new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
const dateTime = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatTime = (value) => time.format(new Date(value));
export const formatDay = (value) => day.format(new Date(value));
export const formatDayWithWeekday = (value) => dayWithWeekday.format(new Date(value));
export const formatDateTime = (value) => dateTime.format(new Date(value));
export const formatRange = (from, to) => `${formatTime(from)} – ${formatTime(to)}`;

export function toIsoDay(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Понеділок тижня, до якого належить дата (тиждень українською починається з понеділка)
export function startOfWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

// ФВ-08: відмітку про прихід можна поставити протягом 10 хвилин після початку
export const ARRIVAL_WINDOW_MS = 10 * 60_000;

export const statusLabels = Object.freeze({
  ACTIVE: 'Активна',
  CONFIRMED: 'Підтверджена',
  CANCELLED: 'Скасована',
  AUTO_CANCELLED: 'Автоскасована',
});
