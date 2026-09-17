import { FC } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Button, Menu } from "@mantine/core";
import {
  IconBlockquote,
  IconBraces,
  IconChevronDown,
  IconH1,
  IconH2,
  IconH3,
  IconMenu4,
  IconPageBreak,
  IconTypography,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IconToggleHeading1 } from "@/components/icons/icon-toggle-heading-1";
import { IconToggleHeading2 } from "@/components/icons/icon-toggle-heading-2";
import { IconToggleHeading3 } from "@/components/icons/icon-toggle-heading-3";

interface Props {
  editor: Editor;
}

export const BlockTypeGroup: FC<Props> = ({ editor }) => {
  const { t } = useTranslation();

  const state = useEditorState({
    editor,
    selector: (ctx) => {
      // Toggle states describe the block holding the selection, not any
      // ancestor: read the level off the nearest details instead of using
      // `isActive("details")`, which also matches enclosing toggles.
      const $from = ctx.editor?.state.selection.$from;
      const toggleLevel =
        $from && $from.parent.type.name === "detailsSummary"
          ? Number($from.node(-1)?.attrs?.level ?? 0)
          : -1;

      return {
        isHeading1: !!ctx.editor?.isActive("heading", { level: 1 }),
        isHeading2: !!ctx.editor?.isActive("heading", { level: 2 }),
        isHeading3: !!ctx.editor?.isActive("heading", { level: 3 }),
        isToggleHeading1: toggleLevel === 1,
        isToggleHeading2: toggleLevel === 2,
        isToggleHeading3: toggleLevel === 3,
        isBlockquote: !!ctx.editor?.isActive("blockquote"),
        isCodeBlock: !!ctx.editor?.isActive("codeBlock"),
      };
    },
  });

  let label = t("Normal text");
  if (state.isHeading1) label = t("Heading 1");
  else if (state.isHeading2) label = t("Heading 2");
  else if (state.isHeading3) label = t("Heading 3");
  else if (state.isToggleHeading1) label = t("Toggle heading 1");
  else if (state.isToggleHeading2) label = t("Toggle heading 2");
  else if (state.isToggleHeading3) label = t("Toggle heading 3");
  else if (state.isBlockquote) label = t("Quote");
  else if (state.isCodeBlock) label = t("Code block");

  return (
    <Menu shadow="md" position="bottom-start" withArrow={false} floatingStrategy="fixed">
      <Menu.Target>
        <Button
          variant="subtle"
          color="dark"
          size="xs"
          rightSection={<IconChevronDown size={14} />}
        >
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconTypography size={16} />}
          onClick={() =>
            editor.chain().focus().toggleNode("paragraph", "paragraph").run()
          }
        >
          {t("Text")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconH1 size={16} />}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          {t("Heading 1")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconH2 size={16} />}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          {t("Heading 2")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconH3 size={16} />}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          {t("Heading 3")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconToggleHeading1 size={16} />}
          onClick={() => editor.chain().focus().setToggleHeading(1).run()}
        >
          {t("Toggle heading 1")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconToggleHeading2 size={16} />}
          onClick={() => editor.chain().focus().setToggleHeading(2).run()}
        >
          {t("Toggle heading 2")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconToggleHeading3 size={16} />}
          onClick={() => editor.chain().focus().setToggleHeading(3).run()}
        >
          {t("Toggle heading 3")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconBlockquote size={16} />}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          {t("Quote")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconBraces size={16} />}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          {t("Code block")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconMenu4 size={16} />}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          {t("Divider")}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconPageBreak size={16} />}
          onClick={() => editor.chain().focus().setPageBreak().run()}
        >
          {t("Page break")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
