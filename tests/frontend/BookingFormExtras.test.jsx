import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/frontend/src/api/ApiError.js';
import { BookingFormPage, defaultSlot } from '../../src/frontend/src/pages/BookingFormPage.jsx';
import { renderWithContext } from './renderWithContext.jsx';

const rooms = [
  { id: 'r1', name: 'Десна', capacity: 4, floor: 2 },
  { id: 'r2', name: 'Дніпро', capacity: 20, floor: 4 },
];

const smallerRoomWarning = {
  code: 'SMALLER_ROOM_AVAILABLE',
  message: 'На цей час вільна менша кімната: «Десна» (до 4 осіб).',
  rooms: [{ id: 'r1', name: 'Десна', capacity: 4 }],
};

function baseApi(overrides = {}) {
  return {
    rooms: async () => rooms,
    myBookings: async () => [],
    bookingWarnings: vi.fn().mockResolvedValue({ warnings: [] }),
    createBooking: vi.fn().mockResolvedValue({ id: 'b1' }),
    createBookingSeries: vi.fn(),
    updateBooking: vi.fn().mockResolvedValue({ id: 'b1' }),
    ...overrides,
  };
}

describe('BookingFormPage: попередження про завелику кімнату (ФВ-30)', () => {
  it('показує попередження, але не блокує бронювання', async () => {
    const api = baseApi({ bookingWarnings: vi.fn().mockResolvedValue({ warnings: [smallerRoomWarning] }) });
    renderWithContext(<BookingFormPage />, { api, path: '/book' });
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText('Кімната'), 'r2');
    expect(await screen.findByRole('status')).toHaveTextContent('менша кімната');
    expect(api.bookingWarnings).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'r2' }));

    await user.click(screen.getByRole('button', { name: 'Забронювати' }));
    await waitFor(() => expect(api.createBooking).toHaveBeenCalledTimes(1));
  });

  it('без менших вільних кімнат попередження немає', async () => {
    renderWithContext(<BookingFormPage />, { api: baseApi(), path: '/book' });
    await userEvent.setup().selectOptions(await screen.findByLabelText('Кімната'), 'r2');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });
});

describe('BookingFormPage: попередній вибір кімнати (НФВ-01)', () => {
  it('кімната з посилання ?roomId= уже обрана у формі', async () => {
    renderWithContext(<BookingFormPage />, { api: baseApi(), route: '/book?roomId=r2', path: '/book' });
    expect(await screen.findByLabelText('Кімната')).toHaveValue('r2');
  });

  it('пропонований слот — майбутній і в межах робочого дня', () => {
    const late = defaultSlot(new Date('2026-09-21T22:30:00'));
    expect(late).toEqual({ date: '2026-09-22', startTime: '10:00', endTime: '11:00' });
    const midday = defaultSlot(new Date('2026-09-21T13:20:00'));
    expect(midday).toEqual({ date: '2026-09-21', startTime: '14:00', endTime: '15:00' });
  });
});

describe('BookingFormPage: серія щотижневих броней (ФВ-24)', () => {
  it('надсилає кількість тижнів і показує пропущені тижні', async () => {
    const createBookingSeries = vi.fn().mockResolvedValue({
      created: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      skipped: [
        { week: 3, startTime: '2026-10-05T10:00:00', endTime: '2026-10-05T11:00:00', reason: 'Слот уже зайнято' },
      ],
    });
    renderWithContext(<BookingFormPage />, { api: baseApi({ createBookingSeries }), path: '/book' });
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText('Кімната'), 'r1');
    await user.click(screen.getByLabelText('Повторювати щотижня'));
    await user.click(screen.getByRole('button', { name: 'Забронювати' }));

    await waitFor(() => expect(createBookingSeries).toHaveBeenCalledWith(expect.objectContaining({ weeks: 4 })));
    expect(await screen.findByText(/Створено 3 з 4 броней/)).toBeInTheDocument();
    expect(screen.getByText(/Тиждень 3/)).toHaveTextContent('Слот уже зайнято');
  });

  it('якщо не вдалося жодного тижня — показує помилку і список пропущених', async () => {
    const createBookingSeries = vi.fn().mockRejectedValue(
      new ApiError(409, {
        code: 'SERIES_EMPTY',
        message: 'Жоден тиждень серії не вдалося забронювати',
        details: { skipped: [{ week: 1, startTime: '2026-09-21T10:00:00', reason: 'Слот уже зайнято' }] },
      }),
    );
    renderWithContext(<BookingFormPage />, { api: baseApi({ createBookingSeries }), path: '/book' });
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText('Кімната'), 'r1');
    await user.click(screen.getByLabelText('Повторювати щотижня'));
    await user.click(screen.getByRole('button', { name: 'Забронювати' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Жоден тиждень');
    expect(screen.getByText(/Тиждень 1/)).toBeInTheDocument();
  });
});

describe('BookingFormPage: редагування (ФВ-07)', () => {
  const booking = {
    id: 'b1',
    roomId: 'r1',
    startTime: '2026-09-22T10:00:00',
    endTime: '2026-09-22T11:00:00',
    participantsCount: 3,
    status: 'ACTIVE',
  };

  it('підставляє поточні значення і зберігає зміни через updateBooking', async () => {
    const api = baseApi({ myBookings: async () => [booking] });
    renderWithContext(<BookingFormPage />, { api, route: '/bookings/b1/edit', path: '/bookings/:id/edit' });
    const user = userEvent.setup();

    expect(await screen.findByLabelText('Кімната')).toHaveValue('r1');
    expect(screen.getByLabelText('Кількість учасників')).toHaveValue(3);
    expect(screen.queryByLabelText('Повторювати щотижня')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Кількість учасників'));
    await user.type(screen.getByLabelText('Кількість учасників'), '4');
    await user.click(screen.getByRole('button', { name: 'Зберегти зміни' }));

    await waitFor(() => expect(api.updateBooking).toHaveBeenCalledTimes(1));
    expect(api.updateBooking.mock.calls[0]).toEqual(['b1', expect.objectContaining({ participantsCount: 4 })]);
    // ФВ-30 діє лише при створенні: під час редагування форма сервер про попередження не питає
    expect(api.bookingWarnings).not.toHaveBeenCalled();
  });

  it('якщо броні вже немає серед чинних — повідомляє про це', async () => {
    renderWithContext(<BookingFormPage />, { api: baseApi(), route: '/bookings/zzz/edit', path: '/bookings/:id/edit' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Бронь не знайдено');
  });
});
