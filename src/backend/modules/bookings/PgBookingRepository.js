import { ConflictError } from '../../shared/errors.js';
import { Booking } from './Booking.js';
import { BookingRepository } from './BookingRepository.js';
import { SlotTakenError } from './SlotTakenError.js';

// exclusion_violation: спрацювало обмеження bookings_no_overlap
const EXCLUSION_VIOLATION = '23P01';

function toBooking(row) {
  if (!row) return null;
  return new Booking({
    id: row.id,
    roomId: row.room_id,
    authorId: row.author_id,
    startTime: row.start_time,
    endTime: row.end_time,
    participantsCount: row.participants_count,
    status: row.status,
    cancelReason: row.cancel_reason,
    cancelledBy: row.cancelled_by,
    reminderSentAt: row.reminder_sent_at,
    createdAt: row.created_at,
  });
}

export class PgBookingRepository extends BookingRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async insert(booking) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO bookings (room_id, author_id, start_time, end_time, participants_count, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          booking.roomId,
          booking.authorId,
          booking.startTime,
          booking.endTime,
          booking.participantsCount,
          booking.status,
        ],
      );
      return toBooking(rows[0]);
    } catch (err) {
      if (err.code === EXCLUSION_VIOLATION) throw new SlotTakenError();
      throw err;
    }
  }

  async update(booking) {
    const { rows } = await this.pool.query(
      `UPDATE bookings
          SET status = $2, cancel_reason = $3, cancelled_by = $4, reminder_sent_at = $5
        WHERE id = $1 AND status = 'ACTIVE'
        RETURNING *`,
      [booking.id, booking.status, booking.cancelReason, booking.cancelledBy, booking.reminderSentAt],
    );
    if (rows.length === 0) throw new ConflictError('Бронь уже змінено', 'BOOKING_NOT_ACTIVE');
    return toBooking(rows[0]);
  }

  async updateSchedule(booking) {
    try {
      const { rows } = await this.pool.query(
        `UPDATE bookings
            SET room_id = $2, start_time = $3, end_time = $4, participants_count = $5, reminder_sent_at = $6
          WHERE id = $1 AND status = 'ACTIVE'
          RETURNING *`,
        [
          booking.id,
          booking.roomId,
          booking.startTime,
          booking.endTime,
          booking.participantsCount,
          booking.reminderSentAt,
        ],
      );
      if (rows.length === 0) throw new ConflictError('Бронь уже змінено', 'BOOKING_NOT_ACTIVE');
      return toBooking(rows[0]);
    } catch (err) {
      if (err.code === EXCLUSION_VIOLATION) throw new SlotTakenError();
      throw err;
    }
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    return toBooking(rows[0]);
  }

  async findOccupying(from, to) {
    const { rows } = await this.pool.query(
      `SELECT * FROM bookings
        WHERE status IN ('ACTIVE', 'CONFIRMED') AND start_time < $2 AND end_time > $1
        ORDER BY start_time`,
      [from, to],
    );
    return rows.map(toBooking);
  }

  async findActiveStartedBy(deadline) {
    const { rows } = await this.pool.query(
      `SELECT * FROM bookings WHERE status = 'ACTIVE' AND start_time <= $1 ORDER BY start_time`,
      [deadline],
    );
    return rows.map(toBooking);
  }

  async findAwaitingReminder(from, to) {
    const { rows } = await this.pool.query(
      `SELECT * FROM bookings
        WHERE status = 'ACTIVE' AND reminder_sent_at IS NULL AND start_time > $1 AND start_time <= $2
        ORDER BY start_time`,
      [from, to],
    );
    return rows.map(toBooking);
  }

  async findByAuthor(authorId, from) {
    const { rows } = await this.pool.query(
      `SELECT * FROM bookings
        WHERE author_id = $1 AND status IN ('ACTIVE', 'CONFIRMED') AND end_time > $2
        ORDER BY start_time`,
      [authorId, from],
    );
    return rows.map(toBooking);
  }

  async findUpcoming(from) {
    const { rows } = await this.pool.query(
      `SELECT * FROM bookings
        WHERE status IN ('ACTIVE', 'CONFIRMED') AND end_time > $1
        ORDER BY start_time`,
      [from],
    );
    return rows.map(toBooking);
  }

  async findByPeriod(from, to) {
    const { rows } = await this.pool.query(
      `SELECT * FROM bookings WHERE start_time >= $1 AND start_time < $2 ORDER BY start_time, created_at`,
      [from, to],
    );
    return rows.map(toBooking);
  }

  async findActiveByRoom(roomId, from, to) {
    const { rows } = await this.pool.query(
      `SELECT * FROM bookings
        WHERE room_id = $1 AND status = 'ACTIVE' AND start_time >= $2 AND start_time < $3
        ORDER BY start_time`,
      [roomId, from, to],
    );
    return rows.map(toBooking);
  }
}
