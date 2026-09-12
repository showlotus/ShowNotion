import { useEditor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";
import { HeadingLink, recalculateLinks } from "./table-of-contents";
import { getScrollContainer } from "@/hooks/use-scroll-container.ts";

export const useTocHeadings = (editor: ReturnType<typeof useEditor>) => {
  const [links, setLinks] = useState<HeadingLink[]>([]);
  const [headingDOMNodes, setHeadingDOMNodes] = useState<HTMLElement[]>([]);
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);
  const headerOffsetRef = useRef<HTMLDivElement | null>(null);

  const getHeaderOffset = () => {
    if (!headerOffsetRef.current) return 0;
    const offset = parseInt(
      window.getComputedStyle(headerOffsetRef.current).getPropertyValue("top"),
    );
    if (!Number.isNaN(offset) && offset > 0) return offset;
    // The app shell header vars are empty in this layout; fall back to the
    // fixed page header height so scrolled headings clear the topbar.
    const pageHeader = parseInt(
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--page-header-height"),
    );
    return Number.isNaN(pageHeader) ? 0 : pageHeader;
  };

  const handleUpdate = () => {
    if (!editor || editor.isDestroyed) return;

    const result = recalculateLinks(editor.$nodes("heading"));

    // $nodes("heading").element can point at detached DOM nodes; pair the
    // positions with the live heading elements rendered by the view instead.
    const domHeadings = Array.from(
      editor.view.dom.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
    ).filter((heading) => heading.textContent && heading.textContent.length > 0);

    const links =
      domHeadings.length === result.links.length
        ? result.links.map((link, index) => ({
            ...link,
            element: domHeadings[index],
          }))
        : result.links;

    setLinks(links);
    setHeadingDOMNodes(links.map((link) => link.element));
  };

  useEffect(() => {
    if (!editor) return;

    // "create" repopulates once the editor view mounts after this component
    editor.on("create", handleUpdate);
    editor.on("update", handleUpdate);
    handleUpdate();

    // TipTap's "create" can fire before the view DOM is attached to the
    // document (all captured heading elements still detached). Re-sync once
    // the view lands in the document so scroll tracking uses live nodes.
    let frame = requestAnimationFrame(function waitForAttached() {
      if (editor.isDestroyed) return;
      if (editor.view?.dom?.isConnected) {
        handleUpdate();
        return;
      }
      frame = requestAnimationFrame(waitForAttached);
    });

    return () => {
      cancelAnimationFrame(frame);
      editor.off("create", handleUpdate);
      editor.off("update", handleUpdate);
    };
  }, [editor]);

  useEffect(() => {
    let frame = 0;

    const updateActive = () => {
      let current = headingDOMNodes[0] ?? null;
      const threshold = getHeaderOffset() + 24;
      for (const heading of headingDOMNodes) {
        if (heading.getBoundingClientRect().top <= threshold) {
          current = heading;
        } else {
          break;
        }
      }
      setActiveElement(current);
    };

    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActive);
    };

    const scroller = getScrollContainer();
    scroller?.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    updateActive();

    return () => {
      cancelAnimationFrame(frame);
      scroller?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [headingDOMNodes, editor]);

  const scrollToHeading = (position: number) => {
    if (!editor || editor.isDestroyed) return;
    const { view } = editor;

    const { node } = view.domAtPos(position);
    const element = node as HTMLElement;
    const scroller = getScrollContainer();

    if (scroller) {
      scroller.scrollTo({
        top:
          scroller.scrollTop +
          element.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          getHeaderOffset(),
        behavior: "smooth",
      });
    } else {
      window.scrollTo({
        top:
          element.getBoundingClientRect().top +
          window.scrollY -
          getHeaderOffset(),
        behavior: "smooth",
      });
    }

    const tr = view.state.tr;
    tr.setSelection(new TextSelection(tr.doc.resolve(position)));
    view.dispatch(tr);
    view.focus();
  };

  return { links, activeElement, scrollToHeading, headerOffsetRef };
};
