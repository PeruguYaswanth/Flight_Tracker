# AeroTrack — Production Flight Tracker Web Application

A lightweight, secure, and professional Flight Tracker web application built with **React (TypeScript, Vite, Tailwind CSS, Leaflet)** and a dedicated **Node.js/Express (TypeScript)** backend.

---

## 1. Project Overview & Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│   React (Vite) + TypeScript + Tailwind CSS + Lucide Icons   │
│   + Leaflet (Lightweight OSM Maps & Aircraft Heading Icons) │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST (/api/flights)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Node.js / Express                       │
│   TypeScript + CORS + Helmet + Axios + Rate Limiting        │
├─────────────────────────────────────────────────────────────┤
│ • FlightController: Request validation & error routing      │
│ • FlightService: Provider abstraction & cache-control       │
│ • FlightNormalizer: Unified internal schema mapping         │
│ • External Flight Provider Adapter (AviationStack / etc.)   │
│   + Mock fallback for offline & immediate testing           │
└──────────────────────────────┬──────────────────────────────┘
                               │ Authenticated API Requests
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          External Flight Data Provider (e.g. API)           │
│   [Secured with FLIGHT_API_KEY in backend environment]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technologies Used

- **Frontend**:
  - React 18 & TypeScript
  - Vite (Fast bundler & HMR)
  - Tailwind CSS (Dark theme radar UI)
  - Leaflet (Lightweight interactive map tiles & rotated SVG heading markers)
  - Lucide React (Icons)
- **Backend**:
  - Node.js & Express (TypeScript)
  - Axios (HTTP client with timeout handling)
  - Helmet & CORS (Security headers)
  - express-rate-limit (API abuse protection)
  - dotenv (Environment variable management)

---

## 3. API Key Security & Isolation

- **Zero Client Exposure**: The `FLIGHT_API_KEY` is loaded strictly on the backend server from environment variables.
- **No Bundle Leakage**: The key is never returned to the frontend or bundled into JavaScript assets.
- **Robust Normalization**: The backend normalizes raw third-party responses into an internal domain schema (`Flight`, `AirportInfo`, `LivePosition`, `FlightStatus`), isolating frontend code from upstream provider API changes.

---

## 4. Environment Variables

### Backend (`server/.env`):
```env
PORT=5000
NODE_ENV=production
CORS_ORIGIN=*
FLIGHT_API_KEY=your_secret_api_key_here
FLIGHT_API_BASE_URL=https://api.aviationstack.com/v1
REQUEST_TIMEOUT_MS=10000
```

### Frontend (`client/.env`):
```env
# URL to your deployed backend (or /api when using reverse proxy)
VITE_API_BASE_URL=/api
```

---

## 5. Local Setup Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation
```bash
# 1. Install server dependencies
cd server
npm install

# 2. Install client dependencies
cd ../client
npm install
```

### Running Locally in Development Mode

**Start Backend Server:**
```bash
cd server
npm run dev
# Server runs on http://localhost:5000
```

**Start Frontend Client:**
```bash
cd client
npm run dev
# Frontend runs on http://localhost:3000 (proxies /api to localhost:5000)
```

---

## 6. Production Build & Deployment

### Build Commands:
```bash
# Build Server
cd server
npm run build

# Build Client
cd client
npm run build
```

### Deployment on Render (Backend)
1. Push your repository to GitHub / GitLab.
2. In Render, create a new **Web Service** using `render.yaml` or manual setup:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `PORT`: `5000`
     - `FLIGHT_API_KEY`: `your_live_api_key`
     - `FLIGHT_API_BASE_URL`: `https://api.aviationstack.com/v1`

### Deployment on Vercel (Frontend)
1. In Vercel, import the repository and set **Root Directory** to `client`.
2. Set Build Command: `npm run build` and Output Directory: `dist`.
3. Set Environment Variable:
   - `VITE_API_BASE_URL`: `https://<your-render-backend-url>/api`

---

## 7. Supported Capabilities & Edge Case Handling

| Requirement | Implementation Status | Note / Fallback Behavior |
|-------------|----------------------|--------------------------|
| Search by Flight Number | Supported | E.g. `AI101`, `6E502`, `BA249`, `AA100` |
| Search by Airline | Supported | Matches airline name or IATA code |
| Search by Route | Supported | E.g. `HYD → DEL`, `BOM → BLR`, `LHR → JFK` |
| Search by Date | Supported | Filters flights by date |
| Map Visualization | Supported | Interactive Leaflet map with OpenStreetMap tiles |
| Aircraft Heading Rotation | Supported | Marker rotates matching `heading` (0-360°) |
| Airport Pins & Route Line | Supported | Origin & Destination pins + geodesic route line |
| Recenter on Aircraft | Supported | Recenter control centers camera on live coordinates |
| Live Position Unavailable | Handled | Displays *"Live tracking data is currently unavailable for this flight."* |
| Rate Limit (429) | Handled | Displays *"Flight-data service request limit reached. Please try again later."* |
| Provider Timeout | Handled | Displays *"The flight-data service is taking too long to respond. Please try again."* |
| No Results Found | Handled | Displays *"No matching flight found. Please check the flight number, airline, or date."* |
