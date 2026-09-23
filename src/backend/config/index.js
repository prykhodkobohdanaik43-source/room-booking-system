import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

function int(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production' && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }

  return Object.freeze({
    env: nodeEnv,
    port: int(env.PORT, 3000),
    appUrl: env.APP_URL ?? 'http://localhost:5173',
    // НФВ-16: за замовчуванням увімкнено лише в production; за проксі потрібен trust proxy
    requireHttps: env.REQUIRE_HTTPS ? env.REQUIRE_HTTPS === 'true' : nodeEnv === 'production',
    databaseUrl: env.DATABASE_URL || null,
    corporateDomain: (env.CORPORATE_EMAIL_DOMAIN ?? 'example.com').toLowerCase(),
    jwt: {
      secret: env.JWT_SECRET ?? 'dev-only-secret',
      expiresIn: env.JWT_EXPIRES_IN ?? '8h',
    },
    // НФВ-06: cost не менше 12
    bcryptCost: Math.max(12, int(env.BCRYPT_COST, 12)),
    // НФВ-15
    login: { maxFailedAttempts: 5, lockMinutes: 15 },
    // ФВ-27, ФВ-21
    booking: { horizonDays: 28, reminderMinutes: 15 },
    // НФВ-07: автоскасування має спрацювати у вікні 30 с, тому крок менший
    scheduler: { tickSeconds: int(env.SCHEDULER_TICK_SECONDS, 15) },
    smtp: env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: int(env.SMTP_PORT, 587),
          user: env.SMTP_USER ?? null,
          pass: env.SMTP_PASS ?? null,
          from: env.SMTP_FROM ?? `booking@${env.CORPORATE_EMAIL_DOMAIN ?? 'example.com'}`,
        }
      : null,
  });
}
