import { loadConfig } from './config/index.js';
import { createPool } from './db/pool.js';
import { demoRooms, demoUsers } from './db/seedData.js';
import { SystemClock } from './shared/Clock.js';
import { createAuthenticate } from './shared/middleware/authenticate.js';

import { AuthController } from './modules/auth/AuthController.js';
import { AuthService } from './modules/auth/AuthService.js';
import { BcryptPasswordHasher } from './modules/auth/BcryptPasswordHasher.js';
import { JwtTokenService } from './modules/auth/JwtTokenService.js';
import { PasswordSetupLinks } from './modules/auth/PasswordSetupLinks.js';
import { BookingController } from './modules/bookings/BookingController.js';
import { BookingService } from './modules/bookings/BookingService.js';
import { InMemoryBookingRepository } from './modules/bookings/InMemoryBookingRepository.js';
import { PgBookingRepository } from './modules/bookings/PgBookingRepository.js';
import { defaultBookingRules } from './modules/bookings/rules/index.js';
import { EventLogController } from './modules/eventlog/EventLogController.js';
import { EventLogService } from './modules/eventlog/EventLogService.js';
import { InMemoryEventLogRepository } from './modules/eventlog/InMemoryEventLogRepository.js';
import { PgEventLogRepository } from './modules/eventlog/PgEventLogRepository.js';
import { ConsoleChannel } from './modules/notifications/ConsoleChannel.js';
import { NotificationService } from './modules/notifications/NotificationService.js';
import { SmtpEmailChannel } from './modules/notifications/SmtpEmailChannel.js';
import { InMemoryRoomRepository } from './modules/rooms/InMemoryRoomRepository.js';
import { PgRoomRepository } from './modules/rooms/PgRoomRepository.js';
import { Room } from './modules/rooms/Room.js';
import { RoomController } from './modules/rooms/RoomController.js';
import { RoomService } from './modules/rooms/RoomService.js';
import { AutoCancelJob } from './modules/scheduler/jobs/AutoCancelJob.js';
import { ReminderJob } from './modules/scheduler/jobs/ReminderJob.js';
import { Scheduler } from './modules/scheduler/Scheduler.js';
import { InMemoryUserRepository } from './modules/users/InMemoryUserRepository.js';
import { PgUserRepository } from './modules/users/PgUserRepository.js';
import { User } from './modules/users/User.js';
import { UserController } from './modules/users/UserController.js';
import { UserService } from './modules/users/UserService.js';

export function createMemoryStorage() {
  return {
    kind: 'memory',
    users: new InMemoryUserRepository(),
    rooms: new InMemoryRoomRepository(),
    bookings: new InMemoryBookingRepository(),
    eventLog: new InMemoryEventLogRepository(),
    ping: async () => true,
    close: async () => {},
  };
}

export function createPgStorage(databaseUrl) {
  const pool = createPool(databaseUrl);
  return {
    kind: 'postgres',
    users: new PgUserRepository(pool),
    rooms: new PgRoomRepository(pool),
    bookings: new PgBookingRepository(pool),
    eventLog: new PgEventLogRepository(pool),
    ping: async () => (await pool.query('SELECT 1')).rowCount === 1,
    close: () => pool.end(),
  };
}

// Демо-дані для запуску без бази; у PostgreSQL їх додає npm run db:seed
export async function seedDemoData(storage, hasher, password) {
  const passwordHash = await hasher.hash(password);
  for (const room of demoRooms) await storage.rooms.insert(new Room(room));
  for (const user of demoUsers) await storage.users.insert(new User({ ...user, passwordHash }));
}

export function buildContainer(config = loadConfig(), overrides = {}) {
  const logger = overrides.logger ?? console;
  const clock = overrides.clock ?? new SystemClock();
  const storage =
    overrides.storage ?? (config.databaseUrl ? createPgStorage(config.databaseUrl) : createMemoryStorage());
  const hasher = overrides.hasher ?? new BcryptPasswordHasher(config.bcryptCost);
  const channel = overrides.channel ?? (config.smtp ? new SmtpEmailChannel(config.smtp) : new ConsoleChannel(logger));

  const tokens = new JwtTokenService(config.jwt);
  const passwordSetup = new PasswordSetupLinks({ tokens, appUrl: config.appUrl });
  const eventLog = new EventLogService({ entries: storage.eventLog, clock });
  const notifications = new NotificationService({ channel, logger });

  const authService = new AuthService({
    users: storage.users,
    hasher,
    tokens,
    passwordSetup,
    clock,
    corporateDomain: config.corporateDomain,
    loginPolicy: config.login,
  });
  const userService = new UserService({
    users: storage.users,
    eventLog,
    notifications,
    passwordSetup,
    corporateDomain: config.corporateDomain,
  });
  const roomService = new RoomService({ rooms: storage.rooms, eventLog });
  const bookingService = new BookingService({
    bookings: storage.bookings,
    rooms: storage.rooms,
    users: storage.users,
    eventLog,
    notifications,
    clock,
    rules: defaultBookingRules(config.booking),
    horizonDays: config.booking.horizonDays,
    reminderMinutes: config.booking.reminderMinutes,
    logger,
  });

  // ФВ-26: скасування броней при деактивації кімнати; Rooms про модуль Bookings нічого не знає
  roomService.addDeactivationListener(bookingService);

  const tickMs = config.scheduler.tickSeconds * 1000;
  const scheduler = new Scheduler({ logger })
    .register(new AutoCancelJob(bookingService), tickMs)
    .register(new ReminderJob(bookingService), tickMs);

  return {
    config,
    logger,
    storage,
    hasher,
    scheduler,
    services: { authService, userService, roomService, bookingService, eventLog, notifications },
    controllers: {
      auth: new AuthController(authService),
      users: new UserController(userService),
      rooms: new RoomController(roomService),
      bookings: new BookingController(bookingService),
      eventLog: new EventLogController(eventLog, userService),
    },
    authenticate: createAuthenticate({ tokens, users: storage.users }),
  };
}
