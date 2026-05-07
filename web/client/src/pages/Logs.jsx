import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { logs as logsApi } from '../api';

const TYPE_CONFIG = {
  match_posted:     { label: 'Match Posted',     color: '#5865f2', icon: '📢' },
  match_closed:     { label: 'Match Closed',     color: '#fee75c', icon: '🔒' },
  match_evaluated:  { label: 'Evaluated',         color: '#57f287', icon: '⚡' },
  match_reevaluated:{ label: 'Reevaluated',       color: '#eb459e', icon: '🔄' },
};

function renderEmoji(emoji) {
  const match = emoji?.match(/^<a?:(\w+):(\d+)>$/);
  if (match) {
    const ext = emoji.startsWith('<a:') ? 'gif' : 'webp';
    return <img src={`https://cdn.discordapp.com/emojis/${match[2]}.${ext}`} alt={match[1]} style={{ width: 18, height: 18, verticalAlign: 'middle' }} />;
  }
  return <span>{emoji}</span>;
}

export default function Logs() {
  const { activeGuild }         = useOutletContext() ?? {};
  const [data, setData]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    if (!activeGuild) return;
    setLoading(true);
    logsApi.list({ type: filterType || undefined, limit: 200 })
      .then(r => setData(r.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [activeGuild, filterType]);

  if (!activeGuild) return (
    <div style={styles.empty}>
      <div style={{ fontSize: 48 }}>👈</div>
      <h2 style={{ color: '#fff', margin: '12px 0 8px' }}>Select a server first</h2>
      <p style={{ color: '#888' }}>Use the dropdown in the sidebar to pick a Discord server.</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ ...styles.heading, margin: 0 }}>Logs</h1>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={styles.select}>
          <option value="">All events</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>

      {loading && <p style={{ color: '#888' }}>Loading...</p>}

      {!loading && data.length === 0 && (
        <p style={{ color: '#888' }}>No logs yet. Logs appear when matches are posted, closed or evaluated.</p>
      )}

      <div style={styles.list}>
        {data.map(log => {
          const cfg = TYPE_CONFIG[log.type] ?? { label: log.type, color: '#888', icon: '📋' };
          const d   = log.details ?? {};

          return (
            <div key={log.id} style={{ ...styles.item, borderLeft: `3px solid ${cfg.color}` }}>
              <div style={styles.itemHeader}>
                <span style={{ ...styles.badge, background: cfg.color + '20', color: cfg.color }}>
                  {cfg.icon} {cfg.label}
                </span>
                <span style={styles.time}>
                  {new Date(log.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}
                </span>
              </div>

              <div style={styles.matchLine}>
                {renderEmoji(log.team_a_emoji)} <b style={{ color: '#fff' }}>{log.team_a}</b>
                <span style={{ color: '#888', margin: '0 8px' }}>vs</span>
                <b style={{ color: '#fff' }}>{log.team_b}</b> {renderEmoji(log.team_b_emoji)}
                <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>
                  {log.league_emoji} {log.league_name} • Match #{log.match_id}
                </span>
              </div>

              {/* Extra details per type */}
              {log.type === 'match_evaluated' && (
                <div style={styles.details}>
                  🏅 Winner: <b style={{ color: '#57f287' }}>{d.winning_name}</b>
                  {' '}• ✅ {d.correct} correct / ❌ {d.wrong} wrong
                  {d.evaluated_by && <span style={{ color: '#888' }}> • by {d.evaluated_by}</span>}
                </div>
              )}
              {log.type === 'match_reevaluated' && (
                <div style={styles.details}>
                  Changed: <b style={{ color: '#ed4245' }}>{d.old_winning_name}</b>
                  {' '}→ <b style={{ color: '#57f287' }}>{d.new_winning_name}</b>
                  {d.reevaluated_by && <span style={{ color: '#888' }}> • by {d.reevaluated_by}</span>}
                </div>
              )}
              {log.type === 'match_posted' && d.channel_id && (
                <div style={styles.details}>
                  Posted to <span style={{ color: '#5865f2' }}>#{d.channel_id}</span>
                </div>
              )}
              {log.type === 'match_closed' && (
                <div style={styles.details}>
                  Reason: {d.reason === 'auto_kickoff' ? '⏱️ Auto-closed at kickoff' : '🔒 Manually closed'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  heading:    { color: '#fff', fontSize: 26, fontWeight: 700 },
  select:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14 },
  list:       { display: 'flex', flexDirection: 'column', gap: 8 },
  item:       { background: '#1e2228', borderRadius: 8, padding: '12px 16px', border: '1px solid #2a2f38', display: 'flex', flexDirection: 'column', gap: 6 },
  itemHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  time:       { color: '#666', fontSize: 12 },
  matchLine:  { color: '#ccc', fontSize: 14, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  details:    { color: '#aaa', fontSize: 13 },
  empty:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' },
};
