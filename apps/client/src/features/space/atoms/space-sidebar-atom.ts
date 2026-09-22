import { atomWithStorage } from "jotai/utils";

export const spaceSidebarPagesOpenAtom = atomWithStorage<boolean>(
  "sidebar-space-pages-open",
  true,
);
