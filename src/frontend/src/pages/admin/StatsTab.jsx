import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.js';
import { Alert } from '../../components/Alert.jsx';
import { saveBlob } from '../../download.js';
import { addDays, toIsoDay } from '../../format.js';
import { PeriodFields } from './PeriodFields.jsx';

// ФВ-12: вивантаження завантаженості кімнат у CSV
export function StatsTab() {
  const { api } = useAuth();
  const [period, setPeriod] = useState(() => ({ from: toIsoDay(addDays(new Date(), -30)), to: toIsoDay(new Date()) }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const blob = await api.utilizationCsv(period.from, period.to);
      saveBlob(blob, `utilization_${period.from}_${period.to}.csv`);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="state">Кількість годин підтверджених броней на кожну кімнату за обраний період.</p>
      <PeriodFields {...period} onChange={setPeriod} />
      <Alert error={error} />
      <button type="button" onClick={download} disabled={busy}>
        {busy ? 'Формуємо…' : 'Вивантажити CSV'}
      </button>
    </div>
  );
}
