import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext } from '../../src/frontend/src/auth/AuthContext.js';
import { RoomStatesPage } from '../../src/frontend/src/pages/RoomStatesPage.jsx';

const states = [
  { room: { id: 'r1', name: 'Десна', capacity: 4, floor: 2 }, state: 'FREE', until: '2026-09-21T10:00:00' },
  { room: { id: 'r2', name: 'Дніпро', capacity: 20, floor: 4 }, state: 'BUSY', until: '2026-09-21T11:00:00' },
];

function renderPage(api) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ api, user: { id: 'u1', role: 'EMPLOYEE' }, loading: false }}>
        <RoomStatesPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('RoomStatesPage (ФВ-23)', () => {
  it('показує стан кожної кімнати і час його зміни', async () => {
    renderPage({ roomStates: async () => states });

    expect(await screen.findByText('Десна')).toBeInTheDocument();
    expect(screen.getByText('Вільна')).toBeInTheDocument();
    expect(screen.getByText('Зайнята')).toBeInTheDocument();
    expect(screen.getByText(/до 10:00/)).toBeInTheDocument();
    expect(screen.getByText(/до 11:00/)).toBeInTheDocument();
  });

  it('показує повідомлення, якщо запит не вдався', async () => {
    renderPage({
      roomStates: async () => {
        throw new Error('Сервіс недоступний');
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Сервіс недоступний');
  });
});
