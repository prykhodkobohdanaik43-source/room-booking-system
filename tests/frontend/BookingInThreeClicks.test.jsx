import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/frontend/src/App.jsx';
import { AuthContext } from '../../src/frontend/src/auth/AuthContext.js';

// НФВ-01: від відкриття головного екрана до підтвердження броні — не більше трьох кліків.
// Тест проходить повний шлях через справжній маршрутизатор застосунку, а не окремий екран.
describe('бронювання не більше ніж за 3 кліки (НФВ-01)', () => {
  it('клік по вільній кімнаті + «Забронювати» = 2 кліки', async () => {
    const api = {
      roomStates: async () => [
        { room: { id: 'r1', name: 'Десна', capacity: 4, floor: 2 }, state: 'FREE', until: null },
        { room: { id: 'r2', name: 'Дніпро', capacity: 20, floor: 4 }, state: 'FREE', until: null },
      ],
      rooms: async () => [
        { id: 'r1', name: 'Десна', capacity: 4, floor: 2 },
        { id: 'r2', name: 'Дніпро', capacity: 20, floor: 4 },
      ],
      myBookings: async () => [],
      bookingWarnings: async () => ({ warnings: [] }),
      createBooking: vi.fn().mockResolvedValue({ id: 'b1' }),
    };
    const user = { id: 'u1', fullName: 'Олена Коваленко', role: 'EMPLOYEE' };

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={{ api, user, loading: false, logout: () => {} }}>
          <App />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    let clicks = 0;
    const click = async (element) => {
      clicks += 1;
      await userEvent.setup().click(element);
    };

    await click(await screen.findByRole('link', { name: /Десна/ }));
    await click(await screen.findByRole('button', { name: 'Забронювати' }));

    await waitFor(() => expect(api.createBooking).toHaveBeenCalledTimes(1));
    expect(api.createBooking.mock.calls[0][0]).toMatchObject({ roomId: 'r1' });
    expect(clicks).toBeLessThanOrEqual(3);
    // після успіху співробітник потрапляє на «Мої броні»
    expect(await screen.findByRole('heading', { name: 'Мої броні' })).toBeInTheDocument();
  });
});
