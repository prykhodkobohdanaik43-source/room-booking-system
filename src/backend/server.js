import { createApp } from './app.js';
import { buildContainer, seedDemoData } from './container.js';

const container = buildContainer();
const { config, logger, storage, scheduler } = container;

if (storage.kind === 'memory') {
  await seedDemoData(storage, container.hasher, process.env.SEED_PASSWORD ?? 'Passw0rd!');
  logger.info("Сховище в пам'яті: дані зникнуть після перезапуску. Для PostgreSQL задайте DATABASE_URL.");
}

const server = createApp(container).listen(config.port, () => {
  logger.info(`API: http://localhost:${config.port}/api/health (${storage.kind})`);
});
scheduler.start();

async function shutdown() {
  scheduler.stop();
  server.close();
  await storage.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
