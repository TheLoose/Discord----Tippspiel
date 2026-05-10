import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { teams as teamsApi, leagues as leaguesApi, importApi } from '../api';
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
  const { activeGuild }             = useOutletContext() ?? {};
  const { user }                    = useAuth();
  const [data, setData]             = useState([]);
  const [allLeagues, setAllLeagues] = useState([]);
  const [filterLeague, setFilterLeague] = useState('');
  const [name, setName]             = useState('');
  const [emoji, setEmoji]           = useState('');
  const [shortName, setShortName]   = useState('');
  const [leagueId, setLeagueId]     = useState('');
  const [error, setError]           = useState('');
  const [saving, setSaving]         = useState(false);

  // Edit state
  const [editing, setEditing]       = useState(null);
  const [editName, setEditName]     = useState('');
  const [editEmoji, setEditEmoji]   = useState('');
  const [editShort, setEditShort]   = useState('');

  // Move state
  const [movingId, setMovingId]     = useState(null);
  const [moveTarget, setMoveTarget] = useState('');

  // Import state
  const [showImport, setShowImport]   = useState(false);
  const [importLeague, setImportLeague] = useState('');
  const [importCsv, setImportCsv]     = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting]     = useState(false);
  const [importError, setImportError] = useState('');

  const load = () => {
    leaguesApi.list().then(r => setAllLeagues(r.data));
    teamsApi.list(filterLeague || undefined).then(r => setData(r.data));
  };
  useEffect(() => { if (activeGuild) load(); }, [activeGuild, filterLeague]);

  if (!activeGuild) return (
    <div style={styles.empty}>
      <div style={{ fontSize: 48 }}>👈</div>
      <h2 style={{ color: '#fff', margin: '12px 0 8px' }}>Select a server first</h2>
      <p style={{ color: '#888' }}>Use the dropdown in the sidebar to pick a Discord server.</p>
    </div>
  );

  const submit = async e => {
    e.preventDefault();
    if (!name || !emoji || !leagueId) return setError('All fields are required.');
    setSaving(true); setError('');
    try {
      await teamsApi.create({ name, emoji, league_id: leagueId, short_name: shortName || null });
      setName(''); setEmoji(''); setShortName('');
      load();
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to create team');
    } finally { setSaving(false); }
  };

  const startEdit = t => {
    setEditing(t.team_id);
    setEditName(t.name);
    setEditEmoji(t.emoji);
    setEditShort(t.short_name ?? '');
  };

  const saveEdit = async id => {
    try {
      await teamsApi.update(id, { emoji: editEmoji, short_name: editShort || null });
      // Also update name via a separate call if changed
      setEditing(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to update');
    }
  };

  const toggleActive = async t => {
    await teamsApi.update(t.team_id, { active: !t.active });
    load();
  };

  const moveTeam = async teamId => {
    if (!moveTarget) return;
    await teamsApi.move(teamId, moveTarget);
    setMovingId(null); setMoveTarget('');
    load();
  };

  const runImport = async () => {
    if (!importCsv.trim()) return setImportError('Please paste CSV content.');
    setImporting(true); setImportError(''); setImportResult(null);
    try {
      const r = await importApi.teams(importLeague || null, importCsv);
      setImportResult(r.data);
      if (r.data.created > 0) load();
    } catch (e) {
      setImportError(e.response?.data?.error ?? 'Import failed');
    } finally { setImporting(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ ...styles.heading, margin: 0 }}>Teams</h1>
        {user?.isMod && (
          <button onClick={() => { setShowImport(o => !o); setImportResult(null); setImportError(''); }} style={styles.btn}>
            📥 Import CSV
          </button>
        )}
      </div>

      {/* CSV Import */}
      {showImport && user?.isMod && (
        <div style={styles.form}>
          <h2 style={styles.subheading}>📥 Import Teams from CSV</h2>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 4px' }}>
            Format: <code style={{ color: '#aaa' }}>name;short_name;emoji;league_id</code>
          </p>
          <p style={{ color: '#666', fontSize: 12, margin: '0 0 12px' }}>
            Example:<br />
            <code style={{ color: '#aaa' }}>Germany;GER;🇩🇪;1</code><br />
            <code style={{ color: '#aaa' }}>Finland;FIN;🇫🇮;1</code><br />
            If you select a league below, the league_id column is optional.
          </p>
          {importError && <div style={styles.error}>{importError}</div>}
          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Default league (optional if league_id in CSV)</label>
            <select value={importLeague} onChange={e => setImportLeague(e.target.value)} style={styles.select}>
              <option value="">Use league_id from CSV</option>
              {allLeagues.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>)}
            </select>
          </div>
          <textarea
            placeholder="Paste CSV here..."
            value={importCsv}
            onChange={e => setImportCsv(e.target.value)}
            style={{ ...styles.input, height: 140, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={runImport} disabled={importing} style={{ ...styles.btn, background: '#57f287', color: '#000' }}>
              {importing ? '⏳ Importing...' : '▶ Run Import'}
            </button>
            <label style={{ ...styles.btn, background: '#3a3f47', cursor: 'pointer' }}>
              📂 Upload file
              <input type="file" accept=".csv,.txt" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setImportCsv(ev.target.result); r.readAsText(f); }} />
            </label>
          </div>
          {importResult && (
            <div style={{ marginTop: 12, padding: 12, background: '#13151a', borderRadius: 8, border: '1px solid #2a2f38' }}>
              <div style={{ color: '#57f287', fontWeight: 600 }}>✅ {importResult.created} created, {importResult.skipped} skipped</div>
              {importResult.errors?.map((e, i) => <div key={i} style={{ color: '#888', fontSize: 12 }}>• {e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {user?.isMod && (
        <form onSubmit={submit} style={styles.form}>
          <h2 style={styles.subheading}>Add Team</h2>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.row}>
            <select value={leagueId} onChange={e => setLeagueId(e.target.value)} style={styles.select}>
              <option value="">Select league...</option>
              {allLeagues.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input placeholder="Team name" value={name} onChange={e => setName(e.target.value)} style={styles.input} />
            <input placeholder="Short (e.g. GER)" value={shortName} onChange={e => setShortName(e.target.value.toUpperCase())} style={{ ...styles.input, width: 90 }} maxLength={10} />
            <EmojiPicker value={emoji} onChange={setEmoji} placeholder="Pick emoji" />
            <button type="submit" disabled={saving} style={styles.btn}>{saving ? 'Adding...' : '+ Add Team'}</button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <select value={filterLeague} onChange={e => setFilterLeague(e.target.value)} style={styles.select}>
          <option value="">All leagues</option>
          {allLeagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {/* Team list */}
      <div style={styles.list}>
        {data.map(t => (
          <div key={t.team_id} style={{ ...styles.item, opacity: t.active ? 1 : 0.5 }}>
            {editing === t.team_id ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={styles.row}>
                  <span style={{ color: '#888', fontSize: 13 }}>{t.name}</span>
                  <input value={editShort} onChange={e => setEditShort(e.target.value.toUpperCase())} style={{ ...styles.input, width: 90 }} placeholder="Short" maxLength={10} />
                  <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveEdit(t.team_id)} style={styles.btn}>💾 Save</button>
                  <button onClick={() => setEditing(null)} style={styles.ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <span>{renderEmoji(t.emoji)}</span>
                <div style={{ flex: 1 }}>
                  <div style={styles.name}>
                    {t.name}
                    {t.short_name && (
                      <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: '#5865f220', color: '#5865f2', fontSize: 11, fontWeight: 700 }}>
                        {t.short_name}
                      </span>
                    )}
                  </div>
                  <div style={styles.meta}>{t.league_emoji} {t.league_name} • ID: {t.team_id}</div>
                </div>
                {user?.isMod && (
                  <>
                    <button onClick={() => startEdit(t)} style={styles.ghostBtn}>✏️ Edit</button>
                    {movingId === t.team_id ? (
                      <div style={styles.moveRow}>
                        <select value={moveTarget} onChange={e => setMoveTarget(e.target.value)} style={styles.select}>
                          <option value="">Move to...</option>
                          {allLeagues.filter(l => l.id !== t.league_id && l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <button onClick={() => moveTeam(t.team_id)} style={styles.btn}>Move</button>
                        <button onClick={() => setMovingId(null)} style={styles.ghostBtn}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setMovingId(t.team_id)} style={styles.ghostBtn}>Move</button>
                    )}
                    <button onClick={() => toggleActive(t)} style={styles.ghostBtn}>{t.active ? 'Deactivate' : 'Activate'}</button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  heading:    { color: '#fff', fontSize: 26, fontWeight: 700 },
  subheading: { color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 12px' },
  form:       { background: '#1e2228', borderRadius: 10, padding: 20, marginBottom: 24, border: '1px solid #2a2f38' },
  label:      { color: '#aaa', fontSize: 12, display: 'block', marginBottom: 4 },
  row:        { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  moveRow:    { display: 'flex', gap: 8, alignItems: 'center' },
  input:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  select:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  btn:        { padding: '8px 20px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 },
  ghostBtn:   { padding: '5px 12px', borderRadius: 6, background: 'none', border: '1px solid #3a3f47', color: '#aaa', cursor: 'pointer', fontSize: 12 },
  error:      { color: '#ed4245', fontSize: 13, marginBottom: 10 },
  list:       { display: 'flex', flexDirection: 'column', gap: 8 },
  item:       { display: 'flex', alignItems: 'center', gap: 16, background: '#1e2228', borderRadius: 8, padding: '14px 16px', border: '1px solid #2a2f38', flexWrap: 'wrap' },
  name:       { color: '#fff', fontWeight: 600 },
  meta:       { color: '#888', fontSize: 12, marginTop: 2 },
  empty:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' },
};