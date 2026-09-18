import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { useAsync } from '../useAsync.js';

const EMPTY = { name: '', capacity: '', floor: '' };

// ФВ-13: довідник кімнат для IT та адміністратора офісу
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

  if (loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;

  return (
    <section>
      <h1 className="page-title">Переговорні кімнати</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Назва</th>
            <th>Місткість</th>
            <th>Поверх</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>{room.name}</td>
              <td>{room.capacity}</td>
              <td>{room.floor}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
