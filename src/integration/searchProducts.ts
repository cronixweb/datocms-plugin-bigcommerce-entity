import request, { gql } from "graphql-request";
import { ValidConfig } from "../types/config.ts";
import { Product } from "../types/product";
import { PRODUCT_FRAGMENT } from "./productFragment";

export type ProductsPage = {
  products: Product[];
  hasNextPage: boolean;
  endCursor: string | null;
};

const PREVIEW_PAGE_SIZE = 25;
const PAGE_SIZE = 50;
const PRODUCT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRODUCT_CACHE_PREFIX = "bc-product-cache-v1";

type ProductCacheEntry = {
  expiresAt: number;
  products: Product[];
  warmupComplete: boolean;
};

const inMemoryCache = new Map<string, ProductCacheEntry>();
const inFlightFetches = new Map<string, Promise<Product[]>>();
const subscribers = new Map<string, Set<() => void>>();

const getCacheKey = (config: ValidConfig) =>
  `${PRODUCT_CACHE_PREFIX}:${config.graphqlEndpoint}`;

const notifySubscribers = (key: string) => {
  const listeners = subscribers.get(key);
  if (!listeners) {
    return;
  }

  listeners.forEach((listener) => listener());
};

const getCacheEntry = (config: ValidConfig): ProductCacheEntry | null => {
  const key = getCacheKey(config);
  const memoryEntry = inMemoryCache.get(key);
  if (memoryEntry && Date.now() <= memoryEntry.expiresAt) {
    return memoryEntry;
  }

  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ProductCacheEntry>;
    if (!parsed?.expiresAt || !Array.isArray(parsed.products)) {
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(key);
      return null;
    }

    const entry: ProductCacheEntry = {
      expiresAt: parsed.expiresAt,
      products: parsed.products,
      warmupComplete: Boolean(parsed.warmupComplete),
    };
    inMemoryCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
};

export const getCachedProducts = (config: ValidConfig): Product[] | null => {
  return getCacheEntry(config)?.products ?? null;
};

export const clearProductCache = (config: ValidConfig) => {
  const key = getCacheKey(config);
  inMemoryCache.delete(key);

  if (typeof window === "undefined" || !window.localStorage) {
    notifySubscribers(key);
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage removal failures.
  }

  notifySubscribers(key);
};

export const isProductCacheWarmupInProgress = (config: ValidConfig): boolean => {
  return inFlightFetches.has(getCacheKey(config)) && !(getCacheEntry(config)?.warmupComplete);
};

export const subscribeProductCache = (config: ValidConfig, listener: () => void) => {
  const key = getCacheKey(config);
  let listeners = subscribers.get(key);
  if (!listeners) {
    listeners = new Set();
    subscribers.set(key, listeners);
  }

  listeners.add(listener);
  return () => {
    const currentListeners = subscribers.get(key);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      subscribers.delete(key);
    }
  };
};

const persistCacheEntry = (key: string, entry: ProductCacheEntry) => {
  inMemoryCache.set(key, entry);

  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore localStorage failures such as quota limits or private mode.
  }
};

const upsertCachedProducts = (
  config: ValidConfig,
  products: Product[],
  warmupComplete: boolean,
) => {
  const key = getCacheKey(config);
  const existing = getCacheEntry(config);
  const mergedProducts = Array.from(
    new Map([...(existing?.products || []), ...products].map((product) => [product.id, product])).values(),
  );

  persistCacheEntry(key, {
    expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS,
    products: mergedProducts,
    warmupComplete,
  });
  notifySubscribers(key);
};

export const filterProductsByTerm = (products: Product[], term: string): Product[] => {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return products;
  }

  return products.filter((product) => {
    return (
      product.name.toLowerCase().includes(normalizedTerm) ||
      (product.sku || "").toLowerCase().includes(normalizedTerm) ||
      (product.plainTextDescription || "").toLowerCase().includes(normalizedTerm)
    );
  });
};

export const searchProductsPage = (
  term: string,
  config: ValidConfig,
  first: number,
  after?: string | null,
): Promise<ProductsPage> => {
  return request<{
    site: {
      search: {
        searchProducts: {
          products: {
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string | null;
            };
            edges: {
              node: Product;
            }[];
          };
        };
      };
    };
  }>(
    config.graphqlEndpoint,
    gql`
        ${PRODUCT_FRAGMENT}
        query productSearch($term: String, $first: Int!, $after: String) {
            site {
                search {
                    searchProducts(filters: { searchTerm: $term }) {
                        products(first: $first, after: $after) {
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                            edges {
                                node {
                                    ...ProductData
                                }
                            }
                        }
                    }
                }
            }
        }
    `,
    {
      term,
      first,
      after,
    },
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    }
  ).then((response) => ({
    products: response.site.search.searchProducts.products.edges.map((e) => e.node),
    hasNextPage: response.site.search.searchProducts.products.pageInfo.hasNextPage,
    endCursor: response.site.search.searchProducts.products.pageInfo.endCursor,
  }));
};

const warmProductCache = (config: ValidConfig): Promise<Product[]> => {
  const cachedEntry = getCacheEntry(config);
  if (cachedEntry?.warmupComplete) {
    return Promise.resolve(cachedEntry.products);
  }

  const key = getCacheKey(config);
  const existingFetch = inFlightFetches.get(key);
  if (existingFetch) {
    return existingFetch;
  }

  const fetchPromise = (async () => {
    const allProducts: Product[] = [];
    let hasNextPage = true;
    let after: string | null = null;
    let firstPage = true;

    while (hasNextPage) {
      const page = await searchProductsPage(
        "",
        config,
        firstPage ? PREVIEW_PAGE_SIZE : PAGE_SIZE,
        after,
      );

      allProducts.push(...page.products);
      upsertCachedProducts(config, allProducts, false);

      hasNextPage = page.hasNextPage;
      after = page.endCursor;
      firstPage = false;
    }

    upsertCachedProducts(config, allProducts, true);
    return allProducts;
  })()
    .finally(() => {
      inFlightFetches.delete(key);
    });

  inFlightFetches.set(key, fetchPromise);
  return fetchPromise;
};

export const searchProducts = async (
  term: string = "",
  config: ValidConfig,
): Promise<Product[]> => {
  const cachedEntry = getCacheEntry(config);
  if (cachedEntry) {
    if (!cachedEntry.warmupComplete) {
      void warmProductCache(config).catch((error) => {
        console.warn("Product cache warmup failed", error);
      });
    }

    return filterProductsByTerm(cachedEntry.products, term);
  }

  void warmProductCache(config).catch((error) => {
    console.warn("Product cache warmup failed", error);
  });

  return filterProductsByTerm(getCachedProducts(config) || [], term);
};
