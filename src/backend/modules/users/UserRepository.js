/* eslint-disable no-unused-vars */

export class UserRepository {
  /** @returns {Promise<import('./User.js').User|null>} */
  async findById(id) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('./User.js').User|null>} */
  async findByEmail(email) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('./User.js').User[]>} */
  async findAll() {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('./User.js').User>} */
  async insert(user) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('./User.js').User>} */
  async update(user) {
    throw new Error('Not implemented');
  }
}
