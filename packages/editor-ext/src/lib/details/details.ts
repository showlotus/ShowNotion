import {
  Node,
  findChildren,
  findParentNode,
  mergeAttributes,
  wrappingInputRule,
} from "@tiptap/core";
import { icon, setAttributes } from "../utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    details: {
      setDetails: (options?: SetDetailsOptions) => ReturnType;
      setToggleHeading: (level: number) => ReturnType;
      unsetDetails: () => ReturnType;
      toggleDetails: () => ReturnType;
    };
  }
}

export interface DetailsOptions {
  HTMLAttributes: Record<string, any>;
}

export interface SetDetailsOptions {
  /** 0 = plain toggle block, 1-3 = heading-styled toggle (toggle heading). */
  level?: number;
  open?: boolean;
}

export const Details = Node.create<DetailsOptions>({
  name: "details",
  group: "block",
  content: "detailsSummary detailsContent",
  defining: true,
  isolating: true,
  // @ts-ignore
  allowGapCursor: false,
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (e) => e.getAttribute("open"),
        renderHTML: (a) => (a.open ? { open: "" } : {}),
      },
      level: {
        default: 0,
        parseHTML: (e) => {
          const level = Number(e.getAttribute("data-level"));
          return level >= 1 && level <= 3 ? level : 0;
        },
        renderHTML: (a) => (a.level ? { "data-level": String(a.level) } : {}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "details",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      const btn = document.createElement("button");
      const ico = document.createElement("div");
      const div = document.createElement("div");

      for (const [key, value] of Object.entries(
        mergeAttributes(this.options.HTMLAttributes),
      )) {
        if (value !== undefined && value !== null) {
          dom.setAttribute(key, value);
        }
      }

      dom.setAttribute("data-type", this.name);
      const setLevel = (level: number) => {
        if (level > 0) {
          dom.setAttribute("data-level", String(level));
        } else {
          dom.removeAttribute("data-level");
        }
      };
      setLevel(node.attrs.level ?? 0);
      btn.setAttribute("data-type", `${this.name}Button`);
      div.setAttribute("data-type", `${this.name}Container`);

      if (node.attrs.open) {
        dom.setAttribute("open", "true");
      } else {
        dom.removeAttribute("open");
      }

      ico.innerHTML = icon("right-line");
      btn.addEventListener("click", () => {
        const open = !dom.hasAttribute("open");

        if (!editor.isEditable) {
          // In readonly mode,  toggle the 'open' attribute without updating the document state.
          if (open) {
            dom.setAttribute("open", "true");
          } else {
            dom.removeAttribute("open");
          }
          return;
        }

        setAttributes(editor, getPos, { ...node.attrs, open });
      });

      btn.append(ico);
      dom.append(btn);
      dom.append(div);
      return {
        dom,
        contentDOM: div,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }
          setLevel(updatedNode.attrs.level ?? 0);
          if (updatedNode.attrs.open) {
            dom.setAttribute("open", "true");
          } else {
            dom.removeAttribute("open");
          }
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setDetails: (options?: SetDetailsOptions) => {
        return ({ state, chain }) => {
          const range = state.selection.$from.blockRange(state.selection.$to);
          if (!range) {
            return false;
          }

          const slice = state.doc.slice(range.start, range.end);

          if (slice.content.firstChild.type.name === "detailsSummary")
            return false;

          if (
            !state.schema.nodes.detailsContent.contentMatch.matchFragment(
              slice.content,
            )
          ) {
            return false;
          }

          return chain()
            .insertContentAt(
              {
                from: range.start,
                to: range.end,
              },
              {
                type: this.name,
                attrs: {
                  open: options?.open ?? true,
                  level: options?.level
                    ? Math.min(Math.max(options.level, 1), 3)
                    : 0,
                },
                content: [
                  {
                    type: "detailsSummary",
                  },
                  {
                    type: "detailsContent",
                    content: slice.toJSON()?.content ?? [],
                  },
                ],
              },
            )
            .setTextSelection(range.start + 2)
            .run();
        };
      },

      unsetDetails: () => {
        return ({ state, chain }) => {
          const parent = findParentNode((node) => node.type === this.type)(
            state.selection,
          );
          if (!parent) {
            return false;
          }

          const summary = findChildren(
            parent.node,
            (node) => node.type.name === "detailsSummary",
          );
          const content = findChildren(
            parent.node,
            (node) => node.type.name === "detailsContent",
          );
          if (!summary.length || !content.length) {
            return false;
          }

          const range = {
            from: parent.pos,
            to: parent.pos + parent.node.nodeSize,
          };
          const level = parent.node.attrs.level ?? 0;
          const defaultType = state.doc.resolve(range.from).parent.type
            .contentMatch.defaultType;
          const summaryNode = level
            ? state.schema.nodes.heading.create(
                { level },
                summary[0].node.content,
              )
            : defaultType?.create(null, summary[0].node.content);

          if (!summaryNode) {
            return false;
          }

          return chain()
            .insertContentAt(range, [
              summaryNode.toJSON(),
              ...(content[0].node.content.toJSON() ?? []),
            ])
            .setTextSelection(range.from + 1)
            .run();
        };
      },

      toggleDetails: () => {
        return ({ state, chain }) => {
          const node = findParentNode((node) => node.type === this.type)(
            state.selection,
          );
          if (node) {
            return chain().unsetDetails().run();
          } else {
            return chain().setDetails().run();
          }
        };
      },

      setToggleHeading: (level: number) => {
        return ({ state, chain }) => {
          const normalizedLevel = Math.min(Math.max(level, 1), 3);
          const { $from } = state.selection;

          // Only a selection inside the summary edits the owning toggle in
          // place; selections deeper in the content must not retarget an
          // ancestor toggle.
          if ($from.parent.type.name === "detailsSummary") {
            const parentDetails = findParentNode(
              (node) => node.type === this.type,
            )(state.selection);

            if (parentDetails) {
              const attrs = {
                ...parentDetails.node.attrs,
                level: normalizedLevel,
              };
              return chain()
                .command(({ tr }) => {
                  tr.setNodeMarkup(parentDetails.pos, undefined, attrs);
                  return true;
                })
                .run();
            }
          }

          if ($from.parent.type.name === "heading") {
            const heading = $from.parent;
            const parent = $from.node(-1);
            const index = $from.index(-1);
            let end = $from.after();

            for (let i = index + 1; i < parent.childCount; i++) {
              const sibling = parent.child(i);
              const siblingLevel =
                sibling.type.name === "heading"
                  ? sibling.attrs.level
                  : sibling.type.name === "details" && sibling.attrs.level > 0
                    ? sibling.attrs.level
                    : null;

              if (siblingLevel !== null && siblingLevel <= heading.attrs.level) {
                break;
              }
              end += sibling.nodeSize;
            }

            const slice = state.doc.slice($from.after(), end);

            return chain()
              .insertContentAt(
                { from: $from.before(), to: end },
                {
                  type: this.name,
                  attrs: { open: true, level: normalizedLevel },
                  content: [
                    {
                      type: "detailsSummary",
                      content: heading.content.toJSON(),
                    },
                    {
                      type: "detailsContent",
                      content: slice.toJSON()?.content ?? [],
                    },
                  ],
                },
              )
              .setTextSelection($from.before() + 2)
              .run();
          }

          if ($from.parent.isTextblock) {
            const block = $from.parent;
            const from = $from.before();
            return chain()
              .insertContentAt(
                { from, to: $from.after() },
                {
                  type: this.name,
                  attrs: { open: true, level: normalizedLevel },
                  content: [
                    {
                      type: "detailsSummary",
                      content: block.content.toJSON(),
                    },
                    { type: "detailsContent" },
                  ],
                },
              )
              .setTextSelection(from + 2)
              .run();
          }

          return chain().setDetails({ level: normalizedLevel }).run();
        };
      },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^:::details\s$/,
        type: this.type,
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-d": () => this.editor.commands.toggleDetails(),
    };
  },
});
