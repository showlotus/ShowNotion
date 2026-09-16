import { ActionIcon, Tooltip } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { htmlToMarkdown } from "@docmost/editor-ext";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useClipboard } from "@/hooks/use-clipboard";

export default function ShareCopyPage({ pageTitle }: { pageTitle?: string }) {
  const { t } = useTranslation();
  const editor = useAtomValue(readOnlyEditorAtom);
  const clipboard = useClipboard();

  if (!editor) {
    return null;
  }

  const handleCopy = () => {
    if (editor.isDestroyed) return;
    const markdown = htmlToMarkdown(editor.getHTML());
    const title = pageTitle ? `# ${pageTitle}\n\n` : "";
    clipboard.copy(`${title}${markdown}`);
  };

  return (
    <Tooltip
      label={clipboard.copied ? t("Copied") : t("Copy page")}
      openDelay={250}
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="md"
        onClick={handleCopy}
        aria-label={t("Copy page")}
      >
        {clipboard.copied ? (
          <IconCheck size={18} stroke={1.75} />
        ) : (
          <IconCopy size={18} stroke={1.75} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
