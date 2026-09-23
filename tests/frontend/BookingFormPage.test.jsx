import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/frontend/src/api/ApiError.js';
import { AuthContext } from '../../src/frontend/src/auth/AuthContext.js';
import { BookingFormPage } from '../../src/frontend/src/pages/BookingFormPage.jsx';

const rooms = [
  { id: 'r1', name: 'Десна', capacity: 4, floor: 2 },
  { id: 'r2', name: 'Дніпро', capacity: 20, floor: 4 },
];

function renderForm(createBooking) {
  const api = { rooms: async () => rooms, createBooking, bookingWarnings: async () => ({ warnings: [] }) };
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ api, user: { id: 'u1', role: 'EMPLOYEE' }, loading: false }}>
        <BookingFormPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return api;
}

describe('BookingFormPage (ФВ-04, ФВ-05)', () => {
  it('надсилає кімнату, час і кількість учасників', async () => {
    const createBooking = vi.fn().mockResolvedValue({ id: 'b1' });
    renderForm(createBooking);
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText('Кімната'), 'r1');
    await user.clear(screen.getByLabelText('Кількість учасників'));
    await user.type(screen.getByLabelText('Кількість учасників'), '3');
    await user.click(screen.getByRole('button', { name: 'Забронювати' }));

    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1));
    expect(createBooking.mock.calls[0][0]).toMatchObject({ roomId: 'r1', participantsCount: 3 });
  });

  it('показує повідомлення сервера про зайнятий слот (ФВ-18)', async () => {
    renderForm(async () => {
      throw new ApiError(409, { code: 'SLOT_TAKEN', message: 'Слот уже зайнято' });
    });
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText('Кімната'), 'r1');
    await user.click(screen.getByRole('button', { name: 'Забронювати' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Слот уже зайнято');
  });
});
