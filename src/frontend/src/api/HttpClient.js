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

  // ФВ-12: файл (CSV) приходить не як JSON, а як Blob
  getBlob(path) {
    return this.#send('GET', path, undefined, { as: 'blob' });
  }

  post(path, body) {
    return this.#send('POST', path, body);
  }

  patch(path, body) {
    return this.#send('PATCH', path, body);
  }

  async #send(method, path, body, { as = 'json' } = {}) {
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
    if (response.status === 204) return null;
    return as === 'blob' ? response.blob() : response.json();
  }
}
