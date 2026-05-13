import request, { gql } from "graphql-request";
import { ValidConfig } from "../types/config.ts";
import { Brand } from "../types/entity.ts";
import { BRAND_FRAGMENT } from "./brandFragment.ts";

const PAGE_SIZE = 50;
const BRAND_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BRAND_CACHE_PREFIX = "bc-brand-cache-v1";
const inMemoryCache = new Map<string, { expiresAt: number; brands: Brand[] }>();
const inFlightFetches = new Map<string, Promise<Brand[]>>();

const getCacheKey = (config: ValidConfig) =>
  `${BRAND_CACHE_PREFIX}:${config.graphqlEndpoint}`;

const readLocalCache = (key: string): { expiresAt: number; brands: Brand[] } | null => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { expiresAt: number; brands: Brand[] };
    if (!parsed?.expiresAt || !Array.isArray(parsed.brands)) {
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

const writeLocalCache = (key: string, brands: Brand[]) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    const payload = {
      expiresAt: Date.now() + BRAND_CACHE_TTL_MS,
      brands,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore localStorage write failures.
  }
};

const getCachedBrands = (config: ValidConfig): Brand[] | null => {
  const key = getCacheKey(config);
  const memoryEntry = inMemoryCache.get(key);
  if (memoryEntry && Date.now() <= memoryEntry.expiresAt) {
    return memoryEntry.brands;
  }

  const localEntry = readLocalCache(key);
  if (!localEntry) {
    return null;
  }

  inMemoryCache.set(key, localEntry);
  return localEntry.brands;
};

const setCachedBrands = (config: ValidConfig, brands: Brand[]) => {
  const key = getCacheKey(config);
  const payload = {
    expiresAt: Date.now() + BRAND_CACHE_TTL_MS,
    brands,
  };
  inMemoryCache.set(key, payload);
  writeLocalCache(key, brands);
};

const filterBrandsByTerm = (brands: Brand[], term: string): Brand[] => {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return brands;
  }
  return brands.filter((brand) =>
    brand.name.toLowerCase().includes(normalizedTerm),
  );
};

const fetchAllBrands = async (config: ValidConfig): Promise<Brand[]> => {
  const allBrands: Brand[] = [];
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    const response: {
      site: {
        brands: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges: {
            node: Brand;
          }[];
        };
      };
    } = await request<{
      site: {
        brands: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges: {
            node: Brand;
          }[];
        };
      };
    }>(
      config.graphqlEndpoint,
      gql`
          ${BRAND_FRAGMENT}
          query brandSearch($first: Int!, $after: String) {
              site {
                  brands(first: $first, after: $after) {
                      pageInfo {
                          hasNextPage
                          endCursor
                      }
                      edges {
                          node {
                              ...BrandData
                          }
                      }
                  }
              }
          }
      `,
      {
        first: PAGE_SIZE,
        after,
      },
      {
        Authorization: `Bearer ${config.authorizationToken}`,
      },
    );

    allBrands.push(...response.site.brands.edges.map((edge: { node: Brand }) => edge.node));
    hasNextPage = response.site.brands.pageInfo.hasNextPage;
    after = response.site.brands.pageInfo.endCursor;
  }

  return allBrands;
};

export const searchBrands = async (
  term: string,
  config: ValidConfig,
): Promise<Brand[]> => {
  const cached = getCachedBrands(config);
  if (cached) {
    return filterBrandsByTerm(cached, term);
  }

  const key = getCacheKey(config);
  const existingFetch = inFlightFetches.get(key);
  if (existingFetch) {
    const sharedBrands = await existingFetch;
    return filterBrandsByTerm(sharedBrands, term);
  }

  const fetchPromise = fetchAllBrands(config)
    .then((brands) => {
      setCachedBrands(config, brands);
      return brands;
    })
    .finally(() => {
      inFlightFetches.delete(key);
    });

  inFlightFetches.set(key, fetchPromise);
  const brands = await fetchPromise;
  return filterBrandsByTerm(brands, term);
};
