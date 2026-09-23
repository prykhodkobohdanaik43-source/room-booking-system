import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/frontend/src/App.jsx';
import { AuthContext } from '../../src/frontend/src/auth/AuthContext.js';
import { RoomsPage } from '../../src/frontend/src/pages/RoomsPage.jsx';
import { renderWithContext } from './renderWithContext.jsx';

const rooms = [{ id: 'r1', name: 'Десна', capacity: 4, floor: 2, isActive: true }];

function makeApi() {
  return {
    rooms: vi.fn().mockResolvedValue(rooms),
    createRoom: vi.fn().mockResolvedValue({}),
    updateRoom: vi.fn().mockResolvedValue({}),
    deactivateRoom: vi.fn().mockResolvedValue({ cancelledBookings: 2 }),
  };
}

describe('RoomsPage (ФВ-13 – ФВ-15, ФВ-26)', () => {
  it('змінює місткість кімнати', async () => {
    const api = makeApi();
    renderWithContext(<RoomsPage />, { api, role: 'IT' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Змінити' }));
    const capacity = screen.getAllByLabelText('Місткість')[0];
    await user.clear(capacity);
    await user.type(capacity, '6');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => expect(api.updateRoom).toHaveBeenCalledWith('r1', { name: 'Десна', capacity: 6, floor: 2 }));
  });

  it('деактивує кімнату на період і повідомляє, скільки броней скасовано', async () => {
    const api = makeApi();
    renderWithContext(<RoomsPage />, { api, role: 'IT' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Деактивувати' }));
    await user.click(screen.getAllByRole('button', { name: 'Деактивувати' })[1]);

    await waitFor(() =>
      expect(api.deactivateRoom).toHaveBeenCalledWith('r1', {
        from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Скасовано броней: 2');
  });
});

describe('головна сторінка залежить від ролі (ФВ-29)', () => {
  it('роль IT з головної потрапляє до довідника кімнат, а не на розклад, який їй недоступний', async () => {
    const api = { rooms: async () => rooms, roomStates: vi.fn() };
    const user = { id: 'it1', fullName: 'Сергій Бойко', role: 'IT' };

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={{ api, user, loading: false, logout: () => {} }}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Переговорні кімнати' })).toBeInTheDocument();
    expect(api.roomStates).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Розклад' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Користувачі' })).toBeInTheDocument();
  });
});
