import { Outlet, Link, useNavigate } from 'react-router-dom';
import { auth } from '../api';

export default function Layout() {
  const navigate = useNavigate();

  async function logout() {
    try {
      await auth.logout();
    } catch {
      /* still navigate */
    }
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/contacts" className="site-brand">
            <span className="site-brand-mark" aria-hidden />
            Geocoded Contact List
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <div className="main-shell">
        <Outlet />
      </div>
    </>
  );
}
