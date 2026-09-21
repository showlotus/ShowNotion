import { Fragment, ReactNode, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import {
  ActionIcon,
  Anchor,
  Breadcrumbs,
  Button,
  Popover,
  Tooltip,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconCornerDownRightDouble, IconDots } from "@tabler/icons-react";
import { extractPageSlugId } from "@/lib";
import { HoverScrollText } from "@/components/ui/hover-scroll-text.tsx";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom.ts";
import { findAncestorTrail } from "@/features/public-space/utils/docs-tree.ts";
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import type { SharedPageTreeNode } from "@/features/share/utils.ts";
// Workspace breadcrumb pills/menus: same classes, so the share breadcrumb
// reads (and behaves) exactly like the editor page's.
import breadcrumbClasses from "@/features/page/components/breadcrumbs/breadcrumb.module.css";
import ShareBreadcrumbItemMenu from "@/features/share/components/share-breadcrumb-item-menu.tsx";

type Crumb = {
  node: SharedPageTreeNode;
  label: string;
  url: string;
};

function crumbLabel(node: SharedPageTreeNode, untitled: string) {
  const name = node.name || untitled;
  return node.icon ? `${node.icon} ${name}` : name;
}

function CrumbPill({
  crumb,
  isCurrent,
}: {
  crumb: Crumb;
  isCurrent?: boolean;
}) {
  return (
    <ShareBreadcrumbItemMenu node={crumb.node}>
      {/* Same anchor props as the workspace breadcrumb (renderAnchor): 14px,
          no underline, single-line ellipsis. */}
      <Anchor
        component={Link}
        to={crumb.url}
        underline="never"
        fz="sm"
        lh={1.2}
        className={`${breadcrumbClasses.breadcrumbLink} ${breadcrumbClasses.truncatedText}`}
        aria-current={isCurrent ? "page" : undefined}
      >
        {crumb.label}
      </Anchor>
    </ShareBreadcrumbItemMenu>
  );
}

function HiddenCrumbList({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      {crumbs.map((crumb) => (
        <Button.Group orientation="vertical" key={crumb.node.slugId}>
          <Button
            justify="start"
            component={Link}
            to={crumb.url}
            variant="default"
            style={{ border: "none" }}
            data-hover-scroll
          >
            <HoverScrollText fz="sm" className={breadcrumbClasses.truncatedText}>
              {crumb.label}
            </HoverScrollText>
          </Button>
        </Button.Group>
      ))}
    </>
  );
}

export default function ShareBreadcrumb() {
  const { t } = useTranslation();
  const { shareId, pageSlug } = useParams();
  const treeData = useAtomValue(sharedTreeDataAtom);
  const isMobile = useMediaQuery("(max-width: 48em)");

  const crumbs = useMemo<Crumb[] | null>(() => {
    if (!treeData?.length) return null;

    const currentSlugId = pageSlug
      ? extractPageSlugId(pageSlug)
      : treeData[0]?.slugId;
    if (!currentSlugId) return null;

    // Workspace breadcrumb parity: the full path including the current page.
    const trail = findAncestorTrail(treeData, currentSlugId);
    if (trail === null) return null;
    const currentNode = findNodeBySlugId(treeData, currentSlugId);
    const path = currentNode ? [...trail, currentNode] : trail;
    if (!path.length) return null;

    return path.map((node: SharedPageTreeNode) => ({
      node,
      label: crumbLabel(node, t("untitled")),
      url: buildSharedPageUrl({
        shareId: shareId ?? "",
        pageSlugId: node.slugId,
        pageTitle: node.name,
      }),
    }));
  }, [treeData, pageSlug, shareId, t]);

  if (!crumbs?.length) return null;

  const items = buildBreadcrumbItems({
    crumbs,
    isMobile,
    hiddenLabel: t("Show hidden pages"),
    breadcrumbsLabel: t("Breadcrumbs"),
  });

  return (
    <nav
      aria-label={t("Breadcrumb")}
      className={breadcrumbClasses.breadcrumbDiv}
    >
      <Breadcrumbs
        className={breadcrumbClasses.breadcrumbs}
        separatorMargin={2}
      >
        {items}
      </Breadcrumbs>
    </nav>
  );
}

type BreadcrumbItemsArgs = {
  crumbs: Crumb[];
  isMobile: boolean;
  hiddenLabel: string;
  breadcrumbsLabel: string;
};

function buildBreadcrumbItems({
  crumbs,
  isMobile,
  hiddenLabel,
  breadcrumbsLabel,
}: BreadcrumbItemsArgs): ReactNode {
  const popoverProps = {
    width: 250,
    position: "bottom" as const,
    withArrow: true,
    shadow: "xl",
    floatingStrategy: "fixed" as const,
  };

  // Mobile keeps a single icon that lists the whole trail, like the app header.
  if (isMobile) {
    return (
      <Popover {...popoverProps} key="mobile-hidden-nodes">
        <Popover.Target>
          <Tooltip label={breadcrumbsLabel} withArrow openDelay={250}>
            <ActionIcon
              color="gray"
              variant="transparent"
              aria-label={breadcrumbsLabel}
            >
              <IconCornerDownRightDouble size={20} stroke={2} />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown className={breadcrumbClasses.menuDropdown}>
          <HiddenCrumbList crumbs={crumbs} />
        </Popover.Dropdown>
      </Popover>
    );
  }

  // Desktop collapses long trails to [first, dots, last], like the app header.
  if (crumbs.length > 3) {
    const hidden = crumbs.slice(1, -1);
    return (
      <Fragment key="collapsed-nodes">
        <CrumbPill crumb={crumbs[0]} />
        <Popover {...popoverProps}>
          <Popover.Target>
            <ActionIcon
              color="gray"
              variant="transparent"
              aria-label={hiddenLabel}
            >
              <IconDots size={20} stroke={2} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown className={breadcrumbClasses.menuDropdown}>
            <HiddenCrumbList crumbs={hidden} />
          </Popover.Dropdown>
        </Popover>
        <CrumbPill crumb={crumbs[crumbs.length - 1]} isCurrent />
      </Fragment>
    );
  }

  return crumbs.map((crumb, i) => (
    <CrumbPill
      key={crumb.node.slugId}
      crumb={crumb}
      isCurrent={i === crumbs.length - 1}
    />
  ));
}

function findNodeBySlugId(
  nodes: SharedPageTreeNode[],
  slugId: string,
): SharedPageTreeNode | null {
  for (const node of nodes) {
    if (node.slugId === slugId) return node;
    if (node.children?.length) {
      const found = findNodeBySlugId(node.children, slugId);
      if (found) return found;
    }
  }
  return null;
}
