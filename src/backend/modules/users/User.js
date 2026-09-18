import { ValidationError } from '../../shared/errors.js';
import { addMinutes } from '../../shared/dates.js';
import { ROLES } from './Role.js';

export class User {
  constructor({
    id = null,
    fullName,
    email,
    passwordHash = null,
    role,
    isBlocked = false,
    failedLoginAttempts = 0,
    lockedUntil = null,
  }) {
    const name = String(fullName ?? '').trim();
    const mail = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!name) throw new ValidationError("Вкажіть ім'я користувача");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new ValidationError('Некоректна електронна пошта');
    if (!ROLES.includes(role)) throw new ValidationError('Невідома роль користувача');

    this.id = id;
    this.fullName = name;
    this.email = mail;
    this.passwordHash = passwordHash;
    this.role = role;
    this.isBlocked = isBlocked;
    this.failedLoginAttempts = failedLoginAttempts;
    this.lockedUntil = lockedUntil;
  }

  // ФВ-01
  async authenticate(password, hasher) {
    if (!this.passwordHash) return false;
    return hasher.verify(String(password ?? ''), this.passwordHash);
  }

  // ФВ-17
  block() {
    this.isBlocked = true;
  }

  unblock() {
    this.isBlocked = false;
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
  }

  // НФВ-15
  isLocked(now) {
    return this.lockedUntil !== null && now < this.lockedUntil;
  }

  registerFailedLogin(now, { maxFailedAttempts, lockMinutes }) {
    this.failedLoginAttempts += 1;
    if (this.failedLoginAttempts >= maxFailedAttempts) {
      this.lockedUntil = addMinutes(now, lockMinutes);
      this.failedLoginAttempts = 0;
    }
  }

  registerSuccessfulLogin() {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
  }

  toJSON() {
    return {
      id: this.id,
      fullName: this.fullName,
      email: this.email,
      role: this.role,
      isBlocked: this.isBlocked,
    };
  }
}
