import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { atom } from "jotai";

export const mobileSidebarAtom = atom<boolean>(false);

export const desktopSidebarAtom = atomWithWebStorage<boolean>(
  "showSidebar",
  true,
);

// 鼠标接近屏幕左边缘时的临时预览状态（peek 悬浮已暂时停用，保留以备恢复）
// export const sidebarPeekAtom = atom<boolean>(false);

export const desktopAsideAtom = atom<boolean>(false);

// Valid `tab` values: "" | "comments" | "toc" | "chat" | "details"
type AsideStateType = {
  tab: string;
  isAsideOpen: boolean;
};

export const asideStateAtom = atom<AsideStateType>({
  tab: "",
  isAsideOpen: false,
});

// Notion 侧边栏宽度：默认 240，拖拽范围 220–400（global-app-shell 内统一 clamp）
export const sidebarWidthAtom = atomWithWebStorage<number>("sidebarWidth", 270);