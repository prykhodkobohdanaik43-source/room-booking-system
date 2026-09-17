/* eslint-disable no-unused-vars */

export class TokenService {
  /** @returns {string} */
  sign(payload, options) {
    throw new Error('Not implemented');
  }

  /** @returns {object|null} null, якщо токен недійсний або прострочений */
  verify(token) {
    throw new Error('Not implemented');
  }
}
