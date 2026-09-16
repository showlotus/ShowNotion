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

// How long staged files stay in the inbox; unconsumed files are cleaned up on the next tool call
const INBOX_TTL_MS = 24 * 60 * 60 * 1000;

// Clean up timed-out unconsumed staged files at the top level of the inbox;
// failures don't affect the main upload flow
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
    // Ignore cleanup failures
  }
}

// Register the attachment-related MCP tools (upload a file to a given page)
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
  // Prefer guiding delivery via the host shared directory; fall back to cp / docker cp
  // detection when not configured
  const deliveryHint = hostInbox
    ? `Deliver files first: cp <local-file> ${hostInbox}/ (or drop it into that folder), it is shared with ${inbox} in the server`
    : existsSync('/.dockerenv')
      ? `Deliver files first: docker cp <local-file> <container>:${inbox}/`
      : `Deliver files first: cp <local-file> ${inbox}/`;
  const inboxTarget = hostInbox
    ? `into the shared upload folder (${hostInbox})`
    : `into the server inbox ${inbox}`;

  // Read a file from the inbox staging directory and upload it to the given page,
  // returning a file URL that can be embedded in Markdown directly
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

        // Only allow references inside the inbox; reject absolute paths and '..' escaping
        const resolved = path.resolve(inbox, filePath);
        if (resolved !== inbox && !resolved.startsWith(inbox + path.sep)) {
          throw new BadRequestException('Path escapes the upload inbox');
        }

        // Lexical checks can't catch symlink hops; re-verify with the real path
        // (the inbox base is realpath'ed as well)
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

        // Keep the same size limit as the REST upload
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

        // Clean up the staged file after a successful upload (consume semantics; keep
        // it on failure so the upload can be retried)
        await fs.rm(resolved, { force: true }).catch(() => undefined);

        // Record the audit event consistently with the REST upload
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
