import { useState } from "react";
import {
  Group,
  Menu,
  ScrollArea,
  Text,
  TextInput,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconBrightnessFilled,
  IconBrush,
  IconCheck,
  IconChevronDown,
  IconDeviceDesktop,
  IconLayoutGrid,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
  IconUser,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { getSpaceUrl } from "@/lib/config.ts";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { usePersonalSpaceQuery } from "@/ee/personal-space/queries/personal-space-query";
import { useGetSpacesQuery } from "@/features/space/queries/space-query.ts";
import CreatePersonalSpaceModal from "@/ee/personal-space/components/create-personal-space-modal";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { Link, useNavigate, useParams } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import useAuth from "@/features/auth/hooks/use-auth.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import WorkspaceIconPicker from "@/features/workspace/components/workspace-icon-picker.tsx";
import { useTranslation } from "react-i18next";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import classes from "./top-menu.module.css";

// 暂时隐藏空间搜索（空间数量不多，搜索意义不大），需要时改回 true
const SHOW_SPACE_SEARCH = false;

// 侧边栏顶部的工作区菜单：工作区设置、成员管理、个人空间
export default function TopMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { spaceSlug: currentSpaceSlug } = useParams<{ spaceSlug: string }>();
  const [currentUser] = useAtom(currentUserAtom);

  const workspace = currentUser?.workspace;

  const hasPersonalSpaces = useHasFeature(Feature.PERSONAL_SPACES);
  const settingEnabled = workspace?.settings?.spaces?.allowPersonal === true;
  const { data: personalSpace } = usePersonalSpaceQuery(hasPersonalSpaces);
  const [
    createOpened,
    { open: openCreate, close: closeCreate },
  ] = useDisclosure(false);

  // Notion 式工作区面板：内嵌空间搜索与列表，点击直接切换
  const [menuOpened, setMenuOpened] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const { data: spacesData } = useGetSpacesQuery({
    query: debouncedSearch,
    limit: 50,
  });
  const spaces = spacesData?.items ?? [];

  const handleSelectSpace = (slug: string) => {
    setMenuOpened(false);
    navigate(getSpaceUrl(slug));
  };

  const handleWorkspaceIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (!workspace) {
    return <></>;
  }

  return (
    <>
    <Menu
      width={280}
      position="bottom-start"
      shadow={"lg"}
      opened={menuOpened}
      onChange={setMenuOpened}
    >
      <Menu.Target>
        <div className={classes.trigger}>
          <div onClick={handleWorkspaceIconClick}>
            <WorkspaceIconPicker size={26} />
          </div>
          <UnstyledButton
            className={classes.triggerNameButton}
            aria-label={workspace?.name}
          >
            <Text fw={500} size="sm" lh={1} className={classes.triggerName} lineClamp={1}>
              {workspace?.name}
            </Text>
            <IconChevronDown size={16} className={classes.triggerChevron} />
          </UnstyledButton>
        </div>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Group gap="xs" wrap="nowrap">
            <WorkspaceIconPicker size={22} emojiSize={14} />
            <Text size="sm" fw={600} lineClamp={1}>
              {workspace?.name}
            </Text>
          </Group>
        </Menu.Label>

        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.WORKSPACE.GENERAL}
          leftSection={<IconSettings size={16} />}
        >
          {t("Workspace settings")}
        </Menu.Item>

        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.WORKSPACE.MEMBERS}
          leftSection={<IconUsers size={16} />}
        >
          {t("Manage members")}
        </Menu.Item>

        {personalSpace ? (
          <Menu.Item
            component={Link}
            to={getSpaceUrl(personalSpace.slug)}
            leftSection={<IconUser size={16} />}
          >
            {t("Personal space")}
          </Menu.Item>
        ) : (
          hasPersonalSpaces &&
          settingEnabled && (
            <Menu.Item
              onClick={openCreate}
              leftSection={<IconUser size={16} />}
            >
              {t("Create personal space")}
            </Menu.Item>
          )
        )}

        <Menu.Divider />

        <Menu.Label>{t("Spaces")}</Menu.Label>

        {SHOW_SPACE_SEARCH && (
          <TextInput
            size="xs"
            placeholder={t("Search for spaces")}
            aria-label={t("Search for spaces")}
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            mb="xs"
          />
        )}

        <ScrollArea.Autosize mah={240} type="scroll" scrollbarSize={6}>
          {spaces.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="xs">
              {t("No space found")}
            </Text>
          ) : (
            spaces.map((space) => (
              <Menu.Item
                key={space.slug}
                onClick={() => handleSelectSpace(space.slug)}
                leftSection={
                  <CustomAvatar
                    name={space.name}
                    avatarUrl={space.logo}
                    type={AvatarIconType.SPACE_ICON}
                    color="initials"
                    variant="filled"
                    size={20}
                  />
                }
                rightSection={
                  space.slug === currentSpaceSlug ? (
                    <IconCheck size={14} />
                  ) : undefined
                }
              >
                <Text size="sm" lineClamp={1} component="span">
                  {space.name}
                </Text>
              </Menu.Item>
            ))
          )}
        </ScrollArea.Autosize>

        <Menu.Divider />

        <Menu.Item
          component={Link}
          to="/spaces"
          leftSection={<IconLayoutGrid size={16} />}
        >
          {t("View all")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>

      <CreatePersonalSpaceModal opened={createOpened} onClose={closeCreate} />
    </>
  );
}

// 侧边栏底部的个人账户菜单：个人资料、偏好设置、主题切换、登出
export function UserMenu() {
  const { t } = useTranslation();
  const [currentUser] = useAtom(currentUserAtom);
  const { logout } = useAuth();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const user = currentUser?.user;

  if (!user) {
    return <></>;
  }

  return (
    <Menu width={250} position="top-start" shadow={"lg"}>
      <Menu.Target>
        <UnstyledButton className={classes.userTrigger} aria-label={user.name}>
          <CustomAvatar
            size={"md"}
            avatarUrl={user.avatarUrl}
            name={user.name}
          />
          <div className={classes.userMeta}>
            <Text size="sm" fw={500} lineClamp={1}>
              {user.name}
            </Text>
            <Text size="xs" c="dimmed" truncate="end">
              {user.email}
            </Text>
          </div>
          <IconChevronDown size={16} className={classes.triggerChevron} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t("Account")}</Menu.Label>

        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.ACCOUNT.PROFILE}
          leftSection={<IconUserCircle size={16} />}
        >
          {t("My profile")}
        </Menu.Item>

        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.ACCOUNT.PREFERENCES}
          leftSection={<IconBrush size={16} />}
        >
          {t("My preferences")}
        </Menu.Item>

        <Menu.Sub>
          <Menu.Sub.Target>
            <Menu.Sub.Item leftSection={<IconBrightnessFilled size={16} />}>
              {t("Theme")}
            </Menu.Sub.Item>
          </Menu.Sub.Target>

          <Menu.Sub.Dropdown>
            <Menu.Item
              onClick={() => setColorScheme("light")}
              leftSection={<IconSun size={16} />}
              rightSection={
                colorScheme === "light" ? <IconCheck size={16} /> : null
              }
            >
              {t("Light")}
            </Menu.Item>
            <Menu.Item
              onClick={() => setColorScheme("dark")}
              leftSection={<IconMoon size={16} />}
              rightSection={
                colorScheme === "dark" ? <IconCheck size={16} /> : null
              }
            >
              {t("Dark")}
            </Menu.Item>
            <Menu.Item
              onClick={() => setColorScheme("auto")}
              leftSection={<IconDeviceDesktop size={16} />}
              rightSection={
                colorScheme === "auto" ? <IconCheck size={16} /> : null
              }
            >
              {t("System settings")}
            </Menu.Item>
          </Menu.Sub.Dropdown>
        </Menu.Sub>

        <Menu.Divider />

        <Menu.Item onClick={logout} leftSection={<IconLogout size={16} />}>
          {t("Logout")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
