import { Extension } from "@tiptap/core";
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
} from "@tiptap/pm/state";
import { Fragment, Slice, Node } from "@tiptap/pm/model";
import { EditorView } from "@tiptap/pm/view";

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
]);

// 文本类块：halo 以文字内容包围盒为基准上下对称留白；容器型块（代码块/
// 标注/折叠块）沿用整块几何，避免把内部留白一并算进高亮；任务项的 content
// range 会带上 checkbox 与无障碍隐藏元素、测量失真，一并回退整块几何
const haloTextBlockTypes = new Set([
  "paragraph",
  "heading",
  "listItem",
  "blockquote",
]);

// 量取块内文字内容的包围盒；空块（只有占位换行）返回 null 以便回退整块几何
function measureContentRect(node: HTMLElement): DOMRect | null {
  const range = document.createRange();
  range.selectNodeContents(node);
  const contentRect = range.getBoundingClientRect();
  if (contentRect.width === 0 && contentRect.height === 0) return null;
  return contentRect;
}

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
  const anchorPos = anchorPosAtDOM(view, node) ?? rawPos;
  const $pos = doc.resolve(Math.min(anchorPos, doc.content.size));

  for (let d = $pos.depth; d > 0; d--) {
    const typeName = $pos.node(d).type.name;
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

    const node = nodeDOMAtCoords(
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
    handleDragInProgress = true;
  }

  let dragHandleElement: HTMLElement | null = null;
  // 把手触发的拖拽进行中标记：仅用于 drop 后修正选区
  let handleDragInProgress = false;

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
    // 代码块：把手对齐块顶部行（Notion 实测块顶 +8px），而不是首行代码文本
    const codeBlock = codeBlockRenderer(node);
    if (codeBlock) {
      const surface = codeBlock.querySelector(".codeBlock") ?? codeBlock;
      const rect = absoluteRect(surface);
      return {
        left: rect.left - options.dragHandleWidth - options.dragHandleGap,
        top: rect.top + 8,
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

    // 列表项的符号在 li 盒子之外：以父级列表盒子左缘作为块的视觉左缘
    const markerZone = listMarkerZone(node);
    if (markerZone) {
      rect.left = absoluteRect(markerZone).left;
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

        const node = nodeDOMAtCoords(
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
        let scrollY = window.scrollY;
        if (e.clientY < options.scrollThreshold) {
          window.scrollTo({ top: scrollY - 30, behavior: "smooth" });
        } else if (window.innerHeight - e.clientY < options.scrollThreshold) {
          window.scrollTo({ top: scrollY + 30, behavior: "smooth" });
        }
      }

      dragHandleElement.addEventListener("drag", onDragHandleDrag);

      function onDragHandleDragEnd() {
        handleDragInProgress = false;
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

        const containerRect = container.getBoundingClientRect();
        const contentRect = haloTextBlockTypes.has(selection.node.type.name)
          ? measureContentRect(nodeDOM)
          : null;

        // 文本块：以文字内容为基准上下各留 3px（正文 24px / 标题 38px），
        // 选中时高亮不再紧贴文字；其余块沿用“inset 2px 2px 1px”的整块几何
        if (contentRect) {
          const haloPadY = 3;
          halo.style.top = `${contentRect.top - containerRect.top - haloPadY}px`;
          halo.style.height = `${Math.max(contentRect.height + haloPadY * 2, 0)}px`;
        } else {
          halo.style.top = `${rect.top - containerRect.top + 2}px`;
          halo.style.height = `${Math.max(rect.height - 3, 0)}px`;
        }
        // 左右各外扩 1px：中文/emoji 字形紧贴内容盒子边缘，内缩会切掉首字笔画
        halo.style.left = `${blockLeft - containerRect.left - 1}px`;
        halo.style.width = `${Math.max(rect.right - blockLeft + 2, 0)}px`;
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
            hideDragHandle();
            return;
          }

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
        // dragging class is used for CSS
        dragstart: (view) => {
          view.dom.classList.add("dragging");
        },
        drop: (view, event) => {
          view.dom.classList.remove("dragging");
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
        },
      },
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
