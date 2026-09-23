import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { formatTime } from '../format.js';
import { Role } from '../roles.js';
import { useAsync } from '../useAsync.js';

// ФВ-23, НФВ-14: стан усіх кімнат видно одразу після входу, без переходів.
// НФВ-01: клікнувши на кімнату, співробітник потрапляє у форму з уже обраною кімнатою (2 кліки до броні).
export function RoomStatesPage() {
  const { api, user } = useAuth();
  const { data, error, loading } = useAsync(() => api.roomStates(), [api]);
  const canBook = user.role !== Role.IT;

  if (loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;

  return (
    <section>
      <h1 className="page-title">Що вільно зараз</h1>
      <ul className="rooms">
        {data.map(({ room, state, until }) => {
          const content = (
            <>
              <span className="room__name">{room.name}</span>
              <span className="room__meta">
                {room.capacity} місць · {room.floor} поверх
              </span>
              <span className="room__state">
                {state === 'BUSY' ? 'Зайнята' : 'Вільна'}
                {until && <em> до {formatTime(until)}</em>}
              </span>
            </>
          );
          return (
            <li key={room.id}>
              {canBook ? (
                <Link className={`room room--${state.toLowerCase()}`} to={`/book?roomId=${room.id}`}>
                  {content}
                </Link>
              ) : (
                <div className={`room room--${state.toLowerCase()}`}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {canBook && (
        <Link className="cta" to="/book">
          Забронювати кімнату
        </Link>
      )}
    </section>
  );
}
