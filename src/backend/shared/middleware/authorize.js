import { ForbiddenError } from '../errors.js';

export function authorize(...roles) {
  return function checkRole(req, _res, next) {
    if (!roles.includes(req.user?.role)) throw new ForbiddenError();
    next();
  };
}
