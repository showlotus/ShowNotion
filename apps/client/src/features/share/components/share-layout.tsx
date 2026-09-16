import { useEffect, useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useGetSharedPageTreeQuery } from "@/features/share/queries/share-query.ts";
import { buildSharedPageTree } from "@/features/share/utils.ts";
import {
  sharedHasSidebarAtom,
  sharedPageTreeAtom,
  sharedTreeDataAtom,
} from "@/features/share/atoms/shared-page-atom.ts";
import ShareAppShell from "@/features/share/components/share-app-shell.tsx";
import { ShareSearchSpotlight } from "@/features/search/components/share-search-spotlight.tsx";

export default function ShareLayout() {
  const { shareId } = useParams();
  const { data } = useGetSharedPageTreeQuery(shareId);

  const setSharedPageTree = useSetAtom(sharedPageTreeAtom);
  const setSharedTreeData = useSetAtom(sharedTreeDataAtom);
  const setSharedHasSidebar = useSetAtom(sharedHasSidebarAtom);

  const treeData = useMemo(() => {
    if (!data?.pageTree) return null;
    return buildSharedPageTree(data.pageTree);
  }, [data?.pageTree]);

  useEffect(() => {
    setSharedPageTree(data || null);
    setSharedTreeData(treeData);
    // Same source of truth as the shell's sidebar visibility (flat page count).
    setSharedHasSidebar((data?.pageTree?.length ?? 0) > 1);
  }, [
    data,
    treeData,
    setSharedPageTree,
    setSharedTreeData,
    setSharedHasSidebar,
  ]);

  const hasSidebar = (data?.pageTree?.length ?? 0) > 1;

  return (
    <>
      <ShareAppShell hasSidebar={hasSidebar}>
        <Outlet />
      </ShareAppShell>

      {shareId && <ShareSearchSpotlight shareId={shareId} />}
    </>
  );
}
