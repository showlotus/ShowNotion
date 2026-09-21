import {
  ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Text, TextProps } from "@mantine/core";
import classes from "./hover-scroll-text.module.css";

type HoverScrollTextProps = TextProps & {
  children: ReactNode;
};

/** The label is fully scrolled this many px before the pointer reaches the
 * edge of the label, so the end of a title is visible without chasing it. */
const FRIENDLY_GAP = 24;

export function HoverScrollText({
  children,
  className,
  ...textProps
}: HoverScrollTextProps) {
  const viewportRef = useRef<HTMLParagraphElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const overflowRef = useRef(0);
  const lastXRef = useRef<number | null>(null);
  const [scrollable, setScrollable] = useState(false);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    // The content span is inline so the ellipsis renders; its box still
    // reports the full, untruncated text width.
    const overflow =
      content.getBoundingClientRect().width - viewport.clientWidth;
    const truncated = overflow > 2;
    overflowRef.current = truncated ? overflow : 0;
    setScrollable(truncated);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    measure();
    viewport.scrollLeft = 0;
    viewport.removeAttribute("data-panned");

    // Keep the measured overflow fresh for the pointer mapping.
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [children, measure]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // The row is the trigger, so moving over its icons pans too. Distances are
    // still measured inside the label box: the icon space takes no travel room
    // and a pointer over an icon counts as the head or the tail of the text.
    const track: HTMLElement =
      viewport.closest("[data-hover-scroll]") ?? viewport;

    const handleMouseEnter = (event: MouseEvent) => {
      lastXRef.current = event.clientX;
      measure();
    };

    const handleMouseMove = (event: MouseEvent) => {
      const previousX = lastXRef.current;
      lastXRef.current = event.clientX;
      const overflow = overflowRef.current;
      if (previousX === null || overflow === 0) return;

      const dx = event.clientX - previousX;
      if (dx === 0) return;

      const rect = viewport.getBoundingClientRect();
      const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
      // Pan speed follows the room left in the direction of the move, so the
      // whole title is revealed FRIENDLY_GAP before the edge, while a pointer
      // that entered close to that edge can still reach the end.
      const room = dx > 0 ? rect.width - x : x;
      const travel = Math.min(
        Math.max(room - FRIENDLY_GAP, Math.min(room, FRIENDLY_GAP)),
        overflow,
      );
      if (travel <= 0) return;

      const next = Math.min(
        Math.max(viewport.scrollLeft + dx * (overflow / travel), 0),
        overflow,
      );
      viewport.scrollLeft = next;
      viewport.toggleAttribute("data-panned", next > 0);
    };

    const handleMouseLeave = () => {
      lastXRef.current = null;
      viewport.scrollLeft = 0;
      viewport.removeAttribute("data-panned");
    };

    track.addEventListener("mouseenter", handleMouseEnter);
    track.addEventListener("mousemove", handleMouseMove);
    track.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      track.removeEventListener("mouseenter", handleMouseEnter);
      track.removeEventListener("mousemove", handleMouseMove);
      track.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [measure]);

  return (
    <Text
      {...textProps}
      ref={viewportRef}
      className={[classes.viewport, className].filter(Boolean).join(" ")}
      data-scroll={scrollable || undefined}
    >
      <span ref={contentRef} className={classes.content}>
        {children}
      </span>
    </Text>
  );
}
