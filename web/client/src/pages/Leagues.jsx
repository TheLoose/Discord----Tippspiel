import { useState, useEffect } from 'react';
import { leagues as leaguesApi } from '../api';
import EmojiPicker from '../components/EmojiPicker';
import ChannelPicker from '../components/ChannelPicker';
import { useAuth } from '../hooks/useAuth';

export default function Leagues() {
  const { user }                  = useAuth();
  const [data, setData]           = useState([]);
  const [name, setName]           = useState('');
  const [emoji, setEmoji]         = useState('');
  const [channelId, setChannelId] = useState('');
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  const load = () => leaguesApi.list().then(r => setData(r.data));
  useEffect(() => { load(); }, []);

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
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (league) => {
    await leaguesApi.update(league.id, { active: !league.active });
    load();
  };

  return (
    <div>
      <h1 style={styles.heading}>Leagues</h1>

      {user?.isMod && (
        <form onSubmit={submit} style={styles.form}>
          <h2 style={styles.subheading}>Create League</h2>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.row}>
            <input placeholder="League name" value={name} onChange={e => setName(e.target.value)} style={styles.input} />
            <EmojiPicker value={emoji} onChange={setEmoji} placeholder="Pick emoji" />
            <ChannelPicker value={channelId} onChange={setChannelId} placeholder="Select channel (optional)" />
            <button type="submit" disabled={saving} style={styles.btn}>
              {saving ? 'Creating...' : '+ Create'}
            </button>
          </div>
        </form>
      )}

      <div style={styles.list}>
        {data.map(l => (
          <div key={l.id} style={{ ...styles.item, opacity: l.active ? 1 : 0.5 }}>
            <span style={styles.emoji}>{renderEmoji(l.emoji)}</span>
            <div style={{ flex: 1 }}>
              <div style={styles.name}>{l.name}</div>
              <div style={styles.meta}>ID: {l.id} {l.channel_id ? `• #${l.channel_id}` : ''}</div>
            </div>
            <span style={{ ...styles.badge, background: l.active ? '#57f28720' : '#ed424220', color: l.active ? '#57f287' : '#ed4245' }}>
              {l.active ? 'Active' : 'Inactive'}
            </span>
            {user?.isMod && (
              <button onClick={() => toggleActive(l)} style={styles.ghostBtn}>
                {l.active ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderEmoji(emoji) {
  const match = emoji?.match(/^<a?:(\w+):(\d+)>$/);
  if (match) {
    const ext = emoji.startsWith('<a:') ? 'gif' : 'webp';
    return <img src={`https://cdn.discordapp.com/emojis/${match[2]}.${ext}`} alt={match[1]} style={{ width: 24, height: 24, verticalAlign: 'middle' }} />;
  }
  return emoji;
}

const styles = {
  heading:    { color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 24px' },
  subheading: { color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 12px' },
  form:       { background: '#1e2228', borderRadius: 10, padding: 20, marginBottom: 24, border: '1px solid #2a2f38' },
  row:        { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  input:      { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  btn:        { padding: '8px 20px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 },
  error:      { color: '#ed4245', fontSize: 13, marginBottom: 10 },
  list:       { display: 'flex', flexDirection: 'column', gap: 8 },
  item:       { display: 'flex', alignItems: 'center', gap: 16, background: '#1e2228', borderRadius: 8, padding: '14px 16px', border: '1px solid #2a2f38' },
  emoji:      { fontSize: 24, minWidth: 32 },
  name:       { color: '#fff', fontWeight: 600 },
  meta:       { color: '#888', fontSize: 12, marginTop: 2 },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  ghostBtn:   { padding: '5px 12px', borderRadius: 6, background: 'none', border: '1px solid #3a3f47', color: '#aaa', cursor: 'pointer', fontSize: 12 },
};