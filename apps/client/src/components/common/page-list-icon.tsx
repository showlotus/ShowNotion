import { ThemeIcon } from "@mantine/core";
import { IconFileDescription, IconTable } from "@tabler/icons-react";

type Props = {
  icon?: string | null;
  isBase?: boolean;
};

export function PageListIcon({ icon, isBase }: Props) {
  if (icon) {
    return <>{icon}</>;
  }
  return (
    <ThemeIcon variant="transparent" color="gray" size={20}>
      {isBase ? <IconTable size={20} /> : <IconFileDescription size={20} />}
    </ThemeIcon>
  );
}
