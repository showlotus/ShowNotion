import { Tabs } from "@mantine/core";
import { IconClockHour3, IconStar, IconUser } from "@tabler/icons-react";
import RecentChanges from "@/components/common/recent-changes";
import FavoritesPages from "@/features/home/components/favorites-pages";
import CreatedByMe from "@/features/home/components/created-by-me";
import { useParams } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { homeTabAtom } from "@/features/home/atoms/home-tab-atom";
import classes from "./space-home.module.css";

export default function SpaceHomeTabs() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const [activeTab, setActiveTab] = useAtom(homeTabAtom);

  return (
    <Tabs
      color="dark"
      value={activeTab}
      onChange={(value) => {
        if (value) setActiveTab(value);
      }}
    >
      <Tabs.List
        className={classes.tabsList}
        style={{ flexWrap: "nowrap", overflowX: "auto" }}
      >
        <Tabs.Tab
          value="recent"
          leftSection={<IconClockHour3 size={16} />}
          fz="sm"
          fw={500}
        >
          {t("Recently updated")}
        </Tabs.Tab>
        <Tabs.Tab
          value="favorites"
          leftSection={<IconStar size={16} />}
          fz="sm"
          fw={500}
        >
          {t("Favorites")}
        </Tabs.Tab>
        <Tabs.Tab
          value="created"
          leftSection={<IconUser size={16} />}
          fz="sm"
          fw={500}
        >
          {t("Created by me")}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="recent" className={classes.panel}>
        {space?.id && <RecentChanges spaceId={space.id} />}
      </Tabs.Panel>
      <Tabs.Panel value="favorites" className={classes.panel}>
        {space?.id && <FavoritesPages spaceId={space.id} />}
      </Tabs.Panel>
      <Tabs.Panel value="created" className={classes.panel}>
        {space?.id && <CreatedByMe spaceId={space.id} />}
      </Tabs.Panel>
    </Tabs>
  );
}
