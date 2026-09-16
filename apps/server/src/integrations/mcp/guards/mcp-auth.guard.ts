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

// Compare tokens: reject mismatched lengths immediately; for equal lengths use a
// constant-time comparison to prevent timing attacks
function tokensMatch(expected: string, received: string): boolean {
  const bufExpected = Buffer.from(expected, 'utf8');
  const bufReceived = Buffer.from(received, 'utf8');
  if (bufExpected.length !== bufReceived.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufExpected, bufReceived);
}

// MCP endpoint authentication: validate the static Bearer token and resolve it to
// a fixed operator user
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly userRepo: UserRepo,
  ) {}

  // Validation flow: token config check → token comparison → resolve user and
  // attach to request
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // When MCP_AUTH_TOKEN is not configured the feature is considered disabled and
    // the endpoint hides behind a 404
    const expectedToken = this.environmentService.getMcpAuthToken();
    if (!expectedToken) {
      throw new NotFoundException('MCP is not enabled');
    }

    const token = extractBearerTokenFromHeader(request);
    if (!token || !tokensMatch(expectedToken, token)) {
      throw new UnauthorizedException('Invalid MCP token');
    }

    // DomainMiddleware has already attached the workspace to request.raw
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

    // Aligned with the JwtAuthGuard user shape so the AuthUser/AuthWorkspace
    // decorators work directly
    request.user = { user, workspace };
    return true;
  }
}
