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

## Quick setup with AI

Paste the following prompt into your AI coding agent (OpenCode, Claude Code, Codex, ...) to
have it set up and run the project automatically:

```text
Set up and run the ShowNotion project from scratch in this repository:

1. Copy .env.example to .env, then set APP_SECRET (long random string),
   POSTGRES_PASSWORD (strong password), and DATABASE_URL
   (postgresql://shownotion:<password>@localhost:5432/shownotion — must reuse
   the same password) and REDIS_URL (redis://127.0.0.1:6379).
2. Start only the infrastructure: docker compose up -d db redis.
   NEVER start the `shownotion` service — it conflicts with the dev server on port 3000.
3. Install dependencies with pnpm (Node.js 22+, enable once via `corepack enable`).
4. Run database migrations (required in dev):
   pnpm --filter ./apps/server run migration:latest
5. Start the dev servers with `pnpm dev` — frontend at http://localhost:5173,
   backend at http://localhost:3000.
6. Verify: both apps start without errors, then open http://localhost:3000 —
   a fresh database shows the setup wizard to create the workspace and admin account.

Do not modify any source code; only environment/config steps above.
If any step fails, diagnose and fix the environment issue before continuing.
```

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
| `POSTGRES_PASSWORD` | a strong password — the `db` container reads it from `.env` |
| `DATABASE_URL` | `postgresql://shownotion:<your-password>@localhost:5432/shownotion` |
| `REDIS_URL` | `redis://127.0.0.1:6379` |

Set `POSTGRES_PASSWORD` in `.env` — the `db` container reads it, and `DATABASE_URL` must use the same password.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start infrastructure services

```bash
docker compose up -d db redis
```

> Only start `db` and `redis` — the `shownotion` container is not needed for local development
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
(Claude Code, Codex, OpenCode, ...) to search, read, and write wiki pages
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

Claude Desktop (`mcpServers` in the MCP config):

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

Codex (MCP servers in `~/.codex/config.toml`):

```toml
[mcp_servers.shownotion]
url = "http://localhost:3000/mcp"
bearer_token_env_var = "SHOWNOTION_MCP_TOKEN"
```

The token is read from the `SHOWNOTION_MCP_TOKEN` environment variable (Codex's recommended
way of providing a static Bearer token). Alternatively, pass it inline with
`http_headers = { "Authorization" = "Bearer <your-token>" }`.

OpenCode (`mcp` section in `~/.config/opencode/opencode.json`):

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
