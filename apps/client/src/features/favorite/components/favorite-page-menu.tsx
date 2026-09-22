import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useAtom, useStore } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Menu, rem } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowRight,
  IconCopy,
  IconDots,
  IconFileExport,
  IconLink,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";

import ExportModal from "@/components/common/export-modal";
import MovePageModal from "@/features/page/components/move-page-modal.tsx";
import CopyPageModal from "@/features/page/components/copy-page-modal.tsx";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils.ts";
import { duplicatePage } from "@/features/page/services/page-service.ts";
import { useClipboard } from "@/hooks/use-clipboard";
import { extractPageSlugId } from "@/lib";
import { getAppUrl, getSpaceUrl } from "@/lib/config.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import {
  useAddFavoriteMutation,
  useFavoriteIds,
  useRemoveFavoriteMutation,
} from "@/features/favorite/queries/favorite-query";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import {
  spaceRoots,
  updateSpaceRoots,
} from "@/features/page/tree/utils/utils.ts";
import type { SpaceTreeNode } from "@/features/page/tree/types.ts";
import type { FavoritePageRowPage } from "@/features/favorite/components/favorite-page-row.tsx";
import classes from "@/features/favorite/components/favorites-sidebar-section.module.css";

type FavoritePageMenuProps = {
  page: FavoritePageRowPage;
  spaceId: string;
  /**
   * The row's own space slug. Favorites can point at another space (workspace
   * sidebar) or be rendered outside a space route (/home), so the menu must
   * never fall back to the route params the way the tree menu does.
   */
  spaceSlug: string;
  canEdit: boolean;
  /** The row line. Right-clicking it opens this menu at the cursor. */
  children: ReactNode;
};

/** The `...` trigger. Drop it inside the row line passed to FavoritePageMenu. */
export function FavoriteMenuButton({ title }: { title: string }) {
  const { t } = useTranslation();

  return (
    <Menu.Target>
      <ActionIcon
        variant="subtle"
        color="gray"
        className={classes.rowActionIcon}
        aria-label={t("Page menu for {{name}}", { name: title })}
        aria-haspopup="menu"
        tabIndex={-1}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <IconDots style={{ width: rem(20), height: rem(20) }} stroke={2} />
      </ActionIcon>
    </Menu.Target>
  );
}

/**
 * Per-row menu for the sidebar favorites section: the same page actions the
 * space tree offers (sort excluded), with links and modals resolved against
 * the row's own space instead of the current route.
 */
export default function FavoritePageMenu({
  page,
  spaceId,
  spaceSlug,
  canEdit,
  children,
}: FavoritePageMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pageSlug } = useParams();
  const queryClient = useQueryClient();
  const clipboard = useClipboard({ timeout: 500 });
  const { openDeleteModal } = useDeletePageModal();
  const { handleDelete } = useTreeMutation(spaceId, { spaceSlug });
  const [, setData] = useAtom(treeDataAtom);
  const store = useStore();
  const emit = useQueryEmit();
  const favoriteIds = useFavoriteIds("page", spaceId);
  const addFavorite = useAddFavoriteMutation();
  const removeFavorite = useRemoveFavoriteMutation();
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [
    movePageModalOpened,
    { open: openMovePageModal, close: closeMoveSpaceModal },
  ] = useDisclosure(false);
  const [
    copyPageModalOpened,
    { open: openCopyPageModal, close: closeCopySpaceModal },
  ] = useDisclosure(false);

  const title = getPageTitle(page.title, page.isBase, t);
  const isFavorited = favoriteIds.has(page.id);

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, page.slugId, page.title);
    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  const handleDuplicatePage = async () => {
    try {
      const duplicatedPage = await duplicatePage({ pageId: page.id });

      // Mirror the tree's duplicate, but only when the source is already
      // loaded in the Pages tree: treeModel.insert with an unknown parent
      // would drop the copy at the root, and broadcasting that would be worse
      // than waiting for the tree's next refetch.
      const siblings = treeModel.siblingsOf(
        spaceRoots(store.get(treeDataAtom), spaceId),
        page.id,
      );

      if (siblings) {
        const parentId = siblings.parentId ?? null;
        const index = siblings.index + 1;
        const treeNodeData: SpaceTreeNode = {
          id: duplicatedPage.id,
          slugId: duplicatedPage.slugId,
          name: duplicatedPage.title,
          position: duplicatedPage.position,
          spaceId: duplicatedPage.spaceId,
          parentPageId: duplicatedPage.parentPageId,
          icon: duplicatedPage.icon,
          hasChildren: duplicatedPage.hasChildren,
          canEdit: true,
          children: [],
        };

        setData((prev) =>
          updateSpaceRoots(prev, spaceId, (roots) =>
            treeModel.insert(roots, parentId, treeNodeData, index),
          ),
        );

        setTimeout(() => {
          emit({
            operation: "addTreeNode",
            spaceId,
            payload: { parentId, index, data: treeNodeData },
          });
        }, 50);
      }

      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      notifications.show({ message: t("Page duplicated successfully") });
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message || "An error occurred",
        color: "red",
      });
    }
  };

  const handleDeletePage = async () => {
    await handleDelete(page.id);
    queryClient.invalidateQueries({ queryKey: ["favorites"] });

    // handleDelete only redirects when the page sits in the loaded tree; a
    // favorite can be the open page without being in the tree.
    if (pageSlug && extractPageSlugId(pageSlug) === page.slugId) {
      navigate(getSpaceUrl(spaceSlug));
    }
  };

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.ContextMenu>{children}</Menu.ContextMenu>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconLink size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyLink();
            }}
          >
            {t("Copy link")}
          </Menu.Item>

          <Menu.Item
            leftSection={
              isFavorited ? <IconStarFilled size={16} /> : <IconStar size={16} />
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isFavorited) {
                removeFavorite.mutate({ type: "page", pageId: page.id });
              } else {
                addFavorite.mutate({ type: "page", pageId: page.id });
              }
            }}
          >
            {isFavorited ? t("Remove from favorites") : t("Add to favorites")}
          </Menu.Item>

          <Menu.Divider />

          {canEdit && (
            <>
              <Menu.Item
                leftSection={<IconCopy size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDuplicatePage();
                }}
              >
                {t("Duplicate")}
              </Menu.Item>

              <Menu.Item
                leftSection={<IconArrowRight size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openMovePageModal();
                }}
              >
                {t("Move")}
              </Menu.Item>

              <Menu.Item
                leftSection={<IconCopy size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openCopyPageModal();
                }}
              >
                {t("Copy to space")}
              </Menu.Item>

              <Menu.Divider />
            </>
          )}

          <Menu.Item
            leftSection={<IconFileExport size={16} />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openExportModal();
            }}
          >
            {t("Export page")}
          </Menu.Item>

          {canEdit && (
            <>
              <Menu.Divider />
              <Menu.Item
                c="red"
                leftSection={<IconTrash size={16} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDeleteModal({
                    onConfirm: () => handleDeletePage(),
                  });
                }}
              >
                {t("Move to trash")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <MovePageModal
        pageId={page.id}
        slugId={page.slugId}
        currentSpaceSlug={spaceSlug}
        onClose={closeMoveSpaceModal}
        open={movePageModalOpened}
      />

      <CopyPageModal
        pageId={page.id}
        currentSpaceSlug={spaceSlug}
        onClose={closeCopySpaceModal}
        open={copyPageModalOpened}
      />

      <ExportModal
        type="page"
        id={page.id}
        open={exportOpened}
        onClose={closeExportModal}
      />
    </>
  );
}
