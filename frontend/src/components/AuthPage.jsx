import { useState } from 'react';
import { auth } from '../api';

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await auth.login({ email: form.email, password: form.password })
        : await auth.register(form);
      localStorage.setItem('token', res.token);
      onLogin(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#6366f1 0%,#818cf8 100%)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 20 }}>
        <div className="card">
          <div style={{ padding: '32px 32px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔄</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>TradeNest</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Exchange anything, anywhere</p>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', margin: '16px 32px 0' }}>
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 0, fontWeight: 700, fontSize: 14,
                  background: 'transparent', color: mode === m ? 'var(--primary)' : 'var(--muted)',
                  borderBottom: mode === m ? '2px solid var(--primary)' : '2px solid transparent',
                  textTransform: 'capitalize'
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <div className="form-group">
                <label>Username</label>
                <input placeholder="johndoe" value={form.username} onChange={set('username')} required />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              {loading ? <><span className="spinner" /> Working...</> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
