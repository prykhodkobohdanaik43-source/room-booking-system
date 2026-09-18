import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBookingApi } from '../api/bookingApi.js';
import { HttpClient } from '../api/HttpClient.js';
import { AuthContext } from './AuthContext.js';

const TOKEN_KEY = 'room-booking.token';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const logoutRef = useRef(() => {});
  const http = useMemo(() => new HttpClient('/api', { onUnauthorized: () => logoutRef.current() }), []);
  const api = useMemo(() => createBookingApi(http), [http]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    http.setToken(null);
    setToken(null);
    setUser(null);
  }, [http]);
  logoutRef.current = logout;

  const login = useCallback(
    async (email, password) => {
      const session = await api.login(email, password);
      localStorage.setItem(TOKEN_KEY, session.token);
      http.setToken(session.token);
      setToken(session.token);
      setUser(session.user);
    },
    [api, http],
  );

  // Після перезавантаження сторінки токен беремо зі сховища і звіряємо з сервером
  useEffect(() => {
    if (!token) return;
    http.setToken(token);
    api
      .me()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [api, http, logout, token]);

  const value = useMemo(() => ({ api, user, loading, login, logout }), [api, user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
