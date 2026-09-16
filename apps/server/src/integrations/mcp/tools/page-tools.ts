import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate as isValidUUID } from 'uuid';
import {
  McpToolContext,
  McpToolServices,
  paginationShape,
  runTool,
  toPaginationOptions,
  trimPage,
} from './shared';
import {
  jsonToMarkdown,
} from '../../../collaboration/collaboration.util';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../../core/casl/interfaces/space-ability.type';
import {
  extractPageSlugId,
} from '../../../integrations/export/utils';

// searchPage actually returns richer fields than SearchResponseDto declares (the SQL additionally selects slugId/spaceId)
interface SearchItem {
  id: string;
  slugId: string;
  title: string;
  icon: string;
  parentPageId: string | null;
  spaceId?: string;
  space?: { id: string };
  updatedAt: Date;
  highlight: string;
}

// Normalize a page identifier into a findById-compatible form (UUID or slugId)
// Accepted inputs: full URL (http://host/docs/space/page-slug), path, pageSlug,
// bare slugId, or UUID
export function normalizePageId(input: string): string {
  const trimmed = input.trim();
  if (isValidUUID(trimmed)) {
    return trimmed;
  }
  // Strip query/hash, take the last path segment, then extract the slugId from the
  // pageSlug (the slugId charset contains no '-', so parsing is unambiguous)
  const lastSegment =
    trimmed.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? trimmed;
  return extractPageSlugId(lastSegment);
}

// Register the 9 page-related MCP tools (search, list, read, create, update, move, delete)
export function registerPageTools(
  server: McpServer,
  ctx: McpToolContext,
  services: McpToolServices,
): void {
  const { user, workspace } = ctx;
  const {
    pageService,
    searchService,
    spaceMemberService,
    pageAccessService,
    spaceAbility,
  } = services;

  // Read a page by ID/slug/URL and convert it to Markdown (shared by get_page and get_page_by_url)
  const fetchPageMarkdown = async (pageIdInput: string) => {
    const page = await pageService.findById(normalizePageId(pageIdInput), true);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await pageAccessService.validateCanView(page, user);

    return {
      ...trimPage(page),
      createdAt: page.createdAt,
      content: page.content ? jsonToMarkdown(page.content) : '',
    };
  };

  // Full-text search pages visible to the current user
  server.registerTool(
    'search',
    {
      description:
        'Full-text search across pages the user can access in the workspace',
      inputSchema: {
        query: z.string().describe('Search query text'),
        spaceId: z
          .string()
          .optional()
          .describe('Optional space ID to scope the search'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Maximum number of results (1-100, default 25)'),
      },
    },
    async ({ query, spaceId, limit }) =>
      runTool(async () => {
        const { items } = (await searchService.searchPage(
          { query, spaceId, limit: limit ?? 25 },
          { userId: user.id, workspaceId: workspace.id },
        )) as unknown as { items: SearchItem[] };
        return {
          items: items.map((item) => ({
            id: item.id,
            slugId: item.slugId,
            title: item.title,
            icon: item.icon,
            spaceId: item.space?.id ?? item.spaceId,
            parentPageId: item.parentPageId,
            updatedAt: item.updatedAt,
            highlight: item.highlight,
          })),
        };
      }),
  );

  // List spaces accessible to the user
  server.registerTool(
    'list_spaces',
    {
      description: 'List the spaces the user has access to',
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const { items } = await spaceMemberService.getUserSpaces(
          user.id,
          toPaginationOptions(100),
        );
        return {
          items: items.map((space) => ({
            id: space.id,
            name: space.name,
            slug: space.slug,
            description: space.description,
          })),
        };
      }),
  );

  // List recently updated pages, optionally filtered by space
  server.registerTool(
    'list_pages',
    {
      description:
        'List recently updated pages, optionally scoped to a space. Use list_spaces to find space IDs',
      inputSchema: {
        spaceId: z
          .string()
          .optional()
          .describe('Optional space ID to list pages from'),
        ...paginationShape,
      },
    },
    async ({ spaceId, limit, cursor }) =>
      runTool(async () => {
        const pagination = toPaginationOptions(limit, cursor);
        const result = spaceId
          ? await (async () => {
              const ability = await spaceAbility.createForUser(user, spaceId);
              if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
                throw new ForbiddenException();
              }
              return pageService.getRecentSpacePages(
                spaceId,
                user.id,
                pagination,
              );
            })()
          : await pageService.getRecentPages(user.id, pagination);

        return {
          items: result.items.map(trimPage),
          meta: {
            hasNextPage: result.meta.hasNextPage,
            nextCursor: result.meta.nextCursor,
          },
        };
      }),
  );

  // Read a single page with its content converted to Markdown
  server.registerTool(
    'get_page',
    {
      description:
        'Get a page with its content converted to Markdown. Accepts a page ID, slug ID, page slug, path, or full ShowNotion URL',
      inputSchema: {
        pageId: z
          .string()
          .describe(
            'Page ID, slug ID, page slug, path, or full ShowNotion page URL',
          ),
      },
    },
    async ({ pageId }) => runTool(() => fetchPageMarkdown(pageId)),
  );

  // Read a page by URL (hidden for now: get_page already accepts URLs;
  // uncomment to restore when needed)
  // server.registerTool(
  //   'get_page_by_url',
  //   {
  //     description:
  //       'Get a page by its ShowNotion URL, with content converted to Markdown. The slugId is extracted automatically from URLs like http://host/docs/{spaceSlug}/{pageSlug}',
  //     inputSchema: {
  //       url: z
  //         .string()
  //         .describe('Full page URL, path, page slug, or slug ID'),
  //     },
  //   },
  //   async ({ url }) => runTool(() => fetchPageMarkdown(url)),
  // );

  // Create a page with Markdown content, optionally nested under a parent page
  server.registerTool(
    'create_page',
    {
      description:
        'Create a new page in a space with Markdown content, optionally nested under a parent page',
      inputSchema: {
        spaceId: z.string().describe('Space ID (UUID) to create the page in'),
        title: z.string().describe('Page title'),
        markdown: z
          .string()
          .optional()
          .describe('Page body as Markdown'),
        parentPageId: z
          .string()
          .optional()
          .describe(
            'Optional parent page (ID, slug, or full URL) to nest the new page under',
          ),
      },
    },
    async ({ spaceId, title, markdown, parentPageId }) =>
      runTool(async () => {
        const normalizedParentId = parentPageId
          ? normalizePageId(parentPageId)
          : undefined;
        if (normalizedParentId) {
          // With a parent page, require the parent to be editable (consistent with the REST endpoint)
          const parentPage = await pageService.findById(normalizedParentId);
          if (!parentPage || parentPage.deletedAt) {
            throw new NotFoundException('Parent page not found');
          }
          await pageAccessService.validateCanEdit(parentPage, user);
        } else {
          // Root-level creation requires space-level create permission
          const ability = await spaceAbility.createForUser(user, spaceId);
          if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
            throw new ForbiddenException();
          }
        }

        const page = await pageService.create(user.id, workspace.id, {
          spaceId,
          title,
          content: markdown,
          format: markdown !== undefined ? 'markdown' : undefined,
          parentPageId: normalizedParentId,
        });

        return trimPage(page);
      }),
  );

  // Update a page's title and/or body, preserving the original page ID and history
  server.registerTool(
    'update_page',
    {
      description:
        "Update an existing page's title and/or replace its body with Markdown. Omitted fields stay unchanged",
      inputSchema: {
        pageId: z
          .string()
          .describe(
            'Page ID, slug ID, page slug, or full ShowNotion page URL',
          ),
        title: z.string().optional().describe('New page title'),
        markdown: z
          .string()
          .optional()
          .describe('New page body as Markdown (replaces existing content)'),
      },
    },
    async ({ pageId, title, markdown }) =>
      runTool(async () => {
        const page = await pageService.findById(normalizePageId(pageId));
        if (!page || page.deletedAt) {
          throw new NotFoundException('Page not found');
        }

        await pageAccessService.validateCanEdit(page, user);

        const updatedPage = await pageService.update(
          page,
          {
            pageId: page.id,
            title,
            content: markdown,
            operation: markdown !== undefined ? 'replace' : undefined,
            format: markdown !== undefined ? 'markdown' : undefined,
          },
          user,
        );

        return {
          ...trimPage(updatedPage),
          content: updatedPage.content
            ? jsonToMarkdown(updatedPage.content)
            : '',
        };
      }),
  );

  // Move a page under a new parent page or to the space root
  server.registerTool(
    'move_page',
    {
      description:
        'Move a page under a new parent page, or to the space root when parentPageId is null',
      inputSchema: {
        pageId: z
          .string()
          .describe('Page to move: ID, slug, or full ShowNotion page URL'),
        parentPageId: z
          .string()
          .nullish()
          .describe(
            'Target parent page (ID, slug, or URL); pass null to move the page to the space root',
          ),
        position: z
          .string()
          .optional()
          .describe(
            'Optional fractional ordering key; appended to the end of the target when omitted',
          ),
      },
    },
    async ({ pageId, parentPageId, position }) =>
      runTool(async () => {
        const movedPage = await pageService.findById(normalizePageId(pageId));
        if (!movedPage || movedPage.deletedAt) {
          throw new NotFoundException('Page not found');
        }

        const ability = await spaceAbility.createForUser(
          user,
          movedPage.spaceId,
        );
        if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
          throw new ForbiddenException();
        }

        await pageAccessService.validateCanEdit(movedPage, user);

        // After normalization the id may still be a slugId; resolve it to the page
        // record to get the real UUID
        const normalizedParentId = parentPageId
          ? normalizePageId(parentPageId)
          : null;
        const targetParent = normalizedParentId
          ? await pageService.findById(normalizedParentId)
          : undefined;
        if (normalizedParentId && (!targetParent || targetParent.deletedAt)) {
          throw new NotFoundException('Target parent page not found');
        }

        // Only validate permission when the target parent changes (consistent with the REST endpoint)
        if (targetParent && targetParent.id !== movedPage.parentPageId) {
          await pageAccessService.validateCanEdit(targetParent, user);
        }

        // Without an explicit position, append to the end of the target level
        const nextPosition =
          position ??
          (await pageService.nextPagePosition(
            movedPage.spaceId,
            targetParent?.id,
          ));

        await pageService.movePage(
          {
            pageId: movedPage.id,
            parentPageId: targetParent?.id ?? null,
            position: nextPosition,
          },
          movedPage,
        );

        return { id: movedPage.id, parentPageId: targetParent?.id ?? null };
      }),
  );

  // Delete a single page (soft delete into trash)
  server.registerTool(
    'delete_page',
    {
      description:
        'Move a page to trash (soft delete). Requires edit permission on the page',
      inputSchema: {
        pageId: z
          .string()
          .describe('Page to delete: ID, slug, or full ShowNotion page URL'),
      },
    },
    async ({ pageId }) =>
      runTool(async () => {
        const page = await pageService.findById(normalizePageId(pageId));
        if (!page) {
          throw new NotFoundException('Page not found');
        }

        await pageAccessService.validateCanEdit(page, user);

        await pageService.removePage(page.id, user.id, workspace.id);
        return { id: page.id, deleted: true };
      }),
  );

  // Delete multiple pages, returning per-page success or failure reasons
  server.registerTool(
    'delete_pages',
    {
      description:
        'Move multiple pages to trash. Returns per-page success or error details',
      inputSchema: {
        pageIds: z
          .array(z.string())
          .describe('Pages to delete: IDs, slugs, or full URLs'),
      },
    },
    async ({ pageIds }) =>
      runTool(async () => ({
        results: await Promise.all(
          pageIds.map(async (pageId) => {
            try {
              const page = await pageService.findById(normalizePageId(pageId));
              if (!page) {
                throw new NotFoundException('Page not found');
              }
              await pageAccessService.validateCanEdit(page, user);
              await pageService.removePage(page.id, user.id, workspace.id);
              return { pageId, success: true };
            } catch (err) {
              const e = err as { response?: unknown; message?: string };
              const raw = e?.response ?? e?.message ?? 'Unknown error';
              return {
                pageId,
                success: false,
                error:
                  typeof raw === 'string' ? raw : JSON.stringify(raw),
              };
            }
          }),
        ),
      })),
  );
}
