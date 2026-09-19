import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { formatTime } from '../format.js';
import { useAsync } from '../useAsync.js';

// ФВ-23, НФВ-14: стан усіх кімнат видно одразу після входу, без переходів
export function RoomStatesPage() {
  const { api } = useAuth();
  const { data, error, loading } = useAsync(() => api.roomStates(), [api]);

  if (loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;

  return (
    <section>
      <h1 className="page-title">Що вільно зараз</h1>
      <ul className="rooms">
        {data.map(({ room, state, until }) => (
          <li key={room.id} className={`room room--${state.toLowerCase()}`}>
            <span className="room__name">{room.name}</span>
            <span className="room__meta">
              {room.capacity} місць · {room.floor} поверх
            </span>
            <span className="room__state">
              {state === 'BUSY' ? 'Зайнята' : 'Вільна'}
              {until && <em> до {formatTime(until)}</em>}
            </span>
          </li>
        ))}
      </ul>
      <Link className="cta" to="/book">
        Забронювати кімнату
      </Link>
    </section>
  );
}
