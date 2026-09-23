import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';

// ФВ-16: сторінка, на яку веде посилання з листа; токен у посиланні діє 24 години
export function SetPasswordPage() {
  const { api } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    if (password !== repeat) {
      setError(new Error('Паролі не збігаються'));
      return;
    }
    setBusy(true);
    try {
      await api.setPassword(token, password);
      setDone(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="entry">
        <div className="entry__form">
          <Alert>Посилання недійсне: у ньому немає ключа доступу</Alert>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="entry">
        <div className="entry__form">
          <h1>Пароль встановлено</h1>
          <Link className="cta" to="/login">
            Перейти до входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="entry">
      <form className="entry__form" onSubmit={submit}>
        <h1>Встановлення пароля</h1>
        <Field label="Новий пароль" hint="Щонайменше 8 символів">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </Field>
        <Field label="Повторіть пароль">
          <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
        </Field>
        <Alert error={error} />
        <button type="submit" disabled={busy}>
          {busy ? 'Зберігаємо…' : 'Зберегти пароль'}
        </button>
      </form>
    </div>
  );
}
