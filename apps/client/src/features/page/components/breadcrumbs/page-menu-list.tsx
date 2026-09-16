import { useAtomValue } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import React, { useRef, useState } from "react";
import { buildTree } from "@/features/page/tree/utils";
import { Box, Loader, Popover, Text, UnstyledButton } from "@mantine/core";
import {
  IconCheck,
  IconChevronRight,
  IconFileDescription,
} from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils.ts";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import { useTranslation } from "react-i18next";
import classes from "./breadcrumb.module.css";

export function useFlyout(openDelay: number, closeDelay: number) {
  const [opened, setOpened] = useState(false);
  const openTimeout = useRef(-1);
  const closeTimeout = useRef(-1);

  const clearAll = () => {
    window.clearTimeout(openTimeout.current);
    window.clearTimeout(closeTimeout.current);
  };

  const requestOpen = () => {
    clearAll();
    openTimeout.current = window.setTimeout(() => setOpened(true), openDelay);
  };

  const requestClose = () => {
    clearAll();
    closeTimeout.current = window.setTimeout(
      () => setOpened(false),
      closeDelay,
    );
  };

  const closeNow = () => {
    clearAll();
    setOpened(false);
  };

  return { opened, requestOpen, requestClose, closeNow };
}

export function useNodeChildren(
  node: SpaceTreeNode | null,
  fetchEnabled: boolean,
) {
  const treeData = useAtomValue(treeDataAtom);
  const { data, isFetching } = useGetSidebarPagesQuery(
    fetchEnabled && node ? { pageId: node.id, spaceId: node.spaceId } : null,
  );

  const treeNode =
    treeData?.length && node ? treeModel.find(treeData, node.id) : null;
  if (treeNode?.children?.length) {
    return { children: treeNode.children, isFetching: false };
  }
  if (data) {
    return {
      children: buildTree(data.pages.flatMap((page) => page.items)),
      isFetching,
    };
  }
  return { children: [] as SpaceTreeNode[], isFetching };
}

// Minimal node shape satisfied by both the workspace tree nodes and the
// public share tree nodes, so callers can reuse the menu with their own
// data source and URL scheme.
export type MenuNode = {
  id: string;
  slugId: string;
  name: string;
  icon?: string | null;
  isBase?: boolean;
  hasChildren?: boolean;
  children?: MenuNode[];
};

interface PageMenuListProps<T extends MenuNode> {
  nodes: T[];
  currentNodeId: string | null;
  onNavigate: () => void;
  /** Link builder override (e.g. share URLs); defaults to workspace URLs. */
  urlBuilder?: (node: T) => string;
  /** In-memory children resolver (e.g. the share tree); when set the
   * workspace sidebar fetch is never triggered. */
  childrenOf?: (node: T) => T[];
}

export function PageMenuList<T extends MenuNode>({
  nodes,
  currentNodeId,
  onNavigate,
  urlBuilder,
  childrenOf,
}: PageMenuListProps<T>) {
  const { t } = useTranslation();

  if (nodes.length === 0) {
    return (
      <Text fz="sm" c="dimmed" ta="center" my="xs">
        {t("No pages inside")}
      </Text>
    );
  }

  return (
    <>
      {nodes.map((node) => (
        <PageMenuRow
          key={node.id}
          node={node}
          currentNodeId={currentNodeId}
          onNavigate={onNavigate}
          urlBuilder={urlBuilder}
          childrenOf={childrenOf}
        />
      ))}
    </>
  );
}

interface PageMenuRowProps<T extends MenuNode> {
  node: T;
  currentNodeId: string | null;
  onNavigate: () => void;
  urlBuilder?: (node: T) => string;
  childrenOf?: (node: T) => T[];
}

function PageMenuRow<T extends MenuNode>({
  node,
  currentNodeId,
  onNavigate,
  urlBuilder,
  childrenOf,
}: PageMenuRowProps<T>) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const hasChildren = !!node.hasChildren;
  const isCurrent = node.id === currentNodeId;
  const flyout = useFlyout(150, 300);
  // Injected resolvers read the caller's in-memory tree; the node is nulled
  // out so the workspace sidebar fetch stays disabled.
  const { children: fetchedChildren, isFetching } = useNodeChildren(
    childrenOf ? null : (node as unknown as SpaceTreeNode),
    flyout.opened,
  );
  const children = (childrenOf ? childrenOf(node) : fetchedChildren) as T[];

  const rowButton = (
    <UnstyledButton
      component={Link}
      to={
        urlBuilder
          ? urlBuilder(node)
          : buildPageUrl(spaceSlug, node.slugId, node.name)
      }
      onClick={onNavigate}
      className={classes.menuItem}
      data-active={isCurrent || undefined}
      data-subopen={flyout.opened || undefined}
      onMouseEnter={hasChildren ? flyout.requestOpen : undefined}
      onMouseLeave={hasChildren ? flyout.requestClose : undefined}
    >
      {node.icon ? (
        <Text className={classes.menuItemIconText}>{node.icon}</Text>
      ) : (
        <IconFileDescription
          size={18}
          stroke={1.5}
          className={classes.menuItemIcon}
        />
      )}
      <Text fz="sm" className={classes.menuItemLabel}>
        {getPageTitle(node.name, node.isBase, t)}
      </Text>
      {isCurrent ? (
        <IconCheck size={16} stroke={2} className={classes.menuItemCheck} />
      ) : hasChildren ? (
        <IconChevronRight
          size={14}
          stroke={2}
          className={classes.menuItemChevron}
        />
      ) : null}
    </UnstyledButton>
  );

  if (!hasChildren) {
    return rowButton;
  }

  return (
    <Popover
      opened={flyout.opened}
      position="right-start"
      offset={2}
      shadow="xl"
      radius="md"
      withinPortal={false}
      floatingStrategy="fixed"
    >
      <Popover.Target>{rowButton}</Popover.Target>
      <Popover.Dropdown
        p={0}
        onMouseEnter={flyout.requestOpen}
        onMouseLeave={flyout.requestClose}
      >
        <Box className={classes.menuDropdown}>
          {children.length > 0 ? (
            <PageMenuList
              nodes={children}
              currentNodeId={currentNodeId}
              onNavigate={onNavigate}
              urlBuilder={urlBuilder}
              childrenOf={childrenOf}
            />
          ) : isFetching ? (
            <Loader size="xs" mx="auto" my="sm" />
          ) : (
            <Text fz="sm" c="dimmed" ta="center" my="xs">
              {t("No pages inside")}
            </Text>
          )}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
