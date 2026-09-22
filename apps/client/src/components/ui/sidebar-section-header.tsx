import { ReactNode } from "react";
import { UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import clsx from "clsx";
import classes from "./sidebar-section-header.module.css";

type SidebarSectionHeaderProps = {
  label: string;
  opened: boolean;
  onToggle: () => void;
  /** id of the collapsed region, for `aria-controls`. */
  controlsId?: string;
  /** Rendered right after the label, inside the toggle (e.g. a state icon). */
  labelExtra?: ReactNode;
  /** Right-aligned actions, kept outside the toggle so clicks don't collapse. */
  children?: ReactNode;
  /** Keeps the actions visible while one of their menus is open. */
  actionsPinned?: boolean;
  className?: string;
};

export function SidebarSectionHeader({
  label,
  opened,
  onToggle,
  controlsId,
  labelExtra,
  children,
  actionsPinned,
  className,
}: SidebarSectionHeaderProps) {
  return (
    <div
      className={clsx(classes.header, className)}
      data-actions-pinned={actionsPinned || undefined}
    >
      <UnstyledButton
        className={classes.toggle}
        onClick={onToggle}
        aria-expanded={opened}
        aria-controls={controlsId}
      >
        <IconChevronRight
          size={18}
          className={clsx(classes.caret, opened && classes.caretExpanded)}
        />
        <span className={classes.label}>{label}</span>
        {labelExtra && <span className={classes.labelExtra}>{labelExtra}</span>}
      </UnstyledButton>

      {children && <div className={classes.actions}>{children}</div>}
    </div>
  );
}
