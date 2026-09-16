import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { useAtom, useAtomValue } from "jotai";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconList,
} from "@tabler/icons-react";
import { FLOATING_TOC_PANEL_ID } from "@/features/editor/components/table-of-contents/floating-toc.tsx";
import { floatingTocAtom } from "@/features/editor/atoms/editor-atoms.ts";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { sharedHasSidebarAtom } from "@/features/share/atoms/shared-page-atom.ts";
import ShareBreadcrumb from "@/features/share/components/share-breadcrumb.tsx";
import ShareSearchButton from "@/features/share/components/share-search-button.tsx";
import ShareThemeToggle from "@/features/share/components/share-theme-toggle.tsx";
import ShareCopyPage from "@/features/share/components/share-copy-page.tsx";
import ShareEditPage from "@/features/share/components/share-edit-page.tsx";
import styles from "./share-page-header.module.css";

interface SharePageHeaderProps {
  pageTitle?: string;
}

// Same selected look as the workspace page-header triggers (activeIconProps):
// pinned/expanded state paints the quiet hover surface.
const activeTocProps = (active: boolean) => ({
  "data-active": active || undefined,
  "aria-expanded": active,
  style: active ? { backgroundColor: "var(--ai-hover)" } : undefined,
});

export default function SharePageHeader({ pageTitle }: SharePageHeaderProps) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const hasSidebar = useAtomValue(sharedHasSidebarAtom);
  const [mobileOpened, setMobileOpened] = useAtom(mobileSidebarAtom);
  const [desktopOpened, setDesktopOpened] = useAtom(desktopSidebarAtom);
  const [tocPinned, setTocPinned] = useAtom(floatingTocAtom);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpened(!mobileOpened);
    } else {
      setDesktopOpened(!desktopOpened);
    }
  };
  const sidebarOpened = isMobile ? mobileOpened : desktopOpened;
  // Workspace overlay parity: stateful labels instead of a generic toggle.
  const sidebarLabel = t(sidebarOpened ? "Collapse sidebar" : "Expand sidebar");

  return (
    <div className={styles.header} data-page-header="true">
      <Group justify="space-between" h="100%" wrap="nowrap" gap="xs">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          {hasSidebar && (
            <Tooltip label={sidebarLabel} openDelay={250}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                onClick={toggleSidebar}
                aria-label={sidebarLabel}
                aria-expanded={sidebarOpened}
              >
                {sidebarOpened ? (
                  <IconLayoutSidebarLeftCollapse size={18} stroke={1.75} />
                ) : (
                  <IconLayoutSidebarLeftExpand size={18} stroke={1.75} />
                )}
              </ActionIcon>
            </Tooltip>
          )}

          <ShareBreadcrumb />
        </Group>

        <Group
          justify="flex-end"
          h="100%"
          wrap="nowrap"
          gap="var(--mantine-spacing-xs)"
        >
          <ShareSearchButton />
          <ShareThemeToggle />
          <ShareCopyPage pageTitle={pageTitle} />
          <Tooltip label={t("Table of contents")} openDelay={250}>
            <ActionIcon
              variant="subtle"
              color="dark"
              aria-label={t("Table of contents")}
              aria-controls={FLOATING_TOC_PANEL_ID}
              {...activeTocProps(tocPinned)}
              onClick={() => setTocPinned(!tocPinned)}
            >
              <IconList size={20} stroke={2} />
            </ActionIcon>
          </Tooltip>
          <ShareEditPage />
        </Group>
      </Group>
    </div>
  );
}
