import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

import { queryClient } from "@/main.tsx";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { movePageToSpace } from "@/features/page/services/page-service.ts";
import type { ISpace } from "@/features/space/types/space.types.ts";

export function useMovePageToSpace() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return useCallback(
    async (pageId: string, slugId: string, targetSpace: ISpace) => {
      try {
        await movePageToSpace({ pageId, spaceId: targetSpace.id });
        queryClient.removeQueries({
          predicate: (item) =>
            ["pages", "sidebar-pages", "root-sidebar-pages"].includes(
              item.queryKey[0] as string,
            ),
        });
        navigate(buildPageUrl(targetSpace.slug, slugId, undefined));
        notifications.show({ message: t("Page moved successfully") });
        return true;
      } catch (err: any) {
        notifications.show({
          message: err?.response?.data?.message || "An error occurred",
          color: "red",
        });
        return false;
      }
    },
    [navigate, t],
  );
}
