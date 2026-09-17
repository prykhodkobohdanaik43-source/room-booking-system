export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  login = async (req, res) => {
    const { email, password } = req.body ?? {};
    res.json(await this.authService.login(email, password));
  };

  setPassword = async (req, res) => {
    const { token, password } = req.body ?? {};
    await this.authService.setPassword(token, password);
    res.status(204).end();
  };

  me = async (req, res) => {
    res.json(req.user);
  };
}
