import { NodePos, useEditor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import React, { FC, useEffect, useRef, useState } from "react";
import classes from "./table-of-contents.module.css";
import clsx from "clsx";
import { Box, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { getScrollContainer } from "@/hooks/use-scroll-container.ts";

type TableOfContentsProps = {
  editor: ReturnType<typeof useEditor>;
  isShare?: boolean;
};

export type HeadingLink = {
  label: string;
  level: number;
  element: HTMLElement;
  position: number;
};

const TOGGLE_HEADING_SUMMARY_SELECTOR =
  '[data-type="details"][data-level] > [data-type="detailsContainer"] > [data-type="detailsSummary"]';

const TOC_DOM_SELECTOR = `h1, h2, h3, h4, h5, h6, ${TOGGLE_HEADING_SUMMARY_SELECTOR}`;

const nodePosPosition = (item: NodePos): number => {
  //@ts-ignore resolvedPos is available at runtime
  return item.resolvedPos.pos;
};

const nodePosParent = (item: NodePos) => {
  //@ts-ignore resolvedPos is available at runtime
  return item.resolvedPos.node(-1);
};

export const recalculateLinks = (nodePos: NodePos[]) => {
  const nodes: HTMLElement[] = [];

  const links: HeadingLink[] = Array.from(nodePos).reduce<HeadingLink[]>(
    (acc, item) => {
      const label = item.node.textContent;
      const level =
        item.node.type.name === "heading"
          ? Number(item.node.attrs.level)
          : Number(nodePosParent(item)?.attrs?.level ?? 0);
      if (label.length && level >= 1 && level <= 6) {
        acc.push({
          label,
          level,
          element: item.element,
          position: nodePosPosition(item),
        });
        nodes.push(item.element);
      }
      return acc;
    },
    [],
  );
  return { links, nodes };
};

export const getTocNodePositions = (
  editor: ReturnType<typeof useEditor>,
): NodePos[] => {
  if (!editor) return [];

  const headings = editor.$nodes("heading") ?? [];
  const toggleHeadings = (editor.$nodes("detailsSummary") ?? []).filter(
    (item) => {
      const level = Number(nodePosParent(item)?.attrs?.level ?? 0);
      return level >= 1 && level <= 6;
    },
  );

  return [...headings, ...toggleHeadings].sort(
    (a, b) => nodePosPosition(a) - nodePosPosition(b),
  );
};

export const collectTocHeadings = (
  editor: ReturnType<typeof useEditor>,
): { links: HeadingLink[]; nodes: HTMLElement[] } => {
  const result = recalculateLinks(getTocNodePositions(editor));
  if (!editor?.view?.dom) return result;

  // $nodes(...).element can point at detached DOM nodes; pair the positions
  // with the live elements rendered by the view instead.
  const domHeadings = Array.from(
    editor.view.dom.querySelectorAll<HTMLElement>(TOC_DOM_SELECTOR),
  ).filter((heading) => heading.textContent && heading.textContent.length > 0);

  if (domHeadings.length !== result.links.length) return result;

  const links = result.links.map((link, index) => ({
    ...link,
    element: domHeadings[index],
  }));
  return { links, nodes: links.map((link) => link.element) };
};

export const expandAncestorToggles = (
  editor: ReturnType<typeof useEditor>,
  position: number,
) => {
  if (!editor || editor.isDestroyed) return;

  const { state, view } = editor;
  const $pos = state.doc.resolve(Math.min(position, state.doc.content.size));

  const togglePositions: number[] = [];
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "details" && !node.attrs.open) {
      togglePositions.push($pos.before(depth));
    }
  }
  if (!togglePositions.length) return;

  if (editor.isEditable) {
    const tr = state.tr;
    togglePositions.forEach((pos) => {
      const node = tr.doc.nodeAt(pos);
      if (node) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, open: true });
      }
    });
    view.dispatch(tr);
    return;
  }

  // Read-only views keep the panel state in the DOM (the details NodeView
  // never syncs programmatic attribute changes), so flip the attribute there.
  togglePositions.forEach((pos) => {
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) {
      dom.setAttribute("open", "true");
    }
  });
};

export const TableOfContents: FC<TableOfContentsProps> = (props) => {
  const { t } = useTranslation();
  const [links, setLinks] = useState<HeadingLink[]>([]);
  const [headingDOMNodes, setHeadingDOMNodes] = useState<HTMLElement[]>([]);
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);
  const headerPaddingRef = useRef<HTMLDivElement | null>(null);

  const handleScrollToHeading = (position: number) => {
    if (!props.editor || props.editor.isDestroyed) return;
    const { view } = props.editor;

    expandAncestorToggles(props.editor, position);

    const headerOffset = parseInt(
      window.getComputedStyle(headerPaddingRef.current).getPropertyValue("top"),
    );

    const { node } = view.domAtPos(position);
    const element = node as HTMLElement;
    const scroller = getScrollContainer();

    if (scroller) {
      scroller.scrollTo({
        top:
          scroller.scrollTop +
          element.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          headerOffset,
        behavior: "smooth",
      });
    } else {
      window.scrollTo({
        top:
          element.getBoundingClientRect().top + window.scrollY - headerOffset,
        behavior: "smooth",
      });
    }

    const tr = view.state.tr;
    tr.setSelection(new TextSelection(tr.doc.resolve(position)));
    view.dispatch(tr);
    view.focus();
  };

  const handleUpdate = () => {
    if (!props.editor || props.editor.isDestroyed) return;

    const result = collectTocHeadings(props.editor);

    setLinks(result.links);
    setHeadingDOMNodes(result.nodes);
  };

  useEffect(() => {
    // "create" repopulates once the editor view mounts after this component
    props.editor?.on("create", handleUpdate);
    props.editor?.on("update", handleUpdate);

    return () => {
      props.editor?.off("create", handleUpdate);
      props.editor?.off("update", handleUpdate);
    };
  }, [props.editor]);

  useEffect(
    () => {
      handleUpdate();
    },
    props.isShare ? [props.editor] : [],
  );

  useEffect(() => {
    try {
      const observeHandler = (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveElement(entry.target as HTMLElement);
          }
        });
      };

      let headerOffset = 0;
      if (headerPaddingRef.current) {
        headerOffset = parseInt(
          window
            .getComputedStyle(headerPaddingRef.current)
            .getPropertyValue("top"),
        );
      }
      const observerOptions: IntersectionObserverInit = {
        rootMargin: `-${headerOffset}px 0px -85% 0px`,
        threshold: 0,
        root: null,
      };
      const observer = new IntersectionObserver(
        observeHandler,
        observerOptions,
      );

      headingDOMNodes.forEach((heading) => {
        observer.observe(heading);
      });
      return () => {
        headingDOMNodes.forEach((heading) => {
          observer.unobserve(heading);
        });
      };
    } catch (err) {
      console.log(err);
    }
  }, [headingDOMNodes, props.editor]);

  if (!links.length) {
    return (
      <>
        {!props.isShare && (
          <Text size="sm">
            {t("Add headings (H1, H2, H3) to generate a table of contents.")}
          </Text>
        )}

        {props.isShare && (
          <Text size="sm" c="dimmed">
            {t("No table of contents.")}
          </Text>
        )}
      </>
    );
  }

  return (
    <>
      {props.isShare && (
        <Title order={2} size="h6" mb="md" fw={500}>
          {t("Table of contents")}
        </Title>
      )}
      <div className={props.isShare ? classes.leftBorder : ""}>
        {links.map((item, idx) => (
          <Box<"button">
            component="button"
            onClick={() => handleScrollToHeading(item.position)}
            key={idx}
            className={clsx(classes.link, {
              [classes.linkActive]: item.element === activeElement,
            })}
            style={{
              paddingLeft: `calc(${item.level} * var(--mantine-spacing-md))`,
            }}
          >
            {item.label}
          </Box>
        ))}
      </div>
      <div ref={headerPaddingRef} className={classes.headerPadding} />
    </>
  );
};
