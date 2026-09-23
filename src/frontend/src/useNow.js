import { useEffect, useState } from 'react';

// Поточний час, що оновлюється сам: кнопки «Я на місці» і «Скасувати» з'являються й зникають без перезавантаження
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
