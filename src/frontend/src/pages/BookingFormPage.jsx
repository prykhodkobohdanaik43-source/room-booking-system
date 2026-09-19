import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { toIsoDay } from '../format.js';
import { useAsync } from '../useAsync.js';

const HORIZON_DAYS = 28;

function isoDayIn(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toIsoDay(date);
}

// ФВ-04, ФВ-05: форма броні; перевірки накладення і місткості лишаються на сервері
export function BookingFormPage() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const { data: rooms, error: roomsError, loading } = useAsync(() => api.rooms(), [api]);

  const [form, setForm] = useState({
    roomId: '',
    date: isoDayIn(0),
    startTime: '10:00',
    endTime: '11:00',
    participantsCount: 2,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createBooking({
        roomId: form.roomId,
        startTime: new Date(`${form.date}T${form.startTime}`).toISOString(),
        endTime: new Date(`${form.date}T${form.endTime}`).toISOString(),
        participantsCount: Number(form.participantsCount),
      });
      navigate('/schedule');
    } catch (bookingError) {
      setError(bookingError);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="state">Завантаження…</p>;
  if (roomsError) return <Alert error={roomsError} />;

  return (
    <section>
      <h1 className="page-title">Нова бронь</h1>
      <form className="form" onSubmit={submit}>
        <Field label="Кімната">
          <select value={form.roomId} onChange={set('roomId')} required>
            <option value="">Оберіть кімнату</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} — до {room.capacity} осіб
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата" hint={`Не далі ніж на ${HORIZON_DAYS} днів наперед`}>
          <input type="date" value={form.date} min={isoDayIn(0)} max={isoDayIn(HORIZON_DAYS)} onChange={set('date')} />
        </Field>
        <div className="form__row">
          <Field label="Початок">
            <input type="time" value={form.startTime} onChange={set('startTime')} required />
          </Field>
          <Field label="Завершення">
            <input type="time" value={form.endTime} onChange={set('endTime')} required />
          </Field>
        </div>
        <Field label="Кількість учасників">
          <input type="number" min="1" value={form.participantsCount} onChange={set('participantsCount')} required />
        </Field>
        <Alert error={error} />
        <button type="submit" disabled={busy}>
          {busy ? 'Бронюємо…' : 'Забронювати'}
        </button>
      </form>
    </section>
  );
}
