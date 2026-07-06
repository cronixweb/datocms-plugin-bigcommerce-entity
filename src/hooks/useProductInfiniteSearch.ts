import { useEffect, useState } from "react";
import { ValidConfig } from "../types/config.ts";
import { Product } from "../types/product";
import { searchProducts } from "../integration/searchProducts.ts";

export const useProductInfiniteSearch = (
  config: ValidConfig,
  term: string,
) => {
  const [state, setState] = useState<"loading" | "error" | "idle">("idle");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let isStale = false;

    setState("loading");
    setProducts([]);

    searchProducts(term, config)
      .then((results) => {
        if (isStale) {
          return;
        }
        setProducts(results);
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

  return {
    state,
    products,
    hasMore: false,
    loadMore: () => undefined,
    isLoadingMore: false,
  };
};
