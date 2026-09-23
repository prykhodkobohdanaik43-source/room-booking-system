import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/backend/app.js';
import { createTestApp } from '../../helpers/testApp.js';

describe('HTTPS і перевірка здоров’я (НФВ-16, НФВ-05)', () => {
  describe('production-режим із REQUIRE_HTTPS=true', () => {
    async function secureApp() {
      const { app } = await createTestApp({ env: { REQUIRE_HTTPS: 'true' } });
      return app;
    }

    it('GET по HTTP перенаправляється на HTTPS кодом 308', async () => {
      const response = await request(await secureApp())
        .get('/api/schedule/now')
        .set('Host', 'booking.example.com');
      expect(response.status).toBe(308);
      expect(response.headers.location).toBe('https://booking.example.com/api/schedule/now');
    });

    it('змінюючі запити по HTTP відхиляються, пароль по відкритому каналу не приймається', async () => {
      const response = await request(await secureApp())
        .post('/api/auth/login')
        .send({ email: 'olena.kovalenko@example.com', password: 'Passw0rd!' });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HTTPS_REQUIRED');
    });

    it('запит через проксі з X-Forwarded-Proto: https проходить і отримує HSTS', async () => {
      const response = await request(await secureApp())
        .post('/api/auth/login')
        .set('X-Forwarded-Proto', 'https')
        .send({ email: 'olena.kovalenko@example.com', password: 'Passw0rd!' });
      expect(response.status).toBe(200);
      expect(response.headers['strict-transport-security']).toMatch(/max-age=31536000/);
    });

    it('перевірка здоров’я доступна і по HTTP, щоб працював docker healthcheck', async () => {
      expect((await request(await secureApp()).get('/api/health')).status).toBe(200);
    });
  });

  it('у режимі розробки перенаправлення вимкнено', async () => {
    const { app } = await createTestApp();
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({})).status).not.toBe(403);
  });

  it('/api/health повертає 503, якщо база даних недоступна', async () => {
    const { container } = await createTestApp();
    container.storage.ping = async () => {
      throw new Error('connection refused');
    };
    const response = await request(createApp(container)).get('/api/health');
    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unavailable');
  });
});
