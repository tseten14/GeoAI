import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Contacts from './pages/Contacts';
import ContactForm from './pages/ContactForm';

function Protected({ children }) {
  const [state, setState] = useState('loading');

  useEffect(() => {
    auth
      .me()
      .then((r) => setState(r.user ? 'in' : 'out'))
      .catch(() => setState('out'));
  }, []);

  if (state === 'loading') {
    return <div className="loading">Loading…</div>;
  }
  if (state === 'out') {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/contacts" replace />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/new" element={<ContactForm />} />
        <Route path="contacts/:id/edit" element={<ContactForm />} />
      </Route>
      <Route path="*" element={<Navigate to="/contacts" replace />} />
    </Routes>
  );
}
