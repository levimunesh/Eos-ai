# EOS AI frontend

React + TypeScript + Vite, Tailwind CSS, TanStack Query, React Hook Form + Zod, Supabase Auth.

Run it:

    cp .env.example .env      # then fill in the Supabase values
    npm install
    npm run dev               # http://localhost:5173 (the backend's default CORS origin)

Other commands: `npm run build`, `npm run lint`, `npm test` (watch) or `npm test -- --run` (once).

Environment variables (Vite reads them at build time; never commit real values):

- `VITE_SUPABASE_URL` - Supabase project URL. Required.
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable (anon) key. Required. Never a service-role key.
- `VITE_API_URL` - backend base URL, default `http://localhost:8000/api/v1`.

If either Supabase variable is missing the app shows a configuration screen instead of starting.

In Supabase Auth settings, add `http://localhost:5173/reset-password` (and your deployed origin's
equivalent) to the allowed redirect URLs so password-reset links land on the app.

Notes: all user-facing text is in `src/lib/strings.ts` (use `t('key')`), and layout uses logical
properties (`ms-`, `pe-`, `start-`, `end-`) so Arabic/RTL can be added without rewrites.
