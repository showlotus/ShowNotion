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

// Register the workspace-related MCP tools (workspace info, user group list)
export function registerWorkspaceTools(
  server: McpServer,
  ctx: McpToolContext,
  services: McpToolServices,
): void {
  const { user, workspace } = ctx;
  const { workspaceService, groupService, workspaceAbility } = services;

  // Get the current workspace's basic info
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

  // List user groups in the workspace (requires workspace group read permission)
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
