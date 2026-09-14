import { useAtomValue } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import React from "react";
import { findBreadcrumbPath, spaceRoots } from "@/features/page/tree/utils";
import { Box, Popover } from "@mantine/core";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import classes from "./breadcrumb.module.css";
import { PageMenuList, useFlyout, useNodeChildren } from "./page-menu-list.tsx";

interface BreadcrumbItemMenuProps {
  node: SpaceTreeNode;
  children: React.ReactNode;
}

export default function BreadcrumbItemMenu({
  node,
  children,
}: BreadcrumbItemMenuProps) {
  const treeData = useAtomValue(treeDataAtom);
  const flyout = useFlyout(200, 150);

  const path =
    treeData?.length > 0 ? findBreadcrumbPath(treeData, node.id) : null;
  const parent = path && path.length > 1 ? path[path.length - 2] : null;
  const currentNodeId = path ? path[path.length - 1].id : null;
  const needsFetch =
    !!parent && parent.hasChildren && (parent.children?.length ?? 0) === 0;

  const { children: fetchedChildren, isFetching } = useNodeChildren(
    parent,
    flyout.opened && needsFetch,
  );

  let siblings: SpaceTreeNode[] = [];
  if (path) {
    if (parent) {
      siblings = parent.children?.length ? parent.children : fetchedChildren;
    } else {
      siblings = spaceRoots(treeData, node.spaceId);
    }
  }

  return (
    <Popover
      opened={flyout.opened}
      position="bottom-start"
      offset={4}
      shadow="xl"
      radius="md"
      withinPortal={false}
      floatingStrategy="fixed"
    >
      <Popover.Target>
        {React.cloneElement(
          children as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
          {
            onMouseEnter: flyout.requestOpen,
            onMouseLeave: flyout.requestClose,
          },
        )}
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        onMouseEnter={flyout.requestOpen}
        onMouseLeave={flyout.requestClose}
      >
        <Box className={classes.menuDropdown}>
          <PageMenuList
            nodes={siblings}
            currentNodeId={currentNodeId}
            onNavigate={flyout.closeNow}
          />
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
