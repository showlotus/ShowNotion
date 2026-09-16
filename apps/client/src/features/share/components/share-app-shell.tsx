import React, { useEffect, useRef, useState } from "react";
import { AppShell } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
  sidebarWidthAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { MAIN_CONTENT_ID, SkipToMain } from "@/components/ui/skip-to-main.tsx";
import ShareSidebarTree from "@/features/share/components/share-sidebar-tree.tsx";
import styles from "./share-app-shell.module.css";

// Workspace parity: draggable Notion-style sidebar between 220 and 400px,
// width shared (and remembered) with the authenticated app.
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 400;

interface ShareAppShellProps {
  hasSidebar: boolean;
  children: React.ReactNode;
}

export default function ShareAppShell({
  hasSidebar,
  children,
}: ShareAppShellProps) {
  const { t } = useTranslation();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Tolerate widths stored by older limits (the cap was once 600).
  const clampedSidebarWidth = Math.min(
    Math.max(sidebarWidth, SIDEBAR_MIN_WIDTH),
    SIDEBAR_MAX_WIDTH,
  );

  const startResizing = React.useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (mouseMoveEvent) => {
      if (isResizing) {
        const newWidth =
          mouseMoveEvent.clientX -
          sidebarRef.current.getBoundingClientRect().left;
        if (newWidth < SIDEBAR_MIN_WIDTH) {
          setSidebarWidth(SIDEBAR_MIN_WIDTH);
          return;
        }
        if (newWidth > SIDEBAR_MAX_WIDTH) {
          setSidebarWidth(SIDEBAR_MAX_WIDTH);
          return;
        }
        setSidebarWidth(newWidth);
      }
    },
    [isResizing, setSidebarWidth],
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <>
      <SkipToMain />
      <AppShell
        className={styles.shell}
        data-resizing={isResizing ? "true" : undefined}
        navbar={{
          width: clampedSidebarWidth,
          breakpoint: "sm",
          collapsed: {
            mobile: !mobileOpened,
            desktop: !desktopOpened || !hasSidebar,
          },
        }}
        padding="md"
      >
        <AppShell.Navbar
          className={styles.navbar}
          withBorder={false}
          ref={sidebarRef}
          aria-label={t("Pages")}
        >
          {hasSidebar && (
            <div className={styles.resizeHandle} onMouseDown={startResizing} />
          )}
          {hasSidebar && <ShareSidebarTree />}
        </AppShell.Navbar>

        <AppShell.Main
          id={MAIN_CONTENT_ID}
          className={styles.main}
          tabIndex={-1}
        >
          {children}
        </AppShell.Main>
      </AppShell>
    </>
  );
}
