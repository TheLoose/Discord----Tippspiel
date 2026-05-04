import { useState, useEffect } from 'react';
import { teams as teamsApi, leagues as leaguesApi } from '../api';
import EmojiPicker from '../components/EmojiPicker';
import { useAuth } from '../hooks/useAuth';

function renderEmoji(emoji) {
  const match = emoji?.match(/^<a?:(\w+):(\d+)>$/);
  if (match) {
    const ext = emoji.startsWith('<a:') ? 'gif' : 'webp';
    return <img src={`https://cdn.discordapp.com/emojis/${match[2]}.${ext}`} alt={match[1]} style={{ width: 24, height: 24, verticalAlign: 'middle' }} />;
  }
  return emoji;
}

export default function Teams() {
  const { user }              = useAuth();
  const [data, setData]       = useState([]);
  const [allLeagues, setAllLeagues] = useState([]);
  const [filterLeague, setFilterLeague] = useState('');
  const [name, setName]       = useState('');
  const [emoji, setEmoji]     = useState('');
  const [leagueId, setLeagueId] = useState('');
  const [movingId, setMovingId] = useState(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const load = () => {
    leaguesApi.list().then(r => setAllLeagues(r.data));
    teamsApi.list(filterLeague || undefined).then(r => setData(r.data));
  };
  useEffect(() => { load(); }, [filterLeague]);

  const submit = async e => {
    e.preventDefault();
    if (!name || !emoji || !leagueId) return setError('All fields are required.');
    setSaving(true); setError('');
    try {
      await teamsApi.create({ name, emoji, league_id: leagueId });
      setName(''); setEmoji('');
      load();
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to create team');
    } finally { setSaving(false); }
  };

  const toggleActive = async team => {
    await teamsApi.update(team.team_id, { active: !team.active });
    load();
  };

  const moveTeam = async teamId => {
    if (!moveTarget) return;
    await teamsApi.move(teamId, moveTarget);
    setMovingId(null); setMoveTarget('');
    load();
  };

  return (
    <div>
      <h1 style={styles.heading}>Teams</h1>

      {user?.isMod && (
        <form onSubmit={submit} style={styles.form}>
          <h2 style={styles.subheading}>Add Team</h2>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.row}>
            <select value={leagueId} onChange={e => setLeagueId(e.target.value)} style={styles.select}>
              <option value="">Select league...</option>
              {allLeagues.filter(l => l.active).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <input placeholder="Team name" value={name} onChange={e => setName(e.target.value)} style={styles.input} />
            <EmojiPicker value={emoji} onChange={setEmoji} placeholder="Pick emoji" />
            <button type="submit" disabled={saving} style={styles.btn}>
              {saving ? 'Adding...' : '+ Add Team'}
            </button>
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
        {data.map(t => (
          <div key={t.team_id} style={{ ...styles.item, opacity: t.active ? 1 : 0.5 }}>
            <span>{renderEmoji(t.emoji)}</span>
            <div style={{ flex: 1 }}>
              <div style={styles.name}>{t.name}</div>
              <div style={styles.meta}>{t.league_emoji} {t.league_name} • ID: {t.team_id}</div>
            </div>
            {user?.isMod && (
              <>
                {movingId === t.team_id ? (
                  <div style={styles.moveRow}>
                    <select value={moveTarget} onChange={e => setMoveTarget(e.target.value)} style={styles.select}>
                      <option value="">Move to league...</option>
                      {allLeagues.filter(l => l.id !== t.league_id && l.active).map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <button onClick={() => moveTeam(t.team_id)} style={styles.btn}>Move</button>
                    <button onClick={() => setMovingId(null)} style={styles.ghostBtn}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setMovingId(t.team_id)} style={styles.ghostBtn}>Move</button>
                )}
                <button onClick={() => toggleActive(t)} style={styles.ghostBtn}>
                  {t.active ? 'Deactivate' : 'Activate'}
                </button>
              </>
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
  moveRow:    { display: 'flex', gap: 8, alignItems: 'center' },
  input:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  select:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  btn:        { padding: '8px 20px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 },
  error:      { color: '#ed4245', fontSize: 13, marginBottom: 10 },
  list:       { display: 'flex', flexDirection: 'column', gap: 8 },
  item:       { display: 'flex', alignItems: 'center', gap: 16, background: '#1e2228', borderRadius: 8, padding: '14px 16px', border: '1px solid #2a2f38' },
  name:       { color: '#fff', fontWeight: 600 },
  meta:       { color: '#888', fontSize: 12, marginTop: 2 },
  ghostBtn:   { padding: '5px 12px', borderRadius: 6, background: 'none', border: '1px solid #3a3f47', color: '#aaa', cursor: 'pointer', fontSize: 12 },
};
