import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpAuthGuard } from './guards/mcp-auth.guard';
import { McpServerFactory } from './services/mcp-server.factory';
import { PageModule } from '../../core/page/page.module';
import { SearchModule } from '../../core/search/search.module';
import { SpaceModule } from '../../core/space/space.module';
import { WorkspaceModule } from '../../core/workspace/workspace.module';
import { GroupModule } from '../../core/group/group.module';
import { AttachmentModule } from '../../core/attachment/attachment.module';
import { EnvironmentModule } from '../environment/environment.module';

@Module({
  // CaslModule, PageAccessModule, and the repo layer are all global modules;
  // no need to re-import them
  imports: [
    PageModule,
    SearchModule,
    SpaceModule,
    WorkspaceModule,
    GroupModule,
    AttachmentModule,
    EnvironmentModule,
  ],
  controllers: [McpController],
  providers: [McpAuthGuard, McpServerFactory],
})
export class McpModule {}
