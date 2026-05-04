import { useState, useEffect } from 'react';
import { leagues, matches, leaderboard } from '../api';
import { Link } from 'react-router-dom';

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
      <div style={styles.cardValue}>{value}</div>
      <div style={styles.cardLabel}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]         = useState(null);
  const [openMatches, setOpenMatches] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      leagues.list(),
      matches.list({ status: 'open' }),
      matches.list({ status: 'closed' }),
      matches.list({}),
    ]).then(([lg, open, closed, all]) => {
      setStats({
        leagues:  lg.data.length,
        open:     open.data.length,
        closed:   closed.data.length,
        total:    all.data.length,
      });
      setOpenMatches(open.data.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#888' }}>Loading...</p>;

  return (
    <div>
      <h1 style={styles.heading}>Dashboard</h1>
      <div style={styles.statsRow}>
        <StatCard label="Active Leagues"    value={stats.leagues} color="#5865f2" />
        <StatCard label="Open Matches"      value={stats.open}    color="#57f287" />
        <StatCard label="Awaiting Evaluate" value={stats.closed}  color="#fee75c" />
        <StatCard label="Total Matches"     value={stats.total}   color="#eb459e" />
      </div>

      <h2 style={styles.subheading}>Open Matches</h2>
      {openMatches.length === 0
        ? <p style={{ color: '#888' }}>No open matches right now.</p>
        : openMatches.map(m => (
          <div key={m.id} style={styles.matchRow}>
            <span style={styles.leagueBadge}>{m.league_emoji} {m.league_name}</span>
            <span style={styles.matchTeams}>
              {m.team_a_emoji} <b>{m.team_a}</b> vs <b>{m.team_b}</b> {m.team_b_emoji}
            </span>
            <span style={styles.votes}>🗳️ {m.total_votes} votes</span>
          </div>
        ))
      }
      {openMatches.length > 0 && (
        <Link to="/matches" style={styles.seeAll}>See all matches →</Link>
      )}
    </div>
  );
}

const styles = {
  heading:    { color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 24px' },
  subheading: { color: '#fff', fontSize: 18, fontWeight: 600, margin: '32px 0 12px' },
  statsRow:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  card:       { background: '#1e2228', borderRadius: 10, padding: '20px 24px', border: '1px solid #2a2f38' },
  cardValue:  { color: '#fff', fontSize: 32, fontWeight: 700 },
  cardLabel:  { color: '#888', fontSize: 13, marginTop: 4 },
  matchRow:   {
    display: 'flex', alignItems: 'center', gap: 16,
    background: '#1e2228', borderRadius: 8, padding: '12px 16px',
    marginBottom: 8, border: '1px solid #2a2f38',
  },
  leagueBadge: { color: '#5865f2', fontSize: 13, minWidth: 140 },
  matchTeams:  { color: '#fff', fontSize: 14, flex: 1 },
  votes:       { color: '#888', fontSize: 13 },
  seeAll:      { display: 'inline-block', marginTop: 12, color: '#5865f2', textDecoration: 'none', fontSize: 14 },
};
