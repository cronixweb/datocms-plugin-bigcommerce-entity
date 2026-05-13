export type Product = {
  id: string;
  entityId: number;
  name: string;
  sku?: string;
  plainTextDescription?: string;
  defaultImage: {
    urlOriginal: string;
    altText: string;
  };
  availabilityV2: {
    status: string;
  };
  prices: {
    price: {
      value: number;
      currencyCode: string;
    };
  };
};


export type ProductIdKey = "id" | "entityId";
