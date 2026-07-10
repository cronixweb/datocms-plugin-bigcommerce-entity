import { useEffect, useState } from "react";
import { ValidConfig } from "../types/config.ts";
import { BigcommerceEntity, BigcommerceEntityType } from "../types/entity.ts";
import { searchProducts } from "../integration/searchProducts.ts";
import { filterProductsByTerm, getCachedProducts, isProductCacheWarmupInProgress, subscribeProductCache } from "../integration/searchProducts.ts";
import { searchBrands } from "../integration/searchBrands.ts";
import { searchCategories } from "../integration/searchCategories.ts";

const searchByType: Record<
  BigcommerceEntityType,
  (term: string, config: ValidConfig) => Promise<BigcommerceEntity[]>
> = {
  product: searchProducts,
  brand: searchBrands,
  category: searchCategories,
};

export const useEntitySearch = (
  entityType: BigcommerceEntityType,
  config: ValidConfig,
  term: string,
  enabled: boolean = true,
  revision: number = 0,
) => {
  const [state, setState] = useState<"loading" | "error" | "idle">("idle");
  const [entities, setEntities] = useState<BigcommerceEntity[]>([]);

  useEffect(() => {
    if (!enabled) {
      setState("idle");
      setEntities([]);
      return;
    }

    if (entityType === "product") {
      let isStale = false;

      const refreshFromCache = () => {
        if (isStale) {
          return;
        }

        const cached = getCachedProducts(config) || [];
        setEntities(filterProductsByTerm(cached, term));
        setState(isProductCacheWarmupInProgress(config) ? "loading" : "idle");
      };

      setState("loading");
      setEntities([]);

      void searchProducts(term, config).catch((e) => {
        if (isStale) {
          return;
        }
        console.error(e);
        setState("error");
      });

      const unsubscribe = subscribeProductCache(config, refreshFromCache);
      refreshFromCache();

      return () => {
        isStale = true;
        unsubscribe();
      };
    }

    let isStale = false;

    setState("loading");

    searchByType[entityType](term, config)
      .then((results) => {
        if (isStale) {
          return;
        }
        setEntities(results);
      })
      .then(() => {
        if (isStale) {
          return;
        }
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
  }, [config, enabled, entityType, term, revision]);

  return { state, entities };
};
