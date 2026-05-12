import request, { gql } from "graphql-request";
import { ValidConfig } from "../types/config.ts";
import { Category } from "../types/entity.ts";

type CategoryTreeItem = {
  entityId: number;
  name: string;
  path?: string;
  hasChildren?: boolean;
  children?: CategoryTreeItem[];
};

const mapToCategory = (node: CategoryTreeItem): Category => ({
  id: String(node.entityId),
  entityId: node.entityId,
  name: node.name,
  path: node.path,
});

const dedupeCategories = (categories: Category[]) =>
  Array.from(new Map(categories.map((category) => [category.entityId, category])).values());

export const searchCategories = async (
  term: string,
  config: ValidConfig,
): Promise<Category[]> => {
  try {
    const rootsResponse = await request<{
      site: {
        categoryTree: CategoryTreeItem[];
      };
    }>(
      config.graphqlEndpoint,
      gql`
          query categoryRoots {
              site {
                  categoryTree {
                      entityId
                      name
                      path
                      hasChildren
                  }
              }
          }
      `,
      undefined,
      {
        Authorization: `Bearer ${config.authorizationToken}`,
      },
    );

    const categories: Category[] = rootsResponse.site.categoryTree.map(mapToCategory);
    const queue: number[] = rootsResponse.site.categoryTree
      .filter((node) => Boolean(node.hasChildren))
      .map((node) => node.entityId);
    const visitedParents = new Set<number>();

    while (queue.length > 0) {
      const rootEntityId = queue.shift();
      if (!rootEntityId || visitedParents.has(rootEntityId)) {
        continue;
      }
      visitedParents.add(rootEntityId);

      const branchResponse = await request<{
        site: {
          categoryTree: CategoryTreeItem[];
        };
      }>(
        config.graphqlEndpoint,
        gql`
            query categoryBranch($rootEntityId: Int) {
                site {
                    categoryTree(rootEntityId: $rootEntityId) {
                        entityId
                        name
                        path
                        hasChildren
                        children {
                            entityId
                            name
                            path
                            hasChildren
                        }
                    }
                }
            }
        `,
        { rootEntityId },
        {
          Authorization: `Bearer ${config.authorizationToken}`,
        },
      );

      const parentNode =
        branchResponse.site.categoryTree.find((node) => node.entityId === rootEntityId) ||
        branchResponse.site.categoryTree[0];
      const children = parentNode?.children || [];

      children.forEach((child) => {
        categories.push(mapToCategory(child));
        if (child.hasChildren) {
          queue.push(child.entityId);
        }
      });
    }

    const dedupedCategories = dedupeCategories(categories);
    const normalizedTerm = term.trim().toLowerCase();

    if (!normalizedTerm) {
      return dedupedCategories;
    }

    return dedupedCategories.filter((category) =>
      category.name.toLowerCase().includes(normalizedTerm),
    );
  } catch (error) {
    console.warn("Falling back to shallow category query due to category traversal error", error);
    return searchCategoriesFallback(term, config);
  }
};

export const searchCategoriesFallback = async (
  term: string,
  config: ValidConfig,
): Promise<Category[]> => {
  const response = await request<{
    site: {
      categoryTree: CategoryTreeItem[];
    };
  }>(
    config.graphqlEndpoint,
    gql`
        query categorySearchFallback {
            site {
                categoryTree {
                    entityId
                    name
                    path
                    children {
                        entityId
                        name
                        path
                    }
                }
            }
        }
    `,
    undefined,
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    },
  );

  const queue: CategoryTreeItem[] = [...response.site.categoryTree];
  const categories: Category[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      continue;
    }
    categories.push(mapToCategory(node));
    if (node.children?.length) {
      queue.push(...node.children);
    }
  }

  const dedupedCategories = dedupeCategories(categories);
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return dedupedCategories;
  }

  return dedupedCategories.filter((category) =>
    category.name.toLowerCase().includes(normalizedTerm),
  );
};
