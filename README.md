# DualTranslate

Real-time dual-language speech translation app powered by Eburon alias routes.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create local env file:
   ```bash
   cp .env.example .env.local
   ```
3. Set your Eburon API base in `.env.local`:
   ```bash
   VITE_EBURON_API_BASE=https://api.eburon.ai
   VITE_EBURON_LIVE_WS_URL=wss://api.eburon.ai/live
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```

## Vercel Deployment

1. Import this repo in Vercel.
2. In Vercel Project Settings -> Environment Variables, add:
   - `VITE_EBURON_API_BASE` (for example `https://api.eburon.ai`)
   - `VITE_EBURON_LIVE_WS_URL` (for example `wss://api.eburon.ai/live`)
3. Keep build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy.

The repo includes `vercel.json` with SPA rewrites so all routes resolve to `index.html`.

## Alias-First Rules

- User-facing model naming is Eburon-only (`orbit`, `codemax`, `echo`, `vision`).
- Client payloads use only alias metadata (`alias_id`, `alias_name`, `alias_version`).
- Provider/model resolution is private to backend routes under `api/eburon`.
- User-visible errors are alias-native and vendor-neutral.
- Telemetry is alias-native and redacted before write.

## Admin Staff IDs

- Open `/admin` to access the admin console.
- Sign in using `SI0000` (super admin) to create staff IDs.
- New users sign in with created IDs (format `SI0001`).
- Translation history is isolated per user ID in local storage, and conversation logs remain user-scoped in the database.
