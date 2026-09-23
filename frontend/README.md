# Frontend

React 18 + Vite client for the CVSU alumni document verification app.

Routes live in `src/App.jsx`. The API base URL is `VITE_API_URL` (`src/config.js`). Public document check is `/verify`.

```bash
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```

Dev server: http://localhost:5173. The API is expected at http://localhost:8000 unless `VITE_API_URL` says otherwise.

See the [repository README](../README.md) for Compose, Fabric, and the rest of the stack. `vercel.json` is the Vite SPA build config only.
