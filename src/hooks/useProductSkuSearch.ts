import { useEffect, useState } from "react";
import { ValidConfig } from "../types/config.ts";
import { Product } from "../types/product";
import { searchProductsBySku } from "../integration/searchProducts.ts";

export const useProductSkuSearch = (
  config: ValidConfig,
  term: string,
  enabled: boolean = true,
) => {
  const [state, setState] = useState<"loading" | "error" | "idle">("idle");
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      setProducts([]);
      return;
    }

    let isStale = false;

    setState("loading");
    setProducts([]);

    searchProductsBySku(term, config)
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
  }, [config, enabled, term]);

  return { state, products };
};
