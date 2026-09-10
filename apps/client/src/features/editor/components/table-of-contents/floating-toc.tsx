import { Text } from "@mantine/core";
import { useAtom, useAtomValue } from "jotai";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import {
  floatingTocAtom,
  pageActionMenuOpenAtom,
  pageEditorAtom,
} from "@/features/editor/atoms/editor-atoms.ts";
import classes from "./floating-toc.module.css";
import { useTocHeadings } from "./use-toc-headings";
import tocClasses from "./table-of-contents.module.css";

export const FLOATING_TOC_PANEL_ID = "floating-toc-panel";

const OPEN_DELAY = 150;
const CLOSE_DELAY = 200;

export function FloatingToc({ pageId }: { pageId?: string }) {
  const { t } = useTranslation();
  const editor = useAtomValue(pageEditorAtom);
  const [{ isAsideOpen }] = useAtom(asideStateAtom);
  const actionMenuOpen = useAtomValue(pageActionMenuOpenAtom);
  const [pinned, setPinned] = useAtom(floatingTocAtom);
  const [hoverOpen, setHoverOpen] = useState(false);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);

  const { links, activeElement, scrollToHeading, headerOffsetRef } =
    useTocHeadings(editor);

  const clearTimers = () => {
    if (openTimer.current !== undefined) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== undefined)
      window.clearTimeout(closeTimer.current);
  };

  useEffect(() => clearTimers, []);

  useEffect(() => {
    setPinned(false);
    setHoverOpen(false);
  }, [pageId, setPinned]);

  useEffect(() => {
    if (!pinned) return;
    return () => {
      clearTimers();
      setHoverOpen(false);
    };
  }, [pinned]);

  if (isAsideOpen || actionMenuOpen) return null;

  const open = pinned || hoverOpen;
  const activeLink = activeElement ?? links[0]?.element;

  const scheduleOpen = () => {
    clearTimers();
    openTimer.current = window.setTimeout(() => setHoverOpen(true), OPEN_DELAY);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => {
      setHoverOpen(false);
    }, CLOSE_DELAY);
  };

  const closeHover = () => {
    clearTimers();
    setHoverOpen(false);
  };

  return (
    <>
      <div ref={headerOffsetRef} className={tocClasses.headerPadding} />

      {links.length > 0 && !pinned && (
        <div
          className={classes.hotZone}
          onMouseEnter={() => {
            clearTimers();
            scheduleOpen();
          }}
          onMouseLeave={scheduleClose}
          onClick={() => {
            clearTimers();
            setHoverOpen(true);
          }}
        >
          <div className={classes.rail} data-visible={!open}>
            {links.map((item, idx) => (
              <div
                key={idx}
                className={classes.bar}
                data-level={Math.min(item.level, 3)}
                data-active={item.element === activeLink || undefined}
              />
            ))}
          </div>
        </div>
      )}

      {open && (
        <div
          id={FLOATING_TOC_PANEL_ID}
          role="dialog"
          aria-label={t("Table of contents")}
          className={classes.panel}
          onMouseEnter={clearTimers}
          onMouseLeave={() => {
            if (!pinned) scheduleClose();
          }}
        >
          {links.length > 0 ? (
            <div className={classes.list}>
              {links.map((item, idx) => (
                <button
                  type="button"
                  key={idx}
                  className={classes.item}
                  data-active={item.element === activeLink || undefined}
                  style={{
                    paddingInlineStart: 4 + (Math.min(item.level, 3) - 1) * 12,
                  }}
                  onClick={() => {
                    scrollToHeading(item.position);
                    if (!pinned) closeHover();
                  }}
                >
                  <span className={classes.itemLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <Text size="sm" c="dimmed" className={classes.empty}>
              {t("Add headings (H1, H2, H3) to generate a table of contents.")}
            </Text>
          )}
        </div>
      )}
    </>
  );
}
