import { describe, it, expect } from "vitest";
import { sortTreeByUpdatedAtDesc } from "./utils.ts";
import { SpaceTreeNode } from "../types.ts";

function node(
  id: string,
  updatedAt?: string,
  children: SpaceTreeNode[] = [],
): SpaceTreeNode {
  return {
    id,
    slugId: id,
    name: id,
    position: id,
    spaceId: "space",
    parentPageId: null as unknown as string,
    hasChildren: children.length > 0,
    updatedAt,
    children,
  };
}

describe("sortTreeByUpdatedAtDesc", () => {
  it("orders siblings newest first", () => {
    const tree = [
      node("old", "2024-01-01T00:00:00Z"),
      node("new", "2025-01-01T00:00:00Z"),
      node("mid", "2024-06-01T00:00:00Z"),
    ];

    expect(sortTreeByUpdatedAtDesc(tree).map((n) => n.id)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("sorts missing updatedAt last", () => {
    const tree = [
      node("none"),
      node("dated", "2024-01-01T00:00:00Z"),
    ];

    expect(sortTreeByUpdatedAtDesc(tree).map((n) => n.id)).toEqual([
      "dated",
      "none",
    ]);
  });

  it("keeps ties in their previous order (stable)", () => {
    const tree = [
      node("first", "2024-01-01T00:00:00Z"),
      node("second", "2024-01-01T00:00:00Z"),
      node("third", "2024-01-01T00:00:00Z"),
    ];

    expect(sortTreeByUpdatedAtDesc(tree).map((n) => n.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("sorts every level of the tree", () => {
    const tree = [
      node("root-a", "2024-01-01T00:00:00Z", [
        node("a-old", "2024-02-01T00:00:00Z"),
        node("a-new", "2025-02-01T00:00:00Z"),
      ]),
      node("root-b", "2025-01-01T00:00:00Z"),
    ];

    const sorted = sortTreeByUpdatedAtDesc(tree);
    expect(sorted.map((n) => n.id)).toEqual(["root-b", "root-a"]);
    expect(sorted[1].children.map((n) => n.id)).toEqual(["a-new", "a-old"]);
  });

  it("does not mutate the input arrays", () => {
    const tree = [node("b", "2024-01-01T00:00:00Z"), node("a", "2025-01-01T00:00:00Z")];
    const original = [...tree];

    sortTreeByUpdatedAtDesc(tree);

    expect(tree).toEqual(original);
  });

  it("treats invalid dates as missing (sorted last)", () => {
    const tree = [
      node("bad", "not-a-date"),
      node("dated", "2024-01-01T00:00:00Z"),
    ];

    expect(sortTreeByUpdatedAtDesc(tree).map((n) => n.id)).toEqual([
      "dated",
      "bad",
    ]);
  });
});
