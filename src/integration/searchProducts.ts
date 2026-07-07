import request, { gql } from "graphql-request";
import { Product } from "../types/product";
import { PRODUCT_FRAGMENT } from "./productFragment";
import {ValidConfig} from "../types/config.ts";

export type ProductsPage = {
  products: Product[];
  hasNextPage: boolean;
  endCursor: string | null;
};

const PAGE_SIZE = 50;
const PRODUCT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PRODUCT_CACHE_PREFIX = "bc-product-cache-v1";
const inMemoryCache = new Map<string, { expiresAt: number; products: Product[] }>();
const inFlightFetches = new Map<string, Promise<Product[]>>();

const getCacheKey = (config: ValidConfig) =>
  `${PRODUCT_CACHE_PREFIX}:${config.graphqlEndpoint}`;

const readLocalCache = (key: string): { expiresAt: number; products: Product[] } | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { expiresAt: number; products: Product[] };
    if (!parsed?.expiresAt || !Array.isArray(parsed.products)) {
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

const writeLocalCache = (key: string, products: Product[]) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const payload = {
      expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS,
      products,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore localStorage write failures.
  }
};

const getCachedProducts = (config: ValidConfig): Product[] | null => {
  const key = getCacheKey(config);
  const memoryEntry = inMemoryCache.get(key);
  if (memoryEntry && Date.now() <= memoryEntry.expiresAt) {
    return memoryEntry.products;
  }

  const localEntry = readLocalCache(key);
  if (!localEntry) {
    return null;
  }

  inMemoryCache.set(key, localEntry);
  return localEntry.products;
};

const setCachedProducts = (config: ValidConfig, products: Product[]) => {
  const key = getCacheKey(config);
  const payload = {
    expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS,
    products,
  };
  inMemoryCache.set(key, payload);
  writeLocalCache(key, products);
};

const filterProductsByTerm = (products: Product[], term: string): Product[] => {
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
  )
  .then((response) => ({
    products: response.site.search.searchProducts.products.edges.map((e) => e.node),
    hasNextPage: response.site.search.searchProducts.products.pageInfo.hasNextPage,
    endCursor: response.site.search.searchProducts.products.pageInfo.endCursor,
  }));
};

const fetchAllProducts = async (config: ValidConfig): Promise<Product[]> => {
  const allProducts: Product[] = [];
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    const page = await searchProductsPage("", config, PAGE_SIZE, after);
    allProducts.push(...page.products);
    hasNextPage = page.hasNextPage;
    after = page.endCursor;
  }

  return Array.from(new Map(allProducts.map((product) => [product.id, product])).values());
};

export const searchProducts: (
  term: string,
  config: ValidConfig
) => Promise<Product[]> = async (term: string = "", config) => {
  const cached = getCachedProducts(config);
  if (cached) {
    return filterProductsByTerm(cached, term);
  }

  const key = getCacheKey(config);
  const existingFetch = inFlightFetches.get(key);
  if (existingFetch) {
    const sharedProducts = await existingFetch;
    return filterProductsByTerm(sharedProducts, term);
  }

  const fetchPromise = fetchAllProducts(config)
    .then((products) => {
      setCachedProducts(config, products);
      return products;
    })
    .finally(() => {
      inFlightFetches.delete(key);
    });

  inFlightFetches.set(key, fetchPromise);
  const products = await fetchPromise;
  return filterProductsByTerm(products, term);
};
