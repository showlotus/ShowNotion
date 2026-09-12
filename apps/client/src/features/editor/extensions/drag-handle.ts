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
   * 把手与块视觉左缘的间距
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

// 代码块渲染为 .react-renderer.node-codeBlock > .codeBlock（工具行 + pre），
// 命中内部任意元素时统一归一到渲染器外层
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
    // 独立叶子块（分割线、图片等媒体）：嵌套在列表项、引用等容器内时
    // 父级检查不成立，需显式匹配才能让把手命中它们自身
    "hr",
    ".node-image",
    ".node-video",
    ".node-audio",
    ".node-drawio",
    ".node-excalidraw",
    "[data-youtube-video]",
    // 折叠块/分栏的「首个子块」原本会向上解析到容器本体，导致把手
    // 跳到容器 gutter（与同容器内后续子块位置不一致）；显式匹配直接
    // 子块，让每个子块都命中自身
    "[data-type='detailsContent'] > *",
    "[data-type='column'] > *",
    // 标注/折叠块本体：嵌套在引用块、列表项等容器内时父级检查不成立，
    // 需显式匹配，否则把手会落到外层容器（钉在容器首行、点击选错块）
    ".node-callout",
    "[data-type='callout']",
    "[data-type='details']",
    ...customParagraphSelectors,
    ...customSelectors,
    ...atomSelectors,
  ].join(", ");
  const elements = document.elementsFromPoint(coords.x, coords.y);

  // 代码块：工具行/内边距/代码正文任一位置命中，都归一到代码块自身，
  // 否则会命中外层 details 等祖先容器导致把手跳位
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
  // 代码块用内部 pre 做坐标探测，避免落在顶部工具行上解析不到节点
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

// 列表项的符号绘制在 li 盒子之外的父级列表缩进区内，返回该 li 所属的列表元素
function listMarkerZone(node: Element): Element | null {
  return node.matches("ul:not([data-type=taskList]) li, ol li")
    ? node.parentElement
    : null;
}

// 左侧带装饰条/图标的容器（引用块色条、标注块图标）：内部子块的把手需
// 让位到容器外缘左侧；嵌套时取最外层（Notion 实测）。折叠块与分栏不算
// 装饰容器——折叠块子块、分栏子块都对齐各自块/列的外缘
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

// 列表项内的任意块（多段落的后续段落、分割线、图片等）统一对齐所属列表
// 的符号 gutter；任务列表的复选框在 li 盒内，不适用
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

// 可整体选中的容器节点：命中时选中整个容器，其下方所有子块随之一起选中
const blockContainerTypes = new Set([
  "listItem",
  "taskItem",
  "details",
  "blockquote",
  "callout",
]);

// 选中高亮覆盖层支持的块类型：高亮绘制在独立的 halo 容器上，不作用在块元素本身
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

// 取找到的 DOM 元素在文档中的锚点位置（元素内容起点），据此判断它代表的块
function anchorPosAtDOM(view: EditorView, node: Element): number | null {
  try {
    const pos = view.posAtDOM(node, 0);
    return pos >= 0 ? pos : null;
  } catch {
    return null;
  }
}

// 计算块选择：优先取最近的容器节点整棵子树，否则回退到单节点选择规则
function blockTreeSelection(
  view: EditorView,
  node: Element,
  rawPos: number,
  options: GlobalDragHandleOptions,
): Selection {
  const doc = view.state.doc;

  // 独立叶子块（分割线、图片等）：即使嵌套在列表项/引用等容器内，
  // 也始终只选中自身，否则会被下方的容器提升规则选中整个容器
  const leafBlock = doc.nodeAt(rawPos);
  if (leafBlock?.isLeaf && leafBlock.isBlock) {
    return NodeSelection.create(doc, rawPos);
  }

  const anchorPos = anchorPosAtDOM(view, node) ?? rawPos;
  const $pos = doc.resolve(Math.min(anchorPos, doc.content.size));

  // 命中引用块本体（色条/首行/内边距）时整体选中引用块
  if (node.matches("blockquote")) {
    return NodeSelection.create(doc, $pos.before($pos.depth));
  }

  for (let d = $pos.depth; d > 0; d--) {
    const typeName = $pos.node(d).type.name;
    // 引用块不作为子块的提升目标：引用内文本块停在自身（Notion 实测
    // 引用内子块单独选中），容器（列表项/折叠块/标注）照常提升
    if (typeName === "blockquote") {
      break;
    }
    // 命中容器（列表项/折叠块/引用/标注）时选中整棵子树
    if (blockContainerTypes.has(typeName)) {
      return NodeSelection.create(doc, $pos.before(d));
    }
    // 段落/标题这类文本块继续向上找容器；遇到代码块等独立块则停下，选中它自身
    if (typeName !== "paragraph" && typeName !== "heading") {
      break;
    }
  }

  return singleNodeSelection(view, node, calcNodePos(anchorPos, view), options);
}

// 计算单节点选择：自定义节点选中整体，表格选中整表，内联节点提升到父块
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
  // 把手触发的拖拽进行中标记：仅用于 drop 后修正选区
  let handleDragInProgress = false;
  // 把手当前悬停的块：分割线仅 13px 高，按点击坐标反查会落到下方块，
  // 点击/拖拽以 mousemove 记录的目标块为准（对齐 Notion 的行为）
  let hoveredBlockElement: Element | null = null;

  // 落点提示：Notion 同款 4px 半透明蓝线 + 拖拽经过容器的浅色高亮
  let dropIndicatorElement: HTMLElement | null = null;
  let dropHoverElement: HTMLElement | null = null;
  let lastDropKey: string | null = null;

  function hideDropFeedback(view: EditorView) {
    dropIndicatorElement?.classList.remove("active");
    dropHoverElement?.classList.remove("active");
    lastDropKey = null;
    view.dom.classList.remove("handle-drag");
  }

  // 按 Notion 实测几何更新落点提示（2026-09）：
  // 线体吸附在落点前块的底边（bottom:-4px）或后块的顶边（top:-4px），
  // 宽度取锚点块宽（嵌套列表自然缩进）；浅色高亮只画在插入点最近的
  // 容器块（列表项/引用/折叠/标注）上，顶层插入不显示
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
    // 选中态由选区驱动，鼠标移开/滚动等触发源不隐藏
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

  // 按 Notion 的 gutter 规则计算把手位置：把手右缘距块视觉左缘 dragHandleGap
  function computeHandlePosition(node: Element): { left: number; top: number } {
    // 引用块/标注块内的子块：把手让位到容器外缘左侧（Notion 实测）
    // 左侧装饰让位：引用色条/标注图标（最外层）与列表项所属列表的符号区
    // 取最左缘，保证把手越过所有左侧装饰（Notion 实测）
    let gutterLeft: number | null = null;
    for (const zone of [decorationGutter(node), listOwnerZone(node)]) {
      if (zone) {
        const left = absoluteRect(zone).left;
        gutterLeft = gutterLeft == null ? left : Math.min(gutterLeft, left);
      }
    }

    // 代码块：把手对齐块顶部行（Notion 实测块顶 +8px），而不是首行代码文本
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

    // 分割线：24px 把手垂直居中于 13px 的线体（Notion 实测把手与线同轴）
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

    // 符号区/装饰容器让位：列表项内任意块统一对齐列表 gutter（li 本体
    // 由 listOwnerZone 自然覆盖原 markerZone 规则）
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

      // 点击把手选中 hover 块的整棵子树；拖拽结束后浏览器不会再触发 click，两者互不干扰
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

      // 选中高亮覆盖容器：独立 DOM 层，几何对齐 Notion 的 notion-selectable-halo
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

      // 选中块的文字锁定：Chrome 会忽略 editable 内容上的 user-select:none，
      // 需在块选中期间给块挂 contenteditable=false（PM 忽略该属性变化），取消选中时还原
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
        // 选中块被隐藏（如折叠内容收起）时不显示高亮
        if (rect.width === 0 && rect.height === 0) {
          hideSelectionHalo();
          hideSelectedDragHandle();
          return;
        }

        // 列表项的符号在 li 盒子之外，块视觉左缘取父级列表盒子，保证符号被包进高亮
        const markerZone = listMarkerZone(nodeDOM);
        const blockLeft = markerZone
          ? markerZone.getBoundingClientRect().left
          : rect.left;

        // Notion 同款几何（2026-09 实测）：纵向取块盒内缩 2px；横向因文字盒
        // 紧贴内容栏边缘，向左右各外扩 6px，让文字/元素距 halo 边 6px
        const containerRect = container.getBoundingClientRect();
        const haloPadX = 6;
        halo.style.top = `${rect.top - containerRect.top + 2}px`;
        halo.style.height = `${Math.max(rect.height - 4, 0)}px`;
        halo.style.left = `${blockLeft - containerRect.left - haloPadX}px`;
        halo.style.width = `${Math.max(rect.right - blockLeft + haloPadX * 2, 0)}px`;
        halo.classList.add("active");

        // 把手进入选中态：定位到选中块并保持可见
        if (dragHandleElement) {
          const pos = computeHandlePosition(nodeDOM);
          dragHandleElement.style.left = `${pos.left}px`;
          dragHandleElement.style.top = `${pos.top}px`;
          dragHandleElement.classList.add("selected");
          showDragHandle();
        }
      }

      const onWindowResize = () => updateSelectionHalo();

      // 选中把手是 fixed 定位，滚动时需要跟随选中块重新定位（halo 为 absolute 天然跟随）
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
        // 选中块被锁成 contenteditable=false 后浏览器无法就地下光标：
        // 在选中块内按下鼠标时手动把光标落到点击位置并退出块选中
        mousedown: (view, event) => {
          if (event.button !== 0) return false;

          // 图片：点击完全交给 ProseMirror 原生处理 —— PM 的双击识别在
          // mousedown 里做连击判定（双击预览依赖它），任何拦截都会打断；
          // 图片的 NodeSelection 由 filterTransaction 拦截，仅把手可选中
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

          // 块处于选中态时把手固定在选中块上，跟随选区而非鼠标
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
    // 拦截 ProseMirror 原生点击（pointer 来源）在图片上建立的 NodeSelection：
    // 图片的选中只允许由行前把手触发，避免单击即选中并顶掉双击预览
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
        // drop 已发生，复位交互标记（取消拖拽的场景由把手 dragend 兜底）
        handleDragInProgress = false;

        // ProseMirror 在部分落点会把选区设成跨拖入内容的 TextSelection（可见，
        // 块内文字会显示为被选中），这里统一改回块的 NodeSelection
        const selection = newState.selection;
        if (!(selection instanceof TextSelection) || selection.empty) return null;

        const $from = selection.$from;
        const $to = selection.$to;
        if ($from.depth < 1 || $to.depth < 1) return null;

        // 同时包含首尾的最深公共祖先
        let depth = Math.min($from.depth, $to.depth);
        while (depth > 0 && $from.node(depth) !== $to.node(depth)) {
          depth -= 1;
        }

        // 复用块树规则：容器（列表项等）即目标；段落/标题继续向上；独立块或顶层块即目标
        while (depth > 1) {
          const typeName = $from.node(depth).type.name;
          if (blockContainerTypes.has(typeName)) break;
          if (typeName !== "paragraph" && typeName !== "heading") break;
          // 文本块的直接父级是引用块时停在自身：引用内子块单独选中
          // （与把手选中规则一致），不提升到整个引用块
          if ($from.node(depth - 1).type.name === "blockquote") break;
          depth -= 1;
        }

        if (depth < 1) return null;

        const target = $from.before(depth);
        const targetNode = newState.doc.resolve(target).nodeAfter;
        if (!targetNode || !NodeSelection.isSelectable(targetNode)) return null;

        // 防御：选区必须完整落在目标块内
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
