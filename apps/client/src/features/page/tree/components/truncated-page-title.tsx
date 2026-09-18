import { useRef, useState } from "react";
import { Tooltip } from "@mantine/core";

interface TruncatedPageTitleProps {
  title: string;
  className?: string;
}

export function TruncatedPageTitle({ title, className }: TruncatedPageTitleProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [axesOffsets, setAxesOffsets] = useState({ mainAxis: 6, crossAxis: 0 });

  const handleMouseEnter = () => {
    const el = textRef.current;
    if (!el) return;
    setTruncated(el.scrollWidth > el.clientWidth);
    const row = el.parentElement;
    if (row) {
      const textRect = el.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      setAxesOffsets({
        mainAxis: 6 + Math.max(0, rowRect.right - textRect.right),
        crossAxis: rowRect.top + rowRect.height / 2 - (textRect.top + textRect.height / 2),
      });
    }
  };

  return (
    <Tooltip
      label={title}
      position="right"
      disabled={!truncated}
      offset={axesOffsets}
      middlewares={{ flip: false }}
    >
      <span ref={textRef} className={className} onMouseEnter={handleMouseEnter}>
        {title}
      </span>
    </Tooltip>
  );
}
