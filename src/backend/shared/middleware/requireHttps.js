// НФВ-16: у production усі дані між браузером і сервером ходять лише через HTTPS.
// TLS завершує зворотний проксі перед застосунком і передає схему в заголовку X-Forwarded-Proto.
// Перевірку здоров'я (/api/health) пропускаємо, щоб docker healthcheck працював усередині мережі.
export function requireHttps({ enabled }) {
  return function enforceHttps(req, res, next) {
    if (!enabled || req.path === '/api/health') return next();

    if (req.secure) {
      res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      return next();
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    }
    return res
      .status(403)
      .json({ error: { code: 'HTTPS_REQUIRED', message: 'Використовуйте захищене з’єднання HTTPS' } });
  };
}
