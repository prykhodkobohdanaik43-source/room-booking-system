import { Router } from 'express';
import { authorize } from '../../shared/middleware/authorize.js';
import { Role } from '../users/Role.js';

export function createBookingsRouter({ controller, authenticate }) {
  const router = Router();
  // ФВ-29: роль IT не має доступу до розкладу і броней
  const guard = [authenticate, authorize(Role.EMPLOYEE, Role.OFFICE_ADMIN)];

  router.get('/schedule', guard, controller.daySchedule);
  router.get('/schedule/now', guard, controller.roomStates);
  router.post('/bookings', guard, controller.create);
  router.post('/bookings/:id/cancel', guard, controller.cancel);
  router.post('/bookings/:id/confirm-arrival', guard, controller.confirmArrival);

  return router;
}
