const time = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' });

export const formatTime = (value) => time.format(new Date(value));
export const formatDay = (value) => day.format(new Date(value));
export const formatRange = (from, to) => `${formatTime(from)} – ${formatTime(to)}`;

export function toIsoDay(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
