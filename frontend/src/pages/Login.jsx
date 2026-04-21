import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    auth
      .me()
      .then((r) => {
        if (r.user) navigate('/contacts', { replace: true });
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await auth.login(username, password);
      navigate('/contacts', { replace: true });
    } catch {
      setError('Invalid username or password.');
    }
  }

  if (checking) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="login-page">
      <div className="login-page-atmosphere" aria-hidden="true">
        <div className="login-page-grid" />
        <svg
          className="login-page-routes"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="login-route-glow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(56,189,248,0)" />
              <stop offset="45%" stopColor="rgba(56,189,248,0.45)" />
              <stop offset="100%" stopColor="rgba(99,102,241,0.15)" />
            </linearGradient>
          </defs>
          <path
            fill="none"
            stroke="url(#login-route-glow)"
            strokeWidth="3"
            strokeLinecap="round"
            d="M -40 520 C 180 380, 320 620, 520 480 S 780 200, 980 340 S 1180 180, 1280 280"
          />
          <path
            fill="none"
            stroke="rgba(148,163,184,0.22)"
            strokeWidth="2"
            strokeDasharray="10 14"
            strokeLinecap="round"
            d="M 80 680 C 260 520, 400 720, 620 560 S 880 400, 1120 480"
          />
          <path
            fill="none"
            stroke="rgba(56,189,248,0.18)"
            strokeWidth="2"
            strokeLinecap="round"
            d="M 200 120 C 420 80, 500 280, 720 220 S 920 80, 1100 140"
          />
          <path
            fill="none"
            stroke="rgba(34,211,238,0.12)"
            strokeWidth="4"
            strokeLinecap="round"
            d="M 40 360 Q 360 180, 640 320 T 1220 400"
          />
        </svg>
        <div className="login-page-orb login-page-orb--cyan" />
        <div className="login-page-orb login-page-orb--violet" />
      </div>

      <div className="login-page-content">
        <div className="login-page-brand">
          <span className="login-page-logo" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="3" width="20" height="27" rx="5" fill="#1e293b" stroke="#475569" strokeWidth="1" />
              <circle cx="20" cy="11.5" r="4" fill="#ef4444" />
              <circle cx="20" cy="19.5" r="4" fill="#eab308" />
              <circle cx="20" cy="27.5" r="4" fill="#22c55e" />
              <rect x="18" y="30" width="4" height="7" rx="1" fill="#64748b" />
            </svg>
          </span>
          <h1 className="login-page-title">GeoAI: Traffic Analysis</h1>
        </div>
        <div className="login-card card">
          <div className="card-header">Sign in</div>
          <div className="card-body">
            <p className="muted" style={{ margin: 0 }}>
              Enter your credentials to use contacts, maps, and GeoTraffic insights.
            </p>
            {error ? <div className="alert alert-warn">{error}</div> : null}
            <form onSubmit={onSubmit} className="form-grid">
              <div>
                <label className="form-label" htmlFor="user">
                  Username
                </label>
                <input
                  id="user"
                  className="input"
                  style={{ width: '100%' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="pass">
                  Password
                </label>
                <input
                  id="pass"
                  type="password"
                  className="input"
                  style={{ width: '100%' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Log in
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
