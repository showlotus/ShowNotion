import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Group, Select, Tooltip } from "@mantine/core";
import { CopyButton } from "@/components/common/copy-button";
import { useEffect, useState } from "react";
import { IconCheck, IconCopy, IconCornerDownLeft } from "@tabler/icons-react";
import classes from "./code-block.module.css";
import React from "react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";

const MermaidView = React.lazy(
  () => import("@/features/editor/components/code-block/mermaid-view.tsx"),
);

// Pretty display names (Notion-style); values stay raw ids for highlight.js.
const LANGUAGE_LABELS: Record<string, string> = {
  abap: "ABAP",
  bash: "Bash",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  graphql: "GraphQL",
  ini: "INI",
  javascript: "JavaScript",
  json: "JSON",
  mermaid: "Mermaid",
  objectivec: "Objective-C",
  php: "PHP",
  "php-template": "PHP Template",
  phptemplate: "PHP Template",
  plaintext: "Plain Text",
  powershell: "PowerShell",
  "python-repl": "Python REPL",
  pythonrepl: "Python REPL",
  scss: "SCSS",
  typescript: "TypeScript",
  vbnet: "VB.NET",
  wasm: "WebAssembly",
  xml: "XML",
};

function languageLabel(language: string): string {
  return (
    LANGUAGE_LABELS[language] ??
    language.charAt(0).toUpperCase() + language.slice(1)
  );
}

export default function CodeBlockView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, updateAttributes, extension, editor, getPos } = props;
  const { language, wrap } = node.attrs;
  const [languageValue, setLanguageValue] = useState<string | null>(
    language || null,
  );
  const [isSelected, setIsSelected] = useState(false);

  useEffect(() => {
    const updateSelection = () => {
      const { state } = editor;
      const { from, to } = state.selection;
      // Check if the selection intersects with the node's range
      const isNodeSelected =
        (from >= getPos() && from < getPos() + node.nodeSize) ||
        (to > getPos() && to <= getPos() + node.nodeSize);
      setIsSelected(isNodeSelected);
    };

    editor.on("selectionUpdate", updateSelection);
    return () => {
      editor.off("selectionUpdate", updateSelection);
    };
  }, [editor, getPos(), node.nodeSize]);

  function changeLanguage(language: string) {
    setLanguageValue(language);
    updateAttributes({
      language: language,
    });
  }

  const languageOptions = extension.options.lowlight
    .listLanguages()
    .sort()
    .map((lang: string) => ({ value: lang, label: languageLabel(lang) }));

  return (
    <NodeViewWrapper className={`codeBlock ${classes.wrapper}`}>
      <Group
        justify="flex-end"
        wrap="nowrap"
        gap={6}
        contentEditable={false}
        className={`${classes.menuGroup} ${isSelected ? classes.menuPinned : ""}`}
      >
        <Select
          placeholder={t("Auto")}
          checkIconPosition="right"
          data={languageOptions}
          value={languageValue}
          onChange={changeLanguage}
          searchable
          style={{ maxWidth: 130 }}
          classNames={{ input: classes.selectInput }}
          disabled={!editor.isEditable}
        />

        <Tooltip label={t("Wrap lines")} withArrow position="right">
          <ActionIcon
            variant="subtle"
            color={wrap ? "blue" : "gray"}
            aria-label={t("Wrap lines")}
            aria-pressed={Boolean(wrap)}
            onClick={() => updateAttributes({ wrap: !wrap })}
          >
            <IconCornerDownLeft size={16} />
          </ActionIcon>
        </Tooltip>

        <CopyButton value={node?.textContent} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? t("Copied") : t("Copy")}
              withArrow
              position="right"
            >
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                onClick={copy}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>

      <pre spellCheck="false" className={classes.pre} hidden={
          ((language === "mermaid" && !editor.isEditable) ||
            (language === "mermaid" && !isSelected)) &&
          node.textContent.length > 0
        }>
        {/* @ts-ignore */}
        <NodeViewContent as="code" className={`language-${language}`} style={{ whiteSpace: wrap ? "pre-wrap" : "pre", overflowWrap: wrap ? "break-word" : undefined }} />
      </pre>

      {language === "mermaid" && (
        <Suspense fallback={null}>
          <MermaidView props={props} />
        </Suspense>
      )}
    </NodeViewWrapper>
  );
}
