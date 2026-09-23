function pickBookingFields(body) {
  const { roomId, startTime, endTime, participantsCount } = body ?? {};
  return { roomId, startTime, endTime, participantsCount };
}

function smallerRoomWarning(rooms) {
  const names = rooms.map((room) => `«${room.name}» (до ${room.capacity} осіб)`).join(', ');
  return {
    code: 'SMALLER_ROOM_AVAILABLE',
    message: `На цей час вільна менша кімната, у яку вміщаються учасники: ${names}. Велику кімнату краще залишити командам, яким потрібно більше місця.`,
    rooms: rooms.map((room) => ({ id: room.id, name: room.name, capacity: room.capacity })),
  };
}

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

  weekSchedule = async (req, res) => {
    res.json(await this.bookingService.getWeekSchedule(req.query.date));
  };

  mine = async (req, res) => {
    res.json(await this.bookingService.getMyBookings(req.user));
  };

  create = async (req, res) => {
    const booking = await this.bookingService.create(pickBookingFields(req.body), req.user);
    res.status(201).json(booking);
  };

  createSeries = async (req, res) => {
    const result = await this.bookingService.createSeries(pickBookingFields(req.body), req.body?.weeks, req.user);
    res.status(201).json(result);
  };

  update = async (req, res) => {
    res.json(await this.bookingService.update(req.params.id, pickBookingFields(req.body), req.user));
  };

  // ФВ-30: перевірка перед відправленням форми; ніколи не блокує бронювання
  warnings = async (req, res) => {
    const smaller = await this.bookingService.findSmallerFreeRooms(pickBookingFields(req.body));
    const warnings = smaller.length === 0 ? [] : [smallerRoomWarning(smaller)];
    res.json({ warnings });
  };

  // ФВ-09, ФВ-11, ФВ-12: розділ адміністратора офісу
  upcoming = async (_req, res) => {
    res.json(await this.bookingService.listUpcoming());
  };

  history = async (req, res) => {
    res.json(await this.bookingService.history(req.query.from, req.query.to));
  };

  utilization = async (req, res) => {
    const csv = await this.bookingService.utilizationCsv(req.query.from, req.query.to);
    res
      .type('text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="utilization_${req.query.from}_${req.query.to}.csv"`)
      .send(csv);
  };

  cancel = async (req, res) => {
    res.json(await this.bookingService.cancel(req.params.id, req.body?.reason, req.user));
  };

  confirmArrival = async (req, res) => {
    res.json(await this.bookingService.confirmArrival(req.params.id, req.user));
  };
}
