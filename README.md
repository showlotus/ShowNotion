<div align="center">
    <h1><b>ShowNotion</b></h1>
    <p>
        Open-source collaborative wiki and documentation software.
        <br />
        Forked from <a href="https://github.com/docmost/docmost"><strong>Docmost</strong></a> (v0.95.0),
        evolving toward a Notion-like experience.
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
| `MCP_UPLOAD_INBOX` | Server-side staging directory the `upload_attachment` tool reads files from (default `/tmp/shownotion-mcp-inbox`) |
| `MCP_UPLOAD_INBOX_HOST` | Host-side shared directory (bind-mounted to `MCP_UPLOAD_INBOX`), used only for delivery hints in the tool description, e.g. `~/shownotion/inbox` |

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
| `upload_attachment` | Upload a file (e.g. an image) from the server inbox to a page as an attachment, returning a URL for embedding in Markdown |

All page tools accept a page ID, slug ID, page slug, path, or a full page URL
(e.g. `http://localhost:3000/docs/{spaceSlug}/{pageSlug}`) — the slug ID is extracted
automatically. `upload_attachment` accepts the same formats for its `pageId` argument.

To use `upload_attachment`, deliver the file to the inbox first: copy it into the shared
host directory (`MCP_UPLOAD_INBOX_HOST`), or `docker cp <local-file> <container>:<MCP_UPLOAD_INBOX>/`.
Then call the tool with a `filePath` relative to the inbox; the staged file is consumed
(deleted) on success. Use the returned file URL to embed the attachment in Markdown —
never inline base64 content.

## License

This repository contains code under two licenses:

- Code derived from Docmost is licensed under the AGPL 3.0 license (see [LICENSE](LICENSE)).
- Original code of this fork is licensed under the MIT License (see [LICENSE-MIT](LICENSE-MIT)).

Enterprise features (`apps/server/src/ee`, `apps/client/src/ee`, `packages/ee`)
are licensed under the Docmost Enterprise license defined in `packages/ee/LICENSE`.

Upstream Docmost copyright notices and the AGPL 3.0 terms for Docmost-derived
code are retained.

## Contributing

See the upstream [development documentation](https://docmost.com/docs/self-hosting/development)
