import { Tooltip, UnstyledButton, ActionIcon } from "@mantine/core";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "./hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "./hooks/hooks/use-toggle-sidebar.ts";
import classes from "./sidebar-toggle-overlay.module.css";

// 顶部 Header 移除后侧边栏的开关入口：桌面端侧边栏收起时左上角常驻展开按钮，移动端为汉堡按钮
// peek 边缘感应已暂时停用，保留以备恢复
export function SidebarToggleOverlay() {
  const { t } = useTranslation();
  const [desktopOpened, setDesktopOpened] = useAtom(desktopSidebarAtom);
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);
  // peek 悬浮已暂时停用，保留以备恢复
  // const [, setPeek] = useAtom(sidebarPeekAtom);
  // const edgeTimerRef = useRef<number | null>(null);

  // // 鼠标进入左边缘感应条后延迟触发预览，避免快速划过误触
  // const handleEdgeEnter = () => {
  //   if (edgeTimerRef.current === null) {
  //     edgeTimerRef.current = window.setTimeout(() => setPeek(true), 150);
  //   }
  // };
  //
  // // 鼠标离开感应条时取消未触发的预览计时
  // const handleEdgeLeave = () => {
  //   if (edgeTimerRef.current !== null) {
  //     window.clearTimeout(edgeTimerRef.current);
  //     edgeTimerRef.current = null;
  //   }
  // };
  //
  // // 组件卸载时清理感应条计时器
  // useEffect(() => handleEdgeLeave, []);

  return (
    <>
      {/* 仅在侧边栏收起时显示展开按钮，展开时避免悬浮按钮遮挡工作区名称 */}
      {!desktopOpened && (
        <Tooltip label={t("Expand sidebar")} position="right" openDelay={300}>
          <UnstyledButton
            className={classes.expandButton}
            aria-label={t("Expand sidebar")}
            aria-expanded={desktopOpened}
            visibleFrom="sm"
            onClick={() => {
              // setPeek(false);
              setDesktopOpened(true);
            }}
          >
            <IconLayoutSidebarLeftExpand size={18} />
          </UnstyledButton>
        </Tooltip>
      )}

      {/* 移动端抽屉打开时隐藏汉堡按钮，避免遮挡工作区入口 */}
      {!mobileSidebarOpened && (
        <ActionIcon
          className={classes.mobileButton}
          variant="subtle"
          color="gray"
          aria-label={t("Sidebar toggle")}
          aria-expanded={mobileSidebarOpened}
          onClick={toggleMobileSidebar}
        >
          <IconLayoutSidebarLeftExpand size={20} />
        </ActionIcon>
      )}

      {/* peek 边缘感应条已暂时停用，保留以备恢复 */}
      {/* {!desktopOpened && (
        <div
          className={classes.edgeTrigger}
          aria-hidden
          onMouseEnter={handleEdgeEnter}
          onMouseLeave={handleEdgeLeave}
        />
      )} */}
    </>
  );
}
