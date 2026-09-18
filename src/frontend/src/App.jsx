import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.js';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { Layout } from './components/Layout.jsx';
import { BookingFormPage } from './pages/BookingFormPage.jsx';
import { DaySchedulePage } from './pages/DaySchedulePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RoomStatesPage } from './pages/RoomStatesPage.jsx';
import { RoomsPage } from './pages/RoomsPage.jsx';
import { Role } from './roles.js';

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<RoomStatesPage />} />
        <Route
          path="schedule"
          element={
            <RequireAuth roles={[Role.EMPLOYEE, Role.OFFICE_ADMIN]}>
              <DaySchedulePage />
            </RequireAuth>
          }
        />
        <Route
          path="book"
          element={
            <RequireAuth roles={[Role.EMPLOYEE, Role.OFFICE_ADMIN]}>
              <BookingFormPage />
            </RequireAuth>
          }
        />
        <Route
          path="rooms"
          element={
            <RequireAuth roles={[Role.IT, Role.OFFICE_ADMIN]}>
              <RoomsPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
