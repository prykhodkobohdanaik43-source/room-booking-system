import { PasswordHasher } from '../../src/backend/modules/auth/PasswordHasher.js';
import { NotificationChannel } from '../../src/backend/modules/notifications/NotificationChannel.js';

// bcrypt з cost 12 сповільнив би кожен тест, тому в тестах хешер підмінено
export class FakeHasher extends PasswordHasher {
  async hash(password) {
    return `hashed:${password}`;
  }

  async verify(password, hash) {
    return hash === `hashed:${password}`;
  }
}

export class RecordingChannel extends NotificationChannel {
  sent = [];

  async send(message) {
    this.sent.push(message);
  }
}

export const silentLogger = { info() {}, warn() {}, error() {} };
