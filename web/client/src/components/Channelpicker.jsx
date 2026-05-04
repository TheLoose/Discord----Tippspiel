import { useState, useEffect } from 'react';
import { auth } from '../api';

export default function ChannelPicker({ value, onChange, placeholder = 'Select channel...' }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    auth.channels()
      .then(r => setChannels(r.data))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedChannel = channels.find(c => c.id === value);

  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      style={styles.select}
      disabled={loading}
    >
      <option value="">{loading ? 'Loading channels...' : placeholder}</option>
      {channels.map(c => (
        <option key={c.id} value={c.id}>#{c.name}</option>
      ))}
    </select>
  );
}

const styles = {
  select: {
    padding: '8px 12px', borderRadius: 8,
    border: '1px solid #3a3f47', background: '#2b2f36',
    color: '#fff', fontSize: 14, minWidth: 200,
  }
};