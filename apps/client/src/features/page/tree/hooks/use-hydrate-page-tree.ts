import { useCallback } from "react";
import { useAtom, useStore } from "jotai";

import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { openTreeNodesAtom } from "@/features/page/tree/atoms/open-tree-nodes-atom.ts";
import { treeModel } from "@/features/page/tree/model/tree-model";
import {
  buildTree,
  buildTreeWithChildren,
} from "@/features/page/tree/utils/utils.ts";
import { fetchAllAncestorChildren } from "@/features/page/queries/page-query.ts";
import { getPageBreadcrumbs } from "@/features/page/services/page-service.ts";
import type { IPage } from "@/features/page/types/page.types.ts";

type HydratePageTreeOptions = {
  isStale?: () => boolean;
};

export function useHydratePageTree() {
  const store = useStore();
  const [, setData] = useAtom(treeDataAtom);
  const [, setOpenTreeNodes] = useAtom(openTreeNodesAtom);

  return useCallback(
    async (pageId: string, options?: HydratePageTreeOptions) => {
      if (treeModel.find(store.get(treeDataAtom), pageId)) return;

      const ancestors = await getPageBreadcrumbs(pageId);
      if (options?.isStale?.()) return;
      if (!ancestors || ancestors.length <= 1) return;
      if (treeModel.find(store.get(treeDataAtom), pageId)) return;

      let flatTreeItems = [...buildTree(ancestors)];

      const fetchAndUpdateChildren = async (ancestor: IPage) => {
        if (ancestor.id === pageId) return;
        const children = await fetchAllAncestorChildren({
          pageId: ancestor.id,
          spaceId: ancestor.spaceId,
        });

        flatTreeItems = [
          ...flatTreeItems,
          ...children.filter(
            (child) => !flatTreeItems.some((item) => item.id === child.id),
          ),
        ];
      };

      await Promise.all(
        ancestors.map((ancestor) => fetchAndUpdateChildren(ancestor)),
      );
      if (options?.isStale?.()) return;

      const ancestorsTree = buildTreeWithChildren(flatTreeItems);
      const rootChild = ancestorsTree[0];
      if (!rootChild) return;

      setData((currentData) =>
        treeModel.appendChildren(
          currentData,
          rootChild.id,
          rootChild.children ?? [],
        ),
      );

      setOpenTreeNodes((prev) => {
        const next = { ...prev };
        for (const a of ancestors) {
          if (a.id !== pageId) next[a.id] = true;
        }
        return next;
      });
    },
    [store, setData, setOpenTreeNodes],
  );
}
