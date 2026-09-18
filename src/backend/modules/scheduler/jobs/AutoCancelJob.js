// ФВ-20, НФВ-07
export class AutoCancelJob {
  name = 'auto-cancel';

  constructor(bookingService) {
    this.bookingService = bookingService;
  }

  run() {
    return this.bookingService.autoCancelOverdue();
  }
}
