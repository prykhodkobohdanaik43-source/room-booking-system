import { ApiError } from './ApiError.js';

// Єдина точка звернення до REST API: токен і розбір помилок не дублюються по сторінках
export class HttpClient {
  #token = null;

  constructor(baseUrl = '/api', { onUnauthorized } = {}) {
    this.baseUrl = baseUrl;
    this.onUnauthorized = onUnauthorized;
  }

  setToken(token) {
    this.#token = token;
  }

  get(path) {
    return this.#send('GET', path);
  }

  post(path, body) {
    return this.#send('POST', path, body);
  }

  patch(path, body) {
    return this.#send('PATCH', path, body);
  }

  async #send(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) this.onUnauthorized?.();
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new ApiError(response.status, payload.error);
    }
    return response.status === 204 ? null : response.json();
  }
}
