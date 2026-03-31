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
```

### Vercel setup

1. Create a new Vercel project from the frontend repo.
2. Set the root directory to the repo root if the frontend is split out, or to `frontend` if you keep the monorepo.
3. Add all environment variables from the production example file.
4. Set the production domain:
   `turm.in` and optionally `www.turm.in`
5. Deploy.

### Vercel 404 troubleshooting

If Vercel shows this plain platform error:

```text
404: NOT_FOUND
Code: NOT_FOUND
```

that usually means Vercel is not serving this Next.js app at all, even though the app has a real `/` route in `src/app/page.tsx`.

Check these first:

1. The deployed project root is correct.
   For a split frontend repo, the repo root should contain `package.json`, `src/`, `public/`, and `vercel.json`.
2. If you deployed the monorepo, `Root Directory` must be `frontend`.
3. The custom domain is attached to the correct project and latest production deployment.
4. The framework preset is `Next.js`.
5. The build logs show generated routes including `/`.

Do not manually add `NODE_ENV=production` in Vercel project environment variables.
Vercel already sets the correct mode, and forcing it during install can skip devDependencies
like `typescript`, `@types/react`, and `@types/node`.

### Important notes

- `NEXT_PUBLIC_API_BASE_URL` is used by the browser.
- `API_SERVER_URL` is used by server components and server-side auth checks.
- Both should normally point to the same public backend URL.
