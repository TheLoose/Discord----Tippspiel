import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import GuildSwitcher from './GuildSwitcher';
import { auth } from '../api';

const NAV = [
  { to: '/',            label: '📊 Dashboard'    },
  { to: '/leagues',     label: '🏆 Leagues'      },
  { to: '/teams',       label: '👥 Teams'        },
  { to: '/matchdays',   label: '📅 Matchdays'    },
  { to: '/matches',     label: '⚽ Matches'      },
  { to: '/leaderboard', label: '🥇 Leaderboard'  },
];

export default function Layout() {
  const { user, logout }            = useAuth();
  const [activeGuild, setActiveGuild] = useState(null);
  const [loadingGuild, setLoadingGuild] = useState(true);

  useEffect(() => {
    auth.getGuild()
      .then(r => setActiveGuild(r.data.guild))
      .catch(() => {})
      .finally(() => setLoadingGuild(false));
  }, []);

  const handleSwitch = guild => setActiveGuild(guild);

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>Tippspiel</div>

        <GuildSwitcher activeGuild={activeGuild} onSwitch={handleSwitch} />

        <nav>
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              style={({ isActive }) => ({ ...styles.link, ...(isActive ? styles.linkActive : {}) })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.userSection}>
          {user?.avatar && <img src={user.avatar} alt="" style={styles.avatar} />}
          <div>
            <div style={styles.username}>{user?.username}</div>
            <div style={styles.role}>{user?.isMod ? '🛡️ Moderator' : '👤 Viewer'}</div>
          </div>
          <button onClick={logout} style={styles.logoutBtn} title="Logout">↩</button>
        </div>
      </aside>

      <main style={styles.main}>
        {!loadingGuild && !activeGuild ? (
          <div style={styles.noGuild}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
            <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Select a server</h2>
            <p style={{ color: '#888' }}>Pick a server from the dropdown in the sidebar to get started.</p>
          </div>
        ) : (
          <Outlet context={{ activeGuild }} />
        )}
      </main>
    </div>
  );
}

const styles = {
  shell:    { display: 'flex', minHeight: '100vh', background: '#13151a' },
  sidebar:  {
    width: 220, background: '#1e2228', display: 'flex', flexDirection: 'column',
    padding: '24px 0 0', borderRight: '1px solid #2a2f38', flexShrink: 0,
  },
  brand:    { color: '#fff', fontWeight: 800, fontSize: 20, padding: '0 20px 16px' },
  link:     {
    display: 'block', padding: '10px 20px', color: '#aaa',
    textDecoration: 'none', borderRadius: '0 8px 8px 0', marginRight: 8,
    fontSize: 14, transition: 'all 0.15s',
  },
  linkActive:  { background: '#5865f220', color: '#fff', borderLeft: '3px solid #5865f2' },
  userSection: {
    marginTop: 'auto', padding: '16px 20px', display: 'flex',
    alignItems: 'center', gap: 10, borderTop: '1px solid #2a2f38',
  },
  avatar:   { width: 32, height: 32, borderRadius: '50%' },
  username: { color: '#fff', fontSize: 13, fontWeight: 600 },
  role:     { color: '#888', fontSize: 11 },
  logoutBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 },
  main:     { flex: 1, padding: 32, overflowY: 'auto' },
  noGuild:  { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' },
};
