import { z } from 'zod';
import { Page } from '@docmost/db/types/entity.types';
import {
  GroupService,
} from '../../../core/group/services/group.service';
import { PageService } from '../../../core/page/services/page.service';
import { SearchService } from '../../../core/search/search.service';
import {
  SpaceMemberService,
} from '../../../core/space/services/space-member.service';
import {
  WorkspaceService,
} from '../../../core/workspace/services/workspace.service';
import {
  PageAccessService,
} from '../../../core/page/page-access/page-access.service';
import {
  AttachmentService,
} from '../../../core/attachment/services/attachment.service';
import {
  EnvironmentService,
} from '../../../integrations/environment/environment.service';
import {
  DomainService,
} from '../../../integrations/environment/domain.service';
import {
  IAuditService,
} from '../../../integrations/audit/audit.service';
import SpaceAbilityFactory from '../../../core/casl/abilities/space-ability.factory';
import WorkspaceAbilityFactory from '../../../core/casl/abilities/workspace-ability.factory';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getPageTitle } from '../../../common/helpers';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

// Services available to MCP tools, injected by McpServerFactory
export interface McpToolServices {
  pageService: PageService;
  searchService: SearchService;
  spaceMemberService: SpaceMemberService;
  workspaceService: WorkspaceService;
  groupService: GroupService;
  pageAccessService: PageAccessService;
  attachmentService: AttachmentService;
  environmentService: EnvironmentService;
  domainService: DomainService;
  auditService: IAuditService;
  spaceAbility: SpaceAbilityFactory;
  workspaceAbility: WorkspaceAbilityFactory;
}

// Execution context for MCP tools: the operator identity resolved from the static token
export interface McpToolContext {
  user: User;
  workspace: Workspace;
}

// Common pagination parameters for list tools like list_pages
export const paginationShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of items to return (1-100, default 20)'),
  cursor: z.string().optional().describe('Pagination cursor from a previous call'),
};

// Build a complete PaginationOptions (filling in fields that are required by the
// type but nullable)
export function toPaginationOptions(
  limit?: number,
  cursor?: string,
): PaginationOptions {
  return { limit: limit ?? 20, cursor, query: undefined, adminView: undefined };
}

// Uniformly wrap tool execution: catch exceptions and convert them to MCP error
// results, avoiding interruption of the client session
export async function runTool(
  fn: () => Promise<unknown>,
): Promise<CallToolResult> {
  try {
    const data = await fn();
    return {
      content: [
        { type: 'text', text: JSON.stringify(data ?? { ok: true }, null, 2) },
      ],
    };
  } catch (err) {
    const e = err as { response?: unknown; message?: string };
    const raw = e?.response ?? e?.message ?? 'Unknown error';
    const message =
      typeof raw === 'string' ? raw : JSON.stringify(raw);
    return {
      isError: true,
      content: [{ type: 'text', text: message }],
    };
  }
}

// Trim the page fields, keeping only what's meaningful to the LLM to save tokens
export function trimPage(page: Partial<Page>) {
  return {
    id: page.id,
    slugId: page.slugId,
    title: getPageTitle(page.title),
    icon: page.icon,
    parentPageId: page.parentPageId,
    spaceId: page.spaceId,
    updatedAt: page.updatedAt,
  };
}
