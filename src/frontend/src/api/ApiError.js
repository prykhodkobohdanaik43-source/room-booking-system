export class ApiError extends Error {
  constructor(status, { code = 'UNKNOWN', message = 'Помилка запиту' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
