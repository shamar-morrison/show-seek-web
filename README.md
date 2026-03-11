# ShowSeek Web

ShowSeek is a Next.js app deployed to Cloudflare Workers with OpenNext.

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local checks

```bash
pnpm run typecheck
pnpm test -- --watchman=false
pnpm run build
pnpm run cf:build
```

`pnpm run build` now validates the required build-time environment before running `next build`.

## Cloudflare deployment

This repo is set up for Cloudflare Workers, not the default Vercel flow.

### Local CLI deploy

```bash
pnpm cf:build
pnpm cf:preflight
pnpm cf:deploy
```

### Git-connected Cloudflare deploy

Configure the Cloudflare Worker with:

- Worker name: `show-seek-web`
- Build command: `pnpm cf:build`
- Deploy command: `pnpm exec wrangler deploy --config wrangler.jsonc`

Build variables and secrets are synced from `.env` through the Cloudflare Workers Builds API, so they do not need to be re-entered manually in the dashboard:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

TMDB stays out of git and is synced as a build secret through the Cloudflare Workers Builds API:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_BUILD_TRIGGER_ID=...
pnpm cf:build-env:sync
```

Use this to preview the payload without sending it:

```bash
pnpm cf:build-env:sync:dry
```

The build sync script will:

- upsert the six `NEXT_PUBLIC_FIREBASE_*` keys as non-secret build variables
- upsert `TMDB_BEARER_TOKEN`, or fall back to `TMDB_API_KEY`
- delete the alternate TMDB key if it exists, so stale build secrets do not override the current choice

The Firebase web config is required during `next build`, and TMDB credentials are required because prerendered pages fetch TMDB data at build time.

### Runtime variables and secrets

Keep the Worker runtime configuration populated as well. At minimum, this repo expects runtime values such as:

- `NEXTJS_ENV`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `TRAKT_CLIENT_ID`
- `TRAKT_REDIRECT_URI`
- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`

For local Cloudflare preview, copy `.dev.vars.example` to `.dev.vars` or run:

```bash
pnpm cf:prepare-dev-vars
pnpm cf:preview
```

## Secret sync note

`pnpm cf:secret:sync` still syncs runtime Worker secrets from `.env`.

`pnpm cf:build-env:sync` is separate and only manages Git build secrets for Workers Builds.
