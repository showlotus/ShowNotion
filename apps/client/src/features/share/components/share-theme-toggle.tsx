import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export default function ShareThemeToggle() {
  const { t } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light");

  return (
    <Tooltip label={t("Toggle color scheme")} openDelay={250}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        onClick={() =>
          setColorScheme(computedColorScheme === "light" ? "dark" : "light")
        }
        aria-label={t("Toggle color scheme")}
      >
        {computedColorScheme === "light" ? (
          <IconMoon size={18} stroke={1.75} />
        ) : (
          <IconSun size={18} stroke={1.75} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
