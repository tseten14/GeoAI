import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { contactsApi } from '../api';
import { US_STATES } from '../usStates';

const empty = {
  Prefix: 'Mr',
  Firstname: '',
  Lastname: '',
  Street: '',
  City: '',
  State: '',
  Zip: '',
  Phone: '',
  Email: '',
  checkphone: false,
  checkemail: false,
  checkmail: false,
  checkall: false
};

export default function ContactForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editMode = Boolean(id);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(editMode);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editMode) return;
    let cancelled = false;
    contactsApi
      .get(id)
      .then((r) => {
        if (cancelled || !r.contact) return;
        const c = r.contact;
        setForm({
          Prefix: c.Prefix || 'Mr',
          Firstname: c.Firstname || '',
          Lastname: c.Lastname || '',
          Street: c.Street || '',
          City: c.City || '',
          State: c.State || '',
          Zip: c.Zip || '',
          Phone: c.Phone || '',
          Email: c.Email || '',
          checkphone: c.Contactbyphone === 'on',
          checkemail: c.Contactbyemail === 'on',
          checkmail: c.contactbymail === 'on',
          checkall: false
        });
      })
      .catch(() => navigate('/contacts'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, editMode, navigate]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      Prefix: form.Prefix,
      Firstname: form.Firstname,
      Lastname: form.Lastname,
      Street: form.Street,
      City: form.City,
      State: form.State,
      Zip: form.Zip,
      Phone: form.Phone,
      Email: form.Email,
      checkphone: form.checkphone,
      checkemail: form.checkemail,
      checkmail: form.checkmail,
      checkall: form.checkall
    };
    try {
      if (editMode) {
        await contactsApi.update(id, payload);
      } else {
        await contactsApi.create(payload);
      }
      navigate('/contacts');
    } catch {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading contact…</div>;
  }

  return (
    <div className="page-form">
      <div className="toolbar">
        <Link to="/contacts" className="btn btn-ghost">
          ← Contacts
        </Link>
        <a href="/traffic/" className="btn btn-ghost">
          Traffic insights
        </a>
      </div>

      <form onSubmit={onSubmit}>
        <div className="card">
          <div className="card-header">{editMode ? 'Edit contact' : 'Add contact'}</div>
          <div className="card-body form-grid">
            <div>
              <span className="form-label">Prefix</span>
              <div className="radio-row">
                {['Mr', 'Mrs', 'Ms', 'Dr'].map((p) => (
                  <label key={p}>
                    <input
                      type="radio"
                      name="prefix"
                      checked={form.Prefix === p}
                      onChange={() => setField('Prefix', p)}
                    />
                    {p}.
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row-2">
              <div>
                <label className="form-label" htmlFor="fn">
                  First name
                </label>
                <input
                  id="fn"
                  className="input"
                  style={{ width: '100%' }}
                  value={form.Firstname}
                  onChange={(e) => setField('Firstname', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="ln">
                  Last name
                </label>
                <input
                  id="ln"
                  className="input"
                  style={{ width: '100%' }}
                  value={form.Lastname}
                  onChange={(e) => setField('Lastname', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="st">
                Street
              </label>
              <input
                id="st"
                className="input"
                style={{ width: '100%' }}
                value={form.Street}
                onChange={(e) => setField('Street', e.target.value)}
              />
            </div>

            <div className="form-row-3">
              <div>
                <label className="form-label" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className="input"
                  style={{ width: '100%' }}
                  value={form.City}
                  onChange={(e) => setField('City', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="state">
                  State
                </label>
                <select
                  id="state"
                  className="input"
                  style={{ width: '100%' }}
                  value={form.State}
                  onChange={(e) => setField('State', e.target.value)}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="zip">
                  Zip
                </label>
                <input
                  id="zip"
                  className="input"
                  style={{ width: '100%' }}
                  value={form.Zip}
                  onChange={(e) => setField('Zip', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="ph">
                Phone
              </label>
              <input
                id="ph"
                className="input"
                style={{ width: '100%' }}
                value={form.Phone}
                onChange={(e) => setField('Phone', e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="em">
                Email
              </label>
              <input
                id="em"
                type="email"
                className="input"
                style={{ width: '100%' }}
                value={form.Email}
                onChange={(e) => setField('Email', e.target.value)}
              />
            </div>

            <div>
              <span className="form-label">Contact by</span>
              <div className="check-row">
                <label>
                  <input
                    type="checkbox"
                    checked={form.checkphone}
                    onChange={(e) => setField('checkphone', e.target.checked)}
                  />
                  Phone
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.checkemail}
                    onChange={(e) => setField('checkemail', e.target.checked)}
                  />
                  Email
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.checkmail}
                    onChange={(e) => setField('checkmail', e.target.checked)}
                  />
                  Mail
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.checkall}
                    onChange={(e) => setField('checkall', e.target.checked)}
                  />
                  Any
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editMode ? 'Update' : 'Save contact'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
