import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Role, roleLabels } from '../roles.js';

export function Layout() {
  const { user, logout } = useAuth();
  const books = user.role === Role.EMPLOYEE || user.role === Role.OFFICE_ADMIN;
  const managesRooms = user.role === Role.IT || user.role === Role.OFFICE_ADMIN;

  return (
    <div className="shell">
      <header className="shell__bar">
        <nav className="nav">
          <NavLink to="/" end>
            Зараз
          </NavLink>
          {books && <NavLink to="/schedule">Розклад</NavLink>}
          {books && <NavLink to="/book">Забронювати</NavLink>}
          {managesRooms && <NavLink to="/rooms">Кімнати</NavLink>}
        </nav>
        <div className="who">
          <span className="who__name">{user.fullName}</span>
          <span className="who__role">{roleLabels[user.role]}</span>
          <button type="button" className="link" onClick={logout}>
            Вийти
          </button>
        </div>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
