import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { leagues as leaguesApi, importApi } from '../api';
import EmojiPicker from '../components/EmojiPicker';
import ChannelPicker from '../components/ChannelPicker';
import { useAuth } from '../hooks/useAuth';

function renderEmoji(emoji) {
  const match = emoji?.match(/^<a?:(\w+):(\d+)>$/);
  if (match) {
    const ext = emoji.startsWith('<a:') ? 'gif' : 'webp';
    return <img src={`https://cdn.discordapp.com/emojis/${match[2]}.${ext}`} alt={match[1]} style={{ width: 24, height: 24, verticalAlign: 'middle' }} />;
  }
  return emoji;
}

export default function Leagues() {
  const { activeGuild }           = useOutletContext() ?? {};
  const { user }                  = useAuth();
  const [data, setData]           = useState([]);
  const [name, setName]           = useState('');
  const [emoji, setEmoji]         = useState('');
  const [channelId, setChannelId] = useState('');
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  // Edit state
  const [editing, setEditing]     = useState(null); // league id
  const [editName, setEditName]   = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editChannel, setEditChannel] = useState('');

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importCsv, setImportCsv]   = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting]   = useState(false);
  const [importError, setImportError] = useState('');

  const load = () => leaguesApi.list().then(r => setData(r.data));
  useEffect(() => { if (activeGuild) load(); }, [activeGuild]);

  if (!activeGuild) return (
    <div style={styles.empty}>
      <div style={{ fontSize: 48 }}>👈</div>
      <h2 style={{ color: '#fff', margin: '12px 0 8px' }}>Select a server first</h2>
      <p style={{ color: '#888' }}>Use the dropdown in the sidebar to pick a Discord server.</p>
    </div>
  );

  const submit = async e => {
    e.preventDefault();
    if (!name || !emoji) return setError('Name and emoji are required.');
    setSaving(true); setError('');
    try {
      await leaguesApi.create({ name, emoji, channel_id: channelId || null });
      setName(''); setEmoji(''); setChannelId('');
      load();
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to create league');
    } finally { setSaving(false); }
  };

  const startEdit = league => {
    setEditing(league.id);
    setEditName(league.name);
    setEditEmoji(league.emoji);
    setEditChannel(league.channel_id ?? '');
  };

  const saveEdit = async id => {
    try {
      await leaguesApi.update(id, { name: editName, emoji: editEmoji, channel_id: editChannel || null });
      setEditing(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to update');
    }
  };

  const toggleActive = async league => {
    await leaguesApi.update(league.id, { active: !league.active });
    load();
  };

  const runImport = async () => {
    if (!importCsv.trim()) return setImportError('Please paste CSV content.');
    setImporting(true); setImportError(''); setImportResult(null);
    try {
      const r = await importApi.leagues(importCsv);
      setImportResult(r.data);
      if (r.data.created > 0) load();
    } catch (e) {
      setImportError(e.response?.data?.error ?? 'Import failed');
    } finally { setImporting(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ ...styles.heading, margin: 0 }}>Leagues</h1>
        {user?.isMod && (
          <button onClick={() => { setShowImport(o => !o); setImportResult(null); setImportError(''); }} style={styles.btn}>
            📥 Import CSV
          </button>
        )}
      </div>

      {/* CSV Import */}
      {showImport && user?.isMod && (
        <div style={styles.form}>
          <h2 style={styles.subheading}>📥 Import Leagues from CSV</h2>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 8px' }}>
            Format: <code style={{ color: '#aaa' }}>name;emoji;channel_id</code> — channel_id is optional.
          </p>
          <p style={{ color: '#666', fontSize: 12, margin: '0 0 12px' }}>
            Example:<br />
            <code style={{ color: '#aaa' }}>Bundesliga;⚽;1234567890123</code><br />
            <code style={{ color: '#aaa' }}>Champions League;🏆;</code>
          </p>
          {importError && <div style={styles.error}>{importError}</div>}
          <textarea
            placeholder="Paste CSV here..."
            value={importCsv}
            onChange={e => setImportCsv(e.target.value)}
            style={{ ...styles.input, height: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, width: '100%' }}
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
          <h2 style={styles.subheading}>Create League</h2>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.row}>
            <input placeholder="League name" value={name} onChange={e => setName(e.target.value)} style={styles.input} />
            <EmojiPicker value={emoji} onChange={setEmoji} placeholder="Pick emoji" />
            <ChannelPicker value={channelId} onChange={setChannelId} placeholder="Select channel (optional)" />
            <button type="submit" disabled={saving} style={styles.btn}>{saving ? 'Creating...' : '+ Create'}</button>
          </div>
        </form>
      )}

      {/* League list */}
      <div style={styles.list}>
        {data.map(l => (
          <div key={l.id} style={{ ...styles.item, opacity: l.active ? 1 : 0.5 }}>
            {editing === l.id ? (
              /* Edit mode */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={styles.row}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={styles.input} placeholder="Name" />
                  <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                  <ChannelPicker value={editChannel} onChange={setEditChannel} placeholder="Select channel" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => saveEdit(l.id)} style={styles.btn}>💾 Save</button>
                  <button onClick={() => setEditing(null)} style={styles.ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              /* View mode */
              <>
                <span style={styles.emojiCol}>{renderEmoji(l.emoji)}</span>
                <div style={{ flex: 1 }}>
                  <div style={styles.name}>{l.name}</div>
                  <div style={styles.meta}>ID: {l.id}{l.channel_id ? ` • <#${l.channel_id}>` : ' • No channel'}</div>
                </div>
                <span style={{ ...styles.badge, background: l.active ? '#57f28720' : '#ed424220', color: l.active ? '#57f287' : '#ed4245' }}>
                  {l.active ? 'Active' : 'Inactive'}
                </span>
                {user?.isMod && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => startEdit(l)} style={styles.ghostBtn}>✏️ Edit</button>
                    <button onClick={() => toggleActive(l)} style={styles.ghostBtn}>{l.active ? 'Deactivate' : 'Activate'}</button>
                  </div>
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
  row:        { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  input:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  btn:        { padding: '8px 20px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 },
  ghostBtn:   { padding: '5px 12px', borderRadius: 6, background: 'none', border: '1px solid #3a3f47', color: '#aaa', cursor: 'pointer', fontSize: 12 },
  error:      { color: '#ed4245', fontSize: 13, marginBottom: 10 },
  list:       { display: 'flex', flexDirection: 'column', gap: 8 },
  item:       { display: 'flex', alignItems: 'center', gap: 16, background: '#1e2228', borderRadius: 8, padding: '14px 16px', border: '1px solid #2a2f38' },
  emojiCol:   { fontSize: 24, minWidth: 32 },
  name:       { color: '#fff', fontWeight: 600 },
  meta:       { color: '#888', fontSize: 12, marginTop: 2 },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  empty:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' },
};