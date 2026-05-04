import { useState, useEffect } from 'react';
import { auth } from '../api';

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.me()
      .then(r => setUser(r.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await auth.logout();
    setUser(null);
    window.location.href = '/';
  };

  return { user, loading, logout };
}
