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
      <h1 className="login-page-title">GeoAI: Traffic Analysis</h1>
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
  );
}
