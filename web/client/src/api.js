import axios from 'axios';

const api = axios.create({
  baseURL:         '/api',
  withCredentials: true,
});

export const auth = {
  me:       () => axios.get('/auth/me',       { withCredentials: true }),
  logout:   () => axios.post('/auth/logout', {}, { withCredentials: true }),
  emojis:   () => axios.get('/auth/emojis',   { withCredentials: true }),
  channels: () => axios.get('/auth/channels', { withCredentials: true }),
};

export const leagues     = {
  list:   ()       => api.get('/leagues'),
  create: (data)   => api.post('/leagues', data),
  update: (id, d)  => api.patch(`/leagues/${id}`, d),
};

export const teams = {
  list:   (leagueId) => api.get('/teams', { params: { league_id: leagueId } }),
  create: (data)     => api.post('/teams', data),
  update: (id, d)    => api.patch(`/teams/${id}`, d),
  move:   (id, lid)  => api.patch(`/teams/${id}/move`, { league_id: lid }),
};

export const matchdays = {
  list:   (leagueId) => api.get('/matchdays', { params: { league_id: leagueId } }),
  create: (data)     => api.post('/matchdays', data),
  close:  (id)       => api.patch(`/matchdays/${id}/close`),
};

export const matches = {
  list:     (params)       => api.get('/matches', { params }),
  get:      (id)           => api.get(`/matches/${id}`),
  create:   (data)         => api.post('/matches', data),
  close:    (id)           => api.patch(`/matches/${id}/close`),
  evaluate: (id, winner)   => api.patch(`/matches/${id}/evaluate`, { winner }),
};

export const leaderboard = {
  get: (leagueId) => api.get(`/leaderboard/${leagueId}`),
};

export default api;