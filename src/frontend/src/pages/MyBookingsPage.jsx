import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { ARRIVAL_WINDOW_MS, formatDay, formatRange, statusLabels } from '../format.js';
import { useAsync } from '../useAsync.js';
import { useNow } from '../useNow.js';

// ФВ-06, ФВ-07, ФВ-08: власні броні з діями «Я на місці», «Редагувати», «Скасувати».
// Кнопки показуються лише тоді, коли дія дозволена; остаточне рішення завжди за сервером.
export function MyBookingsPage() {
  const { api } = useAuth();
  const now = useNow();
  const { data, error, loading, reload } = useAsync(() => api.myBookings(), [api]);
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function act(action, successMessage) {
    setActionError(null);
    setNotice(null);
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      reload();
    } catch (failure) {
      setActionError(failure);
      reload();
    }
  }

  if (!data && loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;

  return (
    <section>
      <h1 className="page-title">Мої броні</h1>
      <Alert error={actionError} />
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {data.length === 0 ? (
        <p className="state">
          У вас немає чинних броней. <Link to="/book">Забронювати кімнату</Link>
        </p>
      ) : (
        <ul className="records">
          {data.map((booking) => {
            const start = new Date(booking.startTime);
            const isActive = booking.status === 'ACTIVE';
            const beforeStart = now < start;
            const inArrivalWindow = !beforeStart && now.getTime() < start.getTime() + ARRIVAL_WINDOW_MS;

            return (
              <li key={booking.id} className="record">
                <div className="record__main">
                  <strong>{booking.roomName}</strong>
                  <span>
                    {formatDay(booking.startTime)}, {formatRange(booking.startTime, booking.endTime)}
                  </span>
                  <span className="record__meta">
                    {booking.participantsCount} учасн. ·{' '}
                    <span className={`badge badge--${booking.status.toLowerCase()}`}>
                      {statusLabels[booking.status]}
                    </span>
                  </span>
                </div>
                <div className="actions">
                  {isActive && inArrivalWindow && (
                    <button
                      type="button"
                      onClick={() => act(() => api.confirmArrival(booking.id), 'Прихід підтверджено')}
                    >
                      Я на місці
                    </button>
                  )}
                  {isActive && beforeStart && (
                    <>
                      <Link className="link" to={`/bookings/${booking.id}/edit`}>
                        Редагувати
                      </Link>
                      <button type="button" className="link" onClick={() => act(() => api.cancelBooking(booking.id))}>
                        Скасувати
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
