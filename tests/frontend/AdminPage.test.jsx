import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPage } from '../../src/frontend/src/pages/AdminPage.jsx';
import { renderWithContext } from './renderWithContext.jsx';

vi.mock('../../src/frontend/src/download.js', () => ({ saveBlob: vi.fn() }));
const { saveBlob } = await import('../../src/frontend/src/download.js');

const upcoming = [
  {
    id: 'b1',
    roomName: 'Десна',
    authorName: 'Олена Коваленко',
    startTime: '2026-09-21T10:00:00',
    endTime: '2026-09-21T11:00:00',
    participantsCount: 3,
    status: 'ACTIVE',
  },
];

const history = [
  {
    id: 'b2',
    roomName: 'Ворскла',
    authorName: 'Андрій Ткачук',
    startTime: '2026-09-20T10:00:00',
    endTime: '2026-09-20T11:00:00',
    participantsCount: 2,
    status: 'CANCELLED',
    cancelReason: 'Термінова нарада',
    cancelledByName: 'Ірина Мельник',
  },
  {
    id: 'b3',
    roomName: 'Хортиця',
    authorName: 'Андрій Ткачук',
    startTime: '2026-09-20T12:00:00',
    endTime: '2026-09-20T13:00:00',
    participantsCount: 2,
    status: 'AUTO_CANCELLED',
    cancelReason: 'Немає відмітки про прихід протягом 10 хвилин',
    cancelledByName: null,
  },
];

function makeApi() {
  return {
    adminBookings: vi.fn().mockResolvedValue(upcoming),
    cancelBooking: vi.fn().mockResolvedValue({}),
    bookingHistory: vi.fn().mockResolvedValue(history),
    utilizationCsv: vi.fn().mockResolvedValue(new Blob(['csv'], { type: 'text/csv' })),
    events: vi.fn().mockResolvedValue([
      {
        id: 'e1',
        timestamp: '2026-09-21T10:11:00',
        actionType: 'BOOKING_AUTO_CANCELLED',
        actorName: 'система',
        details: {},
      },
    ]),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('AdminPage (ФВ-09 – ФВ-12, ФВ-22)', () => {
  it('перелік броней показує авторів, а скасування без причини неможливе (ФВ-10)', async () => {
    const api = makeApi();
    renderWithContext(<AdminPage />, { api, role: 'OFFICE_ADMIN' });
    const user = userEvent.setup();

    expect(await screen.findByText(/Олена Коваленко/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Скасувати' }));
    expect(screen.getByRole('button', { name: 'Скасувати бронь' })).toBeDisabled();

    await user.type(screen.getByLabelText('Причина скасування'), 'Ремонт проектора');
    await user.click(screen.getByRole('button', { name: 'Скасувати бронь' }));
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledWith('b1', 'Ремонт проектора'));
  });

  it('вкладка «Історія» показує статус, ініціатора та причину скасування (ФВ-11)', async () => {
    const api = makeApi();
    renderWithContext(<AdminPage />, { api, role: 'OFFICE_ADMIN' });

    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Історія' }));
    expect(await screen.findByText('Скасована')).toBeInTheDocument();
    expect(screen.getByText('Автоскасована')).toBeInTheDocument();
    expect(screen.getByText(/Скасував\(ла\): Ірина Мельник/)).toHaveTextContent('Термінова нарада');
    expect(screen.getByText(/Скасувала система/)).toBeInTheDocument();
    expect(api.bookingHistory).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), expect.any(String));
  });

  it('вкладка «Статистика» вивантажує CSV за період (ФВ-12)', async () => {
    const api = makeApi();
    renderWithContext(<AdminPage />, { api, role: 'OFFICE_ADMIN' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('tab', { name: 'Статистика' }));
    await user.click(screen.getByRole('button', { name: 'Вивантажити CSV' }));

    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    expect(saveBlob.mock.calls[0][1]).toMatch(/^utilization_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('вкладка «Журнал» показує дію та виконавця (ФВ-22)', async () => {
    renderWithContext(<AdminPage />, { api: makeApi(), role: 'OFFICE_ADMIN' });

    await userEvent.setup().click(await screen.findByRole('tab', { name: 'Журнал' }));
    expect(await screen.findByText('Бронь автоскасовано')).toBeInTheDocument();
    expect(screen.getByText(/система/)).toBeInTheDocument();
  });
});
