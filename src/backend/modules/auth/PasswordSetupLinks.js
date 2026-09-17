// ФВ-16: посилання для встановлення пароля діє 24 години
export class PasswordSetupLinks {
  constructor({ tokens, appUrl }) {
    this.tokens = tokens;
    this.appUrl = appUrl;
  }

  linkFor(user) {
    const token = this.tokens.sign({ sub: user.id, purpose: 'password-setup' }, { expiresIn: '24h' });
    return `${this.appUrl}/set-password?token=${encodeURIComponent(token)}`;
  }

  userIdFrom(token) {
    const payload = this.tokens.verify(token);
    return payload?.purpose === 'password-setup' ? payload.sub : null;
  }
}
