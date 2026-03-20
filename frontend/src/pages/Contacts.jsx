import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { contactsApi } from '../api';
import '../mapSetup.js';

const MAHWAH = [41.089, -74.144];
const ROWS_PER_PAGE = 5;

/** Leaflet caches pixel geometry at init; if the container size was wrong, tiles misalign until invalidateSize. */
function MapInvalidate() {
  const map = useMap();
  useEffect(() => {
    const fix = () => {
      map.invalidateSize({ animate: false });
    };
    fix();
    const r0 = requestAnimationFrame(fix);
    const r1 = requestAnimationFrame(() => requestAnimationFrame(fix));
    const t1 = setTimeout(fix, 50);
    const t2 = setTimeout(fix, 200);
    const el = map.getContainer();
    const ro = new ResizeObserver(fix);
    ro.observe(el);
    const shell = el.closest('.map-shell');
    if (shell) ro.observe(shell);
    window.addEventListener('resize', fix);
    return () => {
      cancelAnimationFrame(r0);
      cancelAnimationFrame(r1);
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    map.invalidateSize({ animate: false });
    if (points.length === 0) {
      fitted.current = false;
      return;
    }
    if (fitted.current) return;
    const b = L.latLngBounds(points);
    map.fitBounds(b, { padding: [30, 30], maxZoom: 14 });
    fitted.current = true;
  }, [map, points]);
  return null;
}

function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ animate: false });
    map.flyTo([lat, lng], 14);
  }, [map, lat, lng]);
  return null;
}

export default function Contacts() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nameQ, setNameQ] = useState('');
  const [addrQ, setAddrQ] = useState('');
  const [page, setPage] = useState(1);
  const [flyTo, setFlyTo] = useState(null);
  /** Leaflet + React 18 Strict Mode: mount map after layout so container size and CSS are ready */
  const [mapReady, setMapReady] = useState(false);
  useLayoutEffect(() => {
    setMapReady(true);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    contactsApi
      .list()
      .then((r) => setContacts(r.contacts || []))
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const n = nameQ.trim().toUpperCase();
    const a = addrQ.trim().toUpperCase();
    return contacts.filter((c) => {
      const name = `${c.Firstname || ''} ${c.Lastname || ''}`.toUpperCase();
      const addr = `${c.Street || ''}${c.City || ''}${c.State || ''}${c.Zip || ''}`.toUpperCase();
      if (n && !name.includes(n)) return false;
      if (a && !addr.includes(a)) return false;
      return true;
    });
  }, [contacts, nameQ, addrQ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * ROWS_PER_PAGE;
  const pageRows = filtered.slice(start, start + ROWS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [nameQ, addrQ]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const markerPoints = useMemo(() => {
    return contacts
      .map((c) => {
        const lat = parseFloat(c.Latitude);
        const lng = parseFloat(c.Longitude);
        if (isNaN(lat) || isNaN(lng)) return null;
        return { lat, lng, c };
      })
      .filter(Boolean);
  }, [contacts]);

  const boundsPts = useMemo(() => markerPoints.map((m) => [m.lat, m.lng]), [markerPoints]);

  async function onDelete(id) {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await contactsApi.remove(id);
      load();
    } catch {
      /* ignore */
    }
  }

  function onRowClick(e, c) {
    if (e.target.closest('button') || e.target.closest('a')) return;
    const lat = parseFloat(c.Latitude);
    const lng = parseFloat(c.Longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      setFlyTo({ lat, lng, key: `${lat},${lng},${Date.now()}` });
    }
  }

  function trafficHref(c) {
    const lat = encodeURIComponent(c.Latitude ?? '');
    const lng = encodeURIComponent(c.Longitude ?? '');
    return `/traffic/?lat=${lat}&lng=${lng}&radius=1`;
  }

  if (loading) {
    return <div className="loading">Loading contacts…</div>;
  }

  return (
    <>
      <div className="toolbar">
        <Link to="/contacts/new" className="btn btn-primary">
          Add contact
        </Link>
        <a href="/traffic/" className="btn btn-ghost">
          Traffic insights
        </a>
        <div className="toolbar-spacer" />
        <div className="search-row">
          <input
            className="input"
            placeholder="Search by name"
            value={nameQ}
            onChange={(e) => setNameQ(e.target.value)}
          />
          <input
            className="input"
            placeholder="Search by address"
            value={addrQ}
            onChange={(e) => setAddrQ(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">Contacts</div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>First</th>
                <th>Last</th>
                <th>Street</th>
                <th>City</th>
                <th>State</th>
                <th>Zip</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Lat</th>
                <th>Lng</th>
                <th colSpan={2}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const onPage = pageRows.includes(c);
                return (
                  <tr
                    key={c.id}
                    data-hidden={onPage ? undefined : 'true'}
                    onClick={(e) => onRowClick(e, c)}
                  >
                    <td>{c.Prefix}</td>
                    <td>
                      <a href={trafficHref(c)} onClick={(e) => e.stopPropagation()}>
                        {c.Firstname}
                      </a>
                    </td>
                    <td>
                      <a href={trafficHref(c)} onClick={(e) => e.stopPropagation()}>
                        {c.Lastname}
                      </a>
                    </td>
                    <td>{c.Street}</td>
                    <td>{c.City}</td>
                    <td>{c.State}</td>
                    <td>{c.Zip}</td>
                    <td>{c.Phone}</td>
                    <td>{c.Email}</td>
                    <td>{c.Latitude}</td>
                    <td>{c.Longitude}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/contacts/${c.id}/edit`);
                        }}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span>
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      </div>

      <div className="map-shell">
        {mapReady ? (
          <MapContainer
            center={MAHWAH}
            zoom={11}
            style={{ height: '100%', width: '100%', minHeight: 280 }}
            scrollWheelZoom
          >
            <MapInvalidate />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {boundsPts.length > 0 ? <FitBounds points={boundsPts} /> : null}
            {flyTo ? <FlyTo key={flyTo.key} lat={flyTo.lat} lng={flyTo.lng} /> : null}
            {markerPoints.map((m) => (
              <Marker key={m.c.id} position={[m.lat, m.lng]}>
                <Popup>
                  <strong>
                    {m.c.Firstname} {m.c.Lastname}
                  </strong>
                  <br />
                  {m.c.Email}
                  <br />
                  {m.c.Street}, {m.c.City}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div className="map-shell-placeholder" />
        )}
      </div>
    </>
  );
}
