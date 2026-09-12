import { MAIN_CONTENT_ID } from "@/components/ui/skip-to-main.tsx";

/**
 * 页面滚动容器（AppShell.Main）。页面滚动归内容区所有，凡依赖页面滚动的
 * 位置计算都应使用该元素，而不是 window/documentElement。
 */
export function getScrollContainer(): HTMLElement | null {
  return document.getElementById(MAIN_CONTENT_ID);
}
