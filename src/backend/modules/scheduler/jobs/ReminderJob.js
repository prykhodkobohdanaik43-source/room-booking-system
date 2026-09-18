// ФВ-21
export class ReminderJob {
  name = 'reminders';

  constructor(bookingService) {
    this.bookingService = bookingService;
  }

  run() {
    return this.bookingService.sendDueReminders();
  }
}
