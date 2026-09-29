import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ActionIcon, Menu, rem } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowRight,
  IconArrowsSort,
  IconCopy,
  IconDots,
  IconFileExport,
  IconLink,
  IconStar,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";

import ExportModal from "@/components/common/export-modal";
import CopyPageModal from "@/features/page/components/copy-page-modal.tsx";
import { DestinationPickerModal } from "@/components/ui/destination-picker/destination-picker-modal.tsx";
import type { DestinationSelection } from "@/components/ui/destination-picker/destination-picker.types.ts";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { useMovePageToSpace } from "@/features/page/hooks/use-move-page-to-space.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { getPageTitle } from "@/features/page/page.utils";
import { duplicatePage } from "@/features/page/services/page-service.ts";
import { useClipboard } from "@/hooks/use-clipboard";
import { getAppUrl } from "@/lib/config.ts";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import {
  useFavoriteIds,
  useAddFavoriteMutation,
  useRemoveFavoriteMutation,
} from "@/features/favorite/queries/favorite-query";

import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import {
  spaceRoots,
  updateSpaceRoots,
} from "@/features/page/tree/utils/utils.ts";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import { SortChildrenBy } from "@/features/page/types/page.types.ts";
import type { IPage } from "@/features/page/types/page.types.ts";
import type { ISpace } from "@/features/space/types/space.types.ts";
import type { SpaceTreeNode } from "@/features/page/tree/types.ts";
import classes from "@/features/page/tree/styles/tree.module.css";

export interface NodeMenuProps {
  node: SpaceTreeNode;
  canEdit: boolean;
}

export function NodeMenu({ node, canEdit }: NodeMenuProps) {
  const { t } = useTranslation();
  const clipboard = useClipboard({ timeout: 500 });
  const { spaceSlug } = useParams();
  const { openDeleteModal } = useDeletePageModal();
  const { handleDelete, handleSortChildren, handleMoveToPage } =
    useTreeMutation(node.spaceId);
  const [data, setData] = useAtom(treeDataAtom);
  const emit = useQueryEmit();
  const movePageToSpace = useMovePageToSpace();
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);
  const [
    moveToOpened,
    { open: openMoveToPicker, close: closeMoveToPicker },
  ] = useDisclosure(false);
  const [
    copyPageModalOpened,
    { open: openCopyPageModal, close: closeCopySpaceModal },
  ] = useDisclosure(false);
  const favoriteIds = useFavoriteIds("page", node.spaceId);
  const addFavorite = useAddFavoriteMutation();
  const removeFavorite = useRemoveFavoriteMutation();
  const isFavorited = favoriteIds.has(node.id);

  const descendantIds = useMemo(() => {
    const ids = new Set<string>();
    const source = treeModel.find(data, node.id);
    const walk = (nodes: SpaceTreeNode[]) => {
      for (const child of nodes) {
        ids.add(child.id);
        walk(child.children ?? []);
      }
    };
    walk(source?.children ?? []);
    return ids;
  }, [data, node.id]);

  const isPageDisabled = useCallback(
    (page: Partial<IPage>) => {
      const pageSpaceId = page.spaceId ?? page.space?.id;
      if (pageSpaceId !== node.spaceId) return true;
      return page.id != null && descendantIds.has(page.id);
    },
    [node.spaceId, descendantIds],
  );

  const isSpaceDisabled = useCallback(
    (space: ISpace) => space.id === node.spaceId,
    [node.spaceId],
  );

  const handleSelectDestination = async (selection: DestinationSelection) => {
    closeMoveToPicker();
    if (selection.type === "space") {
      await movePageToSpace(node.id, node.slugId, selection.space);
      return;
    }
    if (selection.spaceId !== node.spaceId) return;
    await handleMoveToPage(node.id, selection.pageId);
  };

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, node.slugId, node.name);
    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  const handleDuplicatePage = async () => {
    try {
      const duplicatedPage = await duplicatePage({ pageId: node.id });

      // figure out parent + insertion index
      const siblings = treeModel.siblingsOf(
        spaceRoots(data, node.spaceId),
        node.id,
      );
      const parentId = siblings?.parentId ?? null;
      const currentIndex = siblings?.index ?? 0;
      const newIndex = currentIndex + 1;

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
        updateSpaceRoots(prev, node.spaceId, (roots) =>
          treeModel.insert(roots, parentId, treeNodeData, newIndex),
        ),
      );

      setTimeout(() => {
        emit({
          operation: "addTreeNode",
          spaceId: node.spaceId,
          payload: {
            parentId,
            index: newIndex,
            data: treeNodeData,
          },
        });
      }, 50);

      notifications.show({ message: t("Page duplicated successfully") });
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message || "An error occurred",
        color: "red",
      });
    }
  };

  return (
    <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            className={classes.actionIcon}
            aria-label={t("Page menu for {{name}}", { name: getPageTitle(node.name, node.isBase, t) })}
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <IconDots
              style={{ width: rem(20), height: rem(20) }}
              stroke={2}
            />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          {canEdit && (
            <>
              <Menu.Sub floatingStrategy="fixed">
                <Menu.Sub.Target>
                  <Menu.Sub.Item leftSection={<IconArrowsSort size={16} />}>
                    {t("Sort")}
                  </Menu.Sub.Item>
                </Menu.Sub.Target>

                <Menu.Sub.Dropdown>
                  <Menu.Item
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSortChildren(node.id, SortChildrenBy.Manual);
                    }}
                  >
                    {t("Manual")}
                  </Menu.Item>

                  <Menu.Item
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSortChildren(node.id, SortChildrenBy.UpdatedAtDesc);
                    }}
                  >
                    {t("Last updated")}
                  </Menu.Item>
                </Menu.Sub.Dropdown>
              </Menu.Sub>

              <Menu.Divider />
            </>
          )}

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
                removeFavorite.mutate({ type: "page", pageId: node.id });
              } else {
                addFavorite.mutate({ type: "page", pageId: node.id });
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
                  openMoveToPicker();
                }}
              >
                {t("Move to")}
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
                    onConfirm: () => handleDelete(node.id),
                  });
                }}
              >
                {t("Move to trash")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <DestinationPickerModal
        opened={moveToOpened}
        onClose={closeMoveToPicker}
        title={t("Move to")}
        actionLabel={t("Move")}
        excludePageId={node.id}
        isPageDisabled={isPageDisabled}
        isSpaceDisabled={isSpaceDisabled}
        onSelect={handleSelectDestination}
      />

      <CopyPageModal
        pageId={node.id}
        currentSpaceSlug={spaceSlug}
        onClose={closeCopySpaceModal}
        open={copyPageModalOpened}
      />

      <ExportModal
        type="page"
        id={node.id}
        open={exportOpened}
        onClose={closeExportModal}
      />
    </>
  );
}
