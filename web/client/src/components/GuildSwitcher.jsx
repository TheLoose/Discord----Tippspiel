import { useState, useEffect } from 'react';
import { auth } from '../api';

export default function GuildSwitcher({ activeGuild, onSwitch }) {
  const [guilds, setGuilds]   = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.guilds()
      .then(r => setGuilds(r.data))
      .catch(() => setGuilds([]))
      .finally(() => setLoading(false));
  }, []);

  const select = async guild => {
    const icon = guild.icon
      ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
      : null;
    await auth.setGuild(guild.id, guild.name, icon);
    onSwitch({ id: guild.id, name: guild.name, icon });
    setOpen(false);
  };

  return (
    <div style={styles.wrapper}>
      <button onClick={() => setOpen(o => !o)} style={styles.trigger}>
        {activeGuild?.icon
          ? <img src={activeGuild.icon} alt="" style={styles.icon} />
          : <div style={styles.iconPlaceholder}>🏠</div>
        }
        <span style={styles.name}>{activeGuild?.name ?? 'Select server'}</span>
        <span style={{ color: '#888', fontSize: 11 }}>▼</span>
      </button>

      {open && (
        <div style={styles.dropdown}>
          {loading && <div style={styles.item}>Loading...</div>}
          {guilds.map(g => {
            const icon = g.icon
              ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
              : null;
            return (
              <button key={g.id} onClick={() => select(g)} style={{
                ...styles.item,
                background: activeGuild?.id === g.id ? '#5865f220' : 'transparent'
              }}>
                {icon
                  ? <img src={icon} alt="" style={styles.icon} />
                  : <div style={styles.iconPlaceholder}>{g.name[0]}</div>
                }
                <span style={{ color: '#fff', fontSize: 13 }}>{g.name}</span>
                {activeGuild?.id === g.id && <span style={{ marginLeft: 'auto', color: '#5865f2' }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper:         { position: 'relative', padding: '0 12px 16px' },
  trigger:         {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    background: '#2b2f36', border: '1px solid #3a3f47', borderRadius: 8,
    padding: '8px 10px', cursor: 'pointer', color: '#fff',
  },
  dropdown:        {
    position: 'absolute', top: '110%', left: 12, right: 12, zIndex: 100,
    background: '#1e2228', border: '1px solid #3a3f47', borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden',
  },
  item:            {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '10px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  icon:            { width: 24, height: 24, borderRadius: '50%' },
  iconPlaceholder: {
    width: 24, height: 24, borderRadius: '50%', background: '#5865f2',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, color: '#fff', flexShrink: 0,
  },
  name:            { flex: 1, fontSize: 13, color: '#fff', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
};
