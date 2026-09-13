import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PageService } from '../../../core/page/services/page.service';
import { SearchService } from '../../../core/search/search.service';
import {
  SpaceMemberService,
} from '../../../core/space/services/space-member.service';
import {
  WorkspaceService,
} from '../../../core/workspace/services/workspace.service';
import { GroupService } from '../../../core/group/services/group.service';
import {
  PageAccessService,
} from '../../../core/page/page-access/page-access.service';
import SpaceAbilityFactory from '../../../core/casl/abilities/space-ability.factory';
import WorkspaceAbilityFactory from '../../../core/casl/abilities/workspace-ability.factory';
import {
  McpToolServices,
} from '../tools/shared';
import { registerPageTools } from '../tools/page-tools';
import { registerWorkspaceTools } from '../tools/workspace-tools';

// 组装 MCP server 实例：注入服务层并注册全部工具
@Injectable()
export class McpServerFactory {
  constructor(
    private readonly pageService: PageService,
    private readonly searchService: SearchService,
    private readonly spaceMemberService: SpaceMemberService,
    private readonly workspaceService: WorkspaceService,
    private readonly groupService: GroupService,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  // 创建绑定指定用户身份的 MCP server（stateless 模式下每个请求新建）
  createServer(user: User, workspace: Workspace): McpServer {
    const server = new McpServer({
      name: 'shownotion',
      version: '0.1.0',
    });

    const services: McpToolServices = {
      pageService: this.pageService,
      searchService: this.searchService,
      spaceMemberService: this.spaceMemberService,
      workspaceService: this.workspaceService,
      groupService: this.groupService,
      pageAccessService: this.pageAccessService,
      spaceAbility: this.spaceAbility,
      workspaceAbility: this.workspaceAbility,
    };

    registerPageTools(server, { user, workspace }, services);
    registerWorkspaceTools(server, { user, workspace }, services);

    return server;
  }
}
