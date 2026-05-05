import { useState, useEffect, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { auth } from '../api';

export default function EmojiPicker({ value, onChange, placeholder = 'Pick emoji...' }) {
  const [open, setOpen]               = useState(false);
  const [tab, setTab]                 = useState('unicode'); // 'unicode' | 'custom'
  const [customEmojis, setCustomEmojis] = useState([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [search, setSearch]           = useState('');
  const ref                           = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch server custom emojis when custom tab is opened
  useEffect(() => {
    if (tab !== 'custom' || customEmojis.length) return;
    setLoadingCustom(true);
    auth.emojis()
      .then(r => setCustomEmojis(r.data))
      .catch(() => setCustomEmojis([]))
      .finally(() => setLoadingCustom(false));
  }, [tab]);

  const selectUnicode = emoji => {
    onChange(emoji.native);
    setOpen(false);
  };

  const selectCustom = emoji => {
    const formatted = emoji.animated
      ? `<a:${emoji.name}:${emoji.id}>`
      : `<:${emoji.name}:${emoji.id}>`;
    onChange(formatted);
    setOpen(false);
    setSearch('');
  };

  // Render the current value as preview
  const renderPreview = () => {
    if (!value) return null;
    const match = value.match(/^<a?:(\w+):(\d+)>$/);
    if (match) {
      const ext = value.startsWith('<a:') ? 'gif' : 'webp';
      return (
        <img
          src={`https://cdn.discordapp.com/emojis/${match[2]}.${ext}`}
          alt={match[1]}
          style={{ width: 22, height: 22 }}
        />
      );
    }
    return <span style={{ fontSize: 22, lineHeight: 1 }}>{value}</span>;
  };

  const filteredCustom = customEmojis.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={ref}>
      {/* Trigger button */}
      <button type="button" onClick={() => setOpen(o => !o)} style={styles.trigger}>
        {value
          ? renderPreview()
          : <span style={{ color: '#888', fontSize: 13 }}>{placeholder}</span>
        }
        <span style={{ marginLeft: 6, fontSize: 11, color: '#888' }}>▼</span>
      </button>

      {open && (
        <div style={styles.popup}>
          {/* Tab switcher */}
          <div style={styles.tabRow}>
            <button
              style={{ ...styles.tab, ...(tab === 'unicode' ? styles.tabActive : {}) }}
              onClick={() => setTab('unicode')}
            >
              🌐 All Emojis
            </button>
            <button
              style={{ ...styles.tab, ...(tab === 'custom' ? styles.tabActive : {}) }}
              onClick={() => setTab('custom')}
            >
              ✨ Server
            </button>
          </div>

          {/* Unicode tab — emoji-mart handles everything */}
          {tab === 'unicode' && (
            <Picker
              data={data}
              onEmojiSelect={selectUnicode}
              theme="dark"
              set="native"
              skinTonePosition="none"
              previewPosition="none"
              navPosition="bottom"
              perLine={8}
              emojiSize={28}
              emojiButtonSize={36}
              maxFrequentRows={2}
              style={{ border: 'none', borderRadius: 0 }}
            />
          )}

          {/* Custom server emojis tab */}
          {tab === 'custom' && (
            <div style={styles.customPanel}>
              <input
                autoFocus
                placeholder="Search server emojis..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={styles.search}
              />
              <div style={styles.grid}>
                {loadingCustom && (
                  <span style={{ color: '#888', fontSize: 13, padding: 8 }}>Loading...</span>
                )}
                {!loadingCustom && filteredCustom.length === 0 && (
                  <span style={{ color: '#888', fontSize: 13, padding: 8 }}>
                    {customEmojis.length === 0 ? 'No server emojis found' : 'No results'}
                  </span>
                )}
                {filteredCustom.map(e => {
                  const ext = e.animated ? 'gif' : 'webp';
                  return (
                    <button
                      key={e.id}
                      title={`:${e.name}:`}
                      onClick={() => selectCustom(e)}
                      style={styles.emojiBtn}
                    >
                      <img
                        src={`https://cdn.discordapp.com/emojis/${e.id}.${ext}`}
                        alt={e.name}
                        style={{ width: 28, height: 28 }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
    cursor: 'pointer', minWidth: 130, fontSize: 14,
  },
  popup: {
    position: 'absolute', top: '110%', left: 0, zIndex: 1000,
    background: '#1e2228', border: '1px solid #3a3f47',
    borderRadius: 10, overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  tabRow: {
    display: 'flex', gap: 4, padding: '8px 8px 4px',
    borderBottom: '1px solid #2a2f38',
  },
  tab: {
    flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
    background: '#2b2f36', color: '#aaa', cursor: 'pointer', fontSize: 12,
  },
  tabActive: { background: '#5865f2', color: '#fff' },
  customPanel: { padding: 8, width: 300 },
  search: {
    width: '100%', padding: '6px 10px', borderRadius: 6,
    border: '1px solid #3a3f47', background: '#2b2f36',
    color: '#fff', fontSize: 13, marginBottom: 8,
    boxSizing: 'border-box',
  },
  grid: {
    display: 'flex', flexWrap: 'wrap', gap: 2,
    maxHeight: 240, overflowY: 'auto',
  },
  emojiBtn: {
    width: 36, height: 36, display: 'flex', alignItems: 'center',
    justifyContent: 'center', border: 'none', borderRadius: 6,
    background: 'transparent', cursor: 'pointer',
  },
};