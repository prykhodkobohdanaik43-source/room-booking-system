import jwt from 'jsonwebtoken';
import { TokenService } from './TokenService.js';

export class JwtTokenService extends TokenService {
  constructor({ secret, expiresIn }) {
    super();
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  sign(payload, { expiresIn = this.expiresIn } = {}) {
    return jwt.sign(payload, this.secret, { expiresIn });
  }

  verify(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch {
      return null;
    }
  }
}
