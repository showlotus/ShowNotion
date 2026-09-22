import type { CSSProperties, MouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { ActionIcon, rem, UnstyledButton } from "@mantine/core";
import {
  IconChevronRight,
  IconPlus,
  IconPointFilled,
} from "@tabler/icons-react";
import clsx from "clsx";

import EmojiPicker from "@/components/ui/emoji-picker";
import { PageListIcon } from "@/components/common/page-list-icon";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import {
  useGetSidebarPagesQuery,
  useUpdatePageMutation,
} from "@/features/page/queries/page-query";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation";
import { updateTreeNodeIcon } from "@/features/page/tree/utils/utils";
import { useQueryEmit } from "@/features/websocket/use-query-emit";
import { favoritesExpandedAtom } from "@/features/favorite/atoms/favorites-expanded-atom";
import { useSpaceQuery } from "@/features/space/queries/space-query";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";
import { extractPageSlugId } from "@/lib";
import FavoritePageMenu, {
  FavoriteMenuButton,
} from "./favorite-page-menu";
import classes from "./favorites-sidebar-section.module.css";

export type FavoritePageRowPage = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  isBase: boolean;
  hasChildren?: boolean;
  /**
   * Per-page permission, only present on rows loaded from the sidebar-pages
   * endpoint (nested children). Top-level favorites fall back to the space
   * ability.
   */
  canEdit?: boolean;
};

type FavoritePageRowProps = {
  page: FavoritePageRowPage;
  spaceId: string;
  spaceSlug: string;
  depth?: number;
  onNavigate?: () => void;
};

export default function FavoritePageRow({
  page,
  spaceId,
  spaceSlug,
  depth = 0,
  onNavigate,
}: FavoritePageRowProps) {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useAtom(favoritesExpandedAtom);
  const [, setTreeData] = useAtom(treeDataAtom);
  const emit = useQueryEmit();
  const updatePageMutation = useUpdatePageMutation();
  const { handleCreate } = useTreeMutation(spaceId, { spaceSlug });

  // Space ability is cached (the space sidebar already holds it), so this
  // costs nothing there; on /home it is one request per distinct space.
  const { data: rowSpace } = useSpaceQuery(spaceId);
  const spaceAbility = useSpaceAbility(rowSpace?.membership?.permissions);
  const canEdit =
    page.canEdit ??
    spaceAbility.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);

  const expanded = expandedIds.includes(page.id);
  const hasChildren = Boolean(page.hasChildren);

  // Children load on demand, one level per expansion (same endpoint the space
  // tree uses, cached per { spaceId, pageId }).
  const { data } = useGetSidebarPagesQuery(
    expanded ? { spaceId, pageId: page.id } : null,
  );
  const children = data?.pages.flatMap((result) => result.items) ?? [];

  const title = getPageTitle(page.title, page.isBase, t);
  const isActive =
    Boolean(pageSlug) && extractPageSlugId(pageSlug) === page.slugId;

  const handleToggle = () => {
    setExpandedIds(
      expanded
        ? expandedIds.filter((id) => id !== page.id)
        : [...expandedIds, page.id],
    );
  };

  const handleCreateChild = async () => {
    // Expand first so the new subpage shows up nested right away.
    if (!expanded) {
      setExpandedIds([...expandedIds, page.id]);
    }

    try {
      await handleCreate(page.id);
    } catch {
      return; // useCreatePageMutation already surfaced the failure
    }

    // The row's chevron depends on hasChildren, which comes from this list.
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  };

  const handleUpdateIcon = (icon: string | null) => {
    // Keep the Pages tree in sync locally, then persist and broadcast (same
    // flow the tree row uses when an emoji is picked).
    setTreeData((prev) => updateTreeNodeIcon(prev, page.id, icon));

    updatePageMutation
      .mutateAsync({ pageId: page.id, icon })
      .then((updated) => {
        queryClient.invalidateQueries({ queryKey: ["favorites"] });
        setTimeout(() => {
          emit({
            operation: "updateOne",
            spaceId,
            entity: ["pages"],
            id: page.id,
            payload: { icon, parentPageId: updated.parentPageId },
          });
        }, 50);
      });
  };

  const handleIconClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div>
      <FavoritePageMenu
        page={page}
        spaceId={spaceId}
        spaceSlug={spaceSlug}
        canEdit={canEdit}
      >
        <div
          className={classes.rowLine}
          data-active={isActive || undefined}
          style={{ "--favorite-depth": String(depth) } as CSSProperties}
        >
          {hasChildren ? (
            <UnstyledButton
              className={classes.rowArrow}
              onClick={handleToggle}
              aria-expanded={expanded}
              aria-label={expanded ? t("Collapse") : t("Expand")}
            >
              <IconChevronRight
                size={18}
                stroke={2}
                className={clsx(
                  classes.rowCaret,
                  expanded && classes.rowCaretExpanded,
                )}
              />
            </UnstyledButton>
          ) : (
            <span className={classes.rowBullet} aria-hidden>
              <IconPointFilled size={8} />
            </span>
          )}

          <Link
            to={buildPageUrl(spaceSlug, page.slugId, page.title)}
            className={classes.rowInner}
            onClick={onNavigate}
            title={title}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={classes.icon} onClick={handleIconClick}>
              <EmojiPicker
                onEmojiSelect={(emoji) => handleUpdateIcon(emoji.native)}
                icon={<PageListIcon icon={page.icon} isBase={page.isBase} />}
                readOnly={!canEdit}
                removeEmojiAction={() => handleUpdateIcon(null)}
                actionIconProps={{ tabIndex: -1 }}
              />
            </span>
            <span className={classes.rowTitle}>{title}</span>
          </Link>

          <div className={classes.rowActions}>
            {canEdit && (
              <ActionIcon
                variant="subtle"
                color="gray"
                className={classes.rowActionIcon}
                aria-label={t("Create subpage of {{name}}", { name: title })}
                tabIndex={-1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateChild();
                }}
              >
                <IconPlus
                  style={{ width: rem(20), height: rem(20) }}
                  stroke={2}
                />
              </ActionIcon>
            )}

            <FavoriteMenuButton title={title} />
          </div>
        </div>
      </FavoritePageMenu>

      {expanded &&
        children.map((child) => (
          <FavoritePageRow
            key={child.id}
            page={child}
            spaceId={spaceId}
            spaceSlug={spaceSlug}
            depth={depth + 1}
            onNavigate={onNavigate}
          />
        ))}
    </div>
  );
}
