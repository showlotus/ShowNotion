import { useCallback } from "react";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";

export type SidebarTreeSortMode = "manual" | "updatedAtDesc";

export function useSidebarTreeSort() {
  const [user, setUser] = useAtom(userAtom);

  const sortMode: SidebarTreeSortMode =
    user?.settings?.preferences?.sidebarPageTreeSort === "updatedAtDesc"
      ? "updatedAtDesc"
      : "manual";

  const setSortMode = useCallback(
    async (mode: SidebarTreeSortMode) => {
      try {
        const updatedUser = await updateUser({ sidebarPageTreeSort: mode });
        setUser(updatedUser);
      } catch {
        // preference stays unchanged on failure; nothing to revert
      }
    },
    [setUser],
  );

  const toggleSortMode = useCallback(
    () => setSortMode(sortMode === "manual" ? "updatedAtDesc" : "manual"),
    [setSortMode, sortMode],
  );

  return { sortMode, setSortMode, toggleSortMode };
}
