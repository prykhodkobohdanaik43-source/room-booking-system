import { UnauthorizedError } from '../errors.js';

export function createAuthenticate({ tokens, users }) {
  return async function authenticate(req, _res, next) {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedError();

    const payload = tokens.verify(token);
    if (!payload || payload.purpose !== 'access') throw new UnauthorizedError('Сесія недійсна або завершилась');

    const user = await users.findById(payload.sub);
    // ФВ-17: після блокування відкриті сесії перестають працювати
    if (!user || user.isBlocked) throw new UnauthorizedError('Сесія недійсна або завершилась');

    req.user = user;
    next();
  };
}
