import { useState, useEffect } from 'react';
import { matchdays as matchdaysApi, leagues as leaguesApi } from '../api';
import ChannelPicker from '../components/ChannelPicker';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLOR = { open: '#57f287', closed: '#fee75c', evaluated: '#5865f2' };

export default function Matchdays() {
  const { user }          = useAuth();
  const [data, setData]   = useState([]);
  const [allLeagues, setAllLeagues] = useState([]);
  const [leagueId, setLeagueId]     = useState('');
  const [number, setNumber]         = useState('');
  const [label, setLabel]           = useState('');
  const [channelId, setChannelId]   = useState('');
  const [filterLeague, setFilterLeague] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    leaguesApi.list().then(r => setAllLeagues(r.data));
    matchdaysApi.list(filterLeague || undefined).then(r => setData(r.data));
  };
  useEffect(() => { load(); }, [filterLeague]);

  const submit = async e => {
    e.preventDefault();
    if (!leagueId || !number) return setError('League and matchday number are required.');
    setSaving(true); setError('');
    try {
      await matchdaysApi.create({ league_id: leagueId, number, label: label || undefined, channel_id: channelId || null });
      setNumber(''); setLabel(''); setChannelId('');
      load();
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to create matchday');
    } finally { setSaving(false); }
  };

  const closeMatchday = async id => {
    if (!confirm('Close voting for all matches in this matchday?')) return;
    await matchdaysApi.close(id);
    load();
  };

  return (
    <div>
      <h1 style={styles.heading}>Matchdays</h1>

      {user?.isMod && (
        <form onSubmit={submit} style={styles.form}>
          <h2 style={styles.subheading}>Create Matchday</h2>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.row}>
            <select value={leagueId} onChange={e => setLeagueId(e.target.value)} style={styles.select}>
              <option value="">Select league...</option>
              {allLeagues.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input type="number" placeholder="Matchday #" value={number} onChange={e => setNumber(e.target.value)} style={{ ...styles.input, width: 100 }} />
            <input placeholder="Label (optional)" value={label} onChange={e => setLabel(e.target.value)} style={styles.input} />
            <ChannelPicker value={channelId} onChange={setChannelId} placeholder="Select channel (optional)" />
            <button type="submit" disabled={saving} style={styles.btn}>{saving ? 'Creating...' : '+ Create'}</button>
          </div>
        </form>
      )}

      <div style={styles.filterRow}>
        <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} style={styles.select}>
          <option value="">All leagues</option>
          {allLeagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div style={styles.list}>
        {data.map(md => (
          <div key={md.id} style={styles.item}>
            <div style={{ flex: 1 }}>
              <div style={styles.name}>{md.league_emoji} {md.league_name} — {md.label}</div>
              <div style={styles.meta}>ID: {md.id} • {md.match_count} matches ({md.evaluated_count} evaluated)</div>
            </div>
            <span style={{ ...styles.badge, background: STATUS_COLOR[md.status] + '20', color: STATUS_COLOR[md.status] }}>
              {md.status}
            </span>
            {user?.isMod && md.status === 'open' && (
              <button onClick={() => closeMatchday(md.id)} style={styles.ghostBtn}>🔒 Close all</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  heading:    { color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 24px' },
  subheading: { color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 12px' },
  form:       { background: '#1e2228', borderRadius: 10, padding: 20, marginBottom: 24, border: '1px solid #2a2f38' },
  filterRow:  { marginBottom: 16 },
  row:        { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  input:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  select:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  btn:        { padding: '8px 20px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 },
  error:      { color: '#ed4245', fontSize: 13, marginBottom: 10 },
  list:       { display: 'flex', flexDirection: 'column', gap: 8 },
  item:       { display: 'flex', alignItems: 'center', gap: 16, background: '#1e2228', borderRadius: 8, padding: '14px 16px', border: '1px solid #2a2f38' },
  name:       { color: '#fff', fontWeight: 600 },
  meta:       { color: '#888', fontSize: 12, marginTop: 2 },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  ghostBtn:   { padding: '5px 12px', borderRadius: 6, background: 'none', border: '1px solid #3a3f47', color: '#aaa', cursor: 'pointer', fontSize: 12 },
};