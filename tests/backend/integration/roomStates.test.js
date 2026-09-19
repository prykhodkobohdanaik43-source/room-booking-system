import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { RoomState } from '../../../src/backend/modules/bookings/BookingService.js';
import { EMPLOYEE, at, createTestApp } from '../../helpers/testApp.js';

describe('стан кімнат у поточний момент (ФВ-23)', () => {
  let app;
  let context;
  let employee;

  beforeEach(async () => {
    context = await createTestApp();
    ({ app } = context);
    employee = await context.loginAs(EMPLOYEE);
  });

  const states = async () =>
    (
      await request(app)
        .get('/api/schedule/now')
        .set({ Authorization: `Bearer ${employee}` })
    ).body;

  it('без броней усі кімнати вільні', async () => {
    expect((await states()).every((entry) => entry.state === RoomState.FREE)).toBe(true);
  });

  it('вільна кімната показує час найближчої броні', async () => {
    const created = await context.book(employee);
    const entry = (await states()).find((item) => item.room.id === created.body.roomId);

    expect(entry.state).toBe(RoomState.FREE);
    expect(new Date(entry.until)).toEqual(at(10));
  });

  it('під час броні кімната зайнята до її завершення', async () => {
    const created = await context.book(employee);
    context.clock.set(at(10, 15));

    const entry = (await states()).find((item) => item.room.id === created.body.roomId);
    expect(entry.state).toBe(RoomState.BUSY);
    expect(new Date(entry.until)).toEqual(at(11));
  });

  it('після завершення броні кімната знову вільна', async () => {
    const created = await context.book(employee);
    context.clock.set(at(11, 1));

    const entry = (await states()).find((item) => item.room.id === created.body.roomId);
    expect(entry.state).toBe(RoomState.FREE);
    expect(entry.until).toBeNull();
  });
});
