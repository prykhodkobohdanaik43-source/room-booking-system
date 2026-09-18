export function createBookingApi(http) {
  return {
    roomStates: () => http.get('/schedule/now'),
    daySchedule: (isoDay) => http.get(`/schedule?date=${isoDay}`),
    rooms: () => http.get('/rooms'),
    createRoom: (payload) => http.post('/rooms', payload),
    createBooking: (payload) => http.post('/bookings', payload),
    cancelBooking: (id, reason) => http.post(`/bookings/${id}/cancel`, { reason }),
    confirmArrival: (id) => http.post(`/bookings/${id}/confirm-arrival`),
    login: (email, password) => http.post('/auth/login', { email, password }),
    me: () => http.get('/auth/me'),
  };
}
