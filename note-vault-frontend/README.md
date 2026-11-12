# NoteVault frontend

## Run locally

```sh
npm install
npm run dev
```

Open <http://localhost:5173>. The local API defaults to `http://localhost:5000/api`. Set `VITE_API_BASE_URL` in `.env.local` to override it (include `/api`, with no trailing slash).

## Deploy to Vercel

Import the frontend and use Framework Preset **Vite**, build command `npm run build`, and output directory `dist`. Set `VITE_API_BASE_URL` to `https://<backend>.vercel.app/api`.

Then set the frontend production URL in the backend's `FRONTEND_URL` environment variable (no trailing slash; local development also needs `http://localhost:5173` in its comma-separated list) and redeploy the backend.
