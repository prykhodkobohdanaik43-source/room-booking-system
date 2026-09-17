import bcrypt from 'bcryptjs';
import { PasswordHasher } from './PasswordHasher.js';

// НФВ-06
export class BcryptPasswordHasher extends PasswordHasher {
  constructor(cost = 12) {
    super();
    this.cost = cost;
  }

  hash(password) {
    return bcrypt.hash(password, this.cost);
  }

  verify(password, hash) {
    return bcrypt.compare(password, hash);
  }
}
