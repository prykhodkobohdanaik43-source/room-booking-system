import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Role, roleLabels } from '../roles.js';

export function Layout() {
  const { user, logout } = useAuth();
  const books = user.role === Role.EMPLOYEE || user.role === Role.OFFICE_ADMIN;
  const isAdmin = user.role === Role.OFFICE_ADMIN;
  const managesRooms = user.role === Role.IT || user.role === Role.OFFICE_ADMIN;
  const managesUsers = user.role === Role.IT;

  // ФВ-29: IT не бачить розкладу й броней, тож розділ «Зараз» для неї не показується
  return (
    <div className="shell">
      <header className="shell__bar">
        <nav className="nav">
          {books && (
            <NavLink to="/" end>
              Зараз
            </NavLink>
          )}
          {books && <NavLink to="/schedule">Розклад</NavLink>}
          {books && <NavLink to="/week">Тиждень</NavLink>}
          {books && <NavLink to="/my">Мої броні</NavLink>}
          {books && <NavLink to="/book">Забронювати</NavLink>}
          {isAdmin && <NavLink to="/admin">Усі броні</NavLink>}
          {managesRooms && <NavLink to="/rooms">Кімнати</NavLink>}
          {managesUsers && <NavLink to="/users">Користувачі</NavLink>}
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
