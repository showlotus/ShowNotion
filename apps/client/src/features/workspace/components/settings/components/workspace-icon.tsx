import { Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import WorkspaceIconPicker from "@/features/workspace/components/workspace-icon-picker.tsx";

export default function WorkspaceIcon() {
  const { t } = useTranslation();

  return (
    <div style={{ marginBottom: "24px" }}>
      <Text size="sm" fw={500} mb="xs">
        {t("Icon")}
      </Text>
      <WorkspaceIconPicker size={44} emojiSize={26} />
    </div>
  );
}
