import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.js';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { Layout } from './components/Layout.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { BookingFormPage } from './pages/BookingFormPage.jsx';
import { DaySchedulePage } from './pages/DaySchedulePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { MyBookingsPage } from './pages/MyBookingsPage.jsx';
import { RoomStatesPage } from './pages/RoomStatesPage.jsx';
import { RoomsPage } from './pages/RoomsPage.jsx';
import { SetPasswordPage } from './pages/SetPasswordPage.jsx';
import { UsersPage } from './pages/UsersPage.jsx';
import { WeekSchedulePage } from './pages/WeekSchedulePage.jsx';
import { Role } from './roles.js';

const BOOKERS = [Role.EMPLOYEE, Role.OFFICE_ADMIN];

function guarded(roles, page) {
  return <RequireAuth roles={roles}>{page}</RequireAuth>;
}

// Головна сторінка: співробітникам і адміністратору — стан кімнат (ФВ-23), ролі IT — довідник кімнат (ФВ-29)
function Home() {
  const { user } = useAuth();
  return user.role === Role.IT ? <Navigate to="/rooms" replace /> : <RoomStatesPage />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="schedule" element={guarded(BOOKERS, <DaySchedulePage />)} />
        <Route path="week" element={guarded(BOOKERS, <WeekSchedulePage />)} />
        <Route path="my" element={guarded(BOOKERS, <MyBookingsPage />)} />
        <Route path="book" element={guarded(BOOKERS, <BookingFormPage />)} />
        <Route path="bookings/:id/edit" element={guarded(BOOKERS, <BookingFormPage />)} />
        <Route path="admin" element={guarded([Role.OFFICE_ADMIN], <AdminPage />)} />
        <Route path="rooms" element={guarded([Role.IT, Role.OFFICE_ADMIN], <RoomsPage />)} />
        <Route path="users" element={guarded([Role.IT], <UsersPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
