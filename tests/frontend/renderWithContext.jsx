import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../src/frontend/src/auth/AuthContext.js';

// Спільний каркас для екранних тестів: маршрутизатор + контекст із підмінним API
export function renderWithContext(
  element,
  { api, role = 'EMPLOYEE', path = '*', route = path === '*' ? '/' : path } = {},
) {
  const user = { id: 'u1', fullName: 'Олена Коваленко', role };
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={{ api, user, loading: false, logout: () => {} }}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}
