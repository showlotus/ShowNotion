import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSharePageQuery } from "@/features/share/queries/share-query.ts";
import { Skeleton, Stack, Container } from "@mantine/core";
import React, { useEffect } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { FloatingToc } from "@/features/editor/components/table-of-contents/floating-toc.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";
import { useAtomValue } from "jotai";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom.ts";
import { isPageInTree } from "@/features/share/utils.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import editorClasses from "@/features/editor/styles/editor.module.css";
import SharePageHeader from "@/features/share/components/share-page-header.tsx";
import ShareFooterBranding from "@/features/share/components/share-footer-branding.tsx";

export default function SharedPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { shareId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useSharePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const sharedTreeData = useAtomValue(sharedTreeDataAtom);
  const readOnlyEditor = useAtomValue(readOnlyEditorAtom);

  useEffect(() => {
    if (shareId && data) {
      if (data.share.key !== shareId) {
        // Check if the current page is part of the active sharing tree (sidebar) - If we are part of it, we will not redirect, keeping the sidebar visible.
        const isPartOfTree =
          sharedTreeData && isPageInTree(sharedTreeData, data.page.slugId);

        if (!isPartOfTree) {
          navigate(`/share/${data.share.key}/p/${pageSlug}`, { replace: true });
        }
      }
    }
  }, [shareId, data, sharedTreeData]);

  if (isLoading) {
    return (
      <Stack gap="md" pt={4} aria-hidden>
        <Skeleton height={13} width={180} radius="sm" />
        <Skeleton height={34} width="55%" radius="sm" mt={10} />
        <Skeleton height={12} width="90%" radius="sm" mt={18} />
        <Skeleton height={12} width="97%" radius="sm" />
        <Skeleton height={12} width="85%" radius="sm" />
        <Skeleton height={12} width="60%" radius="sm" />
      </Stack>
    );
  }

  if (isError || !data) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <Error404 />;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    <>
      <DocumentTitle
        title={data?.page?.title || t("untitled")}
        icon={data?.page?.icon}
        withAppName={false}
      >
        {!data?.share.searchIndexing && (
          <meta name="robots" content="noindex" />
        )}
      </DocumentTitle>

      <SharePageHeader pageTitle={data.page.title || undefined} />

      {/* Same column model as the workspace editor: Container 900 + .editor
          gutters, so a shared page measures exactly like the editor page. */}
      <Container
        size={900}
        className={editorClasses.editor}
        style={{ display: "flex", flexDirection: "column" }}
      >
        <ReadonlyPageEditor
          key={data.page.id}
          title={data.page.title}
          content={data.page.content}
          pageId={data.page.id}
          shareId={data.share.id}
          trailingSpace={false}
        />
      </Container>

      {/* Same floating TOC as the editor page: tick rail when collapsed,
          temporary panel on hover, pinned via the header toggle. */}
      {readOnlyEditor && (
        <FloatingToc pageId={data.page.id} editor={readOnlyEditor} />
      )}

      <ShareFooterBranding />
    </>
  );
}
