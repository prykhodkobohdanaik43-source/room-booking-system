import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { Role, roleLabels } from '../roles.js';
import { useAsync } from '../useAsync.js';

const EMPTY = { fullName: '', email: '', role: Role.EMPLOYEE };

// ФВ-16, ФВ-17: облікові записи для IT — створення з роллю та блокування
export function UsersPage() {
  const { api, user: me } = useAuth();
  const { data: users, error, loading, reload } = useAsync(() => api.users(), [api]);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function create(event) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    try {
      const created = await api.createUser(form);
      setNotice(`Обліковий запис створено. Посилання для встановлення пароля надіслано на ${created.email}`);
      setForm(EMPTY);
      reload();
    } catch (failure) {
      setFormError(failure);
    }
  }

  async function toggleBlocked(target) {
    setActionError(null);
    try {
      await (target.isBlocked ? api.unblockUser(target.id) : api.blockUser(target.id));
      reload();
    } catch (failure) {
      setActionError(failure);
    }
  }

  if (!users && loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;

  return (
    <section>
      <h1 className="page-title">Облікові записи</h1>
      <Alert error={actionError} />
      <ul className="records">
        {users.map((item) => (
          <li key={item.id} className="record">
            <div className="record__main">
              <strong>{item.fullName}</strong>
              <span className="record__meta">
                {item.email} · {roleLabels[item.role]}
                {item.isBlocked && <span className="badge badge--cancelled"> Заблоковано</span>}
              </span>
            </div>
            <div className="actions">
              {item.id !== me.id && (
                <button type="button" className="link" onClick={() => toggleBlocked(item)}>
                  {item.isBlocked ? 'Розблокувати' : 'Заблокувати'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <h2 className="section-title">Новий обліковий запис</h2>
      <form className="form" onSubmit={create}>
        <Field label="Ім’я та прізвище">
          <input value={form.fullName} onChange={set('fullName')} required />
        </Field>
        <Field label="Корпоративна пошта">
          <input type="email" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label="Роль">
          <select value={form.role} onChange={set('role')}>
            {Object.values(Role).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </Field>
        <Alert error={formError} />
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <button type="submit">Створити</button>
      </form>
    </section>
  );
}
