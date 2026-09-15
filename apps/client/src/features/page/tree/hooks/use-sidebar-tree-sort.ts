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
      if (!user) return;
      const prevUser = user;
      setUser({
        ...prevUser,
        settings: {
          ...prevUser.settings,
          preferences: {
            ...prevUser.settings?.preferences,
            sidebarPageTreeSort: mode,
          },
        },
      });
      try {
        const updatedUser = await updateUser({ sidebarPageTreeSort: mode });
        setUser(updatedUser);
      } catch {
        setUser(prevUser);
      }
    },
    [user, setUser],
  );

  const toggleSortMode = useCallback(
    () => setSortMode(sortMode === "manual" ? "updatedAtDesc" : "manual"),
    [setSortMode, sortMode],
  );

  return { sortMode, setSortMode, toggleSortMode };
}
