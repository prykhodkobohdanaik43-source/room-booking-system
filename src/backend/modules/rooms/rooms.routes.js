import { Router } from 'express';
import { authorize } from '../../shared/middleware/authorize.js';
import { Role } from '../users/Role.js';

export function createRoomsRouter({ controller, authenticate }) {
  const router = Router();
  const canManage = authorize(Role.IT, Role.OFFICE_ADMIN);
  router.use(authenticate);

  router.get('/', controller.list);
  router.post('/', canManage, controller.create);
  router.patch('/:id', canManage, controller.update);
  router.post('/:id/deactivate', canManage, controller.deactivate);

  return router;
}
