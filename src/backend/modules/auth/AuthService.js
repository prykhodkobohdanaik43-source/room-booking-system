import { ForbiddenError, UnauthorizedError, ValidationError } from '../../shared/errors.js';

const MIN_PASSWORD_LENGTH = 8;

export class AuthService {
  constructor({ users, hasher, tokens, passwordSetup, clock, corporateDomain, loginPolicy }) {
    this.users = users;
    this.hasher = hasher;
    this.tokens = tokens;
    this.passwordSetup = passwordSetup;
    this.clock = clock;
    this.corporateDomain = corporateDomain;
    this.loginPolicy = loginPolicy;
  }

  // ФВ-01
  async login(email, password) {
    const mail = String(email ?? '')
      .trim()
      .toLowerCase();
    // ОБМ-03
    if (!mail.endsWith(`@${this.corporateDomain}`)) {
      throw new UnauthorizedError('Вхід можливий лише з корпоративної пошти');
    }

    const user = await this.users.findByEmail(mail);
    if (!user) throw new UnauthorizedError('Неправильна пошта або пароль');
    if (user.isBlocked) throw new ForbiddenError('Обліковий запис заблоковано');

    const now = this.clock.now();
    if (user.isLocked(now)) {
      throw new ForbiddenError(`Забагато невдалих спроб. Спробуйте за ${this.loginPolicy.lockMinutes} хвилин`);
    }

    if (!(await user.authenticate(password, this.hasher))) {
      user.registerFailedLogin(now, this.loginPolicy);
      await this.users.update(user);
      throw new UnauthorizedError('Неправильна пошта або пароль');
    }

    user.registerSuccessfulLogin();
    await this.users.update(user);
    return { token: this.tokens.sign({ sub: user.id, role: user.role, purpose: 'access' }), user };
  }

  // ФВ-16
  async setPassword(setupToken, password) {
    const userId = this.passwordSetup.userIdFrom(setupToken);
    const user = userId ? await this.users.findById(userId) : null;
    if (!user) throw new UnauthorizedError('Посилання недійсне або прострочене');
    if (String(password ?? '').length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів`);
    }

    user.passwordHash = await this.hasher.hash(password);
    await this.users.update(user);
  }
}
