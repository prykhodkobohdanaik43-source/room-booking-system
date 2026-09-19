import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../../src/backend/modules/auth/AuthService.js';
import { JwtTokenService } from '../../../src/backend/modules/auth/JwtTokenService.js';
import { PasswordSetupLinks } from '../../../src/backend/modules/auth/PasswordSetupLinks.js';
import { InMemoryUserRepository } from '../../../src/backend/modules/users/InMemoryUserRepository.js';
import { Role } from '../../../src/backend/modules/users/Role.js';
import { User } from '../../../src/backend/modules/users/User.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../../src/backend/shared/errors.js';
import { FixedClock } from '../../helpers/FixedClock.js';
import { FakeHasher } from '../../helpers/fakes.js';

const EMAIL = 'olena.kovalenko@example.com';
const PASSWORD = 'Passw0rd!';

describe('AuthService', () => {
  let users;
  let clock;
  let tokens;
  let passwordSetup;
  let auth;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    clock = new FixedClock(new Date(2026, 8, 21, 9, 0));
    tokens = new JwtTokenService({ secret: 'test-secret', expiresIn: '1h' });
    passwordSetup = new PasswordSetupLinks({ tokens, appUrl: 'http://localhost:5173' });
    const hasher = new FakeHasher();
    auth = new AuthService({
      users,
      hasher,
      tokens,
      passwordSetup,
      clock,
      corporateDomain: 'example.com',
      loginPolicy: { maxFailedAttempts: 5, lockMinutes: 15 },
    });
    await users.insert(
      new User({
        fullName: 'Олена Коваленко',
        email: EMAIL,
        role: Role.EMPLOYEE,
        passwordHash: await hasher.hash(PASSWORD),
      }),
    );
  });

  it('пускає з коректною поштою і паролем (ФВ-01)', async () => {
    const { token, user } = await auth.login(EMAIL, PASSWORD);
    expect(tokens.verify(token)).toMatchObject({ sub: user.id, role: Role.EMPLOYEE });
  });

  it('відхиляє неправильний пароль (ФВ-01)', async () => {
    await expect(auth.login(EMAIL, 'wrong')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('відхиляє пошту поза корпоративним доменом (ОБМ-03)', async () => {
    await expect(auth.login('olena.kovalenko@gmail.com', PASSWORD)).rejects.toThrow(/корпоративної пошти/);
  });

  it('після 5 невдалих спроб блокує вхід на 15 хвилин (НФВ-15)', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(auth.login(EMAIL, 'wrong')).rejects.toBeInstanceOf(UnauthorizedError);
    }
    await expect(auth.login(EMAIL, PASSWORD)).rejects.toBeInstanceOf(ForbiddenError);

    clock.advanceMinutes(15);
    await expect(auth.login(EMAIL, PASSWORD)).resolves.toHaveProperty('token');
  });

  it('заблокований обліковий запис увійти не може (ФВ-17)', async () => {
    const user = await users.findByEmail(EMAIL);
    user.block();
    await users.update(user);
    await expect(auth.login(EMAIL, PASSWORD)).rejects.toThrow(/заблоковано/);
  });

  it('новий користувач встановлює пароль за посиланням і входить (ФВ-16)', async () => {
    const created = await users.insert(
      new User({ fullName: 'Марта Гнатюк', email: 'marta.hnatiuk@example.com', role: Role.EMPLOYEE }),
    );
    const setupToken = new URL(passwordSetup.linkFor(created)).searchParams.get('token');

    await expect(auth.setPassword(setupToken, 'short')).rejects.toBeInstanceOf(ValidationError);
    await auth.setPassword(setupToken, 'NewPassw0rd!');
    await expect(auth.login('marta.hnatiuk@example.com', 'NewPassw0rd!')).resolves.toHaveProperty('token');
  });

  it('токен доступу не годиться для встановлення пароля', async () => {
    const { token } = await auth.login(EMAIL, PASSWORD);
    await expect(auth.setPassword(token, 'NewPassw0rd!')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
