# Frontend

React 18 + Vite client for the CVSU alumni document verification app.

Routes live in `src/App.jsx`. The API base URL is `VITE_API_URL` (`src/config.js`). Public document check is `/verify`.

```bash
cp .env.example .env
npm install --legacy-peer-deps
npm run dev
```

Dev server: http://localhost:5173. Set `VITE_API_URL` (for example `http://localhost:8000`, as in `.env.example`) to talk to the API.

## Preview mode

If `VITE_API_URL` and `VITE_API_ORIGIN` are both empty, or `VITE_PREVIEW_MODE=true`, the build runs in preview mode:

- There is no fallback API address. `src/preview.js` blocks every axios request and every fetch to an `/api` path before it leaves the browser.
- The login, register, and recovery pages show a banner: "UI preview. Login is turned off."
- Submitting those forms shows "Login is turned off in this preview. The code is on GitHub." instead of calling the server.

The public Vercel build is a preview build:

```bash
npm run build   # with no VITE_API_URL set
```

See the [repository README](../README.md) for Compose, Fabric, and the rest of the stack. `vercel.json` is the Vite SPA build config only.
