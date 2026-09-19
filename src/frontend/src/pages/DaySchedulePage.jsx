import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { formatRange, toIsoDay } from '../format.js';
import { useAsync } from '../useAsync.js';

// ФВ-02, ФВ-06: розклад на день і скасування власної броні
export function DaySchedulePage() {
  const { api, user } = useAuth();
  const [isoDay, setIsoDay] = useState(() => toIsoDay(new Date()));
  const { data, error, loading, reload } = useAsync(() => api.daySchedule(isoDay), [api, isoDay]);
  const [actionError, setActionError] = useState(null);

  async function cancel(bookingId) {
    setActionError(null);
    try {
      await api.cancelBooking(bookingId);
      reload();
    } catch (cancelError) {
      setActionError(cancelError);
    }
  }

  return (
    <section>
      <h1 className="page-title">Розклад кімнат</h1>
      <Field label="Дата">
        <input type="date" value={isoDay} onChange={(event) => setIsoDay(event.target.value)} />
      </Field>

      <Alert error={error ?? actionError} />
      {loading && <p className="state">Завантаження…</p>}

      {data?.map(({ room, bookings }) => (
        <article key={room.id} className="day-room">
          <h2>
            {room.name} <span className="day-room__capacity">до {room.capacity} осіб</span>
          </h2>
          {bookings.length === 0 ? (
            <p className="state">Вільна весь день</p>
          ) : (
            <ul className="slots">
              {bookings.map((booking) => (
                <li key={booking.id} className="slot">
                  <span>{formatRange(booking.startTime, booking.endTime)}</span>
                  <span className="slot__people">{booking.participantsCount} учасн.</span>
                  {booking.authorId === user.id && (
                    <button type="button" className="link" onClick={() => cancel(booking.id)}>
                      Скасувати
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </section>
  );
}
