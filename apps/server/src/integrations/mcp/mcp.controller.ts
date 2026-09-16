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

  // Handle MCP Streamable HTTP requests: stateless mode, each request uses its own
  // server and transport
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

    // Clean up this request's session resources once the response ends
    reply.raw.on('close', () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      // Hand Fastify's parsed body directly to the transport to avoid re-reading
      // the request stream
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
