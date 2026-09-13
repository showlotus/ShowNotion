import {
  All,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  StreamableHTTPServerTransport,
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpAuthGuard } from './guards/mcp-auth.guard';
import { McpServerFactory } from './services/mcp-server.factory';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

@UseGuards(McpAuthGuard)
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly mcpServerFactory: McpServerFactory) {}

  // 处理 MCP Streamable HTTP 请求：stateless 模式，每个请求使用独立的 server 与 transport
  @All()
  @SkipTransform()
  @HttpCode(HttpStatus.OK)
  async handleMcp(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { user, workspace } = (request as any).user;

    const server = this.mcpServerFactory.createServer(user, workspace);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // 响应结束后清理本次请求的会话资源
    reply.raw.on('close', () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      // Fastify 已解析的 body 直接交给 transport，避免重复读取请求流
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (err) {
      this.logger.error(
        `MCP request failed: ${(err as Error)?.message ?? err}`,
      );
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(HttpStatus.INTERNAL_SERVER_ERROR);
        reply.raw.end('Internal server error');
      }
    }
  }
}
