# AGENTS.md

ShowNotion — a Notion-like wiki forked from Docmost v0.95. pnpm + Nx monorepo (Node 22+, pnpm 11.25 pinned via `packageManager`). Use pnpm only.

## Layout

- `apps/server` — NestJS 11 + Fastify API (`src/main.ts`), Kysely/Postgres, Socket.IO collaboration. Built-in MCP server lives in `src/integrations/mcp` (endpoint `/mcp`, disabled 404 unless `MCP_AUTH_TOKEN` is set).
- `apps/client` — React 19 + Vite + Mantine + Tiptap; `@` maps to `apps/client/src`.
- `packages/editor-ext` (Tiptap extensions), `packages/base-formula` (formula engine with separate client/server entrypoints).
- `apps/server/src/ee` is an uninitialized git submodule (docmost/ee); imports are guarded in `app.module.ts:38`, so do not create files there. `apps/client/src/ee` is normal tracked source.
- Root scripts wrap Nx: `pnpm dev` (both apps), `pnpm client:dev`, `pnpm server:dev`, `pnpm client:build`, `pnpm server:build`, `pnpm editor-ext:build`.

## Setup / dev loop

```bash
cp .env.example .env   # set APP_SECRET, POSTGRES_PASSWORD, DATABASE_URL, REDIS_URL
pnpm install
docker compose up -d db redis   # do NOT start the `shownotion` service — it conflicts with `pnpm dev` on :3000
pnpm --filter ./apps/server run migration:latest
pnpm dev   # client :5173, server :3000
```

- Server and Vite both read the repo-root `.env` (`envPath = ../../.env`); `.env` changes need a dev-server restart.
- Dev migrations are manual. After pulling new migrations run `migration:latest`, or API calls fail with 500s.

## Migrations & DB types (Kysely — server README's TypeORM commands are stale)

- Create: `pnpm --filter ./apps/server run migration:create <name>` → timestamped file in `src/database/migrations/`.
- `migration:up|down|latest|redo|reset` (`reset` = down to NO_MIGRATIONS).
- `migration:codegen` regenerates `src/database/types/db.d.ts` from the live DB; run it after schema changes — the file is committed.

## Tests, lint, typecheck

- Server (Jest): `pnpm --filter ./apps/server test`; one spec: `pnpm --filter ./apps/server test -- src/core/page/page.controller.spec.ts`
- Client (Vitest): `pnpm --filter ./apps/client test`; one test: `pnpm --filter ./apps/client test -- src/components/ui/document-title.test.tsx`
- Lint: `pnpm --filter ./apps/client lint` (plain), `pnpm --filter ./apps/server lint` (`eslint --fix`).
- No `typecheck` script: `pnpm client:build` runs `tsc` + vite build; `pnpm server:build` is `nest build`.

## Conventions

- i18n source is `apps/client/public/locales/en-US/translation.json` (Crowdin source); edit only en-US, other locales are synced.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (3-day quarantine): installing a version published less than 3 days ago fails unless listed in `minimumReleaseAgeExclude`. Dependency patches live in `patches/`.

## Docker / deploy

- Build images only via `scripts/docker-build.sh <image:tag> [--deploy]` (or the `/deploy` command). Plain `docker build` packs EsafeNet-encrypted file contents into the image and in-container `tsc` fails with TS1127; the script mirrors a plaintext context first, and refuses to build when a ciphertext file has uncommitted changes.
- Prod runs from `docker-compose.prod.yml` (`shownotion` container, host port 3872, `.env.prod`). `/deploy` bumps only the patch tag; verify with `curl -s -o /dev/null -w '%{http_code}' http://localhost:3872/`.
