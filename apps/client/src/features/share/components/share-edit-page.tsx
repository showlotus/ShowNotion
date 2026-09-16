import { ActionIcon, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconPencil } from "@tabler/icons-react";
import { extractPageSlugId } from "@/lib";
import { useAuthenticatedUser } from "@/features/public-space/hooks/use-authenticated-user.ts";
import { useSharePageQuery } from "@/features/share/queries/share-query.ts";
import { getSpaces } from "@/features/space/services/space-service.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";

/** "Edit page" for signed-in visitors: resolves the shared page's space in
 * the visitor's own workspace and deep-links into the editor. Anonymous
 * visitors and non-members never see the action. */
export default function ShareEditPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: currentUser } = useAuthenticatedUser();
  const { data } = useSharePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const { data: spaces } = useQuery({
    queryKey: ["spaces"],
    queryFn: () => getSpaces(),
    enabled: !!currentUser?.user,
  });

  if (!currentUser?.user || !data) {
    return null;
  }

  const space = spaces?.items?.find((item) => item.id === data.share.spaceId);
  if (!space) {
    return null;
  }

  return (
    <Tooltip label={t("Edit page")} openDelay={250}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        component={Link}
        to={buildPageUrl(space.slug, data.page.slugId, data.page.title)}
        target="_blank"
        rel="noopener"
        aria-label={t("Edit page")}
      >
        <IconPencil size={18} stroke={1.75} />
      </ActionIcon>
    </Tooltip>
  );
}
