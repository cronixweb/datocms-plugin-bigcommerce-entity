import { useCallback, useEffect, useState } from "react";
import { ValidConfig } from "../types/config.ts";
import { Product } from "../types/product";
import { searchProductsPage } from "../integration/searchProducts.ts";

const PAGE_SIZE = 40;

export const useProductInfiniteSearch = (
  config: ValidConfig,
  term: string,
) => {
  const [state, setState] = useState<"loading" | "error" | "idle">("idle");
  const [products, setProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let isStale = false;

    setState("loading");
    setProducts([]);
    setHasMore(false);
    setEndCursor(null);

    searchProductsPage(term, config, PAGE_SIZE, null)
      .then((page) => {
        if (isStale) {
          return;
        }
        setProducts(page.products);
        setHasMore(page.hasNextPage);
        setEndCursor(page.endCursor);
        setState("idle");
      })
      .catch((e) => {
        if (isStale) {
          return;
        }
        console.error(e);
        setState("error");
      });

    return () => {
      isStale = true;
    };
  }, [config, term]);

  const loadMore = useCallback(() => {
    if (state !== "idle" || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    searchProductsPage(term, config, PAGE_SIZE, endCursor)
      .then((page) => {
        setProducts((prev) => {
          const merged = [...prev, ...page.products];
          return Array.from(new Map(merged.map((product) => [product.id, product])).values());
        });
        setHasMore(page.hasNextPage);
        setEndCursor(page.endCursor);
      })
      .catch((e) => {
        console.error(e);
        setState("error");
      })
      .finally(() => setIsLoadingMore(false));
  }, [config, endCursor, hasMore, isLoadingMore, state, term]);

  return { state, products, hasMore, loadMore, isLoadingMore };
};
