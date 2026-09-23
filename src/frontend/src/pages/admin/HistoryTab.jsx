import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.js';
import { Alert } from '../../components/Alert.jsx';
import { addDays, formatDateTime, formatTime, statusLabels, toIsoDay } from '../../format.js';
import { useAsync } from '../../useAsync.js';
import { PeriodFields } from './PeriodFields.jsx';

// ФВ-11: історія за період з усіма чотирма статусами, автором, ініціатором і причиною скасування
export function HistoryTab() {
  const { api } = useAuth();
  const [period, setPeriod] = useState(() => ({ from: toIsoDay(addDays(new Date(), -7)), to: toIsoDay(new Date()) }));
  const { data, error, loading } = useAsync(() => api.bookingHistory(period.from, period.to), [api, period]);

  return (
    <div>
      <PeriodFields {...period} onChange={setPeriod} />
      <Alert error={error} />
      {loading && !data && <p className="state">Завантаження…</p>}
      {data?.length === 0 && <p className="state">За цей період броней немає</p>}
      <ul className="records">
        {data?.map((booking) => (
          <li key={booking.id} className="record">
            <div className="record__main">
              <strong>{booking.roomName}</strong>
              <span>
                {formatDateTime(booking.startTime)} – {formatTime(booking.endTime)}
              </span>
              <span className="record__meta">
                {booking.authorName} · {booking.participantsCount} учасн. ·{' '}
                <span className={`badge badge--${booking.status.toLowerCase()}`}>{statusLabels[booking.status]}</span>
              </span>
              {booking.cancelReason && (
                <span className="record__meta">
                  {booking.cancelledByName ? `Скасував(ла): ${booking.cancelledByName}. ` : 'Скасувала система. '}
                  Причина: {booking.cancelReason}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
