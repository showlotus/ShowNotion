import { Inject, Injectable } from '@nestjs/common';
import { mkdirSync } from 'fs';
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
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';
import SpaceAbilityFactory from '../../../core/casl/abilities/space-ability.factory';
import WorkspaceAbilityFactory from '../../../core/casl/abilities/workspace-ability.factory';
import {
  McpToolServices,
} from '../tools/shared';
import { registerPageTools } from '../tools/page-tools';
import { registerWorkspaceTools } from '../tools/workspace-tools';
import { registerAttachmentTools } from '../tools/attachment-tools';

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
    private readonly attachmentService: AttachmentService,
    private readonly environmentService: EnvironmentService,
    private readonly domainService: DomainService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {
    // 服务启动时预创建上传暂存目录，保证 docker cp 的目标目录始终存在
    try {
      mkdirSync(this.environmentService.getMcpUploadInbox(), {
        recursive: true,
      });
    } catch {
      // 创建失败不阻断启动，工具调用时会再次尝试
    }
  }

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
      attachmentService: this.attachmentService,
      environmentService: this.environmentService,
      domainService: this.domainService,
      auditService: this.auditService,
      spaceAbility: this.spaceAbility,
      workspaceAbility: this.workspaceAbility,
    };

    registerPageTools(server, { user, workspace }, services);
    registerWorkspaceTools(server, { user, workspace }, services);
    registerAttachmentTools(server, { user, workspace }, services);

    return server;
  }
}
