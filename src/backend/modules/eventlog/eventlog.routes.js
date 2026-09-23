import { Router } from 'express';
import { authorize } from '../../shared/middleware/authorize.js';
import { Role } from '../users/Role.js';

export function createEventLogRouter({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, authorize(Role.OFFICE_ADMIN));
  router.get('/', controller.recent);
  return router;
}
