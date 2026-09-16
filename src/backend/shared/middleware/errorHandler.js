import { AppError } from '../errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Маршрут ${req.method} ${req.originalUrl} не існує` } });
}

export function createErrorHandler({ logger = console } = {}) {
  // Express розпізнає обробник помилок за чотирма аргументами, тому _next потрібен
  return function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'BAD_JSON', message: 'Тіло запиту не є коректним JSON' } });
      return;
    }
    logger.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Внутрішня помилка сервера' } });
  };
}
