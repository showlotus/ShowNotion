import classes from "@/features/editor/styles/editor.module.css";
import React from "react";
import { TitleEditor } from "@/features/editor/title-editor";
import PageEditor from "@/features/editor/page-editor";
import { Container } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { IContributor } from "@/features/page/types/page.types.ts";
import { FixedToolbar } from "@/features/editor/components/fixed-toolbar/fixed-toolbar";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { DeletedPageBanner } from "@/features/page/trash/components/deleted-page-banner.tsx";
import { currentPageEditModeAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { EmptyPageGetStarted } from "@/features/editor/components/empty-page/empty-page-get-started";
import { FloatingToc } from "@/features/editor/components/table-of-contents/floating-toc";

const MemoizedTitleEditor = React.memo(TitleEditor);
const MemoizedPageEditor = React.memo(PageEditor);
const MemoizedFixedToolbar = React.memo(FixedToolbar);
const MemoizedDeletedPageBanner = React.memo(DeletedPageBanner);

type PageUser = {
  id: string;
  name: string;
  avatarUrl: string;
};

export interface FullEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  content: string;
  spaceSlug: string;
  editable: boolean;
  creator?: PageUser;
  contributors?: IContributor[];
  canComment?: boolean;
}

export function FullEditor({
  pageId,
  title,
  slugId,
  content,
  spaceSlug,
  editable,
  canComment,
}: FullEditorProps) {
  const [user] = useAtom(userAtom);
  const fullPageWidth = user.settings?.preferences?.fullPageWidth;
  const editorToolbarEnabled =
    user.settings?.preferences?.editorToolbar ?? false;
  const [currentPageEditMode] = useAtom(currentPageEditModeAtom);
  const isEditMode = currentPageEditMode === PageEditMode.Edit;

  return (
    <Container
      fluid={fullPageWidth}
      size={!fullPageWidth && 900}
      className={classes.editor}
      style={{ display: "flex", flexDirection: "column" }}
    >
      {editorToolbarEnabled && editable && isEditMode && (
        <MemoizedFixedToolbar />
      )}
      <MemoizedDeletedPageBanner slugId={slugId} />
      <MemoizedTitleEditor
        pageId={pageId}
        slugId={slugId}
        title={title}
        spaceSlug={spaceSlug}
        editable={editable}
      />
      <MemoizedPageEditor
        pageId={pageId}
        editable={editable}
        content={content}
        canComment={canComment}
      />
      <FloatingToc pageId={pageId} />
      <EmptyPageGetStarted pageId={pageId} editable={editable} />
    </Container>
  );
}
