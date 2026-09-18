export class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  list = async (_req, res) => {
    res.json(await this.userService.list());
  };

  create = async (req, res) => {
    const { fullName, email, role } = req.body ?? {};
    const user = await this.userService.create({ fullName, email, role }, req.user);
    res.status(201).json(user);
  };

  block = async (req, res) => {
    res.json(await this.userService.setBlocked(req.params.id, true, req.user));
  };

  unblock = async (req, res) => {
    res.json(await this.userService.setBlocked(req.params.id, false, req.user));
  };
}
