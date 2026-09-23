import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WeekSchedulePage } from '../../src/frontend/src/pages/WeekSchedulePage.jsx';
import { renderWithContext } from './renderWithContext.jsx';

const desna = { id: 'r1', name: 'Десна', capacity: 4, floor: 2 };
const days = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'].map(
  (date, index) => ({
    date,
    rooms: [
      {
        room: desna,
        bookings: index === 1 ? [{ id: 'b1', startTime: '2026-09-22T10:00:00', endTime: '2026-09-22T11:00:00' }] : [],
      },
    ],
  }),
);

describe('WeekSchedulePage (ФВ-03)', () => {
  it('показує сім днів; вільні дні позначено, зайняті — з часом броні', async () => {
    const api = { weekSchedule: vi.fn().mockResolvedValue(days) };
    renderWithContext(<WeekSchedulePage />, { api });

    expect(await screen.findAllByRole('article')).toHaveLength(7);
    expect(screen.getAllByText('Усі кімнати вільні')).toHaveLength(6);
    const busyDay = screen.getByLabelText('2026-09-22');
    expect(within(busyDay).getByText('Десна')).toBeInTheDocument();
    expect(within(busyDay).getByText(/10:00 – 11:00/)).toBeInTheDocument();
  });

  it('запитує розклад із понеділка, а «Наступний» зсуває тиждень рівно на 7 днів', async () => {
    const api = { weekSchedule: vi.fn().mockResolvedValue(days) };
    renderWithContext(<WeekSchedulePage />, { api });
    await screen.findAllByRole('article');

    const first = new Date(`${api.weekSchedule.mock.calls[0][0]}T00:00:00`);
    expect(first.getDay()).toBe(1);

    await userEvent.setup().click(screen.getByRole('button', { name: /Наступний/ }));
    await waitFor(() => expect(api.weekSchedule).toHaveBeenCalledTimes(2));
    const second = new Date(`${api.weekSchedule.mock.calls[1][0]}T00:00:00`);
    expect(Math.round((second - first) / 86_400_000)).toBe(7);
  });
});
