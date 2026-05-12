import { useEffect, useState } from "react";
import { ValidConfig } from "../types/config.ts";
import { BigcommerceEntity, BigcommerceEntityType } from "../types/entity.ts";
import { searchProducts } from "../integration/searchProducts.ts";
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
) => {
  const [state, setState] = useState<"loading" | "error" | "idle">("idle");
  const [entities, setEntities] = useState<BigcommerceEntity[]>([]);

  useEffect(() => {
    setState("loading");
    setEntities([]);

    searchByType[entityType](term, config)
      .then((results) => {
        setEntities(results);
      })
      .then(() => setState("idle"))
      .catch((e) => {
        console.error(e);
        setState("error");
      });
  }, [config, entityType, term]);

  return { state, entities };
};
