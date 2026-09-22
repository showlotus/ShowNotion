import { useId } from "react";
import { useAtom } from "jotai";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import {
  spaceFavoritesSidebarOpenAtom,
  workspaceFavoritesSidebarOpenAtom,
} from "@/features/favorite/atoms/favorites-sidebar-atom";
import { SidebarSectionHeader } from "@/components/ui/sidebar-section-header";
import FavoritePageRow from "@/features/favorite/components/favorite-page-row";

import classes from "./favorites-sidebar-section.module.css";

type FavoritesSidebarSectionProps = {
  /** Omit for the workspace-wide list. */
  spaceId?: string;
  limit?: number;
  viewAllTo?: string;
  onViewAllClick?: () => void;
  onNavigate?: () => void;
};

export default function FavoritesSidebarSection({
  spaceId,
  limit = 8,
  viewAllTo,
  onViewAllClick,
  onNavigate,
}: FavoritesSidebarSectionProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [opened, setOpened] = useAtom(
    spaceId ? spaceFavoritesSidebarOpenAtom : workspaceFavoritesSidebarOpenAtom,
  );
  const { data, isPending } = useFavoritesQuery("page", spaceId);

  const pages = data?.pages ?? [];
  const favorites = pages
    .flatMap((page) => page.items)
    .filter((favorite) => favorite.page);
  const hasMore =
    favorites.length > limit ||
    Boolean(pages[pages.length - 1]?.meta?.hasNextPage);

  // Notion hides the section entirely while loading and when it is empty.
  if (isPending || favorites.length === 0) {
    return null;
  }

  return (
    <div className={classes.section}>
      <SidebarSectionHeader
        label={t("Favorites")}
        opened={opened}
        onToggle={() => setOpened(!opened)}
        controlsId={listId}
      />

      <div className={classes.list} id={listId} hidden={!opened}>
        {favorites.slice(0, limit).map((favorite) => (
          <FavoritePageRow
            key={favorite.id}
            page={favorite.page}
            spaceId={favorite.page.spaceId}
            spaceSlug={favorite.space?.slug}
            onNavigate={onNavigate}
          />
        ))}

        {hasMore && viewAllTo && (
          <Link
            to={viewAllTo}
            className={classes.viewAll}
            onClick={() => {
              onViewAllClick?.();
              onNavigate?.();
            }}
          >
            {t("View all")}
          </Link>
        )}
      </div>
    </div>
  );
}
