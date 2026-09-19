import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="entry">
      <form className="entry__form" onSubmit={submit}>
        <h1>Бронювання переговорних</h1>
        <Field label="Корпоративна пошта">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Пароль">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Alert error={error} />
        <button type="submit" disabled={busy}>
          {busy ? 'Входимо…' : 'Увійти'}
        </button>
      </form>
    </div>
  );
}
