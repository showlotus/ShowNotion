import { atomWithStorage } from "jotai/utils";

export const spaceFavoritesSidebarOpenAtom = atomWithStorage<boolean>(
  "sidebar-favorites-space-open",
  true,
);

export const workspaceFavoritesSidebarOpenAtom = atomWithStorage<boolean>(
  "sidebar-favorites-workspace-open",
  true,
);
