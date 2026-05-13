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

const CATEGORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CATEGORY_CACHE_PREFIX = "bc-category-cache-v1";
const inMemoryCache = new Map<string, { expiresAt: number; categories: Category[] }>();
const inFlightFetches = new Map<string, Promise<Category[]>>();

const getCacheKey = (config: ValidConfig) =>
  `${CATEGORY_CACHE_PREFIX}:${config.graphqlEndpoint}`;

const readLocalCache = (key: string): { expiresAt: number; categories: Category[] } | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { expiresAt: number; categories: Category[] };
    if (!parsed?.expiresAt || !Array.isArray(parsed.categories)) {
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeLocalCache = (key: string, categories: Category[]) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const payload = {
      expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS,
      categories,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Intentionally ignore localStorage write failures (quota/private mode).
  }
};

const getCachedCategories = (config: ValidConfig): Category[] | null => {
  const key = getCacheKey(config);
  const memoryEntry = inMemoryCache.get(key);
  if (memoryEntry && Date.now() <= memoryEntry.expiresAt) {
    return memoryEntry.categories;
  }

  const localEntry = readLocalCache(key);
  if (!localEntry) {
    return null;
  }

  inMemoryCache.set(key, localEntry);
  return localEntry.categories;
};

const setCachedCategories = (config: ValidConfig, categories: Category[]) => {
  const key = getCacheKey(config);
  const payload = {
    expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS,
    categories,
  };
  inMemoryCache.set(key, payload);
  writeLocalCache(key, categories);
};

const filterCategoriesByTerm = (categories: Category[], term: string): Category[] => {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return categories;
  }
  return categories.filter((category) =>
    category.name.toLowerCase().includes(normalizedTerm),
  );
};

const fetchAllCategories = async (config: ValidConfig): Promise<Category[]> => {
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

    return dedupeCategories(categories);
  } catch (error) {
    console.warn("Falling back to shallow category query due to category traversal error", error);
    return searchCategoriesFallback("", config);
  }
};

export const searchCategories = async (
  term: string,
  config: ValidConfig,
): Promise<Category[]> => {
  const cached = getCachedCategories(config);
  if (cached) {
    return filterCategoriesByTerm(cached, term);
  }

  const key = getCacheKey(config);
  const existingFetch = inFlightFetches.get(key);
  if (existingFetch) {
    const sharedCategories = await existingFetch;
    return filterCategoriesByTerm(sharedCategories, term);
  }

  const fetchPromise = fetchAllCategories(config)
    .then((categories) => {
      setCachedCategories(config, categories);
      return categories;
    })
    .finally(() => {
      inFlightFetches.delete(key);
    });

  inFlightFetches.set(key, fetchPromise);
  const categories = await fetchPromise;
  return filterCategoriesByTerm(categories, term);
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
