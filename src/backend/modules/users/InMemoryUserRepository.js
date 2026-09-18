import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../shared/errors.js';
import { User } from './User.js';
import { UserRepository } from './UserRepository.js';

export class InMemoryUserRepository extends UserRepository {
  #items = new Map();

  async findById(id) {
    return this.#copy(this.#items.get(id));
  }

  async findByEmail(email) {
    const mail = String(email).toLowerCase();
    return this.#copy([...this.#items.values()].find((user) => user.email === mail));
  }

  async findAll() {
    return [...this.#items.values()].map((user) => this.#copy(user));
  }

  async insert(user) {
    if (await this.findByEmail(user.email)) {
      throw new ConflictError('Користувач із такою поштою вже існує', 'EMAIL_TAKEN');
    }
    const stored = new User({ ...user, id: user.id ?? randomUUID() });
    this.#items.set(stored.id, stored);
    return this.#copy(stored);
  }

  async update(user) {
    this.#items.set(user.id, new User({ ...user }));
    return this.#copy(user);
  }

  #copy(user) {
    return user ? new User({ ...user }) : null;
  }
}
