import { z } from 'zod';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as bytes from 'bytes';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  McpToolContext,
  McpToolServices,
  runTool,
} from './shared';
import { normalizePageId } from './page-tools';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';

// inbox 暂存文件保留时长，超时未消费的文件在下次工具调用时清理
const INBOX_TTL_MS = 24 * 60 * 60 * 1000;

// 清理 inbox 顶层超时未消费的暂存文件，失败不影响上传主流程
async function cleanupExpiredInboxFiles(inbox: string): Promise<void> {
  try {
    const entries = await fs.readdir(inbox, { withFileTypes: true });
    const now = Date.now();
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() || entry.isSymbolicLink())
        .map(async (entry) => {
          const target = path.join(inbox, entry.name);
          const stat = await fs.stat(target).catch(() => null);
          if (stat && now - stat.mtimeMs > INBOX_TTL_MS) {
            await fs.rm(target, { force: true }).catch(() => undefined);
          }
        }),
    );
  } catch {
    // 忽略清理失败
  }
}

// 注册附件相关的 MCP 工具（上传文件到指定页面）
export function registerAttachmentTools(
  server: McpServer,
  ctx: McpToolContext,
  services: McpToolServices,
): void {
  const { user, workspace } = ctx;
  const {
    pageService,
    pageAccessService,
    attachmentService,
    environmentService,
    domainService,
    auditService,
  } = services;

  const inbox = environmentService.getMcpUploadInbox();
  const hostInbox = environmentService.getMcpUploadInboxHost();
  // 优先按宿主共享目录引导投递；未配置时回退到 cp / docker cp 判断
  const deliveryHint = hostInbox
    ? `Deliver files first: cp <local-file> ${hostInbox}/ (or drop it into that folder), it is shared with ${inbox} in the server`
    : existsSync('/.dockerenv')
      ? `Deliver files first: docker cp <local-file> <container>:${inbox}/`
      : `Deliver files first: cp <local-file> ${inbox}/`;
  const inboxTarget = hostInbox
    ? `into the shared upload folder (${hostInbox})`
    : `into the server inbox ${inbox}`;

  // 从 inbox 暂存目录读取文件并上传到指定页面，返回可直接嵌入 Markdown 的文件 URL
  server.registerTool(
    'upload_attachment',
    {
      description:
        'Upload a file (e.g. an image) to a page as an attachment and return ' +
        `the file URL for embedding in Markdown. The file must be delivered ` +
        `${inboxTarget} beforehand. ${deliveryHint}. ` +
        'Never inline base64 content — deliver the file instead.',
      inputSchema: {
        pageId: z
          .string()
          .describe(
            'Target page: ID, slug ID, page slug, path, or full ShowNotion page URL',
          ),
        filePath: z
          .string()
          .describe(
            `File name or relative path inside the server inbox (${inbox})`,
          ),
        fileName: z
          .string()
          .optional()
          .describe(
            'Rename the stored file, e.g. screenshot.png. Original name kept when omitted',
          ),
      },
    },
    async ({ pageId, filePath, fileName }) =>
      runTool(async () => {
        await fs.mkdir(inbox, { recursive: true });
        await cleanupExpiredInboxFiles(inbox);

        // 只允许引用 inbox 内的文件，拒绝绝对路径与 .. 越界
        const resolved = path.resolve(inbox, filePath);
        if (resolved !== inbox && !resolved.startsWith(inbox + path.sep)) {
          throw new BadRequestException('Path escapes the upload inbox');
        }

        // 词法校验挡不住软链跳转，用真实路径再确认一次（inbox 基准同样取 realpath）
        const inboxReal = await fs.realpath(inbox);
        const resolvedReal = await fs.realpath(resolved).catch(() => null);
        if (!resolvedReal) {
          throw new NotFoundException(
            `File not found in inbox: ${resolved} (deliver it first via cp / docker cp)`,
          );
        }
        if (
          resolvedReal !== inboxReal &&
          !resolvedReal.startsWith(inboxReal + path.sep)
        ) {
          throw new BadRequestException('Path escapes the upload inbox');
        }

        const fileStat = await fs.lstat(resolved).catch(() => null);
        if (!fileStat || fileStat.isDirectory()) {
          throw new NotFoundException(
            `File not found in inbox: ${resolved} (deliver it first via cp / docker cp)`,
          );
        }
        if (fileStat.isSymbolicLink()) {
          throw new BadRequestException(
            'Symlinks are not allowed in the upload inbox',
          );
        }

        // 与 REST 上传保持同一大小上限
        const sizeLimitLabel = environmentService.getFileUploadSizeLimit();
        if (fileStat.size > bytes(sizeLimitLabel)) {
          throw new BadRequestException(
            `File too large. Exceeds the ${sizeLimitLabel} limit`,
          );
        }

        const page = await pageService.findById(normalizePageId(pageId));
        if (!page || page.deletedAt) {
          throw new NotFoundException('Page not found');
        }

        await pageAccessService.validateCanEdit(page, user);

        const attachment = await attachmentService.uploadFileFromBuffer({
          buffer: await fs.readFile(resolvedReal),
          fileName: fileName?.trim() || path.basename(resolved),
          pageId: page.id,
          userId: user.id,
          spaceId: page.spaceId,
          workspaceId: workspace.id,
        });

        // 上传成功后清理暂存文件（consume 语义，失败时保留以便重试）
        await fs.rm(resolved, { force: true }).catch(() => undefined);

        // 与 REST 上传保持一致记录审计事件
        auditService.log({
          event: AuditEvent.ATTACHMENT_UPLOADED,
          resourceType: AuditResource.ATTACHMENT,
          resourceId: attachment.id,
          spaceId: page.spaceId,
          metadata: {
            fileName: attachment.fileName,
            pageId: page.id,
            spaceId: page.spaceId,
            source: 'mcp',
          },
        });

        return {
          id: attachment.id,
          fileName: attachment.fileName,
          fileSize: Number(attachment.fileSize),
          mimeType: attachment.mimeType,
          pageId: attachment.pageId,
          url: `${domainService.getUrl(workspace.hostname)}/api/files/${attachment.id}/${encodeURIComponent(attachment.fileName)}`,
        };
      }),
  );
}
