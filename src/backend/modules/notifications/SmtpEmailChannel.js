import nodemailer from 'nodemailer';
import { NotificationChannel } from './NotificationChannel.js';

export class SmtpEmailChannel extends NotificationChannel {
  constructor({ host, port, user, pass, from }) {
    super();
    this.from = from;
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  async send({ to, subject, text }) {
    await this.transport.sendMail({ from: this.from, to, subject, text });
  }
}
