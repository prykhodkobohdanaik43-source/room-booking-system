export class RoomController {
  constructor(roomService) {
    this.roomService = roomService;
  }

  list = async (_req, res) => {
    res.json(await this.roomService.list());
  };

  create = async (req, res) => {
    const { name, capacity, floor } = req.body ?? {};
    res.status(201).json(await this.roomService.create({ name, capacity, floor }, req.user));
  };

  update = async (req, res) => {
    const { name, capacity, floor } = req.body ?? {};
    res.json(await this.roomService.update(req.params.id, { name, capacity, floor }, req.user));
  };

  deactivate = async (req, res) => {
    const { from, to } = req.body ?? {};
    const { room, cancelledBookings } = await this.roomService.deactivate(req.params.id, { from, to }, req.user);
    res.json({ ...room, cancelledBookings });
  };
}
