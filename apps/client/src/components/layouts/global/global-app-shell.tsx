import { AppShell, Container } from "@mantine/core";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SettingsSidebar from "@/components/settings/settings-sidebar.tsx";
import { useAtom } from "jotai";
import {
  asideStateAtom,
  desktopSidebarAtom,
  mobileSidebarAtom,
  sidebarWidthAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { SpaceSidebar } from "@/features/space/components/sidebar/space-sidebar.tsx";

const AiChatSidebar = React.lazy(
  () => import("@/ee/ai-chat/components/ai-chat-sidebar.tsx"),
);
// 顶部 Header 已由侧边栏内嵌入口方案替代，保留代码以备恢复
// import { AppHeader } from "@/components/layouts/global/app-header.tsx";
import Aside from "@/components/layouts/global/aside.tsx";
import classes from "./app-shell.module.css";
import { useTrialEndAction } from "@/ee/hooks/use-trial-end-action.tsx";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import GlobalSidebar from "@/components/layouts/global/global-sidebar.tsx";
import { ASIDE_PANEL_ID } from "@/hooks/use-toggle-aside.tsx";
import { MAIN_CONTENT_ID, SkipToMain } from "@/components/ui/skip-to-main.tsx";
// peek 悬浮已暂时停用，保留以备恢复
// import { sidebarPeekAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { SidebarToggleOverlay } from "@/components/layouts/global/sidebar-toggle-overlay.tsx";

// Notion 侧边栏宽度限制：最小 220，最大 400
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 400;

export default function GlobalAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  useTrialEndAction();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  // peek 悬浮已暂时停用，保留以备恢复
  // const [isPeek] = useAtom(sidebarPeekAtom);
  // const [, setPeek] = useAtom(sidebarPeekAtom);
  const [{ isAsideOpen, tab: asideTab }] = useAtom(asideStateAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null);

  // 兼容历史存储的超限宽度（旧上限为 600）
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
    [isResizing],
  );

  useEffect(() => {
    //https://codesandbox.io/p/sandbox/kz9de
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isSpaceRoute = location.pathname.startsWith("/s/");
  const isAiRoute = location.pathname.startsWith("/ai");
  const isPageRoute = location.pathname.includes("/p/");
  const showGlobalSidebar = !isSpaceRoute && !isSettingsRoute && !isAiRoute;

  return (
    <>
      <SkipToMain />
      <AppShell
      // 顶部 Header 已由侧边栏内嵌入口方案替代，保留代码以备恢复
      // header={{ height: 45 }}
      className={classes.shell}
      // peek 悬浮已暂时停用，保留以备恢复
      // data-peek={isPeek ? "true" : undefined}
      navbar={{
        // 所有路由统一使用可拖拽宽度（Notion 风格：全局记忆 + min/max 限制）
        width: clampedSidebarWidth,
        breakpoint: "sm",
        collapsed: {
          mobile: !mobileOpened,
          desktop: !desktopOpened,
        },
      }}
      aside={
        isPageRoute && {
          width: 350,
          breakpoint: "sm",
          collapsed: { mobile: !isAsideOpen, desktop: !isAsideOpen },
        }
      }
      padding="md"
    >
      {/* 顶部 Header 已由侧边栏内嵌入口方案替代，保留代码以备恢复 */}
      {/* <AppShell.Header px="md" className={classes.header}>
        <AppHeader />
      </AppShell.Header> */}
      <SidebarToggleOverlay />
      <AppShell.Navbar
        className={classes.navbar}
        withBorder={false}
        ref={sidebarRef}
        // peek 悬浮已暂时停用，保留以备恢复
        // onMouseLeave={() => setPeek(false)}
        aria-label={
          isSpaceRoute
            ? t("Space navigation")
            : isSettingsRoute
              ? t("Settings navigation")
              : isAiRoute
                ? t("AI navigation")
                : t("Main navigation")
        }
      >
        {/* 所有路由均可拖拽调宽 */}
        <div className={classes.resizeHandle} onMouseDown={startResizing} />
        {isSpaceRoute && <SpaceSidebar />}
        {isSettingsRoute && <SettingsSidebar />}
        {isAiRoute && (
          <React.Suspense fallback={null}>
            <AiChatSidebar />
          </React.Suspense>
        )}
        {showGlobalSidebar && <GlobalSidebar />}
      </AppShell.Navbar>
      <AppShell.Main id={MAIN_CONTENT_ID} tabIndex={-1}>
        {isSettingsRoute ? (
          <Container size={900} pb={80}>
            {children}
          </Container>
        ) : (
          children
        )}
      </AppShell.Main>

      {isPageRoute && (
        <AppShell.Aside
          id={ASIDE_PANEL_ID}
          tabIndex={-1}
          className={classes.aside}
          p="md"
          withBorder={false}
          aria-label={
            asideTab === "comments"
              ? t("Comments")
              : asideTab === "toc"
                ? t("Table of contents")
                : asideTab === "chat"
                  ? t("AI Chat")
                  : asideTab === "details"
                    ? t("Details")
                    : undefined
          }
        >
          <Aside />
        </AppShell.Aside>
      )}
    </AppShell>
    </>
  );
}
