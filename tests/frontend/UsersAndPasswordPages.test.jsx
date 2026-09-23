import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/frontend/src/api/ApiError.js';
import { SetPasswordPage } from '../../src/frontend/src/pages/SetPasswordPage.jsx';
import { UsersPage } from '../../src/frontend/src/pages/UsersPage.jsx';
import { renderWithContext } from './renderWithContext.jsx';

// id 'u1' належить користувачеві, що увійшов (див. renderWithContext): свій обліковий запис блокувати не можна
const users = [
  { id: 'u2', fullName: 'Олена Коваленко', email: 'olena@example.com', role: 'EMPLOYEE', isBlocked: false },
  { id: 'u3', fullName: 'Андрій Ткачук', email: 'andrii@example.com', role: 'EMPLOYEE', isBlocked: true },
];

describe('UsersPage (ФВ-16, ФВ-17)', () => {
  function makeApi() {
    return {
      users: vi.fn().mockResolvedValue(users),
      createUser: vi.fn().mockResolvedValue({ email: 'new@example.com' }),
      blockUser: vi.fn().mockResolvedValue({}),
      unblockUser: vi.fn().mockResolvedValue({}),
    };
  }

  it('створює обліковий запис з роллю і повідомляє, куди надіслано посилання', async () => {
    const api = makeApi();
    renderWithContext(<UsersPage />, { api, role: 'IT' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Ім’я та прізвище'), 'Марія Шевченко');
    await user.type(screen.getByLabelText('Корпоративна пошта'), 'new@example.com');
    await user.selectOptions(screen.getByLabelText('Роль'), 'OFFICE_ADMIN');
    await user.click(screen.getByRole('button', { name: 'Створити' }));

    await waitFor(() =>
      expect(api.createUser).toHaveBeenCalledWith({
        fullName: 'Марія Шевченко',
        email: 'new@example.com',
        role: 'OFFICE_ADMIN',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('new@example.com');
  });

  it('блокує чинний обліковий запис і розблоковує заблокований', async () => {
    const api = makeApi();
    renderWithContext(<UsersPage />, { api, role: 'IT' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Заблокувати' }));
    await waitFor(() => expect(api.blockUser).toHaveBeenCalledWith('u2'));
    await user.click(screen.getByRole('button', { name: 'Розблокувати' }));
    await waitFor(() => expect(api.unblockUser).toHaveBeenCalledWith('u3'));
  });

  it('показує помилку сервера, якщо пошта вже зайнята', async () => {
    const api = makeApi();
    api.createUser.mockRejectedValue(new ApiError(409, { code: 'CONFLICT', message: 'Така пошта вже зареєстрована' }));
    renderWithContext(<UsersPage />, { api, role: 'IT' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Ім’я та прізвище'), 'Марія');
    await user.type(screen.getByLabelText('Корпоративна пошта'), 'olena@example.com');
    await user.click(screen.getByRole('button', { name: 'Створити' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('вже зареєстрована');
  });
});

describe('SetPasswordPage (ФВ-16)', () => {
  it('надсилає токен із посилання та новий пароль, після успіху веде до входу', async () => {
    const api = { setPassword: vi.fn().mockResolvedValue(null) };
    renderWithContext(<SetPasswordPage />, { api, route: '/set-password?token=abc123', path: '/set-password' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Новий пароль/), 'Str0ng!Pass');
    await user.type(screen.getByLabelText('Повторіть пароль'), 'Str0ng!Pass');
    await user.click(screen.getByRole('button', { name: 'Зберегти пароль' }));

    await waitFor(() => expect(api.setPassword).toHaveBeenCalledWith('abc123', 'Str0ng!Pass'));
    expect(await screen.findByRole('link', { name: 'Перейти до входу' })).toHaveAttribute('href', '/login');
  });

  it('не надсилає запит, якщо паролі не збігаються', async () => {
    const api = { setPassword: vi.fn() };
    renderWithContext(<SetPasswordPage />, { api, route: '/set-password?token=abc123', path: '/set-password' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Новий пароль/), 'Str0ng!Pass');
    await user.type(screen.getByLabelText('Повторіть пароль'), 'Other!Pass1');
    await user.click(screen.getByRole('button', { name: 'Зберегти пароль' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Паролі не збігаються');
    expect(api.setPassword).not.toHaveBeenCalled();
  });

  it('без токена в посиланні показує повідомлення про недійсне посилання', () => {
    renderWithContext(<SetPasswordPage />, { api: {}, route: '/set-password', path: '/set-password' });
    expect(screen.getByRole('alert')).toHaveTextContent('Посилання недійсне');
  });

  it('прострочений токен — повідомлення сервера', async () => {
    const api = {
      setPassword: vi
        .fn()
        .mockRejectedValue(
          new ApiError(422, { code: 'VALIDATION_ERROR', message: 'Посилання недійсне або прострочене' }),
        ),
    };
    renderWithContext(<SetPasswordPage />, { api, route: '/set-password?token=old', path: '/set-password' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Новий пароль/), 'Str0ng!Pass');
    await user.type(screen.getByLabelText('Повторіть пароль'), 'Str0ng!Pass');
    await user.click(screen.getByRole('button', { name: 'Зберегти пароль' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('прострочене');
  });
});
