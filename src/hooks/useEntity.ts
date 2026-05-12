import { useCallback, useEffect, useState } from "react";
import {
  BigcommerceEntity,
  BigcommerceEntityType,
  EntityIdKey,
} from "../types/entity.ts";
import { ValidConfig } from "../types/config.ts";
import { getProductByEntityId, getProductById } from "../integration/getProduct";
import { getBrandByEntityId, getBrandById } from "../integration/getBrand.ts";
import {
  getCategoryByEntityId,
  getCategoryById,
} from "../integration/getCategory.ts";

const fetchByType: Record<
  BigcommerceEntityType,
  Record<EntityIdKey, (id: string | number, config: ValidConfig) => Promise<BigcommerceEntity | undefined>>
> = {
  product: {
    id: getProductById,
    entityId: getProductByEntityId,
  },
  brand: {
    id: getBrandById,
    entityId: getBrandByEntityId,
  },
  category: {
    id: getCategoryById,
    entityId: getCategoryByEntityId,
  },
};

export const useEntity = (
  entityType: BigcommerceEntityType,
  entityId: string | number,
  idKey: EntityIdKey,
  config: ValidConfig,
) => {
  const [state, setState] = useState<"loading" | "error" | "idle">("idle");
  const [entity, setEntity] = useState<BigcommerceEntity>();

  const fetchEntity = useCallback(
    (id: string | number) => {
      setState("loading");

      fetchByType[entityType][idKey](id, config)
        .then((result) => setEntity(result))
        .then(() => setState("idle"))
        .catch((e) => {
          console.error(e);
          setState("error");
        });
    },
    [config, entityType, idKey],
  );

  useEffect(() => {
    setEntity(undefined);
    if (!entityId) {
      return;
    }
    fetchEntity(entityId);
  }, [entityId, fetchEntity]);

  return { entity, state, retry: () => fetchEntity(entityId) };
};
