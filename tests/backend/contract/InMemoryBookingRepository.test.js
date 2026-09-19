import { InMemoryBookingRepository } from '../../../src/backend/modules/bookings/InMemoryBookingRepository.js';
import { describeBookingRepository } from './bookingRepositoryContract.js';

describeBookingRepository('InMemoryBookingRepository', async () => ({
  repo: new InMemoryBookingRepository(),
  roomId: 'room-1',
  otherRoomId: 'room-2',
  authorId: 'user-1',
}));
