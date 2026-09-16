import { atomWithWebStorage } from "@/lib/jotai-helper.ts";
import { atom } from "jotai";

export const mobileSidebarAtom = atom<boolean>(false);

export const desktopSidebarAtom = atomWithWebStorage<boolean>(
  "showSidebar",
  true,
);

// Temporary preview state when the mouse approaches the left screen edge
// (peek floating is temporarily disabled; kept for possible restoration)
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

// Notion sidebar width: default 240, drag range 220–400 (clamped uniformly in global-app-shell)
export const sidebarWidthAtom = atomWithWebStorage<number>("sidebarWidth", 270);