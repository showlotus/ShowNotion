import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpAuthGuard } from './guards/mcp-auth.guard';
import { McpServerFactory } from './services/mcp-server.factory';
import { PageModule } from '../../core/page/page.module';
import { SearchModule } from '../../core/search/search.module';
import { SpaceModule } from '../../core/space/space.module';
import { WorkspaceModule } from '../../core/workspace/workspace.module';
import { GroupModule } from '../../core/group/group.module';

@Module({
  // CaslModule、PageAccessModule、repo 层均为全局模块，无需重复导入
  imports: [
    PageModule,
    SearchModule,
    SpaceModule,
    WorkspaceModule,
    GroupModule,
  ],
  controllers: [McpController],
  providers: [McpAuthGuard, McpServerFactory],
})
export class McpModule {}
