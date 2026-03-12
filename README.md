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

Deployments are triggered from your machine with Wrangler. Git pushes do not auto-deploy.
Cloudflare Workers Builds / Git auto-deploy is intentionally disabled for this project, so pull requests should rely on the GitHub `PR Checks` workflow for repository validation.

```bash
pnpm cf:prepare-local-config
# run this when runtime secrets change
pnpm cf:secret:sync
pnpm cf:deploy
```

`pnpm cf:deploy` builds the app locally, regenerates an ignored local Wrangler config at `.wrangler/wrangler.local.jsonc`, runs the free-plan preflight check, and deploys with that local config.

Build-time values still come from `.env`, including:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `TMDB_BEARER_TOKEN` or `TMDB_API_KEY`

The generated local Wrangler config includes only non-secret worker vars. The tracked `wrangler.jsonc` stays clean, and `.wrangler/` stays ignored by Git.

Regenerate the local config directly if you want to inspect it before deploying:

```bash
pnpm cf:prepare-local-config
```

### Runtime variables and secrets

Keep the Worker runtime configuration populated as well. The current runtime secret sync script manages:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `TRAKT_CLIENT_ID`
- `TMDB_BEARER_TOKEN` or `TMDB_API_KEY`

Run this after changing any of those secrets in `.env`:

```bash
pnpm cf:secret:sync
```

Non-secret runtime vars such as `NEXTJS_ENV`, the Firebase public web config, and optional public flags are generated into `.wrangler/wrangler.local.jsonc` from `.env`.

For local Cloudflare preview, copy `.dev.vars.example` to `.dev.vars` or run:

```bash
pnpm cf:prepare-dev-vars
pnpm cf:preview
```

The Firebase web config is still public client config in the shipped app. Keeping it out of Git avoids accidental commits, but it does not make those values secret.
