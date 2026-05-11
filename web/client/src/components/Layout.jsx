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
  { to: '/logs',        label: '📋 Logs'          },
  { to: '/settings',    label: '⚙️ Settings'     },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Layout() {
  const { user, logout }              = useAuth();
  const [activeGuild, setActiveGuild] = useState(null);
  const [loadingGuild, setLoadingGuild] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile                      = useIsMobile();

  useEffect(() => {
    auth.getGuild()
      .then(r => setActiveGuild(r.data.guild))
      .catch(() => {})
      .finally(() => setLoadingGuild(false));
  }, []);

  const handleNavClick = () => { if (isMobile) setSidebarOpen(false); };
  const handleSwitch   = guild => { setActiveGuild(guild); if (isMobile) setSidebarOpen(false); };

  const sidebarVisible = !isMobile || sidebarOpen;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#13151a' }}>

      {/* Dark overlay on mobile when sidebar open */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 199
        }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 240, background: '#1e2228', display: 'flex', flexDirection: 'column',
        borderRight: '1px solid #2a2f38', flexShrink: 0,
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
        } : {
          position: 'sticky', top: 0, height: '100vh',
        })
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 12px' }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>Tippspiel</div>
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>✕</button>
          )}
        </div>

        <GuildSwitcher activeGuild={activeGuild} onSwitch={handleSwitch} />

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={handleNavClick}
              style={({ isActive }) => ({
                display: 'block', padding: '12px 20px', color: isActive ? '#fff' : '#aaa',
                textDecoration: 'none', borderRadius: '0 8px 8px 0', marginRight: 8,
                fontSize: 15, transition: 'all 0.15s',
                background: isActive ? '#5865f220' : 'transparent',
                borderLeft: isActive ? '3px solid #5865f2' : '3px solid transparent',
              })}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #2a2f38' }}>
          {user?.avatar && <img src={user.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
            <div style={{ color: '#888', fontSize: 11 }}>{user?.isMod ? '🛡️ Admin' : '👤 Viewer'}</div>
          </div>
          <button onClick={logout} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, flexShrink: 0 }} title="Logout">↩</button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', background: '#1e2228',
            borderBottom: '1px solid #2a2f38',
            position: 'sticky', top: 0, zIndex: 100,
          }}>
            <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}>☰</button>
            <span style={{ flex: 1, color: '#fff', fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeGuild?.icon && <img src={activeGuild.icon} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />}
              {activeGuild?.name ?? 'Tippspiel'}
            </span>
            {user?.avatar && <img src={user.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />}
          </div>
        )}

        <main style={{ flex: 1, padding: isMobile ? '16px' : '32px', overflowY: 'auto' }}>
          {!loadingGuild && !activeGuild ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
              <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Select a server</h2>
              <p style={{ color: '#888' }}>{isMobile ? 'Tap ☰ and pick a server to get started.' : 'Pick a server from the dropdown in the sidebar to get started.'}</p>
            </div>
          ) : (
            <Outlet context={{ activeGuild }} />
          )}
        </main>
      </div>

      {/* Global mobile input fix — prevents iOS zoom on focus */}
      <style>{`
        @media (max-width: 767px) {
          input, select, textarea { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
}
