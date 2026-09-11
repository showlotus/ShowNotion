import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";

// 匹配单个 emoji：基础图形字符，可带变体选择符、零宽连接序列与肤色修饰符
const emojiRegex =
  /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;

// 扫描文档内所有 emoji 字符，为其生成独立字体栈的 inline 装饰。
// Notion 会给 emoji 包裹 Apple Color Emoji 字体栈，Chrome 据此把选区
// 高亮撑高（24px 标题行 32px 而非 28px）；此处复刻同一行为
function buildEmojiDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    for (const match of node.text.matchAll(emojiRegex)) {
      const from = pos + (match.index ?? 0);
      decorations.push(
        Decoration.inline(from, from + match[0].length, {
          class: "editor-emoji",
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const EmojiDecoration = Extension.create({
  name: "emojiDecoration",

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("emojiDecoration");

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: (_, { doc }) => buildEmojiDecorations(doc),
          // 仅文档变化时重建，其余事务只做装饰位置映射，避免每次选区/光标的开销
          apply: (tr, oldSet) =>
            tr.docChanged
              ? buildEmojiDecorations(tr.doc)
              : oldSet.map(tr.mapping, tr.doc),
        },
        props: {
          decorations: (state) => pluginKey.getState(state),
        },
      }),
    ];
  },
});

export default EmojiDecoration;
