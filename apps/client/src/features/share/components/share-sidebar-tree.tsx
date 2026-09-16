import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { ActionIcon } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconFileDescription,
  IconPointFilled,
} from "@tabler/icons-react";
import { extractPageSlugId } from "@/lib";
import {
  DocTree,
  type DocTreeApi,
  type RenderRowProps,
} from "@/features/page/tree/components/doc-tree";
import treeClasses from "@/features/page/tree/styles/tree.module.css";
import {
  sharedOpenTreeNodesAtom,
  sharedTreeDataAtom,
} from "@/features/share/atoms/shared-page-atom.ts";
import { findAncestorTrail } from "@/features/public-space/utils/docs-tree.ts";
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import type { SharedPageTreeNode } from "@/features/share/utils.ts";

export default function ShareSidebarTree() {
  const { t } = useTranslation();
  const treeRef = useRef<DocTreeApi | null>(null);
  const { shareId, pageSlug } = useParams();
  const treeData = useAtomValue(sharedTreeDataAtom);
  const [openTreeNodes, setOpenTreeNodes] = useAtom(sharedOpenTreeNodesAtom);
  const setMobileSidebarOpen = useSetAtom(mobileSidebarAtom);

  // The first root page is the share home, served at the bare URL.
  const firstRootSlugId = treeData?.[0]?.slugId;
  const currentNodeSlugId = pageSlug
    ? extractPageSlugId(pageSlug)
    : firstRootSlugId;

  const openIds = useMemo(
    () => new Set(Object.keys(openTreeNodes).filter((k) => openTreeNodes[k])),
    [openTreeNodes],
  );

  useEffect(() => {
    // Auto-open the first level of the tree on initial load.
    const root = treeData?.[0];
    if (!root) return;
    setOpenTreeNodes((prev) => {
      if (prev[root.slugId]) return prev;
      const next = { ...prev, [root.slugId]: true };
      for (const child of root.children ?? []) {
        next[child.slugId] = true;
      }
      return next;
    });
  }, [treeData, setOpenTreeNodes]);

  useEffect(() => {
    // Reveal the current page: expand its ancestor trail so deep links never
    // land with everything collapsed.
    if (!currentNodeSlugId || !treeData?.length) return;
    const trail = findAncestorTrail(treeData, currentNodeSlugId);
    if (trail === null) return;
    setOpenTreeNodes((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const node of [...trail.map((n) => n.slugId), currentNodeSlugId]) {
        if (!next[node]) {
          next[node] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentNodeSlugId, treeData, setOpenTreeNodes]);

  useEffect(() => {
    if (currentNodeSlugId) {
      treeRef.current?.select(currentNodeSlugId, { scrollIntoView: true });
    }
  }, [currentNodeSlugId, treeData]);

  const getNodeUrl = useCallback(
    (node: Pick<SharedPageTreeNode, "slugId" | "name">) =>
      buildSharedPageUrl({
        shareId: shareId ?? "",
        pageSlugId: node.slugId,
        pageTitle: node.name,
      }),
    [shareId],
  );

  const handleToggle = useCallback(
    (id: string, isOpen: boolean) =>
      setOpenTreeNodes((prev) => ({ ...prev, [id]: isOpen })),
    [setOpenTreeNodes],
  );

  const getDragLabel = useCallback(
    (node: SharedPageTreeNode) => node.name || "untitled",
    [],
  );

  const renderRow = useCallback(
    (props: RenderRowProps<SharedPageTreeNode>) => (
      <ShareTreeRow {...props} getNodeUrl={getNodeUrl} />
    ),
    [getNodeUrl],
  );

  if (!treeData?.length) {
    return null;
  }

  return (
    <div className={treeClasses.treeContainer}>
      <DocTree<SharedPageTreeNode>
        readOnly
        ref={treeRef}
        data={treeData}
        openIds={openIds}
        selectedId={currentNodeSlugId}
        renderRow={renderRow}
        onMove={noopMove}
        onToggle={handleToggle}
        getDragLabel={getDragLabel}
        aria-label={t("Pages")}
      />
    </div>
  );
}

// Module-scope noop so it's a stable reference across renders.
const noopMove = () => {};

type ShareTreeRowProps = RenderRowProps<SharedPageTreeNode> & {
  getNodeUrl: (node: Pick<SharedPageTreeNode, "slugId" | "name">) => string;
};

function ShareTreeRow({
  node,
  isOpen,
  hasChildren,
  isSelected,
  rowRef,
  tabIndex,
  treeItemProps,
  toggleOpen,
  getNodeUrl,
}: ShareTreeRowProps) {
  const { t } = useTranslation();
  const setMobileSidebarOpen = useSetAtom(mobileSidebarAtom);

  return (
    <Link
      ref={rowRef as React.Ref<HTMLAnchorElement>}
      to={getNodeUrl(node)}
      tabIndex={tabIndex}
      {...treeItemProps}
      data-selected={isSelected || undefined}
      className={treeClasses.node}
      onClick={() => {
        setMobileSidebarOpen(false);
      }}
    >
      <PageArrow
        isOpen={isOpen}
        hasChildren={hasChildren}
        onToggle={toggleOpen}
      />

      <span className={treeClasses.icon} aria-hidden>
        {node.icon ? (
          node.icon
        ) : (
          <IconFileDescription size={18} stroke={1.75} />
        )}
      </span>

      <span className={treeClasses.text}>{node.name || t("untitled")}</span>
    </Link>
  );
}

interface PageArrowProps {
  isOpen: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}

function PageArrow({ isOpen, hasChildren, onToggle }: PageArrowProps) {
  const { t } = useTranslation();

  if (!hasChildren) {
    return (
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconPointFilled size={8} />
      </span>
    );
  }

  return (
    <ActionIcon
      size={20}
      variant="subtle"
      color="gray"
      className={treeClasses.actionIcon}
      aria-label={isOpen ? t("Collapse") : t("Expand")}
      aria-expanded={isOpen}
      tabIndex={-1}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {isOpen ? (
        <IconChevronDown stroke={2} size={18} />
      ) : (
        <IconChevronRight stroke={2} size={18} />
      )}
    </ActionIcon>
  );
}
