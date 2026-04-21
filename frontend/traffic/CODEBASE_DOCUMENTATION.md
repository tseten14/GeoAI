# Project GeoAI: Traffic App Codebase Documentation

## Overview
Traffic App is a frontend React application built with TypeScript, Vite, and Tailwind CSS. The application allows users to input coordinates or click on a map, which simulates a data extraction and analysis pipeline to determine traffic congestion, signalized intersections, and other road features within a given radius.

## Tech Stack
- **Frontend Framework:** React 18, set up with Vite (`@vitejs/plugin-react-swc`).
- **Language:** TypeScript.
- **Styling:** Tailwind CSS (`tailwindcss`, `postcss`, `autoprefixer`) accompanied by `framer-motion` for smooth UI transitions and animation.
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/) configured under `src/components/ui/` (using Radix UI under the hood).
- **Icons:** `lucide-react`.
- **State/Query Management:** React Query (`@tanstack/react-query`).
- **Routing:** React Router v6 (`react-router-dom`).
- **Mapping:** Leaflet & React Leaflet (`leaflet`, `react-leaflet`).
- **Testing:** Vitest and Testing Library.

## Directory Structure
```
frontend/traffic/
├── package.json               # Dependencies and npm scripts
├── vite.config.ts             # Vite configuration
├── tailwind.config.ts         # Tailwind theme & plugin setup
├── index.html                 # Main HTML entry point
├── src/
│   ├── App.tsx               # Root component (routing, providers)
│   ├── index.css             # Global CSS and Tailwind directives
│   ├── components/           # Reusable UI React components
│   │   ├── ui/               # Generic shadcn UI components (buttons, dialogs, etc.)
│   │   └── ...               # App-specific components (e.g., MapView, AnalysisDashboard)
│   ├── hooks/                # Custom React hooks
│   ├── integrations/         # 3rd-party tool & service integrations
│   ├── lib/                  # Library code, utilities, and API services
│   │   └── api/
│   │       └── traffic.ts    # Traffic API client and TypeScript interfaces
│   └── pages/                # Route-level page components
│       ├── Index.tsx         # Main Landing/App Page
│       └── NotFound.tsx      # 404 Generic Error Page
└── supabase/                  # Supabase configurations/functions (if integrated)
```

## Key Components & Data Flow
1. **App Initializer (`src/App.tsx`)**
   Wraps the application in primary providers: `QueryClientProvider`, `TooltipProvider`, `BrowserRouter` (with a basename of `/traffic`), and global components like toast notifications (`Toaster`, `Sonner`).

2. **Main Page (`src/pages/Index.tsx`)**
   - Extracts coordinates `?lat=` and `?lng=` from URLs using React Router `useSearchParams`.
   - Manages global state such as the current Map center, radius, ETL pipeline stage (`idle`, `extract`, `transform`, `load`, `complete`), and the resulting API response.
   - Triggers the `handleAnalyze` flow either automatically on map clicks or via input submission.
   - Stages a simulated data-loading sequence while analyzing.

3. **Core Traffic Logic & API (`src/lib/api/traffic.ts`)**
   - Defines interfaces such as `TrafficAnalysis`, `AnalysisMetadata`, and `TrafficResponse`.
   - Exposes an `analyzeTraffic` async function that makes a `POST` request to `/api/traffic-analysis` endpoint fetching the localized traffic data.

4. **Map View (`src/components/MapView.tsx`)**
   - Renders an interactive map using `react-leaflet`.
   - Captures user map clicks to automatically trigger and simulate traffic logic at a new coordinate.

5. **Analysis Dashboard (`src/components/AnalysisDashboard.tsx`)**
   - Renders the resulting traffic metrics (total road signals, current traffic congestion, scores, and metadata) in a stylized Framer Motion animated grid view, mapping numeric thresholds to specific colors and icons.

## Execution Flow
1. User loads the page (potentially passing coordinates via query string).
2. The user inputs coordinates/radius by typing into `CoordinateInput` or clicking via `MapView`.
3. `Index.tsx` triggers `analyzeTraffic`.
4. The fetch command contacts `/api/traffic-analysis` with the given `{lat, lon, radiusMiles}`.
5. While simulating processing, the pipeline UI stages trigger.
6. The resolved payload (`AnalysisData` and `AnalysisMetadata`) is handed over to the `AnalysisDashboard` component for visual representation.
