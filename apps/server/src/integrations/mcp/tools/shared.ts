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
import SpaceAbilityFactory from '../../../core/casl/abilities/space-ability.factory';
import WorkspaceAbilityFactory from '../../../core/casl/abilities/workspace-ability.factory';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getPageTitle } from '../../../common/helpers';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

// MCP 工具可用的服务集合，由 McpServerFactory 注入
export interface McpToolServices {
  pageService: PageService;
  searchService: SearchService;
  spaceMemberService: SpaceMemberService;
  workspaceService: WorkspaceService;
  groupService: GroupService;
  pageAccessService: PageAccessService;
  spaceAbility: SpaceAbilityFactory;
  workspaceAbility: WorkspaceAbilityFactory;
}

// MCP 工具执行上下文：静态 token 解析出的操作者身份
export interface McpToolContext {
  user: User;
  workspace: Workspace;
}

// list_pages 等列表工具的公共分页参数
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

// 构造完整的 PaginationOptions（补齐类型必填但可空的字段）
export function toPaginationOptions(
  limit?: number,
  cursor?: string,
): PaginationOptions {
  return { limit: limit ?? 20, cursor, query: undefined, adminView: undefined };
}

// 统一包装工具执行：捕获异常并转为 MCP 错误结果，避免中断客户端会话
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

// 裁剪 page 字段，只保留对 LLM 有意义的信息以节省 token
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
