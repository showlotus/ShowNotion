import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import { renderEmojiFavicon } from "@/lib/favicon.ts";

const FAVICON_SELECTOR = 'link[rel~="icon"]';

const originalFaviconHrefs = new WeakMap<HTMLLinkElement, string>();

function applyFavicon(icon: string | null | undefined) {
  const links = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(FAVICON_SELECTOR),
  );
  for (const link of links) {
    if (!originalFaviconHrefs.has(link)) {
      originalFaviconHrefs.set(
        link,
        link.getAttribute("href") ?? "/icons/favicon-32x32.png",
      );
    }
    const fallback = originalFaviconHrefs.get(link);
    const href = icon ? renderEmojiFavicon(icon) : fallback;
    if (href) {
      link.setAttribute("href", href);
    }
  }
}

type DocumentTitleProps = {
  title?: string;
  icon?: string;
  withAppName?: boolean;
  children?: React.ReactNode;
};

export function DocumentTitle({
  title,
  icon,
  withAppName = true,
  children,
}: DocumentTitleProps) {
  const appName = getAppName();

  let documentTitle = appName;
  if (title) {
    documentTitle = withAppName ? `${title} - ${appName}` : title;
  }

  useEffect(() => {
    applyFavicon(icon);
    return () => applyFavicon(null);
  }, [icon]);

  return (
    <Helmet>
      <title>{documentTitle}</title>
      {children}
    </Helmet>
  );
}
