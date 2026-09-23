import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyBookingsPage } from '../../src/frontend/src/pages/MyBookingsPage.jsx';
import { renderWithContext } from './renderWithContext.jsx';

const booking = {
  id: 'b1',
  roomName: 'Десна',
  startTime: '2026-09-21T10:00:00',
  endTime: '2026-09-21T11:00:00',
  participantsCount: 3,
  status: 'ACTIVE',
};

function makeApi(items = [booking]) {
  return {
    myBookings: vi.fn().mockResolvedValue(items),
    confirmArrival: vi.fn().mockResolvedValue({}),
    cancelBooking: vi.fn().mockResolvedValue({}),
  };
}

// Фальшуємо лише Date, щоб таймери й userEvent працювали як зазвичай
beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
afterEach(() => vi.useRealTimers());

describe('MyBookingsPage (ФВ-06, ФВ-07, ФВ-08)', () => {
  it('до початку броні доступні «Редагувати» і «Скасувати», а «Я на місці» — ні', async () => {
    vi.setSystemTime(new Date('2026-09-21T09:00:00'));
    renderWithContext(<MyBookingsPage />, { api: makeApi() });

    expect(await screen.findByText('Десна')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Редагувати' })).toHaveAttribute('href', '/bookings/b1/edit');
    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Я на місці' })).not.toBeInTheDocument();
  });

  it('протягом 10 хвилин після початку з’являється «Я на місці» і відмітка надсилається', async () => {
    vi.setSystemTime(new Date('2026-09-21T10:05:00'));
    const api = makeApi();
    renderWithContext(<MyBookingsPage />, { api });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Я на місці' }));
    await waitFor(() => expect(api.confirmArrival).toHaveBeenCalledWith('b1'));
    expect(await screen.findByRole('status')).toHaveTextContent('Прихід підтверджено');
    expect(screen.queryByRole('button', { name: 'Скасувати' })).not.toBeInTheDocument();
  });

  it('після вікна в 10 хвилин жодних дій над бронею немає', async () => {
    vi.setSystemTime(new Date('2026-09-21T10:11:00'));
    renderWithContext(<MyBookingsPage />, { api: makeApi() });

    expect(await screen.findByText('Десна')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Я на місці' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Редагувати' })).not.toBeInTheDocument();
  });

  it('підтверджена бронь показує статус без кнопок дій', async () => {
    vi.setSystemTime(new Date('2026-09-21T10:30:00'));
    renderWithContext(<MyBookingsPage />, { api: makeApi([{ ...booking, status: 'CONFIRMED' }]) });

    expect(await screen.findByText('Підтверджена')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('скасування власної броні викликає API і перечитує список', async () => {
    vi.setSystemTime(new Date('2026-09-21T09:00:00'));
    const api = makeApi();
    renderWithContext(<MyBookingsPage />, { api });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Скасувати' }));
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(api.myBookings).toHaveBeenCalledTimes(2));
  });

  it('порожній список пропонує забронювати кімнату', async () => {
    vi.setSystemTime(new Date('2026-09-21T09:00:00'));
    renderWithContext(<MyBookingsPage />, { api: makeApi([]) });
    expect(await screen.findByRole('link', { name: 'Забронювати кімнату' })).toHaveAttribute('href', '/book');
  });
});
