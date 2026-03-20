# Geocoded Contact List & Traffic Insights

Monorepo: **Express API** + **React (Vite) contact UI** + **Traffic Insights** SPA, with **MongoDB** settings in a dedicated `database/` folder.

## Repository layout

| Folder | Role |
|--------|------|
| **`backend/`** | Express server (`index.js`), routes, Passport auth, Mongo access via `backend/db/connection.js`. |
| **`frontend/`** | Vite + React contact app; **`frontend/traffic-app/`** is the Traffic Insights build. |
| **`database/`** | `config.js` (Mongo URL, DB name, collection) and README — no npm dependencies here. |

Install dependencies for each runnable package:

```bash
npm install                    # root: concurrently only
npm install --prefix backend
npm install --prefix frontend
npm install --prefix frontend/traffic-app
```

Or: `npm run install:all` after `npm install` at root (installs backend + frontend + traffic-app).

## Quick start

1. **MongoDB** on `localhost:27017` (defaults match `database/config.js`).

2. **Development** (API + contacts Vite):

   ```bash
   npm run dev
   ```

   - API: **http://127.0.0.1:3000**
   - Contacts: **http://127.0.0.1:5173** — proxies `/api` and **`/traffic`** to the API (traffic UI is the **built** app in `frontend/traffic-app/dist`)

   Login: `sherpa_14` / `geocode`.

   After you change **traffic-app** styles or code, run **`npm run build:traffic`** (or `cd frontend/traffic-app && npm run build`), then refresh **`http://127.0.0.1:5173/traffic/`**.

   Optional live traffic HMR: **`npm run dev:traffic`** (opens **http://127.0.0.1:8080/traffic/**). If Vite errors about `@rollup/rollup-*`, reinstall native deps:  
   `cd frontend/traffic-app && rm -rf node_modules && npm install`

3. **Production-style** (single port — build the SPA first):

   ```bash
   npm run build
   npm start
   ```

   Open **http://127.0.0.1:3000**.

## Scripts (root `package.json`)

| Script | Description |
|--------|-------------|
| `npm run dev` | API + contacts Vite (:5173); `/traffic` proxied to API (serves `traffic-app/dist`) |
| `npm start` | API only (`backend`) |
| `npm run build` | Production build of `frontend` → `frontend/dist` |
| `npm run build:traffic` | Build Traffic Insights → `frontend/traffic-app/dist` |
| `npm run dev:traffic` | Vite dev for Traffic Insights only |

## Traffic Insights

Uses **Supabase** for the OSM analysis function. In **`frontend/traffic-app/`**:

1. Configure `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Deploy the `osm-traffic-analysis` Edge Function (see `frontend/traffic-app/supabase/`).

## Environment (MongoDB)

Optional overrides:

- `MONGO_URL` — default `mongodb://localhost:27017/cmps369`
- `MONGO_DB_NAME` — default `cmps369`
- `MONGO_CONTACTS_COLLECTION` — default `colon1`

## Geocoding (contacts)

- `MAPBOX_ACCESS_TOKEN` — optional [Mapbox public token](https://docs.mapbox.com/help/getting-started/access-tokens/) for geocoding. If unset, addresses are geocoded via Nominatim (OpenStreetMap) only.

## Navigation

- From **Contacts**: **Traffic insights** → `/traffic/`.
- Traffic app fetches **`/api/traffic-analysis`** on the same host as the API.
