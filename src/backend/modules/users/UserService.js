import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { EventType } from '../eventlog/EventType.js';
import { User } from './User.js';

export class UserService {
  constructor({ users, eventLog, notifications, passwordSetup, corporateDomain }) {
    this.users = users;
    this.eventLog = eventLog;
    this.notifications = notifications;
    this.passwordSetup = passwordSetup;
    this.corporateDomain = corporateDomain;
  }

  list() {
    return this.users.findAll();
  }

  // ФВ-16
  async create({ fullName, email, role }, actor) {
    const user = new User({ fullName, email, role });
    // ОБМ-03
    if (!user.email.endsWith(`@${this.corporateDomain}`)) {
      throw new ValidationError(`Обліковий запис можна створити лише на пошту домену ${this.corporateDomain}`);
    }

    const saved = await this.users.insert(user);
    await this.eventLog.record({
      actorId: actor.id,
      actionType: EventType.USER_CREATED,
      details: { userId: saved.id, role: saved.role },
    });
    this.notifications.sendPasswordSetup({
      to: saved.email,
      fullName: saved.fullName,
      link: this.passwordSetup.linkFor(saved),
    });
    return saved;
  }

  // ФВ-17
  async setBlocked(userId, blocked, actor) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Користувача не знайдено');
    if (user.id === actor.id) throw new ValidationError('Не можна заблокувати власний обліковий запис');

    if (blocked) user.block();
    else user.unblock();

    const saved = await this.users.update(user);
    await this.eventLog.record({
      actorId: actor.id,
      actionType: blocked ? EventType.USER_BLOCKED : EventType.USER_UNBLOCKED,
      details: { userId: saved.id },
    });
    return saved;
  }
}
