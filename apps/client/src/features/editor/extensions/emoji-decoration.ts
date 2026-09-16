import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";

// Match a single emoji: a base pictographic character, optionally with variation
// selectors, zero-width joiner sequences, and skin-tone modifiers
const emojiRegex =
  /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu;

// Scan the document for all emoji characters and give each an inline decoration
// with a dedicated font stack. Notion wraps emoji in an Apple Color Emoji font
// stack, which Chrome uses to stretch selection highlights taller (a 24px
// heading line becomes 32px instead of 28px); replicate the same behavior here.
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
          // Rebuild only when the document changes; other transactions just map
          // decoration positions, avoiding per-selection/cursor overhead
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
