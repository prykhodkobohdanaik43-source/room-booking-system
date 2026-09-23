import { Router } from 'express';
import { authorize } from '../../shared/middleware/authorize.js';
import { Role } from '../users/Role.js';

export function createBookingsRouter({ controller, authenticate }) {
  const router = Router();
  // ФВ-29: роль IT не має доступу до розкладу і броней
  const guard = [authenticate, authorize(Role.EMPLOYEE, Role.OFFICE_ADMIN)];
  const adminOnly = [authenticate, authorize(Role.OFFICE_ADMIN)];

  router.get('/schedule', guard, controller.daySchedule);
  router.get('/schedule/week', guard, controller.weekSchedule);
  router.get('/schedule/now', guard, controller.roomStates);

  router.get('/bookings/mine', guard, controller.mine);
  router.post('/bookings', guard, controller.create);
  router.post('/bookings/series', guard, controller.createSeries);
  router.post('/bookings/warnings', guard, controller.warnings);
  router.patch('/bookings/:id', guard, controller.update);
  router.post('/bookings/:id/cancel', guard, controller.cancel);
  router.post('/bookings/:id/confirm-arrival', guard, controller.confirmArrival);

  // ФВ-09, ФВ-11, ФВ-12
  router.get('/admin/bookings', adminOnly, controller.upcoming);
  router.get('/admin/bookings/history', adminOnly, controller.history);
  router.get('/admin/stats/utilization.csv', adminOnly, controller.utilization);

  return router;
}
