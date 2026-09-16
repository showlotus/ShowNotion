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

// Assemble an MCP server instance: inject the service layer and register all tools
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
    // Pre-create the upload staging directory at service startup so the docker cp
    // target always exists
    try {
      mkdirSync(this.environmentService.getMcpUploadInbox(), {
        recursive: true,
      });
    } catch {
      // A creation failure doesn't block startup; tool calls will retry
    }
  }

  // Create an MCP server bound to the given user identity (a new one per request
  // in stateless mode)
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
