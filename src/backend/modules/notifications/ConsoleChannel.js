import { NotificationChannel } from './NotificationChannel.js';

export class ConsoleChannel extends NotificationChannel {
  constructor(logger = console) {
    super();
    this.logger = logger;
  }

  async send({ to, subject, text }) {
    this.logger.info(`[mail] ${to} | ${subject}\n${text}`);
  }
}
