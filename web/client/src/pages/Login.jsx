export default function Login() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>🏆</div>
        <h1 style={styles.title}>Tippspiel Dashboard</h1>
        <p style={styles.subtitle}>Sign in with your Discord account to manage the guessing game.</p>
        <a href="/auth/login" style={styles.btn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ marginRight: 8 }}>
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Login with Discord
        </a>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#13151a',
  },
  card: {
    background: '#1e2228', borderRadius: 16, padding: '48px 40px',
    textAlign: 'center', maxWidth: 380, width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid #2a2f38',
  },
  logo:     { fontSize: 56, marginBottom: 12 },
  title:    { color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 8px' },
  subtitle: { color: '#888', fontSize: 14, margin: '0 0 32px', lineHeight: 1.5 },
  btn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: '#5865f2', color: '#fff', textDecoration: 'none',
    padding: '12px 24px', borderRadius: 10, fontWeight: 600, fontSize: 15,
    transition: 'background 0.2s',
  },
};
