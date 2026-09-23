import { useAuth } from '../../auth/AuthContext.js';
import { Alert } from '../../components/Alert.jsx';
import { formatDateTime } from '../../format.js';
import { useAsync } from '../../useAsync.js';

const actionLabels = Object.freeze({
  BOOKING_CREATED: 'Бронь створено',
  BOOKING_UPDATED: 'Бронь змінено',
  BOOKING_CONFIRMED: 'Прихід підтверджено',
  BOOKING_CANCELLED: 'Бронь скасовано',
  BOOKING_AUTO_CANCELLED: 'Бронь автоскасовано',
  ROOM_CREATED: 'Кімнату створено',
  ROOM_UPDATED: 'Кімнату змінено',
  ROOM_DEACTIVATED: 'Кімнату деактивовано',
  USER_CREATED: 'Обліковий запис створено',
  USER_BLOCKED: 'Обліковий запис заблоковано',
  USER_UNBLOCKED: 'Обліковий запис розблоковано',
});

// ФВ-22: журнал подій — хто, коли і що зробив (або «система»)
export function EventsTab() {
  const { api } = useAuth();
  const { data, error, loading } = useAsync(() => api.events(50), [api]);

  if (loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;
  if (data.length === 0) return <p className="state">Подій ще немає</p>;

  return (
    <ul className="records">
      {data.map((entry) => (
        <li key={entry.id} className="record">
          <div className="record__main">
            <strong>{actionLabels[entry.actionType] ?? entry.actionType}</strong>
            <span className="record__meta">
              {formatDateTime(entry.timestamp)} · {entry.actorName ?? 'невідомо'}
              {entry.details?.reason ? ` · причина: ${entry.details.reason}` : ''}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
