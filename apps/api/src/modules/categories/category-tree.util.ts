import type { CategoryNode } from '@buisnez/shared';

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  order: number;
  parentId: string | null;
}

export function buildChildrenMap(
  rows: CategoryRow[],
): Map<string | null, CategoryRow[]> {
  const map = new Map<string | null, CategoryRow[]>();
  for (const row of rows) {
    const siblings = map.get(row.parentId) ?? [];
    siblings.push(row);
    map.set(row.parentId, siblings);
  }
  for (const siblings of map.values()) {
    siblings.sort((a, b) => a.order - b.order);
  }
  return map;
}

export function buildCategoryTree(
  parentId: string | null,
  childrenMap: Map<string | null, CategoryRow[]>,
): CategoryNode[] {
  return (childrenMap.get(parentId) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    order: row.order,
    children: buildCategoryTree(row.id, childrenMap),
  }));
}

export function collectDescendantCategoryIds(
  rootId: string,
  childrenMap: Map<string | null, CategoryRow[]>,
): string[] {
  const ids = [rootId];
  for (const child of childrenMap.get(rootId) ?? []) {
    ids.push(...collectDescendantCategoryIds(child.id, childrenMap));
  }
  return ids;
}
