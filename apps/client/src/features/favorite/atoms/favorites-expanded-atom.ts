import { atomWithStorage } from "jotai/utils";

/**
 * Page ids expanded inside the sidebar favorites section. Kept separate from
 * the space tree's openTreeNodesAtom so expanding here never touches the
 * "Pages" tree (and vice versa).
 */
export const favoritesExpandedAtom = atomWithStorage<string[]>(
  "sidebar-favorites-expanded",
  [],
);
