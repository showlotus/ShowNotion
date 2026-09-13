import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { EnvironmentService } from '../../environment/environment.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import {
  extractBearerTokenFromHeader,
  isUserDisabled,
} from '../../../common/helpers';

// 比较 token：长度不同直接拒绝，等长时使用恒定时间比较防时序攻击
function tokensMatch(expected: string, received: string): boolean {
  const bufExpected = Buffer.from(expected, 'utf8');
  const bufReceived = Buffer.from(received, 'utf8');
  if (bufExpected.length !== bufReceived.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufExpected, bufReceived);
}

// MCP 端点认证：校验静态 Bearer token 并解析到固定操作者用户
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly userRepo: UserRepo,
  ) {}

  // 校验流程：token 配置检查 → token 比对 → 解析用户并挂载到 request
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // MCP_AUTH_TOKEN 未配置时视为功能关闭，端点以 404 隐藏
    const expectedToken = this.environmentService.getMcpAuthToken();
    if (!expectedToken) {
      throw new NotFoundException('MCP is not enabled');
    }

    const token = extractBearerTokenFromHeader(request);
    if (!token || !tokensMatch(expectedToken, token)) {
      throw new UnauthorizedException('Invalid MCP token');
    }

    // DomainMiddleware 已把 workspace 挂到 request.raw
    const workspace = request.raw?.workspace;
    if (!workspace) {
      throw new BadRequestException('Invalid workspace');
    }

    const email = this.environmentService.getMcpUserEmail();
    if (!email) {
      throw new UnauthorizedException('MCP_USER_EMAIL is not configured');
    }

    const user = await this.userRepo.findByEmail(email, workspace.id);
    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException('MCP user not found');
    }

    // 与 JwtAuthGuard 的用户结构对齐，AuthUser/AuthWorkspace 装饰器可直接使用
    request.user = { user, workspace };
    return true;
  }
}
