import {
  ActionIcon,
  Group,
  Menu,
  Popover,
  ScrollArea,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowRight,
  IconArrowsHorizontal,
  IconDots,
  IconEye,
  IconEyeOff,
  IconFileExport,
  IconHistory,
  IconInfoCircle,
  IconLink,
  IconList,
  IconMarkdown,
  IconMessage,
  IconPaperclip,
  IconPrinter,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconWifiOff,
} from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useAtom, useAtomValue } from "jotai";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms.ts";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { useClipboard } from "@/hooks/use-clipboard";
import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";
import { getAppUrl } from "@/lib/config.ts";
import { extractPageSlugId } from "@/lib";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { PageWidthToggle } from "@/features/user/components/page-width-pref.tsx";
import { Trans, useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import { htmlToMarkdown } from "@docmost/editor-ext";
import {
  floatingTocAtom,
  pageActionMenuOpenAtom,
  pageEditorAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms.ts";
import { FLOATING_TOC_PANEL_ID } from "@/features/editor/components/table-of-contents/floating-toc";
import { formattedDate } from "@/lib/time.ts";
import MovePageModal from "@/features/page/components/move-page-modal.tsx";
import PageAttachmentsModal from "@/features/attachments/components/page-attachments-modal.tsx";
import { useTimeAgo } from "@/hooks/use-time-ago.tsx";
import { PageShareModal } from "@/ee/page-permission";
import {
  PageVerificationMenuItem,
  PageVerificationModal,
} from "@/ee/page-verification";
import {
  useFavoriteIds,
  useAddFavoriteMutation,
  useRemoveFavoriteMutation,
} from "@/features/favorite/queries/favorite-query";
import {
  useWatchStatusQuery,
  useWatchPageMutation,
  useUnwatchPageMutation,
} from "@/features/page/queries/watcher-query";

const CommentListWithTabs = React.lazy(
  () => import("@/features/comment/components/comment-list-with-tabs.tsx"),
);
const PageDetailsAside = React.lazy(() =>
  import("@/features/page-details/components/page-details-aside.tsx").then(
    (m) => ({ default: m.PageDetailsAside }),
  ),
);

const activeIconProps = (active: boolean) => ({
  "data-active": active || undefined,
  "aria-expanded": active,
  style: active ? { backgroundColor: "var(--ai-hover)" } : undefined,
});

interface PageHeaderMenuProps {
  readOnly?: boolean;
}
export default function PageHeaderMenu({ readOnly }: PageHeaderMenuProps) {
  const { t } = useTranslation();
  const [{ isAsideOpen, tab: asideTab }, setAsideState] = useAtom(asideStateAtom);
  const [, setActionMenuOpen] = useAtom(pageActionMenuOpenAtom);
  const commentsOpened = isAsideOpen && asideTab === "comments";
  const detailsOpened = isAsideOpen && asideTab === "details";
  const togglePanel = (tab: "comments" | "details") => {
    setActionMenuOpen(false);
    setAsideState((state) =>
      state.tab === tab && state.isAsideOpen
        ? { ...state, isAsideOpen: false }
        : { tab, isAsideOpen: true },
    );
  };
  const closePanel = () =>
    setAsideState((state) => ({ ...state, isAsideOpen: false }));
  useEffect(() => {
    if (!commentsOpened && !detailsOpened) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    const handleMouseDown = (event: MouseEvent | TouchEvent) => {
      const keepOpen = event.composedPath().some(
        (node) =>
          node instanceof HTMLElement &&
          (node.hasAttribute("data-mantine-shared-portal-node") ||
            node.hasAttribute("data-panel-trigger")),
      );
      if (!keepOpen) closePanel();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("touchstart", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("touchstart", handleMouseDown);
    };
  }, [commentsOpened, detailsOpened]);
  const [floatingTocOpen, setFloatingTocOpen] = useAtom(floatingTocAtom);
  useEffect(() => {
    if (isAsideOpen) setFloatingTocOpen(false);
  }, [isAsideOpen, setFloatingTocOpen]);
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const isDeleted = !!page?.deletedAt;

  useHotkeys(
    [
      [
        "mod+F",
        () => {
          const event = new CustomEvent("openFindDialogFromEditor", {});
          document.dispatchEvent(event);
        },
      ],
      [
        "Escape",
        () => {
          const event = new CustomEvent("closeFindDialogFromEditor", {});
          document.dispatchEvent(event);
        },
        { preventDefault: false },
      ],
    ],
    [],
  );

  if (isDeleted) {
    return null;
  }

  return (
    <>
      <ConnectionWarning />

      <PageShareModal readOnly={readOnly} />

      <Tooltip label={t("Comments")} openDelay={250} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          aria-label={t("Comments")}
          {...activeIconProps(commentsOpened)}
          data-panel-trigger="comments"
          onClick={() => togglePanel("comments")}
        >
          <IconMessage size={20} stroke={2} />
        </ActionIcon>
      </Tooltip>

      {!page?.isBase && (
        <Tooltip label={t("Table of contents")} openDelay={250} withArrow>
          <ActionIcon
            variant="subtle"
            color="dark"
            data-floating-toc-trigger
            aria-label={t("Table of contents")}
            aria-controls={FLOATING_TOC_PANEL_ID}
            {...activeIconProps(floatingTocOpen)}
            onClick={() => {
              setActionMenuOpen(false);
              closePanel();
              setFloatingTocOpen((open) => !open);
            }}
          >
            <IconList size={20} stroke={2} />
          </ActionIcon>
        </Tooltip>
      )}

      <Tooltip label={t("Details")} openDelay={250} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          aria-label={t("Details")}
          {...activeIconProps(detailsOpened)}
          data-panel-trigger="details"
          onClick={() => togglePanel("details")}
        >
          <IconInfoCircle size={20} stroke={2} />
        </ActionIcon>
      </Tooltip>

      <Popover
        opened={commentsOpened || detailsOpened}
        onChange={(opened) => !opened && closePanel()}
        closeOnClickOutside={false}
        floatingStrategy="fixed"
        shadow="xl"
        position="bottom-end"
        offset={20}
        width={commentsOpened ? 350 : 320}
        withRoles={false}
        hideDetached={false}
      >
        <Popover.Target>
          <div
            aria-hidden
            style={{
              position: "fixed",
              top: "var(--page-header-height, 44px)",
              right: 25,
              width: 0,
              height: 0,
              pointerEvents: "none",
            }}
          />
        </Popover.Target>
        <Popover.Dropdown
          role="dialog"
          aria-label={commentsOpened ? t("Comments") : t("Details")}
          p={commentsOpened ? 0 : undefined}
          style={
            commentsOpened
              ? {
                  display: "flex",
                  flexDirection: "column",
                  height: "min(600px, 70vh)",
                }
              : undefined
          }
        >
          {commentsOpened ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                padding: "var(--mantine-spacing-md)",
              }}
            >
              <React.Suspense fallback={null}>
                <CommentListWithTabs />
              </React.Suspense>
            </div>
          ) : (
            <ScrollArea.Autosize mah={520} type="scroll" scrollbarSize={5}>
              <React.Suspense fallback={null}>
                <PageDetailsAside />
              </React.Suspense>
            </ScrollArea.Autosize>
          )}
        </Popover.Dropdown>
      </Popover>

      <PageActionMenu readOnly={readOnly} />
    </>
  );
}

interface PageActionMenuProps {
  readOnly?: boolean;
}
function PageActionMenu({ readOnly }: PageActionMenuProps) {
  const { t } = useTranslation();
  const [, setHistoryModalOpen] = useAtom(historyAtoms);
  const clipboard = useClipboard({ timeout: 500 });
  const { pageSlug, spaceSlug } = useParams();
  const { data: page, isLoading } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const { openDeleteModal } = useDeletePageModal();
  const { handleDelete } = useTreeMutation(page?.spaceId ?? "");
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [
    movePageModalOpened,
    { open: openMovePageModal, close: closeMoveSpaceModal },
  ] = useDisclosure(false);
  const [
    verificationOpened,
    { open: openVerificationModal, close: closeVerificationModal },
  ] = useDisclosure(false);
  const [
    attachmentsOpened,
    { open: openAttachmentsModal, close: closeAttachmentsModal },
  ] = useDisclosure(false);
  const [pageEditor] = useAtom(pageEditorAtom);
  const pageUpdatedAt = useTimeAgo(page?.updatedAt);
  const favoriteIds = useFavoriteIds("page", page?.spaceId);
  const addFavoriteMutation = useAddFavoriteMutation();
  const removeFavoriteMutation = useRemoveFavoriteMutation();
  const isFavorited = page?.id ? favoriteIds.has(page.id) : false;
  const { data: watchStatus } = useWatchStatusQuery(page?.id);
  const watchPage = useWatchPageMutation();
  const unwatchPage = useUnwatchPageMutation();
  const [actionMenuOpen, setActionMenuOpen] = useAtom(pageActionMenuOpenAtom);
  const [, setFloatingTocOpen] = useAtom(floatingTocAtom);
  const [, setAsideState] = useAtom(asideStateAtom);

  useEffect(() => {
    return () => setActionMenuOpen(false);
  }, [setActionMenuOpen]);

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, page.slugId, page.title);

    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  const handleCopyAsMarkdown = () => {
    if (!pageEditor) return;
    const html = pageEditor.getHTML();
    const markdown = htmlToMarkdown(html);
    const title = page?.title ? `# ${page.title}\n\n` : "";
    clipboard.copy(`${title}${markdown}`);
    notifications.show({ message: t("Copied") });
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const openHistoryModal = () => {
    setHistoryModalOpen(true);
  };

  const handleDeletePage = () => {
    openDeleteModal({ onConfirm: () => handleDelete(page.id) });
  };

  const handleToggleFavorite = () => {
    if (!page?.id) return;
    const params = { type: "page" as const, pageId: page.id };
    if (isFavorited) {
      removeFavoriteMutation.mutate(params);
    } else {
      addFavoriteMutation.mutate(params);
    }
  };

  return (
    <>
      <Menu
        shadow="xl"
        position="bottom-end"
        offset={20}
        width={230}
        withArrow
        arrowPosition="center"
        opened={actionMenuOpen}
        onChange={setActionMenuOpen}
        onOpen={() => {
          setActionMenuOpen(true);
          setFloatingTocOpen(false);
          setAsideState((state) => ({ ...state, isAsideOpen: false }));
        }}
        onClose={() => setActionMenuOpen(false)}
      >
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="dark"
            aria-label={t("Page actions")}
            {...activeIconProps(actionMenuOpen)}
          >
            <IconDots size={20} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconLink size={16} />}
            onClick={handleCopyLink}
          >
            {t("Copy link")}
          </Menu.Item>

          {!page?.isBase && (
            <Menu.Item
              leftSection={<IconMarkdown size={16} />}
              onClick={handleCopyAsMarkdown}
            >
              {t("Copy as Markdown")}
            </Menu.Item>
          )}

          <Menu.Item
            leftSection={
              isFavorited ? (
                <IconStarFilled size={16} color="var(--mantine-color-yellow-5)" />
              ) : (
                <IconStar size={16} />
              )
            }
            onClick={handleToggleFavorite}
          >
            {isFavorited ? t("Remove from favorites") : t("Add to favorites")}
          </Menu.Item>

          {watchStatus?.watching ? (
            <Menu.Item
              leftSection={<IconEyeOff size={16} />}
              onClick={() => unwatchPage.mutate(page.id)}
            >
              {t("Stop watching")}
            </Menu.Item>
          ) : (
            <Menu.Item
              leftSection={<IconEye size={16} />}
              onClick={() => watchPage.mutate(page.id)}
            >
              {t("Watch page")}
            </Menu.Item>
          )}

          {!page?.isBase && <Menu.Divider />}

          {!page?.isBase && (
            <Menu.Item
              leftSection={<IconArrowsHorizontal size={16} />}
              closeMenuOnClick={false}
            >
              <Group wrap="nowrap">
                <PageWidthToggle label={t("Full width")} />
              </Group>
            </Menu.Item>
          )}

          {!page?.isBase && (
            <Menu.Item
              leftSection={<IconHistory size={16} />}
              onClick={openHistoryModal}
            >
              {t("Page history")}
            </Menu.Item>
          )}

          {!page?.isBase && (
            <Menu.Item
              leftSection={<IconPaperclip size={16} />}
              onClick={openAttachmentsModal}
            >
              {t("Attachments")}
            </Menu.Item>
          )}

          {!readOnly && !page?.isBase && (
            <PageVerificationMenuItem
              pageId={page?.id}
              onClick={openVerificationModal}
            />
          )}

          <Menu.Divider />

          {!readOnly && (
            <Menu.Item
              leftSection={<IconArrowRight size={16} />}
              onClick={openMovePageModal}
            >
              {t("Move")}
            </Menu.Item>
          )}

          <Menu.Item
            leftSection={<IconFileExport size={16} />}
            onClick={openExportModal}
          >
            {t("Export")}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
          >
            {t("Print PDF")}
          </Menu.Item>

          {!readOnly && (
            <>
              <Menu.Divider />
              <Menu.Item
                color={"red"}
                leftSection={<IconTrash size={16} />}
                onClick={handleDeletePage}
              >
                {t("Move to trash")}
              </Menu.Item>
            </>
          )}

          <Menu.Divider />

          <>
            <Group px="sm" wrap="nowrap" style={{ cursor: "pointer" }}>
              <Tooltip
                label={t("Edited by {{name}} {{time}}", {
                  name: page.lastUpdatedBy.name,
                  time: pageUpdatedAt,
                })}
                position="left-start"
              >
                <div style={{ width: 210 }}>
                  <Text size="xs" c="dimmed" truncate="end">
                    {t("Word count: {{wordCount}}", {
                      wordCount: pageEditor?.storage?.characterCount?.words(),
                    })}
                  </Text>

                  <Text size="xs" c="dimmed" lineClamp={1}>
                    <Trans
                      defaults="Created by: <b>{{creatorName}}</b>"
                      values={{ creatorName: page?.creator?.name }}
                      components={{ b: <Text span fw={500} /> }}
                    />
                  </Text>
                  <Text size="xs" c="dimmed" truncate="end">
                    {t("Created at: {{time}}", {
                      time: formattedDate(page.createdAt),
                    })}
                  </Text>
                </div>
              </Tooltip>
            </Group>
          </>
        </Menu.Dropdown>
      </Menu>

      <ExportModal
        type="page"
        id={page.id}
        open={exportOpened}
        onClose={closeExportModal}
      />

      <MovePageModal
        pageId={page.id}
        slugId={page.slugId}
        currentSpaceSlug={spaceSlug}
        onClose={closeMoveSpaceModal}
        open={movePageModalOpened}
      />

      <PageVerificationModal
        pageId={page.id}
        opened={verificationOpened}
        onClose={closeVerificationModal}
      />

      <PageAttachmentsModal
        pageId={page.id}
        open={attachmentsOpened}
        onClose={closeAttachmentsModal}
      />
    </>
  );
}

function ConnectionWarning() {
  const { t } = useTranslation();
  const yjsConnectionStatus = useAtomValue(yjsConnectionStatusAtom);
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isDisconnected = ["disconnected", "connecting"].includes(
      yjsConnectionStatus,
    );

    if (isDisconnected) {
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => setShowWarning(true), 5000);
      }
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setShowWarning(false);
    }
  }, [yjsConnectionStatus]);

  // Cleanup only on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!showWarning) return null;

  return (
    <Tooltip
      label={t("Real-time editor connection lost. Retrying...")}
      openDelay={250}
      withArrow
    >
      <ThemeIcon
        variant="default"
        c="red"
        role="status"
        aria-label={t("Real-time editor connection lost. Retrying...")}
        style={{ border: "none" }}
      >
        <IconWifiOff size={20} stroke={2} />
      </ThemeIcon>
    </Tooltip>
  );
}
