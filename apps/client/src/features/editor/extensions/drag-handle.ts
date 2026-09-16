import { Extension } from "@tiptap/core";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
} from "@tiptap/pm/state";
import { Fragment, Slice, Node } from "@tiptap/pm/model";
import { dropPoint } from "@tiptap/pm/transform";
import { EditorView } from "@tiptap/pm/view";
import { getScrollContainer } from "@/hooks/use-scroll-container.ts";

export interface GlobalDragHandleOptions {
  /**
   * The width of the drag handle
   */
  dragHandleWidth: number;

  /**
   * Gap between the handle and the block's visual left edge
   */
  dragHandleGap: number;

  /**
   * The treshold for scrolling
   */
  scrollThreshold: number;

  /*
   * The css selector to query for the drag handle. (eg: '.custom-handle').
   * If handle element is found, that element will be used as drag handle. If not, a default handle will be created
   */
  dragHandleSelector?: string;

  /**
   * Tags to be excluded for drag handle
   */
  excludedTags: string[];

  /**
   * Custom nodes to be included for drag handle
   */
  customNodes: string[];

  atomNodes: string[];
}
function absoluteRect(node: Element) {
  const data = node.getBoundingClientRect();
  const modal = node.closest('[role="dialog"]');

  if (modal && window.getComputedStyle(modal).transform !== "none") {
    const modalRect = modal.getBoundingClientRect();

    return {
      top: data.top - modalRect.top,
      left: data.left - modalRect.left,
      width: data.width,
    };
  }
  return {
    top: data.top,
    left: data.left,
    width: data.width,
  };
}

// Code blocks render as .react-renderer.node-codeBlock > .codeBlock (toolbar + pre);
// when any inner element is hit, normalize it to the renderer's outer wrapper
function codeBlockRenderer(node: Element): Element | null {
  return node.closest(".react-renderer.node-codeBlock");
}

function nodeDOMAtCoords(
  coords: { x: number; y: number },
  options: GlobalDragHandleOptions,
  view: EditorView,
) {
  // Custom nodes (transclusion, …) render via tiptap's React node-view
  // renderer, which emits `class="react-renderer node-${name}"` on the
  // live wrapper — the `data-type` attribute is for static HTML
  // serialization only. Match both so we cover live and parsed DOM.
  // Inside a custom node, also match plain `p` so the first paragraph
  // (which doesn't match `:not(:first-child)`) still gets its own
  // handle; only hovers on the custom node's padding/border fall
  // through to the wrapper.
  const customSelectors = options.customNodes.flatMap((node) => [
    `[data-type=${node}]`,
    `.node-${node}`,
  ]);
  const customParagraphSelectors = options.customNodes.flatMap((node) => [
    `[data-type=${node}] p`,
    `.node-${node} p`,
  ]);
  const atomSelectors = options.atomNodes.flatMap((node) => [
    `[data-type=${node}]`,
    `.node-${node}`,
  ]);

  const selectors = [
    "li",
    "p:not(:first-child)",
    "pre",
    "blockquote",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // Tables nested in another block (toggle, transclusion, …) have a
    // wrapper that isn't a direct child of .ProseMirror, so the
    // parent-check below skips it. Match the wrapper explicitly so the
    // handle shows up even with empty cells.
    ".tableWrapper",
    // Standalone leaf blocks (horizontal rule, images and other media): when nested
    // inside containers like list items or blockquotes the parent check fails,
    // so match them explicitly to let the handle hit the blocks themselves
    "hr",
    ".node-image",
    ".node-video",
    ".node-audio",
    ".node-drawio",
    ".node-excalidraw",
    "[data-youtube-video]",
    // The "first child block" of toggle/column blocks would otherwise resolve up
    // to the container itself, making the handle jump to the container gutter
    // (inconsistent with later sibling blocks in the same container); matching
    // direct children explicitly lets each child hit itself
    "[data-type='detailsContent'] > *",
    "[data-type='column'] > *",
    // Callout/toggle blocks themselves: when nested inside blockquotes, list items
    // and other containers the parent check fails, so match them explicitly,
    // otherwise the handle falls to the outer container (pinned to the container's
    // first line, clicking selects the wrong block)
    ".node-callout",
    "[data-type='callout']",
    "[data-type='details']",
    ...customParagraphSelectors,
    ...customSelectors,
    ...atomSelectors,
  ].join(", ");
  const elements = document.elementsFromPoint(coords.x, coords.y);

  // Code block: hits on the toolbar/padding/code body all normalize to the code
  // block itself, otherwise ancestors like the outer details get hit and the
  // handle jumps
  const codeBlockHit = elements.find(
    (elem) =>
      elem.closest(".ProseMirror") === view.dom && !!codeBlockRenderer(elem),
  );
  if (codeBlockHit) {
    const renderer = codeBlockRenderer(codeBlockHit);
    if (renderer) return renderer;
  }

  const found = elements.find((elem: Element) => {
    // Skip elements that belong to a nested editor (e.g. transclusion
    // references render their own ProseMirror instance). Only consider
    // elements whose closest editor is this host view.
    if (elem.closest(".ProseMirror") !== view.dom) return false;
    return (
      elem.parentElement?.matches?.(".ProseMirror") ||
      elem.matches(selectors)
    );
  });
  if (found && atomSelectors.length > 0) {
    const atomWrapper = found.closest(atomSelectors.join(", "));
    if (atomWrapper) return atomWrapper;
  }
  return found;
}
function nodePosAtDOM(
  node: Element,
  view: EditorView,
  options: GlobalDragHandleOptions,
) {
  // Probe coordinates against the code block's inner pre so hits on the top
  // toolbar still resolve to a node
  const probe = codeBlockRenderer(node)?.querySelector("pre") ?? node;
  const boundingRect = probe.getBoundingClientRect();

  return view.posAtCoords({
    left: boundingRect.left + 50 + options.dragHandleWidth,
    top: boundingRect.top + 1,
  })?.inside;
}

function isCustomNodeDOM(
  elem: Element | null | undefined,
  options: GlobalDragHandleOptions,
): boolean {
  if (!elem) return false;
  for (const name of [...options.customNodes, ...options.atomNodes]) {
    if (
      elem.getAttribute("data-type") === name ||
      elem.classList.contains(`node-${name}`)
    ) {
      return true;
    }
  }
  return false;
}

// A list item's marker is drawn in the parent list's indent area outside the li
// box; return the list element that owns the li
function listMarkerZone(node: Element): Element | null {
  return node.matches("ul:not([data-type=taskList]) li, ol li")
    ? node.parentElement
    : null;
}

// Containers with a left decoration bar/icon (blockquote bar, callout icon): the
// handle of inner child blocks must yield to the left of the container's outer
// edge; take the outermost one when nested (per Notion). Toggles and columns are
// not decoration containers — toggle/column children align to their own
// block/column edge
const DECORATION_CONTAINER_SELECTOR =
  "blockquote, .react-renderer.node-callout";

function decorationGutter(node: Element): Element | null {
  let leftmost: Element | null = null;
  let minLeft = Infinity;
  for (
    let el = node.closest(DECORATION_CONTAINER_SELECTOR);
    el;
    el = el.parentElement?.closest(DECORATION_CONTAINER_SELECTOR) ?? null
  ) {
    const left = absoluteRect(el).left;
    if (left < minLeft) {
      minLeft = left;
      leftmost = el;
    }
  }
  return leftmost;
}

// Any block inside a list item (subsequent paragraphs of a multi-paragraph item,
// horizontal rules, images, etc.) aligns to the owning list's marker gutter;
// not applicable to task lists since their checkboxes live inside the li box
function listOwnerZone(node: Element): Element | null {
  const li = node.closest("li");
  const list = li?.parentElement;
  if (!list || !/^(UL|OL)$/.test(list.tagName)) return null;
  if (list.matches('ul[data-type="taskList"]')) return null;
  return list;
}

function calcNodePos(pos: number, view: EditorView) {
  const $pos = view.state.doc.resolve(pos);
  if ($pos.depth > 1) return $pos.before($pos.depth);
  return pos;
}

// Container nodes selectable as a whole: hitting one selects the entire
// container, with all child blocks below selected along with it
const blockContainerTypes = new Set([
  "listItem",
  "taskItem",
  "details",
  "blockquote",
  "callout",
]);

// Block types supported by the selection halo: the highlight is drawn on a
// separate halo layer, not on the block element itself
const haloBlockTypes = new Set([
  "paragraph",
  "heading",
  "listItem",
  "taskItem",
  "blockquote",
  "details",
  "codeBlock",
  "callout",
  "horizontalRule",
  "image",
  "table",
]);

// Resolve the anchor position (start of the element's content) of the found DOM
// element in the document, used to determine which block it represents
function anchorPosAtDOM(view: EditorView, node: Element): number | null {
  try {
    const pos = view.posAtDOM(node, 0);
    return pos >= 0 ? pos : null;
  } catch {
    return null;
  }
}

// Compute the block selection: prefer the nearest container node's whole subtree,
// otherwise fall back to the single-node selection rules
function blockTreeSelection(
  view: EditorView,
  node: Element,
  rawPos: number,
  options: GlobalDragHandleOptions,
): Selection {
  const doc = view.state.doc;

  // Standalone leaf blocks (horizontal rule, images, etc.): always select only
  // themselves even when nested inside list items/blockquotes, otherwise the
  // container promotion rules below would select the whole container
  const leafBlock = doc.nodeAt(rawPos);
  if (leafBlock?.isLeaf && leafBlock.isBlock) {
    return NodeSelection.create(doc, rawPos);
  }

  const anchorPos = anchorPosAtDOM(view, node) ?? rawPos;
  const $pos = doc.resolve(Math.min(anchorPos, doc.content.size));

  // Hitting the blockquote itself (bar/first line/padding) selects the whole quote
  if (node.matches("blockquote")) {
    return NodeSelection.create(doc, $pos.before($pos.depth));
  }

  for (let d = $pos.depth; d > 0; d--) {
    const typeName = $pos.node(d).type.name;
    // Never promote to a blockquote: text blocks inside a quote stay on themselves
    // (per Notion, quote children select individually), while containers
    // (list items/toggles/callouts) still promote as usual
    if (typeName === "blockquote") {
      break;
    }
    // Hitting a container (list item/toggle/blockquote/callout) selects the whole subtree
    if (blockContainerTypes.has(typeName)) {
      return NodeSelection.create(doc, $pos.before(d));
    }
    // Text blocks like paragraphs/headings keep walking up for a container; stop at
    // standalone blocks like code blocks and select them themselves
    if (typeName !== "paragraph" && typeName !== "heading") {
      break;
    }
  }

  return singleNodeSelection(view, node, calcNodePos(anchorPos, view), options);
}

// Compute the single-node selection: custom nodes select as a whole, tables
// promote to the whole table, inline nodes promote to the parent block
function singleNodeSelection(
  view: EditorView,
  node: Element,
  nodePos: number,
  options: GlobalDragHandleOptions,
): Selection {
  let selection = NodeSelection.create(view.state.doc, nodePos);

  const $sel = view.state.doc.resolve(selection.from);

  if (isCustomNodeDOM(node, options)) {
    // The drag landed on a custom-node container (transclusion etc.).
    // Walk up to the matching node so the drag moves the whole
    // container, not whatever inner element the click landed on.
    const customTypes = new Set([
      ...options.customNodes,
      ...options.atomNodes,
    ]);
    for (let d = $sel.depth; d > 0; d--) {
      if (customTypes.has($sel.node(d).type.name)) {
        selection = NodeSelection.create(view.state.doc, $sel.before(d));
        break;
      }
    }
  } else {
    // If the selected node lives inside a table (at any nesting
    // depth), promote to the whole table — the global drag handle is
    // meant to move the table as a single block, not a row/cell. The
    // earlier tableRow-only check only worked when the table sat at
    // the doc root; once wrapped in another node (toggle, layout,
    // etc.) the selection lands on a cell/paragraph and that check
    // never fired.
    let tableDepth = -1;
    for (let d = $sel.depth; d > 0; d--) {
      if ($sel.node(d).type.name === "table") {
        tableDepth = d;
        break;
      }
    }
    if (tableDepth > 0) {
      selection = NodeSelection.create(view.state.doc, $sel.before(tableDepth));
    } else if ((selection as NodeSelection).node.type.isInline) {
      // Inline node (e.g. mention): walk up to the parent block.
      selection = NodeSelection.create(view.state.doc, $sel.before());
    }
  }

  return selection;
}

export function DragHandlePlugin(
  options: GlobalDragHandleOptions & { pluginKey: string },
) {
  let listType = "";
  function handleDragStart(event: DragEvent, view: EditorView) {
    view.focus();

    if (!event.dataTransfer) return;

    const node =
      hoveredBlockElement && view.dom.contains(hoveredBlockElement)
        ? hoveredBlockElement
        : nodeDOMAtCoords(
            {
              x: event.clientX + 50 + options.dragHandleWidth,
              y: event.clientY,
            },
            options,
            view,
          );

    if (!(node instanceof Element)) return;

    const rawNodePos = nodePosAtDOM(node, view, options);
    if (rawNodePos == null || rawNodePos < 0) return;
    const draggedNodePos = calcNodePos(rawNodePos, view);

    const { from, to } = view.state.selection;
    const diff = from - to;

    const fromSelectionPos = calcNodePos(from, view);
    let differentNodeSelected = false;

    const nodePos = view.state.doc.resolve(fromSelectionPos);

    if (nodePos.node().type.name === "doc") differentNodeSelected = true;
    else {
      const nodeSelection = NodeSelection.create(
        view.state.doc,
        nodePos.before(),
      );

      // Check if the node where the drag event started is part of the current selection
      differentNodeSelected = !(
        draggedNodePos + 1 >= nodeSelection.$from.pos &&
        draggedNodePos <= nodeSelection.$to.pos
      );
    }
    let selection = view.state.selection;
    if (
      !differentNodeSelected &&
      diff !== 0 &&
      !(view.state.selection instanceof NodeSelection)
    ) {
      const endSelection = NodeSelection.create(view.state.doc, to - 1);
      selection = TextSelection.create(
        view.state.doc,
        draggedNodePos,
        endSelection.$to.pos,
      );
    } else {
      selection = blockTreeSelection(view, node, rawNodePos, options);
    }
    view.dispatch(view.state.tr.setSelection(selection));

    // If the selected node is a list item, we need to save the type of the wrapping list e.g. OL or UL
    if (
      view.state.selection instanceof NodeSelection &&
      view.state.selection.node.type.name === "listItem"
    ) {
      listType = node.parentElement!.tagName;
    }

    const slice = view.state.selection.content();
    const { dom, text } = view.serializeForClipboard(slice);

    event.dataTransfer.clearData();
    event.dataTransfer.setData("text/html", dom.innerHTML);
    event.dataTransfer.setData("text/plain", text);
    event.dataTransfer.effectAllowed = "move";

    const previewTemplate =
      node.querySelector<HTMLElement>("[data-drag-preview]");
    if (previewTemplate) {
      const preview = previewTemplate.cloneNode(true) as HTMLElement;
      preview.removeAttribute("hidden");
      preview.style.position = "fixed";
      preview.style.top = "0";
      preview.style.left = "-10000px";
      preview.style.pointerEvents = "none";
      document.body.appendChild(preview);
      event.dataTransfer.setDragImage(preview, 0, 0);
      document.addEventListener("dragend", () => preview.remove(), {
        once: true,
      });
    } else {
      event.dataTransfer.setDragImage(node, 0, 0);
    }

    view.dragging = { slice, move: event.ctrlKey };
    view.dom.classList.add("handle-drag");
    handleDragInProgress = true;
  }

  let dragHandleElement: HTMLElement | null = null;
  // Flag for drags initiated by the handle: only used to fix the selection after drop
  let handleDragInProgress = false;
  // The block the handle is currently hovering: a horizontal rule is only 13px
  // tall, so reverse-looking-up by click coords would land on the block below;
  // clicks and drags trust the block recorded by mousemove (matching Notion)
  let hoveredBlockElement: Element | null = null;

  // Drop feedback: Notion-style 4px translucent blue line + light highlight on the
  // container being dragged over
  let dropIndicatorElement: HTMLElement | null = null;
  let dropHoverElement: HTMLElement | null = null;
  let lastDropKey: string | null = null;

  function hideDropFeedback(view: EditorView) {
    dropIndicatorElement?.classList.remove("active");
    dropHoverElement?.classList.remove("active");
    lastDropKey = null;
    view.dom.classList.remove("handle-drag");
  }

  // Update drop feedback per Notion's measured geometry (2026-09):
  // the line snaps to the bottom edge of the block before the drop point
  // (bottom:-4px) or the top edge of the block after it (top:-4px), with the
  // anchor block's width (nested lists indent naturally); the light highlight is
  // drawn only on the container block (list item/quote/toggle/callout) nearest
  // the insertion point, and top-level inserts show none
  function updateDropIndicator(view: EditorView, event: DragEvent) {
    if (!handleDragInProgress || !view.dragging?.slice) return;

    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!pos) return;

    let target = pos.pos;
    const point = dropPoint(view.state.doc, target, view.dragging.slice);
    if (point != null) target = point;

    const $pos = view.state.doc.resolve(target);
    const before = $pos.nodeBefore;
    const key = `${target}:${before ? "below" : "above"}`;
    if (key === lastDropKey) return;
    lastDropKey = key;

    const container =
      (view.dom.closest(".editor-container") as HTMLElement | null) ??
      view.dom.parentElement;
    if (!container || !dropIndicatorElement || !dropHoverElement) return;
    const containerRect = container.getBoundingClientRect();

    const anchorDOM = view.nodeDOM(before ? target - before.nodeSize : target);
    if (anchorDOM instanceof HTMLElement) {
      const rect = anchorDOM.getBoundingClientRect();
      const lineTop = before ? rect.bottom : rect.top - 4;
      dropIndicatorElement.style.left = `${rect.left - containerRect.left}px`;
      dropIndicatorElement.style.top = `${lineTop - containerRect.top}px`;
      dropIndicatorElement.style.width = `${rect.width}px`;
      dropIndicatorElement.classList.add("active");
    } else {
      dropIndicatorElement.classList.remove("active");
    }

    let containerDOM: HTMLElement | null = null;
    for (let d = $pos.depth; d > 0; d--) {
      if (!blockContainerTypes.has($pos.node(d).type.name)) continue;
      const dom = view.nodeDOM($pos.before(d));
      if (dom instanceof HTMLElement) containerDOM = dom;
      break;
    }
    if (containerDOM) {
      const rect = containerDOM.getBoundingClientRect();
      dropHoverElement.style.left = `${rect.left - containerRect.left + 2}px`;
      dropHoverElement.style.top = `${rect.top - containerRect.top + 2}px`;
      dropHoverElement.style.width = `${Math.max(rect.width - 4, 0)}px`;
      dropHoverElement.style.height = `${Math.max(rect.height - 4, 0)}px`;
      dropHoverElement.classList.add("active");
    } else {
      dropHoverElement.classList.remove("active");
    }
  }

  function hideDragHandle() {
    // The selected state is selection-driven; mouse-out/scroll and other triggers
    // don't hide it
    if (dragHandleElement?.classList.contains("selected")) return;
    if (dragHandleElement) {
      dragHandleElement.classList.add("hide");
    }
  }

  function showDragHandle() {
    if (dragHandleElement) {
      dragHandleElement.classList.remove("hide");
    }
  }

  // Compute the handle position per Notion's gutter rules: the handle's right edge
  // sits dragHandleGap away from the block's visual left edge
  function computeHandlePosition(node: Element): { left: number; top: number } {
    // Child blocks inside quotes/callouts: the handle yields to the left of the
    // container's outer edge (per Notion). Left-decoration yielding: take the
    // leftmost of the quote bar/callout icon (outermost) and the owning list's
    // marker zone, so the handle clears all left decorations (per Notion)
    let gutterLeft: number | null = null;
    for (const zone of [decorationGutter(node), listOwnerZone(node)]) {
      if (zone) {
        const left = absoluteRect(zone).left;
        gutterLeft = gutterLeft == null ? left : Math.min(gutterLeft, left);
      }
    }

    // Code block: align the handle with the block's top row (block top +8px per
    // Notion), not the first line of code text
    const codeBlock = codeBlockRenderer(node);
    if (codeBlock) {
      const surface = codeBlock.querySelector(".codeBlock") ?? codeBlock;
      const rect = absoluteRect(surface);
      return {
        left:
          (gutterLeft ?? rect.left) -
          options.dragHandleWidth -
          options.dragHandleGap,
        top: rect.top + 8,
      };
    }

    // Horizontal rule: center the 24px handle vertically on the 13px rule
    // (handle and line share an axis per Notion)
    if (node.matches("hr")) {
      const rect = absoluteRect(node);
      const height = node.getBoundingClientRect().height;
      return {
        left:
          (gutterLeft ?? rect.left) -
          options.dragHandleWidth -
          options.dragHandleGap,
        top: rect.top + (height - 24) / 2,
      };
    }

    const compStyle = window.getComputedStyle(node);
    const parsedLineHeight = parseInt(compStyle.lineHeight, 10);
    const lineHeight = isNaN(parsedLineHeight)
      ? parseInt(compStyle.fontSize) * 1.2
      : parsedLineHeight;
    const paddingTop = parseInt(compStyle.paddingTop, 10);

    const rect = absoluteRect(node);
    rect.top += (lineHeight - 24) / 2;
    rect.top += paddingTop;

    // Marker zone/decoration container yielding: any block inside a list item
    // aligns to the list gutter (the li itself is naturally covered by
    // listOwnerZone, which supersedes the old markerZone rule)
    if (gutterLeft != null) {
      rect.left = gutterLeft;
    }
    // Tables: clear the table's own row-drag handle so the two
    // grips don't stack on each other. `nodeDOMAtCoords` returns
    // the wrapper for top-level hovers (wrapper is direct child of
    // .ProseMirror) and a descendant for deeper hovers — cover both.
    if (node.closest(".tableWrapper")) {
      rect.left -= options.dragHandleWidth;
    }

    return {
      left: rect.left - options.dragHandleWidth - options.dragHandleGap,
      top: rect.top,
    };
  }

  function hideHandleOnEditorOut(event: MouseEvent) {
    if (event.target instanceof Element) {
      // Check if the relatedTarget class is still inside the editor
      const relatedTarget = event.relatedTarget as HTMLElement;
      const isInsideEditor =
        relatedTarget?.classList.contains("tiptap") ||
        relatedTarget?.classList.contains("drag-handle");

      if (isInsideEditor) return;
    }
    hideDragHandle();
  }

  return new Plugin({
    key: new PluginKey(options.pluginKey),
    view: (view) => {
      const handleBySelector = options.dragHandleSelector
        ? document.querySelector<HTMLElement>(options.dragHandleSelector)
        : null;
      dragHandleElement = handleBySelector ?? document.createElement("div");
      dragHandleElement.draggable = true;
      dragHandleElement.dataset.dragHandle = "";
      dragHandleElement.classList.add("drag-handle");

      function onDragHandleDragStart(e: DragEvent) {
        handleDragStart(e, view);
      }

      dragHandleElement.addEventListener("dragstart", onDragHandleDragStart);

      // Clicking the handle selects the hovered block's whole subtree; the browser
      // doesn't fire click after a drag ends, so the two never interfere
      function onDragHandleClick(e: MouseEvent) {
        if (e.button !== 0) return;

        const node =
          hoveredBlockElement && view.dom.contains(hoveredBlockElement)
            ? hoveredBlockElement
            : nodeDOMAtCoords(
                {
                  x: e.clientX + 50 + options.dragHandleWidth,
                  y: e.clientY,
                },
                options,
                view,
              );

        if (!(node instanceof Element)) return;

        const rawNodePos = nodePosAtDOM(node, view, options);
        if (rawNodePos == null || rawNodePos < 0) return;

        const selection = blockTreeSelection(view, node, rawNodePos, options);
        view.dispatch(view.state.tr.setSelection(selection));
        view.focus();
      }

      dragHandleElement.addEventListener("click", onDragHandleClick);

      function onDragHandleDrag(e: DragEvent) {
        hideDragHandle();
        const scroller = getScrollContainer();
        const scrollTop = scroller ? scroller.scrollTop : window.scrollY;
        if (e.clientY < options.scrollThreshold) {
          if (scroller) {
            scroller.scrollTo({ top: scrollTop - 30, behavior: "smooth" });
          } else {
            window.scrollTo({ top: scrollTop - 30, behavior: "smooth" });
          }
        } else if (window.innerHeight - e.clientY < options.scrollThreshold) {
          if (scroller) {
            scroller.scrollTo({ top: scrollTop + 30, behavior: "smooth" });
          } else {
            window.scrollTo({ top: scrollTop + 30, behavior: "smooth" });
          }
        }
      }

      dragHandleElement.addEventListener("drag", onDragHandleDrag);

      function onDragHandleDragEnd() {
        handleDragInProgress = false;
        hideDropFeedback(view);
      }

      dragHandleElement.addEventListener("dragend", onDragHandleDragEnd);

      hideDragHandle();

      if (!handleBySelector) {
        view?.dom?.parentElement?.appendChild(dragHandleElement);
      }
      view?.dom?.parentElement?.addEventListener(
        "mouseout",
        hideHandleOnEditorOut,
      );

      // Selection highlight overlay: a separate DOM layer, geometry aligned with
      // Notion's notion-selectable-halo
      let selectionHaloElement: HTMLElement | null = null;
      let haloResizeObserver: ResizeObserver | null = null;

      function hideSelectionHalo() {
        selectionHaloElement?.classList.remove("active");
      }

      function hideSelectedDragHandle() {
        if (dragHandleElement?.classList.contains("selected")) {
          dragHandleElement.classList.remove("selected");
          hideDragHandle();
        }
      }

      // Text locking for selected blocks: Chrome ignores user-select:none on
      // editable content, so set contenteditable=false on the block while selected
      // (PM ignores the attribute change) and restore it on deselection
      let editableLockElement: HTMLElement | null = null;
      let editableLockPrevValue: string | null = null;

      function setEditableLockElement(element: HTMLElement | null) {
        if (editableLockElement === element) return;
        if (editableLockElement) {
          if (editableLockPrevValue == null) {
            editableLockElement.removeAttribute("contenteditable");
          } else {
            editableLockElement.setAttribute(
              "contenteditable",
              editableLockPrevValue,
            );
          }
        }
        editableLockElement = element;
        editableLockPrevValue = element
          ? element.getAttribute("contenteditable")
          : null;
        if (element) {
          element.setAttribute("contenteditable", "false");
        }
      }

      function updateSelectionHalo() {
        const halo = selectionHaloElement;
        if (!halo) return;

        const selection = view.state.selection;
        const lockDOM =
          view.editable &&
          selection instanceof NodeSelection &&
          haloBlockTypes.has(selection.node.type.name)
            ? view.nodeDOM(selection.from)
            : null;
        setEditableLockElement(lockDOM instanceof HTMLElement ? lockDOM : null);
        const container =
          (view.dom.closest(".editor-container") as HTMLElement | null) ??
          view.dom.parentElement;

        if (
          !view.editable ||
          view.dom.classList.contains("dragging") ||
          !(selection instanceof NodeSelection) ||
          !haloBlockTypes.has(selection.node.type.name) ||
          !container
        ) {
          hideSelectionHalo();
          hideSelectedDragHandle();
          return;
        }

        const nodeDOM = view.nodeDOM(selection.from);
        if (!(nodeDOM instanceof HTMLElement)) {
          hideSelectionHalo();
          hideSelectedDragHandle();
          return;
        }

        const rect = nodeDOM.getBoundingClientRect();
        // Don't show the halo when the selected block is hidden (e.g. collapsed content)
        if (rect.width === 0 && rect.height === 0) {
          hideSelectionHalo();
          hideSelectedDragHandle();
          return;
        }

        // A list item's marker sits outside the li box, so take the parent list box
        // as the block's visual left edge to keep the marker inside the highlight
        const markerZone = listMarkerZone(nodeDOM);
        const blockLeft = markerZone
          ? markerZone.getBoundingClientRect().left
          : rect.left;

        // Notion-style geometry (measured 2026-09): inset 2px vertically; since the
        // text box hugs the content column edge, expand 6px on each side so
        // text/elements sit 6px away from the halo edge
        const containerRect = container.getBoundingClientRect();
        const haloPadX = 6;
        halo.style.top = `${rect.top - containerRect.top + 2}px`;
        halo.style.height = `${Math.max(rect.height - 4, 0)}px`;
        halo.style.left = `${blockLeft - containerRect.left - haloPadX}px`;
        halo.style.width = `${Math.max(rect.right - blockLeft + haloPadX * 2, 0)}px`;
        halo.classList.add("active");

        // Put the handle into its selected state: position it on the selected block
        // and keep it visible
        if (dragHandleElement) {
          const pos = computeHandlePosition(nodeDOM);
          dragHandleElement.style.left = `${pos.left}px`;
          dragHandleElement.style.top = `${pos.top}px`;
          dragHandleElement.classList.add("selected");
          showDragHandle();
        }
      }

      const onWindowResize = () => updateSelectionHalo();

      // The selected handle is fixed-positioned, so reposition it onto the selected
      // block while scrolling (the absolute halo follows naturally)
      const onWindowScroll = () => {
        if (dragHandleElement?.classList.contains("selected")) {
          updateSelectionHalo();
        }
      };

      selectionHaloElement = document.createElement("div");
      selectionHaloElement.classList.add("block-selection-halo");
      selectionHaloElement.setAttribute("aria-hidden", "true");
      view?.dom?.parentElement?.appendChild(selectionHaloElement);

      dropIndicatorElement = document.createElement("div");
      dropIndicatorElement.classList.add("block-drop-indicator");
      dropIndicatorElement.setAttribute("aria-hidden", "true");
      view?.dom?.parentElement?.appendChild(dropIndicatorElement);

      dropHoverElement = document.createElement("div");
      dropHoverElement.classList.add("block-drop-hover");
      dropHoverElement.setAttribute("aria-hidden", "true");
      view?.dom?.parentElement?.appendChild(dropHoverElement);

      window.addEventListener("resize", onWindowResize);
      window.addEventListener("scroll", onWindowScroll, true);
      haloResizeObserver = new ResizeObserver(onWindowResize);
      haloResizeObserver.observe(view.dom);
      updateSelectionHalo();

      return {
        update: () => {
          updateSelectionHalo();
        },
        destroy: () => {
          if (!handleBySelector) {
            dragHandleElement?.remove?.();
          }
          dragHandleElement?.removeEventListener("drag", onDragHandleDrag);
          dragHandleElement?.removeEventListener(
            "dragstart",
            onDragHandleDragStart,
          );
          dragHandleElement?.removeEventListener("click", onDragHandleClick);
          dragHandleElement?.removeEventListener(
            "dragend",
            onDragHandleDragEnd,
          );
          setEditableLockElement(null);
          dragHandleElement = null;
          dropIndicatorElement?.remove();
          dropIndicatorElement = null;
          dropHoverElement?.remove();
          dropHoverElement = null;
          haloResizeObserver?.disconnect();
          haloResizeObserver = null;
          window.removeEventListener("resize", onWindowResize);
          window.removeEventListener("scroll", onWindowScroll, true);
          selectionHaloElement?.remove();
          selectionHaloElement = null;
          view?.dom?.parentElement?.removeEventListener(
            "mouseout",
            hideHandleOnEditorOut,
          );
        },
      };
    },
    props: {
      handleDOMEvents: {
        // Once a selected block is locked with contenteditable=false, the browser
        // can't place a caret inside it: on mousedown inside the selected block,
        // manually drop the caret at the click position and exit block selection
        mousedown: (view, event) => {
          if (event.button !== 0) return false;

          // Images: leave clicks entirely to ProseMirror — PM detects double clicks
          // during mousedown (double-click preview depends on it) and any
          // interception would break it; image NodeSelection is blocked in
          // filterTransaction, only the handle may select them
          const hitPos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (
            hitPos &&
            hitPos.inside > -1 &&
            view.state.doc.nodeAt(hitPos.inside)?.type.name === "image"
          ) {
            return false;
          }

          const selection = view.state.selection;
          if (
            !(selection instanceof NodeSelection) ||
            !haloBlockTypes.has(selection.node.type.name)
          ) {
            return false;
          }

          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (!pos || pos.pos < selection.from || pos.pos > selection.to) {
            return false;
          }

          const $pos = view.state.doc.resolve(pos.pos);
          view.focus();
          view.dispatch(
            view.state.tr.setSelection(Selection.near($pos, 1)),
          );
          event.preventDefault();
          return true;
        },
        mousemove: (view, event) => {
          if (!view.editable) {
            return;
          }

          // While a block is selected, pin the handle to the selected block,
          // following the selection rather than the mouse
          if (dragHandleElement?.classList.contains("selected")) {
            return;
          }

          const node = nodeDOMAtCoords(
            {
              x: event.clientX + 50 + options.dragHandleWidth,
              y: event.clientY,
            },
            options,
            view,
          );

          const notDragging = node?.closest(".not-draggable");
          const excludedTagList = options.excludedTags
            .concat(["ol", "ul"])
            .join(", ");

          if (
            !(node instanceof Element) ||
            node.matches(excludedTagList) ||
            notDragging
          ) {
            hoveredBlockElement = null;
            hideDragHandle();
            return;
          }

          hoveredBlockElement = node;

          const isCustomNode = isCustomNodeDOM(node, options);

          // Custom nodes pin the handle to the inner NodeViewWrapper's top-left:
          // the natural anchor sits in transient/empty space outside the visible block.
          if (isCustomNode) {
            // tiptap React node-views emit an outer `.react-renderer` whose first
            // child is the visible NodeViewWrapper; walk to that outer first since
            // `node` may be either the outer or an inner element with data-type.
            const rendererOuter =
              (node.closest(".react-renderer") as HTMLElement | null) ?? node;
            const inner =
              (rendererOuter.firstElementChild as HTMLElement | null) ??
              rendererOuter;
            const innerRect = absoluteRect(inner);
            if (!dragHandleElement) return;
            dragHandleElement.style.left = `${innerRect.left + 4}px`;
            dragHandleElement.style.top = `${innerRect.top + 4}px`;
            showDragHandle();
            return;
          }

          if (!dragHandleElement) return;

          const pos = computeHandlePosition(node);
          dragHandleElement.style.left = `${pos.left}px`;
          dragHandleElement.style.top = `${pos.top}px`;
          showDragHandle();
        },
        keydown: () => {
          hideDragHandle();
        },
        mousewheel: () => {
          hideDragHandle();
        },
        dragover: (view, event) => {
          updateDropIndicator(view, event);
          return false;
        },
        // dragging class is used for CSS
        dragstart: (view) => {
          view.dom.classList.add("dragging");
        },
        drop: (view, event) => {
          view.dom.classList.remove("dragging");
          hideDropFeedback(view);
          hideDragHandle();
          let droppedNode: Node | null = null;
          const dropPos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });

          if (!dropPos) return;

          if (view.state.selection instanceof NodeSelection) {
            droppedNode = view.state.selection.node;
          }
          if (!droppedNode) return;

          const resolvedPos = view.state.doc.resolve(dropPos.pos);

          const isDroppedInsideList =
            resolvedPos.parent.type.name === "listItem";

          // If the selected node is a list item and is not dropped inside a list, we need to wrap it inside <ol> tag otherwise ol list items will be transformed into ul list item when dropped
          if (
            view.state.selection instanceof NodeSelection &&
            view.state.selection.node.type.name === "listItem" &&
            !isDroppedInsideList &&
            listType == "OL"
          ) {
            const newList = view.state.schema.nodes.orderedList?.createAndFill(
              null,
              droppedNode,
            );
            const slice = new Slice(Fragment.from(newList), 0, 0);
            view.dragging = { slice, move: event.ctrlKey };
          }
        },
        dragend: (view) => {
          view.dom.classList.remove("dragging");
          hideDropFeedback(view);
        },
      },
    },
    // Block the NodeSelection ProseMirror's native clicks (pointer source) create
    // on images: image selection is only allowed via the row handle, preventing a
    // single click from selecting it and crowding out the double-click preview
    filterTransaction: (tr) => {
      if (
        !tr.docChanged &&
        tr.getMeta("pointer") &&
        tr.selection instanceof NodeSelection &&
        tr.selection.node.type.name === "image"
      ) {
        return false;
      }
      return true;
    },
    appendTransaction: (transactions, _oldState, newState) => {
      if (!handleDragInProgress) return null;

      const isDrop = transactions.some(
        (tr) => tr.getMeta("uiEvent") === "drop" && tr.docChanged,
      );

      if (isDrop) {
        // The drop happened; reset the interaction flag (cancelled drags fall back
        // to the handle's dragend)
        handleDragInProgress = false;

        // At some drop targets ProseMirror sets a TextSelection spanning the dropped
        // content (visually, the block's text appears selected); normalize back to
        // the block's NodeSelection here
        const selection = newState.selection;
        if (!(selection instanceof TextSelection) || selection.empty) return null;

        const $from = selection.$from;
        const $to = selection.$to;
        if ($from.depth < 1 || $to.depth < 1) return null;

        // Deepest common ancestor containing both endpoints
        let depth = Math.min($from.depth, $to.depth);
        while (depth > 0 && $from.node(depth) !== $to.node(depth)) {
          depth -= 1;
        }

        // Reuse the block-tree rules: containers (list items etc.) are the target;
        // paragraphs/headings walk up; standalone or top-level blocks are the target
        while (depth > 1) {
          const typeName = $from.node(depth).type.name;
          if (blockContainerTypes.has(typeName)) break;
          if (typeName !== "paragraph" && typeName !== "heading") break;
          // Stop at the text block itself when its direct parent is a blockquote:
          // quote children select individually (consistent with the handle
          // selection rules) rather than promoting to the whole quote
          if ($from.node(depth - 1).type.name === "blockquote") break;
          depth -= 1;
        }

        if (depth < 1) return null;

        const target = $from.before(depth);
        const targetNode = newState.doc.resolve(target).nodeAfter;
        if (!targetNode || !NodeSelection.isSelectable(targetNode)) return null;

        // Guard: the selection must fall entirely within the target block
        if (
          selection.from < target ||
          selection.to > target + targetNode.nodeSize
        ) {
          return null;
        }

        return newState.tr.setSelection(
          NodeSelection.create(newState.doc, target),
        );
      }

      return null;
    },
  });
}

const GlobalDragHandle = Extension.create({
  name: "globalDragHandle",

  addOptions() {
    return {
      dragHandleWidth: 20,
      dragHandleGap: 14,
      scrollThreshold: 100,
      excludedTags: [],
      customNodes: [],
      atomNodes: [],
    };
  },

  addProseMirrorPlugins() {
    return [
      DragHandlePlugin({
        pluginKey: "globalDragHandle",
        dragHandleWidth: this.options.dragHandleWidth,
        dragHandleGap: this.options.dragHandleGap,
        scrollThreshold: this.options.scrollThreshold,
        dragHandleSelector: this.options.dragHandleSelector,
        excludedTags: this.options.excludedTags,
        customNodes: this.options.customNodes,
        atomNodes: this.options.atomNodes,
      }),
    ];
  },
});

export default GlobalDragHandle;
