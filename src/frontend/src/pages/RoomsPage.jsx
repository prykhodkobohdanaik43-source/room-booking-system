import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { formatDay, toIsoDay } from '../format.js';
import { useAsync } from '../useAsync.js';

const EMPTY = { name: '', capacity: '', floor: '' };

// ФВ-13 – ФВ-15: довідник кімнат для IT та адміністратора офісу
export function RoomsPage() {
  const { api } = useAuth();
  const { data: rooms, error, loading, reload } = useAsync(() => api.rooms(), [api]);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setFormError(null);
    try {
      await api.createRoom({ name: form.name, capacity: Number(form.capacity), floor: Number(form.floor) });
      setForm(EMPTY);
      reload();
    } catch (createError) {
      setFormError(createError);
    }
  }

  if (!rooms && loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;

  return (
    <section>
      <h1 className="page-title">Переговорні кімнати</h1>
      <ul className="records">
        {rooms.map((room) => (
          <RoomRow key={room.id} room={room} onChanged={reload} />
        ))}
      </ul>

      <h2 className="section-title">Нова кімната</h2>
      <form className="form form--inline" onSubmit={submit}>
        <Field label="Назва">
          <input value={form.name} onChange={set('name')} required />
        </Field>
        <Field label="Місткість">
          <input type="number" min="1" value={form.capacity} onChange={set('capacity')} required />
        </Field>
        <Field label="Поверх">
          <input type="number" value={form.floor} onChange={set('floor')} required />
        </Field>
        <button type="submit">Додати кімнату</button>
      </form>
      <Alert error={formError} />
    </section>
  );
}

function RoomRow({ room, onChanged }) {
  const { api } = useAuth();
  const [mode, setMode] = useState('view');
  const [edit, setEdit] = useState({ name: room.name, capacity: room.capacity, floor: room.floor });
  const [period, setPeriod] = useState({ from: toIsoDay(new Date()), to: toIsoDay(new Date()) });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function run(action) {
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      setMode('view');
      onChanged();
      return result;
    } catch (failure) {
      setError(failure);
      return null;
    }
  }

  // ФВ-14
  const save = (event) => {
    event.preventDefault();
    return run(() =>
      api.updateRoom(room.id, { name: edit.name, capacity: Number(edit.capacity), floor: Number(edit.floor) }),
    );
  };

  // ФВ-15, ФВ-26: деактивація скасовує «активні» броні періоду — кількість показуємо
  const deactivate = async (event) => {
    event.preventDefault();
    const result = await run(() => api.deactivateRoom(room.id, period));
    if (result) setNotice(`Кімнату деактивовано. Скасовано броней: ${result.cancelledBookings}`);
  };

  return (
    <li className="record">
      <div className="record__main">
        <strong>{room.name}</strong>
        <span className="record__meta">
          {room.capacity} місць · {room.floor} поверх
        </span>
        {room.deactivatedFrom && (
          <span className="record__meta">
            Не бронюється: {formatDay(room.deactivatedFrom)} – {formatDay(room.deactivatedTo)}
          </span>
        )}
      </div>
      <div className="actions">
        <button type="button" className="link" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>
          Змінити
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === 'deactivate' ? 'view' : 'deactivate')}>
          Деактивувати
        </button>
      </div>

      {mode === 'edit' && (
        <form className="form form--inline record__form" onSubmit={save}>
          <Field label="Назва">
            <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
          </Field>
          <Field label="Місткість">
            <input
              type="number"
              min="1"
              value={edit.capacity}
              onChange={(e) => setEdit({ ...edit, capacity: e.target.value })}
              required
            />
          </Field>
          <Field label="Поверх">
            <input
              type="number"
              value={edit.floor}
              onChange={(e) => setEdit({ ...edit, floor: e.target.value })}
              required
            />
          </Field>
          <button type="submit">Зберегти</button>
        </form>
      )}

      {mode === 'deactivate' && (
        <form className="form form--inline record__form" onSubmit={deactivate}>
          <Field label="З">
            <input
              type="date"
              value={period.from}
              onChange={(e) => setPeriod({ ...period, from: e.target.value })}
              required
            />
          </Field>
          <Field label="По">
            <input
              type="date"
              value={period.to}
              onChange={(e) => setPeriod({ ...period, to: e.target.value })}
              required
            />
          </Field>
          <button type="submit">Деактивувати</button>
        </form>
      )}

      <div className="record__feedback">
        <Alert error={error} />
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </li>
  );
}
