const EMOJI_FONT_STACK =
  '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

const FAVICON_SIZE = 64;
const FAVICON_PADDING = 3;

export function renderEmojiFavicon(emoji: string): string | null {
  const icon = emoji?.trim();
  if (!icon) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.font = `${FAVICON_SIZE}px ${EMOJI_FONT_STACK}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const metrics = ctx.measureText(icon);
  const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const inkHeight =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const hasMetrics =
    Number.isFinite(inkWidth) &&
    Number.isFinite(inkHeight) &&
    inkWidth + inkHeight > 0;

  if (hasMetrics) {
    const scale =
      (FAVICON_SIZE - FAVICON_PADDING * 2) / Math.max(inkWidth, inkHeight);
    ctx.translate(FAVICON_SIZE / 2, FAVICON_SIZE / 2);
    ctx.scale(scale, scale);
    ctx.fillText(
      icon,
      (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2,
      (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2,
    );
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, FAVICON_SIZE / 2, FAVICON_SIZE / 2);
  }

  return canvas.toDataURL("image/png");
}
