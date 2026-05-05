import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { settings as settingsApi } from '../api';

export default function Settings() {
  const { activeGuild }         = useOutletContext() ?? {};
  const [roles, setRoles]       = useState([]);
  const [modRoleId, setModRoleId] = useState('');
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!activeGuild) return;
    setLoading(true);
    Promise.all([settingsApi.get(), settingsApi.roles()])
      .then(([s, r]) => {
        setModRoleId(s.data.mod_role_id ?? '');
        setRoles(r.data);
      })
      .catch(e => setError(e.response?.data?.error ?? 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, [activeGuild]);

  const save = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      await settingsApi.save({ mod_role_id: modRoleId || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!activeGuild) return (
    <div style={styles.empty}>
      <div style={{ fontSize: 48 }}>👈</div>
      <h2 style={{ color: '#fff', margin: '12px 0 8px' }}>Select a server first</h2>
      <p style={{ color: '#888' }}>Use the dropdown in the sidebar to pick a Discord server.</p>
    </div>
  );

  const selectedRole = roles.find(r => r.id === modRoleId);

  return (
    <div>
      <h1 style={styles.heading}>Settings — {activeGuild.name}</h1>

      <div style={styles.section}>
        <h2 style={styles.subheading}>🛡️ Moderator Role</h2>
        <p style={styles.desc}>
          Members with this role can use bot commands and manage the dashboard.
          This is stored per server so each server can have its own mod role.
        </p>

        {loading
          ? <p style={{ color: '#888' }}>Loading roles...</p>
          : (
            <div style={styles.row}>
              <select
                value={modRoleId}
                onChange={e => setModRoleId(e.target.value)}
                style={styles.select}
              >
                <option value="">No role set (use env fallback)</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              {selectedRole && (
                <div style={{
                  ...styles.roleBadge,
                  background: selectedRole.color
                    ? `#${selectedRole.color.toString(16).padStart(6, '0')}22`
                    : '#2b2f36',
                  color: selectedRole.color
                    ? `#${selectedRole.color.toString(16).padStart(6, '0')}`
                    : '#aaa',
                  border: `1px solid ${selectedRole.color ? `#${selectedRole.color.toString(16).padStart(6, '0')}` : '#3a3f47'}`,
                }}>
                  @{selectedRole.name}
                </div>
              )}

              <button onClick={save} disabled={saving} style={styles.btn}>
                {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save'}
              </button>
            </div>
          )
        }

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}

const styles = {
  heading:    { color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 24px' },
  subheading: { color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 8px' },
  desc:       { color: '#888', fontSize: 14, margin: '0 0 16px', lineHeight: 1.5 },
  section:    { background: '#1e2228', borderRadius: 10, padding: 24, border: '1px solid #2a2f38', marginBottom: 24 },
  row:        { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  select:     { padding: '8px 12px', borderRadius: 8, border: '1px solid #3a3f47', background: '#2b2f36', color: '#fff', fontSize: 14, minWidth: 220 },
  roleBadge:  { padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  btn:        { padding: '8px 20px', borderRadius: 8, background: '#5865f2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 },
  error:      { color: '#ed4245', fontSize: 13, marginTop: 10 },
  empty:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' },
};
