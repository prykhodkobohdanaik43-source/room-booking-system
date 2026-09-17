/* eslint-disable no-unused-vars */

export class PasswordHasher {
  /** @returns {Promise<string>} */
  async hash(password) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<boolean>} */
  async verify(password, hash) {
    throw new Error('Not implemented');
  }
}
