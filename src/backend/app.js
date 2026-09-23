import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createBookingsRouter } from './modules/bookings/bookings.routes.js';
import { createEventLogRouter } from './modules/eventlog/eventlog.routes.js';
import { createRoomsRouter } from './modules/rooms/rooms.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { createErrorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';
import { requireHttps } from './shared/middleware/requireHttps.js';

const frontendDist = fileURLToPath(new URL('../frontend/dist', import.meta.url));

export function createApp(container) {
  const { config, controllers, authenticate, storage, logger } = container;
  const app = express();

  app.disable('x-powered-by');
  // За зворотним проксі (nginx) схему та адресу клієнта беремо з X-Forwarded-*
  app.set('trust proxy', config.requireHttps ? 1 : false);
  app.use(requireHttps({ enabled: config.requireHttps }));
  app.use(express.json({ limit: '100kb' }));

  // НФВ-05: перевірка здоров'я звертається до бази, тож docker/моніторинг бачать і збій PostgreSQL
  app.get('/api/health', async (_req, res) => {
    try {
      await storage.ping();
      res.json({ status: 'ok', storage: storage.kind });
    } catch (err) {
      logger.error(`[health] ${err.message}`);
      res.status(503).json({ status: 'unavailable', storage: storage.kind });
    }
  });
  app.use('/api/auth', createAuthRouter({ controller: controllers.auth, authenticate }));
  app.use('/api/users', createUsersRouter({ controller: controllers.users, authenticate }));
  app.use('/api/rooms', createRoomsRouter({ controller: controllers.rooms, authenticate }));
  app.use('/api/admin/events', createEventLogRouter({ controller: controllers.eventLog, authenticate }));
  app.use('/api', createBookingsRouter({ controller: controllers.bookings, authenticate }));
  app.use('/api', notFoundHandler);

  // Зібраний React SPA роздає той самий сервер (один образ, лаб. №2, діаграма розгортання)
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: frontendDist }));
  }

  app.use(createErrorHandler({ logger }));
  return app;
}
