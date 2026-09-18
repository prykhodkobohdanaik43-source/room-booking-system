import { Router } from 'express';
import { authorize } from '../../shared/middleware/authorize.js';
import { Role } from './Role.js';

export function createUsersRouter({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, authorize(Role.IT));

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.post('/:id/block', controller.block);
  router.post('/:id/unblock', controller.unblock);

  return router;
}
