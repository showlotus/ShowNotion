import { KeyboardEvent, useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconChevronRight, IconLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types";
import { IPage } from "@/features/page/types/page.types";
import { SpaceRole } from "@/lib/types";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { PageChildren } from "./page-children";
import classes from "./destination-picker.module.css";

type SpaceRowProps = {
  space: ISpace;
  limit: number;
  selectedId: string | null;
  excludePageId?: string;
  isSpaceDisabled?: boolean;
  isPageDisabled?: (page: Partial<IPage>) => boolean;
  onSelectSpace: (space: ISpace) => void;
  onSelectPage: (page: Partial<IPage>, space: ISpace) => void;
};

export function SpaceRow({
  space,
  limit,
  selectedId,
  excludePageId,
  isSpaceDisabled,
  isPageDisabled,
  onSelectSpace,
  onSelectPage,
}: SpaceRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const writable =
    !!space.membership?.role && space.membership.role !== SpaceRole.READER;
  const isSelected = space.id === selectedId;
  const selectDisabled = !writable || isSpaceDisabled;

  const rowClasses = [
    classes.spaceRow,
    isSelected && classes.selected,
    !writable && classes.disabled,
    isSpaceDisabled && classes.spaceRowDisabled,
  ]
    .filter(Boolean)
    .join(" ");

  const handleSelect = () => {
    if (!selectDisabled) onSelectSpace(space);
  };

  const handleRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect();
    }
  };

  const rowContent = (
    <div
      className={rowClasses}
      data-space-id={space.id}
      role="button"
      tabIndex={selectDisabled ? -1 : 0}
      aria-disabled={selectDisabled || undefined}
      onClick={handleSelect}
      onKeyDown={handleRowKeyDown}
    >
      {writable ? (
        <ActionIcon
          className={`${classes.chevron} ${expanded ? classes.chevronExpanded : ""}`}
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={expanded ? t("Collapse") : t("Expand")}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <IconChevronRight size={14} />
        </ActionIcon>
      ) : (
        <div style={{ width: 20, flexShrink: 0 }} />
      )}

      <CustomAvatar
        name={space.name}
        avatarUrl={space.logo}
        type={AvatarIconType.SPACE_ICON}
        size={22}
      />

      <div className={classes.pageTitle}>{space.name}</div>

      {!writable && (
        <IconLock
          size={14}
          color="var(--mantine-color-gray-5)"
        />
      )}
    </div>
  );

  const tooltipLabel = !writable
    ? t("You don't have permission to create pages here")
    : isSpaceDisabled
      ? t("Page is already in this space")
      : null;

  return (
    <>
      {tooltipLabel ? (
        <Tooltip label={tooltipLabel} position="right" withArrow>
          <div>{rowContent}</div>
        </Tooltip>
      ) : (
        rowContent
      )}

      {expanded && writable && (
        <PageChildren
          spaceId={space.id}
          depth={1}
          limit={limit}
          selectedId={selectedId}
          excludePageId={excludePageId}
          isPageDisabled={isPageDisabled}
          onSelectPage={(page) => onSelectPage(page, space)}
        />
      )}
    </>
  );
}
