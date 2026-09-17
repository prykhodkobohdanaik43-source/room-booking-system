const dateTime = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long', timeStyle: 'short' });

export class NotificationService {
  constructor({ channel, logger = console }) {
    this.channel = channel;
    this.logger = logger;
  }

  // ФВ-21
  sendBookingReminder({ to, roomName, startTime }) {
    return this.#deliver({
      to,
      subject: `Нагадування: ${roomName} о ${dateTime.format(startTime)}`,
      text:
        `Ваша бронь кімнати «${roomName}» починається ${dateTime.format(startTime)}.\n` +
        'Підтвердьте прихід кнопкою «Я на місці» протягом 10 хвилин після початку, інакше бронь буде скасовано.',
    });
  }

  // ФВ-25
  sendBookingCancelled({ to, roomName, startTime, reason }) {
    return this.#deliver({
      to,
      subject: `Бронь кімнати «${roomName}» скасовано`,
      text: `Вашу бронь кімнати «${roomName}» на ${dateTime.format(startTime)} скасовано.\nПричина: ${reason}.`,
    });
  }

  // ФВ-16
  sendPasswordSetup({ to, fullName, link }) {
    return this.#deliver({
      to,
      subject: 'Доступ до системи бронювання переговорних кімнат',
      text: `${fullName}, для вас створено обліковий запис.\nВстановіть пароль за посиланням: ${link}`,
    });
  }

  // Лист не має зривати основну операцію, тому помилки доставки лише логуються
  async #deliver(message) {
    try {
      await this.channel.send(message);
    } catch (err) {
      this.logger.error(`[notifications] ${message.to}: ${err.message}`);
    }
  }
}
