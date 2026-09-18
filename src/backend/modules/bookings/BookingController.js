export class BookingController {
  constructor(bookingService) {
    this.bookingService = bookingService;
  }

  daySchedule = async (req, res) => {
    res.json(await this.bookingService.getDaySchedule(req.query.date));
  };

  roomStates = async (_req, res) => {
    res.json(await this.bookingService.getRoomStates());
  };

  create = async (req, res) => {
    const { roomId, startTime, endTime, participantsCount } = req.body ?? {};
    const booking = await this.bookingService.create({ roomId, startTime, endTime, participantsCount }, req.user);
    res.status(201).json(booking);
  };

  cancel = async (req, res) => {
    res.json(await this.bookingService.cancel(req.params.id, req.body?.reason, req.user));
  };

  confirmArrival = async (req, res) => {
    res.json(await this.bookingService.confirmArrival(req.params.id, req.user));
  };
}
