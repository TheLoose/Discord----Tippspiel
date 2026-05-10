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
  guilds:   () => axios.get('/auth/guilds',   { withCredentials: true }),
  getGuild: () => axios.get('/auth/guild',    { withCredentials: true }),
  setGuild: (guild_id, guild_name, guild_icon) =>
    axios.post('/auth/guild', { guild_id, guild_name, guild_icon }, { withCredentials: true }),
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
  post:   (id)       => api.post(`/matchdays/${id}/post`),
};

export const matches = {
  list:       (params)       => api.get('/matches', { params }),
  get:        (id)           => api.get(`/matches/${id}`),
  create:     (data)         => api.post('/matches', data),
  close:      (id)           => api.patch(`/matches/${id}/close`),
  evaluate:   (id, winner)   => api.patch(`/matches/${id}/evaluate`, { winner }),
  reevaluate: (id, winner)   => api.patch(`/matches/${id}/reevaluate`, { winner }),
  post:       (id)           => api.post(`/matches/${id}/post`),
};

export const logs = {
  list: (params) => api.get('/logs', { params }),
};

export const settings = {
  get:      ()       => api.get('/settings'),
  save:     (data)   => api.post('/settings', data),
  roles:    ()       => api.get('/settings/roles'),
};

export const importApi = {
  leagues: (csv)             => api.post('/import/leagues', { csv }),
  teams:   (league_id, csv)  => api.post('/import/teams',   { league_id, csv }),
  matches: (league_id, rows) => api.post('/import/matches', { league_id, rows }),
};

export const leaderboard = {
  get: (leagueId) => api.get(`/leaderboard/${leagueId}`),
};

export default api;