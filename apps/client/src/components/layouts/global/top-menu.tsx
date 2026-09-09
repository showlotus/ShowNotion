import {
  Menu,
  Text,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconBrightnessFilled,
  IconBrush,
  IconCheck,
  IconChevronDown,
  IconDeviceDesktop,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconUser,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { getSpaceUrl } from "@/lib/config.ts";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { usePersonalSpaceQuery } from "@/ee/personal-space/queries/personal-space-query";
import CreatePersonalSpaceModal from "@/ee/personal-space/components/create-personal-space-modal";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import useAuth from "@/features/auth/hooks/use-auth.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { useTranslation } from "react-i18next";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import classes from "./top-menu.module.css";

// 侧边栏顶部的工作区菜单：工作区设置、成员管理、个人空间
export default function TopMenu() {
  const { t } = useTranslation();
  const [currentUser] = useAtom(currentUserAtom);

  const workspace = currentUser?.workspace;

  const hasPersonalSpaces = useHasFeature(Feature.PERSONAL_SPACES);
  const settingEnabled = workspace?.settings?.spaces?.allowPersonal === true;
  const { data: personalSpace } = usePersonalSpaceQuery(hasPersonalSpaces);
  const [
    createOpened,
    { open: openCreate, close: closeCreate },
  ] = useDisclosure(false);

  if (!workspace) {
    return <></>;
  }

  return (
    <>
    <Menu width={250} position="bottom-start" shadow={"lg"}>
      <Menu.Target>
        <UnstyledButton className={classes.trigger} aria-label={workspace?.name}>
          <CustomAvatar
            avatarUrl={workspace?.logo}
            name={workspace?.name}
            variant="filled"
            size="sm"
            type={AvatarIconType.WORKSPACE_ICON}
          />
          <Text fw={500} size="sm" lh={1} className={classes.triggerName} lineClamp={1}>
            {workspace?.name}
          </Text>
          <IconChevronDown size={16} className={classes.triggerChevron} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t("Workspace")}</Menu.Label>

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
