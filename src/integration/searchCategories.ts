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

const PAGE_SIZE = 50;

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

    const categories: Category[] = rootsResponse.site.categoryTree.map((node) => ({
      id: String(node.entityId),
      entityId: node.entityId,
      name: node.name,
      path: node.path,
    }));

    const queue: number[] = rootsResponse.site.categoryTree
      .filter((node) => Boolean(node.hasChildren))
      .map((node) => node.entityId);

    while (queue.length > 0) {
      const parentEntityId = queue.shift();
      if (!parentEntityId) {
        continue;
      }

      let hasNextPage = true;
      let after: string | null = null;

      while (hasNextPage) {
        const childrenResponse: {
          site: {
            category: {
              children: {
                pageInfo: {
                  hasNextPage: boolean;
                  endCursor: string | null;
                };
                edges: {
                  node: CategoryTreeItem;
                }[];
              } | null;
            } | null;
          };
        } = await request<{
        site: {
          category: {
            children: {
              pageInfo: {
                hasNextPage: boolean;
                endCursor: string | null;
              };
              edges: {
                node: CategoryTreeItem;
              }[];
            } | null;
          } | null;
        };
      }>(
        config.graphqlEndpoint,
        gql`
            query categoryChildren($entityId: Int!, $first: Int!, $after: String) {
                site {
                    category(entityId: $entityId) {
                        children(first: $first, after: $after) {
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                            edges {
                                node {
                                    id
                                    entityId
                                    name
                                    path
                                    hasChildren
                                }
                            }
                        }
                    }
                }
            }
        `,
        {
          entityId: parentEntityId,
          first: PAGE_SIZE,
          after,
        },
        {
          Authorization: `Bearer ${config.authorizationToken}`,
        },
      );

        const children: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges: {
            node: CategoryTreeItem;
          }[];
        } | null | undefined = childrenResponse.site.category?.children;
        if (!children) {
          hasNextPage = false;
          continue;
        }

        children.edges.forEach((edge: { node: CategoryTreeItem }) => {
          categories.push({
            id: String(edge.node.entityId),
            entityId: edge.node.entityId,
            name: edge.node.name,
            path: edge.node.path,
          });
          if (edge.node.hasChildren) {
            queue.push(edge.node.entityId);
          }
        });

        hasNextPage = children.pageInfo.hasNextPage;
        after = children.pageInfo.endCursor;
      }
    }

    const dedupedCategories = Array.from(
      new Map(categories.map((category) => [category.entityId, category])).values(),
    );

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

  const categories = response.site.categoryTree.flatMap((node) => ([
    {
      id: String(node.entityId),
      entityId: node.entityId,
      name: node.name,
      path: node.path,
    },
    ...(node.children || []).map((child) => ({
      id: String(child.entityId),
      entityId: child.entityId,
      name: child.name,
      path: child.path,
    })),
  ]));
  const normalizedTerm = term.trim().toLowerCase();

  if (!normalizedTerm) {
    return categories;
  }

  return categories.filter((category) =>
    category.name.toLowerCase().includes(normalizedTerm),
  );
};
