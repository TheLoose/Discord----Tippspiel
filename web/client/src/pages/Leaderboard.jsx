import { useState, useEffect } from 'react';
import { leaderboard as lbApi, leagues as leaguesApi } from '../api';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [allLeagues, setAllLeagues] = useState([]);
  const [leagueId, setLeagueId]     = useState('');
  const [data, setData]             = useState([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    leaguesApi.list().then(r => {
      setAllLeagues(r.data);
      if (r.data.length) setLeagueId(String(r.data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    lbApi.get(leagueId)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [leagueId]);

  const league = allLeagues.find(l => String(l.id) === leagueId);

  return (
    <div>
      <h1 style={styles.heading}>Leaderboard</h1>

      <div style={styles.tabs}>
        {allLeagues.map(l => (
          <button
            key={l.id}
            onClick={() => setLeagueId(String(l.id))}
            style={{ ...styles.tab, ...(String(l.id) === leagueId ? styles.tabActive : {}) }}
          >
            {l.emoji} {l.name}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#888' }}>Loading...</p>}

      {!loading && data.length === 0 && (
        <p style={{ color: '#888' }}>No points recorded yet for this league.</p>
      )}

      {!loading && data.length > 0 && (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={{ width: 40 }}>#</span>
            <span style={{ flex: 1 }}>Player</span>
            <span style={styles.col}>Points</span>
            <span style={styles.col}>Correct</span>
            <span style={styles.col}>Voted</span>
            <span style={styles.col}>Accuracy</span>
          </div>
          {data.map((row, i) => {
            const accuracy = row.total_votes > 0
              ? Math.round((row.correct / row.total_votes) * 100)
              : 0;
            return (
              <div key={row.user_id} style={{ ...styles.tableRow, background: i < 3 ? '#ffffff08' : '#1e2228' }}>
                <span style={{ width: 40, fontSize: 20 }}>{MEDALS[i] ?? i + 1}</span>
                <span style={{ flex: 1, color: '#fff', fontWeight: i < 3 ? 700 : 400 }}>{row.username}</span>
                <span style={{ ...styles.col, color: '#5865f2', fontWeight: 700 }}>{row.total}</span>
                <span style={{ ...styles.col, color: '#57f287' }}>{row.correct}</span>
                <span style={{ ...styles.col, color: '#aaa' }}>{row.total_votes}</span>
                <span style={{ ...styles.col, color: accuracy >= 70 ? '#57f287' : accuracy >= 50 ? '#fee75c' : '#ed4245' }}>
                  {accuracy}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  heading:     { color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 24px' },
  tabs:        { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  tab:         { padding: '8px 20px', borderRadius: 8, border: '1px solid #3a3f47', background: '#1e2228', color: '#aaa', cursor: 'pointer', fontSize: 14 },
  tabActive:   { background: '#5865f2', border: '1px solid #5865f2', color: '#fff', fontWeight: 600 },
  table:       { background: '#1e2228', borderRadius: 10, overflow: 'hidden', border: '1px solid #2a2f38' },
  tableHeader: { display: 'flex', padding: '12px 16px', color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #2a2f38' },
  tableRow:    { display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #2a2f38', color: '#ccc', fontSize: 14 },
  col:         { width: 90, textAlign: 'right' },
};
