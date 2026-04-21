# Geocoded Contact List & Traffic Insights

Monorepo: **Express API** + **React (Vite) contact UI** + **Traffic Insights** SPA, with **MongoDB** settings in a dedicated `database/` folder.

## Repository layout

| Folder | Role |
|--------|------|
| **`backend/`** | Express server (`index.js`), routes, Passport auth, Mongo access via `backend/db/connection.js`. |
| **`frontend/contacts/`** | Vite + React contact list (legacy course UI). |
| **`frontend/traffic/`** | Vite + React **Traffic Insights** SPA (TypeScript, Tailwind, shadcn). |
| **`database/`** | `config.js` (Mongo URL, DB name, collection) and README — no npm dependencies here. |

Install dependencies for each runnable package:

```bash
npm install                    # root: concurrently only
npm install --prefix backend
npm install --prefix frontend/contacts
npm install --prefix frontend/traffic
```

Or: `npm run install:all` after `npm install` at root (installs backend + both front-end packages).

## Quick start

1. **MongoDB** on `localhost:27017` (defaults match `database/config.js`).

2. **Development** (API + contacts Vite):

   ```bash
   npm run dev
   ```

   - API: **http://127.0.0.1:3000**
   - Contacts: **http://127.0.0.1:5173** — proxies `/api` to the API and **`/traffic`** to the Traffic Vite dev server on **8080** when `npm run dev` is running (HMR).

   Login: `sherpa_14` / `geocode`.

   For a **static** Traffic build under contacts without the traffic dev server, run **`npm run build:traffic`**, then open **`http://127.0.0.1:5173/traffic/`** (served from `frontend/traffic/dist` via the API in production-style setups).

   Optional: run **Traffic only** with **`npm run dev:traffic`** → **http://127.0.0.1:8080/traffic/**. If Vite errors about `@rollup/rollup-*`, reinstall native deps:  
   `cd frontend/traffic && rm -rf node_modules && npm install`

3. **Production-style** (single port — build the SPA first):

   ```bash
   npm run build
   npm start
   ```

   Open **http://127.0.0.1:3000**.

## Scripts (root `package.json`)

| Script | Description |
|--------|-------------|
| `npm run dev` | API + contacts Vite (:5173); `/traffic` proxied to Traffic Vite (:8080) |
| `npm start` | API only (`backend`) |
| `npm run build` | Production build of contacts → `frontend/contacts/dist` |
| `npm run build:traffic` | Build Traffic Insights → `frontend/traffic/dist` |
| `npm run dev:traffic` | Vite dev for Traffic Insights only |

## Traffic Insights

Uses **Supabase** for the OSM analysis function. In **`frontend/traffic/`**:

1. Configure `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Deploy the `osm-traffic-analysis` Edge Function (see `frontend/traffic/supabase/`).

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
