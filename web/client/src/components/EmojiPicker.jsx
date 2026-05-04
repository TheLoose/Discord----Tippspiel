import { useState, useEffect, useRef } from 'react';
import { auth } from '../api';

// Common unicode emojis for quick access
const UNICODE_EMOJIS = [
  '⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸',
  '🥅','🏒','🏑','🏏','🥊','🥋','🎽','🛹','🎿','⛸️',
  '🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤',
  '🏆','🥇','🥈','🥉','🎖️','🏅','🎗️',
];

export default function EmojiPicker({ value, onChange, placeholder = 'Pick emoji...' }) {
  const [open, setOpen]           = useState(false);
  const [emojis, setEmojis]       = useState([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [tab, setTab]             = useState('custom'); // 'custom' | 'unicode'
  const ref                       = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch server custom emojis on first open
  useEffect(() => {
    if (!open || emojis.length) return;
    setLoading(true);
    auth.emojis()
      .then(r => setEmojis(r.data))
      .catch(() => setEmojis([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filteredCustom = emojis.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUnicode = UNICODE_EMOJIS.filter(() =>
    search === '' || true  // unicode emojis don't have searchable names
  );

  const selectCustom = emoji => {
    // Store as Discord format <:name:id>
    const formatted = emoji.animated
      ? `<a:${emoji.name}:${emoji.id}>`
      : `<:${emoji.name}:${emoji.id}>`;
    onChange(formatted);
    setOpen(false);
    setSearch('');
  };

  const selectUnicode = emoji => {
    onChange(emoji);
    setOpen(false);
    setSearch('');
  };

  // Render the current value as an image if it's a custom emoji
  const renderPreview = () => {
    if (!value) return null;
    const match = value.match(/^<a?:(\w+):(\d+)>$/);
    if (match) {
      const [, name, id] = match;
      const ext = value.startsWith('<a:') ? 'gif' : 'webp';
      return <img src={`https://cdn.discordapp.com/emojis/${id}.${ext}`} alt={name} style={{ width: 22, height: 22 }} />;
    }
    return <span style={{ fontSize: 22 }}>{value}</span>;
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={styles.trigger}
      >
        {value ? renderPreview() : <span style={{ color: '#888' }}>{placeholder}</span>}
        <span style={{ marginLeft: 6, fontSize: 12 }}>▼</span>
      </button>

      {open && (
        <div style={styles.popup}>
          <input
            autoFocus
            placeholder="Search emojis..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.search}
          />

          <div style={styles.tabs}>
            <button style={{ ...styles.tab, ...(tab === 'custom' ? styles.tabActive : {}) }}
              onClick={() => setTab('custom')}>Server</button>
            <button style={{ ...styles.tab, ...(tab === 'unicode' ? styles.tabActive : {}) }}
              onClick={() => setTab('unicode')}>Unicode</button>
          </div>

          <div style={styles.grid}>
            {tab === 'custom' && (
              loading
                ? <span style={{ color: '#888', fontSize: 13 }}>Loading emojis...</span>
                : filteredCustom.length === 0
                  ? <span style={{ color: '#888', fontSize: 13 }}>No emojis found</span>
                  : filteredCustom.map(e => {
                      const ext = e.animated ? 'gif' : 'webp';
                      return (
                        <button key={e.id} title={e.name} onClick={() => selectCustom(e)} style={styles.emojiBtn}>
                          <img
                            src={`https://cdn.discordapp.com/emojis/${e.id}.${ext}`}
                            alt={e.name}
                            style={{ width: 28, height: 28 }}
                          />
                        </button>
                      );
                    })
            )}
            {tab === 'unicode' && filteredUnicode.map(e => (
              <button key={e} onClick={() => selectUnicode(e)} style={styles.emojiBtn}>
                <span style={{ fontSize: 24 }}>{e}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  trigger: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', border: '1px solid #3a3f47',
    borderRadius: 8, background: '#2b2f36', color: '#fff',
    cursor: 'pointer', minWidth: 120, fontSize: 14,
  },
  popup: {
    position: 'absolute', top: '110%', left: 0, zIndex: 1000,
    background: '#1e2228', border: '1px solid #3a3f47',
    borderRadius: 10, padding: 10, width: 280,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  search: {
    width: '100%', padding: '6px 10px', borderRadius: 6,
    border: '1px solid #3a3f47', background: '#2b2f36',
    color: '#fff', fontSize: 13, marginBottom: 8, boxSizing: 'border-box',
  },
  tabs: { display: 'flex', gap: 4, marginBottom: 8 },
  tab: {
    flex: 1, padding: '4px 0', borderRadius: 6, border: 'none',
    background: '#2b2f36', color: '#aaa', cursor: 'pointer', fontSize: 12,
  },
  tabActive: { background: '#5865f2', color: '#fff' },
  grid: {
    display: 'flex', flexWrap: 'wrap', gap: 4,
    maxHeight: 200, overflowY: 'auto',
  },
  emojiBtn: {
    width: 36, height: 36, display: 'flex', alignItems: 'center',
    justifyContent: 'center', border: 'none', borderRadius: 6,
    background: 'transparent', cursor: 'pointer',
    transition: 'background 0.15s',
  },
};
