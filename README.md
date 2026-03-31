## 6. Frontend on Vercel

The frontend is ready for Vercel as a standard Next.js deployment.

Important files:

- `frontend/package.json`
- `frontend/next.config.ts`
- `frontend/.env.production.example`

### Required frontend variables

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://api.turm.in/api/v1
API_SERVER_URL=https://api.turm.in/api/v1

NEXT_PUBLIC_SITE_URL=https://turm.in
SITE_URL=https://turm.in

NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN=pk...
NODE_ENV=production
```

### Vercel setup

1. Create a new Vercel project from the frontend repo.
2. Set the root directory to the repo root if the frontend is split out, or to `frontend` if you keep the monorepo.
3. Add all environment variables from the production example file.
4. Set the production domain:
   `turm.in` and optionally `www.turm.in`
5. Deploy.

### Important notes

- `NEXT_PUBLIC_API_BASE_URL` is used by the browser.
- `API_SERVER_URL` is used by server components and server-side auth checks.
- Both should normally point to the same public backend URL.
