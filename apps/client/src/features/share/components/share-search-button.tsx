import { ActionIcon, Tooltip } from "@mantine/core";
import { useParams } from "react-router-dom";
import { IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { platformModifierLabel } from "@/lib";
import { shareSearchSpotlight } from "@/features/search/constants";

/** Hidden on single-page shares (/share/p/:pageSlug) where no search
 * index/spotlight exists. */
export default function ShareSearchButton() {
  const { t } = useTranslation();
  const { shareId } = useParams();

  if (!shareId) {
    return null;
  }

  return (
    <Tooltip
      label={`${t("Search")} · ${platformModifierLabel} K`}
      openDelay={250}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        onClick={shareSearchSpotlight.open}
        aria-label={t("Search")}
      >
        <IconSearch size={18} stroke={1.75} />
      </ActionIcon>
    </Tooltip>
  );
}
