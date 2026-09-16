import React from "react";
import { Box, Popover } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import {
  PageMenuList,
  useFlyout,
} from "@/features/page/components/breadcrumbs/page-menu-list.tsx";
import breadcrumbClasses from "@/features/page/components/breadcrumbs/breadcrumb.module.css";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom.ts";
import { findAncestorTrail } from "@/features/public-space/utils/docs-tree.ts";
import type { SharedPageTreeNode } from "@/features/share/utils.ts";

interface ShareBreadcrumbItemMenuProps {
  node: SharedPageTreeNode;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

/** Thin wrapper around the workspace breadcrumb flyout: same Popover timing
 * and menu rendering, fed from the in-memory share tree with share URLs. */
export default function ShareBreadcrumbItemMenu({
  node,
  children,
}: ShareBreadcrumbItemMenuProps) {
  const { shareId } = useParams();
  const treeData = useAtomValue(sharedTreeDataAtom);
  const flyout = useFlyout(200, 150);

  // Siblings of the crumb: the parent's children, or the share roots.
  const trail = treeData ? findAncestorTrail(treeData, node.slugId) : null;
  const parent = trail && trail.length > 0 ? trail[trail.length - 1] : null;
  const siblings = parent ? (parent.children ?? []) : (treeData ?? []);

  const urlBuilder = React.useCallback(
    (n: SharedPageTreeNode) =>
      buildSharedPageUrl({
        shareId: shareId ?? "",
        pageSlugId: n.slugId,
        pageTitle: n.name,
      }),
    [shareId],
  );
  const childrenOf = React.useCallback(
    (n: SharedPageTreeNode) => n.children ?? [],
    [],
  );

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
        {React.cloneElement(children, {
          onMouseEnter: flyout.requestOpen,
          onMouseLeave: flyout.requestClose,
        })}
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        onMouseEnter={flyout.requestOpen}
        onMouseLeave={flyout.requestClose}
      >
        <Box className={breadcrumbClasses.menuDropdown}>
          <PageMenuList
            nodes={siblings}
            currentNodeId={node.slugId}
            onNavigate={flyout.closeNow}
            urlBuilder={urlBuilder}
            childrenOf={childrenOf}
          />
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
