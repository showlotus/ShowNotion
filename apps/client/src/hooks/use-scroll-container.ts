import { MAIN_CONTENT_ID } from "@/components/ui/skip-to-main.tsx";

/**
 * The page scroll container (AppShell.Main). Page scrolling is owned by the
 * content area; any position calculation that depends on page scrolling should
 * use this element instead of window/documentElement.
 */
export function getScrollContainer(): HTMLElement | null {
  return document.getElementById(MAIN_CONTENT_ID);
}
