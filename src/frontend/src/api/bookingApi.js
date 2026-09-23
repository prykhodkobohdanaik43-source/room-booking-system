const query = (params) => new URLSearchParams(params).toString();

// Усі виклики REST API в одному місці: сторінки не знають ні адрес, ні формату запитів
export function createBookingApi(http) {
  return {
    login: (email, password) => http.post('/auth/login', { email, password }),
    me: () => http.get('/auth/me'),
    setPassword: (token, password) => http.post('/auth/set-password', { token, password }),

    roomStates: () => http.get('/schedule/now'),
    daySchedule: (isoDay) => http.get(`/schedule?${query({ date: isoDay })}`),
    weekSchedule: (isoDay) => http.get(`/schedule/week?${query({ date: isoDay })}`),

    myBookings: () => http.get('/bookings/mine'),
    createBooking: (payload) => http.post('/bookings', payload),
    createBookingSeries: (payload) => http.post('/bookings/series', payload),
    updateBooking: (id, payload) => http.patch(`/bookings/${id}`, payload),
    bookingWarnings: (payload) => http.post('/bookings/warnings', payload),
    cancelBooking: (id, reason) => http.post(`/bookings/${id}/cancel`, { reason }),
    confirmArrival: (id) => http.post(`/bookings/${id}/confirm-arrival`),

    adminBookings: () => http.get('/admin/bookings'),
    bookingHistory: (from, to) => http.get(`/admin/bookings/history?${query({ from, to })}`),
    utilizationCsv: (from, to) => http.getBlob(`/admin/stats/utilization.csv?${query({ from, to })}`),
    events: (limit = 50) => http.get(`/admin/events?${query({ limit })}`),

    rooms: () => http.get('/rooms'),
    createRoom: (payload) => http.post('/rooms', payload),
    updateRoom: (id, payload) => http.patch(`/rooms/${id}`, payload),
    deactivateRoom: (id, period) => http.post(`/rooms/${id}/deactivate`, period),

    users: () => http.get('/users'),
    createUser: (payload) => http.post('/users', payload),
    blockUser: (id) => http.post(`/users/${id}/block`),
    unblockUser: (id) => http.post(`/users/${id}/unblock`),
  };
}
