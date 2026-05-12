import { Product } from "./product";

export type EntityIdKey = "id" | "entityId";
export type BigcommerceEntityType = "product" | "brand" | "category";

export type Brand = {
  id: string;
  entityId: number;
  name: string;
  defaultImage?: {
    urlOriginal: string;
    altText?: string;
  } | null;
};

export type Category = {
  id: string;
  entityId: number;
  name: string;
  path?: string;
};

export type BigcommerceEntity = Product | Brand | Category;
