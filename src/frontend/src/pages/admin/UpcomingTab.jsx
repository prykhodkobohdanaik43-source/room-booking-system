import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.js';
import { Alert } from '../../components/Alert.jsx';
import { formatDateTime, formatTime } from '../../format.js';
import { useAsync } from '../../useAsync.js';

// ФВ-09: усі поточні й майбутні броні з авторами; ФВ-10: скасування чужої броні лише з причиною
export function UpcomingTab() {
  const { api } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.adminBookings(), [api]);
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState(null);

  async function confirmCancel(event) {
    event.preventDefault();
    setActionError(null);
    try {
      await api.cancelBooking(cancelling, reason);
      setCancelling(null);
      setReason('');
      reload();
    } catch (failure) {
      setActionError(failure);
    }
  }

  if (!data && loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;
  if (data.length === 0) return <p className="state">Поточних і майбутніх броней немає</p>;

  return (
    <ul className="records">
      {data.map((booking) => (
        <li key={booking.id} className="record">
          <div className="record__main">
            <strong>{booking.roomName}</strong>
            <span>
              {formatDateTime(booking.startTime)} – {formatTime(booking.endTime)}
            </span>
            <span className="record__meta">
              {booking.authorName} · {booking.participantsCount} учасн.
            </span>
          </div>
          <div className="actions">
            {cancelling === booking.id ? (
              <form className="inline-form" onSubmit={confirmCancel}>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Причина скасування"
                  aria-label="Причина скасування"
                  required
                  autoFocus
                />
                <button type="submit" disabled={!reason.trim()}>
                  Скасувати бронь
                </button>
                <button type="button" className="link" onClick={() => setCancelling(null)}>
                  Не скасовувати
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="link"
                onClick={() => {
                  setCancelling(booking.id);
                  setReason('');
                  setActionError(null);
                }}
              >
                Скасувати
              </button>
            )}
          </div>
          {cancelling === booking.id && <Alert error={actionError} />}
        </li>
      ))}
    </ul>
  );
}
