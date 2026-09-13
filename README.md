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

<div align="center">
    <img src="./design/assets/showcase.png" alt="ShowNotion — a Notion-like collaborative wiki and documentation software" width="100%" />
    <br />
    <img src="./design/assets/showcase-dark.png" alt="ShowNotion — a Notion-like collaborative wiki and documentation software" width="100%" />
</div>

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

## MCP server

ShowNotion ships with a built-in MCP (Model Context Protocol) server, allowing AI clients
(Claude Desktop, Claude Code, Cursor, opencode, ...) to search, read, and write wiki pages
directly. The endpoint is `http://localhost:3000/mcp` (Streamable HTTP). When no auth token
is configured, the endpoint is disabled entirely (404).

### Configuration

Set the following variables in `.env` (see `.env.example`):

| Variable | Description |
| --- | --- |
| `MCP_AUTH_TOKEN` | Static Bearer token for MCP clients. Generate one with `openssl rand -hex 32`. Leave empty to disable the MCP endpoint |
| `MCP_USER_EMAIL` | Email of the workspace user the tools act as. Its permissions define what the MCP tools can read and write |

Restart the dev server after changing these variables (`.env` changes are not hot-reloaded).

### Client setup

Claude Code:

```bash
claude mcp add shownotion --transport http http://localhost:3000/mcp \
  --header "Authorization: Bearer <your-token>"
```

Claude Desktop / Cursor (`mcpServers` in the MCP config):

```json
{
  "mcpServers": {
    "shownotion": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
```

opencode (`mcp` section in `~/.config/opencode/opencode.json`):

```json
{
  "mcp": {
    "shownotion": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": true,
      "headers": { "Authorization": "Bearer <your-token>" }
    }
  }
}
```

### Available tools

| Tool | Description |
| --- | --- |
| `search` | Full-text search across pages the user can access |
| `list_spaces` | List the spaces the user has access to |
| `list_pages` | List recently updated pages, optionally scoped to a space |
| `get_page` | Get a page (content converted to Markdown) |
| `create_page` | Create a page with Markdown content, optionally under a parent page |
| `update_page` | Update a page's title and/or replace its body with Markdown |
| `move_page` | Move a page under a new parent, or to the space root |
| `delete_page` | Move a page to trash (soft delete) |
| `delete_pages` | Move multiple pages to trash |
| `get_workspace` | Get the workspace name and basic info |
| `list_groups` | List user groups in the workspace |

All page tools accept a page ID, slug ID, page slug, path, or a full page URL
(e.g. `http://localhost:3000/docs/{spaceSlug}/{pageSlug}`) — the slug ID is extracted
automatically.

## License

Docmost core is licensed under the open-source AGPL 3.0 license. Enterprise features
(`apps/server/src/ee`, `apps/client/src/ee`, `packages/ee`) are licensed under the Docmost
Enterprise license defined in `packages/ee/License`.

This fork keeps the AGPL 3.0 license and upstream copyright notices intact.

## Contributing

See the upstream [development documentation](https://docmost.com/docs/self-hosting/development)
