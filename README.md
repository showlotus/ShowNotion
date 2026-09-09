<div align="center">
    <h1><b>ShowNotion</b></h1>
    <p>
        Open-source collaborative wiki and documentation software.
        <br />
        Forked from <a href="https://github.com/docmost/docmost"><strong>Docmost</strong></a> (v0.95.0),
        evolving toward a Notion-like experience.
        <br />
        <a href="https://github.com/showlotus/ShowDoc"><strong>Repository</strong></a> |
        <a href="https://docmost.com/docs"><strong>Upstream Documentation</strong></a>
    </p>
</div>
<br />

## Local development (from scratch)

### Prerequisites

- Node.js 22+
- pnpm (enable once with `corepack enable`, version is pinned in `package.json`)
- Docker Desktop running

### 1. Configure environment variables

```bash
cp .env.example .env
```

Key values to set:

| Variable | Example value |
| --- | --- |
| `APP_SECRET` | a long random string |
| `DATABASE_URL` | `postgresql://docmost:STRONG_DB_PASSWORD@localhost:5432/docmost` |
| `REDIS_URL` | `redis://127.0.0.1:6379` |

The DB password in `DATABASE_URL` must match `POSTGRES_PASSWORD` in `docker-compose.yml`.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start infrastructure services

```bash
docker compose up -d db redis
```

> Only start `db` and `redis` — the `docmost` container is not needed for local development
> and would conflict with `pnpm dev` on port `3000`.

### 4. Run database migrations (required)

```bash
pnpm --filter ./apps/server run migration:latest
```

> Migrations run automatically only in production. In dev you must run them manually after
> pulling code with new migrations, otherwise API calls will fail with 500 errors.

### 5. Start the dev servers

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### 6. First-run initialization

With a fresh database, opening http://localhost:3000 shows the setup wizard — create the
workspace and the admin account there.

### One-liner

```bash
docker compose up -d db redis && pnpm install && pnpm --filter ./apps/server run migration:latest && pnpm dev
```

## License

Docmost core is licensed under the open-source AGPL 3.0 license. Enterprise features
(`apps/server/src/ee`, `apps/client/src/ee`, `packages/ee`) are licensed under the Docmost
Enterprise license defined in `packages/ee/License`.

This fork keeps the AGPL 3.0 license and upstream copyright notices intact.

## Contributing

See the upstream [development documentation](https://docmost.com/docs/self-hosting/development)
