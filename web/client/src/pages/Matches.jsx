import { useState, useEffect } from 'react';
import { matches as matchesApi, leagues as leaguesApi, matchdays as matchdaysApi, teams as teamsApi } from '../api';
import EmojiPicker from '../components/EmojiPicker';
import { useAuth } from '../hooks/useAuth';

const STATUS_COLOR = { scheduled: '#888', open: '#57f287', closed: '#fee75c', evaluated: '#5865f2' };

function renderEmoji(emoji) {
  const match = emoji?.match(/^<a?:(\w+):(\d+)>$/);
  if (match) {
    const ext = emoji.startsWith('<a:') ? 'gif' : 'webp';
    return <img src={`https://cdn.discordapp.com/emojis/${match[2]}.${ext}`} alt={match[1]} style={{ width: 22, height: 22, verticalAlign: 'middle' }} />;
  }
  return <span>{emoji}</span>;
}

export default function Matches() {
  const { user }            = useAuth();
  const [data, setData]     = useState([]);
  const [allLeagues, setAllLeagues]   = useState([]);
  const [allMatchdays, setAllMatchdays] = useState([]);
  const [allTeams, setAllTeams]       = useState([]);
  const [filterLeague, setFilterLeague]   = useState('');
  const [filterStatus, setFilterStatus]   = useState('');

  // Form state
  const [formLeague, setFormLeague]   = useState('');
  const [formMatchday, setFormMatchday] = useState('');
  const [teamA, setTeamA]             = useState('');
  const [teamB, setTeamB]             = useState('');
  const [matchDate, setMatchDate]     = useState('');
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);

  // Evaluate state
  const [evaluating, setEvaluating]   = useState(null); // match id

  const loadMatches = () =>
    matchesApi.list({
      league_id: filterLeague || undefined,
      status:    filterStatus || undefined
    }).then(r => setData(r.data));

  useEffect(() => {
    leaguesApi.list().then(r => setAllLeagues(r.data));
  }, []);

  useEffect(() => { loadMatches(); }, [filterLeague, filterStatus]);

  useEffect(() => {
    if (!formLeague) { setAllMatchdays([]); setAllTeams([]); return; }
    matchdaysApi.list(formLeague).then(r => setAllMatchdays(r.data));
    teamsApi.list(formLeague).then(r => setAllTeams(r.data.filter(t => t.active)));
  }, [formLeague]);

  const submit = async e => {
    e.preventDefault();
    if (!formLeague || !teamA || !teamB) return setError('League, Team A and Team B are required.');
    if (teamA === teamB) return setError('Team A and Team B must be different.');
    setSaving(true); setError('');
    try {
      await matchesApi.create({
        league_id:   formLeague,
        matchday_id: formMatchday || null,
        team_a_id:   teamA,
        team_b_id:   teamB,
        match_date:  matchDate || null,
      });
      setTeamA(''); setTeamB(''); setMatchDate(''); setFormMatchday('');
      loadMatches();
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to create match');
    } finally { setSaving(false); }
  };

  const closeMatch = async id => {
    await matchesApi.close(id);
    loadMatches();
  };

  const evaluate = async (id, winner) => {
    try {
      await matchesApi.evaluate(id, winner);
      setEvaluating(null);
      loadMatches();
    } catch (e) {
      alert(e.response?.data?.error ?? 'Evaluation failed');
    }
  };

  return (
    <div>
      <h1 style={styles.heading}>Matches</h1>

      {user?.isMod && (
        <form onSubmit={submit} style={styles.form}>
          <h2 style={styles.subheading}>Create Match</h2>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.grid}>
            <div>
              <label style={styles.label}>League *</label>
              <select value={formLeague} onChange={e => { setFormLeague(e.target.value); setTeamA(''); setTeamB(''); }} style={styles.select}>
                <option value="">Select league...</option>
                {allLeagues.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Matchday</label>
              <select value={formMatchday} onChange={e => setFormMatchday(e.target.value)} style={styles.select} disabled={!formLeague}>
                <option value="">No matchday</option>
                {allMatchdays.filter(md => md.status !== 'evaluated').map(md => <option key={md.id} value={md.id}>{md.label}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Team A *</label>
              <select value={teamA} onChange={e => setTeamA(e.target.value)} style={styles.select} disabled={!formLeague}>
                <option value="">Select team...</option>
                {allTeams.map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Team B *</label>
              <select value={teamB} onChange={e => setTeamB(e.target.value)} style={styles.select} disabled={!formLeague}>
                <option value="">Select team...</option>
                {allTeams.filter(t => String(t.team_id) !== String(teamA)).map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={styles.label}>Match Date & Time</label>
              <input type="datetime-local" value={matchDate} onChange={e => setMatchDate(e.target.value)} style={styles.input} />
            </div>
          </div>
          <button type="submit" disabled={saving} style={{ ...styles.btn, marginTop: 16 }}>
            {saving ? 'Creating...' : '+ Create Match'}
          </button>
        </form>
      )}

      <div style={styles.filterRow}>
        <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} style={styles.select}>
          <option value="">All leagues</option>
          {allLeagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={styles.select}>
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="evaluated">Evaluated</option>
        </select>
      </div>

      <div style={styles.list}>
        {data.map(m => (
          <div key={m.id} style={styles.item}>
            <div style={{ flex: 1 }}>
              <div style={styles.matchTeams}>
                {renderEmoji(m.team_a_emoji)} <b>{m.team_a}</b>
                <span style={{ color: '#888', margin: '0 8px' }}>vs</span>
                <b>{m.team_b}</b> {renderEmoji(m.team_b_emoji)}
              </div>
              <div style={styles.meta}>
                {m.league_emoji} {m.league_name}
                {m.matchday_label ? ` — ${m.matchday_label}` : ''}
                {' '}• ID: {m.id}
                {m.match_date ? ` • ${new Date(m.match_date).toLocaleString('de-DE')}` : ''}
              </div>
              {m.status !== 'scheduled' && (
                <div style={styles.votes}>
                  {renderEmoji(m.team_a_emoji)} {m.votes_a ?? 0} — {m.votes_b ?? 0} {renderEmoji(m.team_b_emoji)}
                  <span style={{ color: '#888', marginLeft: 8 }}>({m.total_votes ?? 0} total)</span>
                  {m.winning_team && (
                    <span style={{ color: '#57f287', marginLeft: 8 }}>
                      🏅 {m.winning_team === 'a' ? m.team_a : m.team_b} won
                    </span>
                  )}
                </div>
              )}
            </div>

            <span style={{ ...styles.badge, background: STATUS_COLOR[m.status] + '20', color: STATUS_COLOR[m.status] }}>
              {m.status}
            </span>

            {user?.isMod && (
              <div style={styles.actions}>
                {m.status === 'open' && (
                  <button onClick={() => closeMatch(m.id)} style={styles.ghostBtn}>🔒 Close</button>
                )}
                {m.status === 'closed' && evaluating !== m.id && (
                  <button onClick={() => setEvaluating(m.id)} style={styles.btnGreen}>⚡ Evaluate</button>
                )}
                {evaluating === m.id && (
                  <div style={styles.evalRow}>
                    <button onClick={() => evaluate(m.id, 'a')} style={styles.btn}>
                      {renderEmoji(m.team_a_emoji)} {m.team_a}
                    </button>
                    <button onClick={() => evaluate(m.id, 'b')} style={styles.btn}>
                      {renderEmoji(m.team_b_emoji)} {m.team_b}
                    </button>
                    <button onClick={() => setEvaluating(null)} style={styles.ghostBtn}>Cancel</button>
                  </div>
                )}
              </div>
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
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  label:      { color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 },
  input:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  select:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  btn:        { padding: '8px 16px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnGreen:   { padding: '5px 12px', borderRadius: 6, background: '#57f28720', border: '1px solid #57f287', color: '#57f287', cursor: 'pointer', fontSize: 12 },
  ghostBtn:   { padding: '5px 12px', borderRadius: 6, background: 'none', border: '1px solid #3a3f47', color: '#aaa', cursor: 'pointer', fontSize: 12 },
  error:      { color: '#ed4245', fontSize: 13, marginBottom: 10 },
  filterRow:  { display: 'flex', gap: 12, marginBottom: 16 },
  list:       { display: 'flex', flexDirection: 'column', gap: 8 },
  item:       { display: 'flex', alignItems: 'center', gap: 16, background: '#1e2228', borderRadius: 8, padding: '14px 16px', border: '1px solid #2a2f38' },
  matchTeams: { color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 },
  meta:       { color: '#888', fontSize: 12, marginTop: 4 },
  votes:      { color: '#ccc', fontSize: 13, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  actions:    { display: 'flex', gap: 8, alignItems: 'center' },
  evalRow:    { display: 'flex', gap: 8, alignItems: 'center' },
};
