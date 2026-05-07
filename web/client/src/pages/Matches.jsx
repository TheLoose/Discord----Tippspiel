import { useState, useEffect } from 'react';
import { matches as matchesApi, leagues as leaguesApi, matchdays as matchdaysApi, teams as teamsApi, importApi } from '../api';
import EmojiPicker from '../components/EmojiPicker';
import { useAuth } from '../hooks/useAuth';
import { useOutletContext } from 'react-router-dom';

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
  const { activeGuild } = useOutletContext() ?? {};

  if (!activeGuild) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>👈</div>
      <h2 style={{ color: '#fff', margin: '12px 0 8px' }}>Select a server first</h2>
      <p style={{ color: '#888' }}>Use the dropdown in the sidebar to pick a Discord server.</p>
    </div>
  );

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
  const [evaluating, setEvaluating]     = useState(null);
  const [reevaluating, setReevaluating] = useState(null);

  // Import state
  const [showImport, setShowImport]   = useState(false);
  const [importLeague, setImportLeague] = useState('');
  const [importText, setImportText]   = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting]     = useState(false);
  const [importError, setImportError] = useState('');

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

  const runImport = async () => {
    if (!importLeague) return setImportError('Please select a league.');
    if (!importText.trim()) return setImportError('Please paste some CSV content.');
    setImporting(true); setImportError(''); setImportResult(null);
    try {
      const lines = importText.trim().split('\n').filter(l => l.trim());
      const rows  = [];
      for (const line of lines) {
        // Strip surrounding quotes from the whole line (e.g. "WM;1;FIN;GER;...")
        const cleanLine = line.trim().replace(/^["']|["']$/g, '');
        const sep   = cleanLine.includes(';') ? ';' : ',';
        const parts = cleanLine.split(sep).map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts[0].toLowerCase() === 'league' || parts[2]?.toLowerCase() === 'home') continue;
        if (parts.length < 5) continue;
        rows.push({ matchday: parseInt(parts[1]), home: parts[2], away: parts[3], time: parts[4] });
      }
      if (!rows.length) return setImportError('No valid rows found in the CSV.');
      const r = await importApi.matches(importLeague, rows);
      setImportResult(r.data);
      if (r.data.created > 0) loadMatches();
    } catch (e) {
      setImportError(e.response?.data?.error ?? 'Import failed');
    } finally { setImporting(false); }
  };

  const reevaluate = async (id, winner) => {
    try {
      await matchesApi.reevaluate(id, winner);
      setReevaluating(null);
      loadMatches();
    } catch (e) {
      alert(e.response?.data?.error ?? 'Reevaluation failed');
    }
  };

  const postMatchNow = async id => {
    try {
      await matchesApi.post(id);
      loadMatches();
    } catch (e) {
      alert('❌ ' + (e.response?.data?.error ?? 'Failed to post match'));
    }
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ ...styles.heading, margin: 0 }}>Matches</h1>
        {user?.isMod && (
          <button onClick={() => { setShowImport(o => !o); setImportResult(null); setImportError(''); }} style={styles.btn}>
            📥 Bulk Import CSV
          </button>
        )}
      </div>

      {/* Bulk Import Panel */}
      {showImport && user?.isMod && (
        <div style={styles.form}>
          <h2 style={styles.subheading}>📥 Bulk Import from CSV</h2>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>
            Expected format: <code style={{ color: '#aaa' }}>League;Matchday;Home;Away;Time</code> (semicolon or comma separated).
            Team names/abbreviations must match teams already added for the selected league.
            Matchdays are created automatically if they don't exist.
          </p>
          {importError && <div style={styles.error}>{importError}</div>}

          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={styles.label}>League *</label>
              <select value={importLeague} onChange={e => setImportLeague(e.target.value)} style={styles.select}>
                <option value="">Select league...</option>
                {allLeagues.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <button
                style={{ ...styles.btn, background: '#57f287', color: '#000' }}
                disabled={importing}
                onClick={runImport}
              >
                {importing ? '⏳ Importing...' : '▶ Run Import'}
              </button>
              <label style={{ ...styles.btn, background: '#3a3f47', cursor: 'pointer' }}>
                📂 Upload file
                <input
                  type="file"
                  accept=".csv,.txt"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setImportText(ev.target.result);
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          </div>

          <textarea
            placeholder={`Paste CSV here, e.g.:\nWM;1;FIN;GER;15-05-2026 16:20;\nWM;1;CAN;SWE;15-05-2026 16:20;`}
            value={importText}
            onChange={e => setImportText(e.target.value)}
            style={{ ...styles.input, height: 160, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
          />

          {importResult && (
            <div style={{ marginTop: 12, padding: 12, background: '#13151a', borderRadius: 8, border: '1px solid #2a2f38' }}>
              <div style={{ color: '#57f287', fontWeight: 600 }}>✅ Import complete</div>
              <div style={{ color: '#ccc', fontSize: 13, marginTop: 4 }}>
                {importResult.created} match(es) created, {importResult.skipped} skipped
              </div>
              {importResult.errors?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: '#fee75c', fontSize: 13, fontWeight: 600 }}>⚠️ Warnings:</div>
                  {[...new Set(importResult.errors)].map((e, i) => (
                    <div key={i} style={{ color: '#888', fontSize: 12 }}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
            {/* Top row: teams + badge */}
            <div style={styles.itemTop}>
              <div style={styles.matchTeams}>
                {renderEmoji(m.team_a_emoji)} <b>{m.team_a}</b>
                <span style={{ color: '#888', margin: '0 6px' }}>vs</span>
                <b>{m.team_b}</b> {renderEmoji(m.team_b_emoji)}
              </div>
              <span style={{ ...styles.badge, background: STATUS_COLOR[m.status] + '20', color: STATUS_COLOR[m.status] }}>
                {m.status}
              </span>
            </div>

            {/* Meta info */}
            <div style={styles.meta}>
              {m.league_emoji} {m.league_name}
              {m.matchday_label ? ` — ${m.matchday_label}` : ''}
              {' '}• ID: {m.id}
              {m.match_date ? ` • ${new Date(m.match_date).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}` : ''}
            </div>

            {/* Vote counts */}
            {m.status !== 'scheduled' && (
              <div style={styles.votes}>
                {renderEmoji(m.team_a_emoji)} {m.votes_a ?? 0} — {m.votes_b ?? 0} {renderEmoji(m.team_b_emoji)}
                <span style={{ color: '#888', marginLeft: 6 }}>({m.total_votes ?? 0} total)</span>
                {m.winning_team && (
                  <span style={{ color: '#57f287', marginLeft: 6 }}>
                    🏅 {m.winning_team === 'a' ? m.team_a : m.team_b} won
                  </span>
                )}
              </div>
            )}

            {/* Action buttons — always on their own row */}
            {user?.isMod && (
              <div style={styles.actions}>
                {m.status === 'scheduled' && (
                  <button onClick={() => postMatchNow(m.id)} style={styles.btnBlue}>📢 Post now</button>
                )}
                {m.status === 'open' && (
                  <button onClick={() => closeMatch(m.id)} style={styles.ghostBtn}>🔒 Close</button>
                )}
                {m.status === 'closed' && evaluating !== m.id && (
                  <button onClick={() => setEvaluating(m.id)} style={styles.btnGreen}>⚡ Evaluate</button>
                )}
                {m.status === 'evaluated' && reevaluating !== m.id && (
                  <button onClick={() => setReevaluating(m.id)} style={{ ...styles.ghostBtn, color: '#fee75c', borderColor: '#fee75c' }}>🔄 Reevaluate</button>
                )}
                {reevaluating === m.id && (
                  <div style={styles.evalRow}>
                    <span style={{ color: '#fee75c', fontSize: 12 }}>Switch winner:</span>
                    <button onClick={() => reevaluate(m.id, 'a')} style={{ ...styles.btn, background: m.winning_team === 'a' ? '#57f287' : '#5865f2' }}>
                      {renderEmoji(m.team_a_emoji)} {m.team_a}
                    </button>
                    <button onClick={() => reevaluate(m.id, 'b')} style={{ ...styles.btn, background: m.winning_team === 'b' ? '#57f287' : '#5865f2' }}>
                      {renderEmoji(m.team_b_emoji)} {m.team_b}
                    </button>
                    <button onClick={() => setReevaluating(null)} style={styles.ghostBtn}>Cancel</button>
                  </div>
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
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  label:      { color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 },
  input:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  select:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14, width: '100%', boxSizing: 'border-box' },
  btn:        { padding: '8px 16px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnGreen:   { padding: '5px 12px', borderRadius: 6, background: '#57f28720', border: '1px solid #57f287', color: '#57f287', cursor: 'pointer', fontSize: 12 },
  ghostBtn:   { padding: '5px 12px', borderRadius: 6, background: 'none', border: '1px solid #3a3f47', color: '#aaa', cursor: 'pointer', fontSize: 12 },
  btnBlue:    { padding: '5px 12px', borderRadius: 6, background: '#5865f220', border: '1px solid #5865f2', color: '#5865f2', cursor: 'pointer', fontSize: 12 },
  error:      { color: '#ed4245', fontSize: 13, marginBottom: 10 },
  filterRow:  { display: 'flex', gap: 12, marginBottom: 16 },
  list:       { display: 'flex', flexDirection: 'column', gap: 8 },
  item:       { display: 'flex', flexDirection: 'column', gap: 8, background: '#1e2228', borderRadius: 10, padding: '14px 16px', border: '1px solid #2a2f38' },
  itemTop:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  matchTeams: { color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  meta:       { color: '#888', fontSize: 12 },
  votes:      { color: '#ccc', fontSize: 13, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 },
  actions:    { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #2a2f3840' },
  evalRow:    { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
};
