import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { addDays, formatDayWithWeekday, formatRange, startOfWeek, toIsoDay } from '../format.js';
import { useAsync } from '../useAsync.js';

// ФВ-03: розклад усіх кімнат на 7 днів поспіль; дні йдуть один під одним, тож на телефоні немає бічної прокрутки
export function WeekSchedulePage() {
  const { api } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const isoStart = toIsoDay(weekStart);
  const { data, error, loading } = useAsync(() => api.weekSchedule(isoStart), [api, isoStart]);

  const shift = (weeks) => setWeekStart(addDays(weekStart, weeks * 7));

  return (
    <section>
      <h1 className="page-title">Розклад на тиждень</h1>
      <div className="toolbar">
        <button type="button" className="secondary" onClick={() => shift(-1)}>
          ← Попередній
        </button>
        <span className="toolbar__label">
          {formatDayWithWeekday(weekStart)} – {formatDayWithWeekday(addDays(weekStart, 6))}
        </span>
        <button type="button" className="secondary" onClick={() => shift(1)}>
          Наступний →
        </button>
      </div>

      <Alert error={error} />
      {loading && !data && <p className="state">Завантаження…</p>}

      {data?.map((day) => {
        const busyRooms = day.rooms.filter(({ bookings }) => bookings.length > 0);
        return (
          <article key={day.date} className="week-day" aria-label={day.date}>
            <h2>{formatDayWithWeekday(`${day.date}T00:00:00`)}</h2>
            {busyRooms.length === 0 ? (
              <p className="state">Усі кімнати вільні</p>
            ) : (
              <ul className="slots">
                {busyRooms.map(({ room, bookings }) => (
                  <li key={room.id} className="slot">
                    <strong>{room.name}</strong>
                    <span>{bookings.map((booking) => formatRange(booking.startTime, booking.endTime)).join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </section>
  );
}
