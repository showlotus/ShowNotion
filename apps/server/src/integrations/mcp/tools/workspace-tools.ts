import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ForbiddenException } from '@nestjs/common';
import {
  McpToolContext,
  McpToolServices,
  runTool,
  toPaginationOptions,
} from './shared';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../../core/casl/interfaces/workspace-ability.type';

// 注册工作区相关的 MCP 工具（工作区信息、用户组列表）
export function registerWorkspaceTools(
  server: McpServer,
  ctx: McpToolContext,
  services: McpToolServices,
): void {
  const { user, workspace } = ctx;
  const { workspaceService, groupService, workspaceAbility } = services;

  // 获取当前工作区基本信息
  server.registerTool(
    'get_workspace',
    {
      description: 'Get the current workspace name and basic info',
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const info = await workspaceService.getWorkspaceInfo(workspace.id);
        return {
          id: info.id,
          name: info.name,
          logo: info.logo,
          hostname: info.hostname,
        };
      }),
  );

  // 列出工作区内的用户组（要求工作区组读取权限）
  server.registerTool(
    'list_groups',
    {
      description: 'List user groups in the workspace',
      inputSchema: {
        query: z.string().optional().describe('Optional group name filter'),
      },
    },
    async ({ query }) =>
      runTool(async () => {
        const ability = workspaceAbility.createForUser(user, workspace);
        if (ability.cannot(WorkspaceCaslAction.Read, WorkspaceCaslSubject.Group)) {
          throw new ForbiddenException();
        }

        const { items } = await groupService.getWorkspaceGroups(
          workspace.id,
          toPaginationOptions(100, undefined),
        );

        return {
          items: items
            .filter((group) =>
              query
                ? group.name.toLowerCase().includes(query.toLowerCase())
                : true,
            )
            .map((group) => ({
              id: group.id,
              name: group.name,
              description: group.description,
            })),
        };
      }),
  );
}
