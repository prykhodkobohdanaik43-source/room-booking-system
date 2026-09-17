import { ConflictError } from '../../shared/errors.js';
import { User } from './User.js';
import { UserRepository } from './UserRepository.js';

const UNIQUE_VIOLATION = '23505';

function toUser(row) {
  if (!row) return null;
  return new User({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    isBlocked: row.is_blocked,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
  });
}

export class PgUserRepository extends UserRepository {
  constructor(pool) {
    super();
    this.pool = pool;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return toUser(rows[0]);
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()]);
    return toUser(rows[0]);
  }

  async findAll() {
    const { rows } = await this.pool.query('SELECT * FROM users ORDER BY full_name');
    return rows.map(toUser);
  }

  async insert(user) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, is_blocked)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user.fullName, user.email, user.passwordHash, user.role, user.isBlocked],
      );
      return toUser(rows[0]);
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        throw new ConflictError('Користувач із такою поштою вже існує', 'EMAIL_TAKEN');
      }
      throw err;
    }
  }

  async update(user) {
    const { rows } = await this.pool.query(
      `UPDATE users
          SET full_name = $2, password_hash = $3, role = $4, is_blocked = $5,
              failed_login_attempts = $6, locked_until = $7
        WHERE id = $1
        RETURNING *`,
      [
        user.id,
        user.fullName,
        user.passwordHash,
        user.role,
        user.isBlocked,
        user.failedLoginAttempts,
        user.lockedUntil,
      ],
    );
    return toUser(rows[0]);
  }
}
