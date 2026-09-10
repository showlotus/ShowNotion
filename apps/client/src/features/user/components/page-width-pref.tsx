import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import { MantineSize, Switch, Text } from "@mantine/core";
import { useAtom } from "jotai/index";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveSettingsRow, ResponsiveSettingsContent, ResponsiveSettingsControl } from "@/components/ui/responsive-settings-row";

export default function PageWidthPref() {
  const { t } = useTranslation();

  return (
    <ResponsiveSettingsRow>
      <ResponsiveSettingsContent>
        <Text size="md">{t("Full page width")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose your preferred page width.")}
        </Text>
      </ResponsiveSettingsContent>

      <ResponsiveSettingsControl>
        <PageWidthToggle />
      </ResponsiveSettingsControl>
    </ResponsiveSettingsRow>
  );
}

interface PageWidthToggleProps {
  size?: MantineSize;
  label?: string;
}

export function PageWidthToggle({ size, label }: PageWidthToggleProps) {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const atomChecked = user?.settings?.preferences?.fullPageWidth ?? false;
  // 本地优先值：点击后立即翻转开关，不被全局渲染与网络阻塞
  const [localChecked, setLocalChecked] = useState<boolean | null>(null);
  const reqIdRef = useRef(0);
  const checked = localChecked ?? atomChecked;

  // 乐观更新：本地 state 即时翻转，全局 atom 以过渡渲染跟随，失败时回滚
  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    if (!user) return;
    const prevUser = user;
    const seq = ++reqIdRef.current;
    setLocalChecked(value);
    React.startTransition(() => {
      setUser({
        ...user,
        settings: {
          ...user.settings,
          preferences: {
            ...user.settings.preferences,
            fullPageWidth: value,
          },
        },
      });
    });
    try {
      const updatedUser = await updateUser({ fullPageWidth: value });
      if (seq !== reqIdRef.current) return;
      setUser(updatedUser);
      setLocalChecked(null);
    } catch {
      if (seq !== reqIdRef.current) return;
      React.startTransition(() => setUser(prevUser));
      setLocalChecked(null);
    }
  };

  return (
    <Switch
      size={size}
      label={label}
      labelPosition="left"
      checked={checked}
      onChange={handleChange}
      aria-label={t("Toggle full page width")}
    />
  );
}
