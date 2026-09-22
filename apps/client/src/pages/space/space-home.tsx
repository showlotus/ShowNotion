import { Container, Text, Title } from "@mantine/core";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import SpacePublicNotice from "@/features/public-space/components/space-public-notice.tsx";
import { useParams } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";
import classes from "@/features/space/components/space-home.module.css";

export default function SpaceHome() {
    const { spaceSlug } = useParams();
    const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
    const { t } = useTranslation();

    const subtitle = [
        space?.description,
        space?.memberCount ? formatMemberCount(space.memberCount, t) : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <>
            <DocumentTitle title={space?.name || 'Overview'} />
            <Container size={"900"} pt="xl" className={classes.page}>
                {space && (
                    <div className={classes.header}>
                        <CustomAvatar
                            name={space.name}
                            avatarUrl={space.logo}
                            type={AvatarIconType.SPACE_ICON}
                            color="initials"
                            variant="filled"
                            size={44}
                        />

                        <div>
                            <Title order={1} size="h4" fw={600}>
                                {space.name}
                            </Title>
                            {subtitle && (
                                <Text size="sm" c="dimmed" mt={2}>
                                    {subtitle}
                                </Text>
                            )}
                        </div>
                    </div>
                )}

                {space && <SpacePublicNotice space={space} />}

                {space && <SpaceHomeTabs />}
            </Container>
        </>
    );
}
