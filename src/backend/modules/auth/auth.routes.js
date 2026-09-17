import { Router } from 'express';

export function createAuthRouter({ controller, authenticate }) {
  const router = Router();

  router.post('/login', controller.login);
  router.post('/set-password', controller.setPassword);
  router.get('/me', authenticate, controller.me);

  return router;
}
