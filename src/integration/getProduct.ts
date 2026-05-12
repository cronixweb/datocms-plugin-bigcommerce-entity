import request, {gql} from "graphql-request";
import {Product} from "../types/product";
import {PRODUCT_FRAGMENT} from "./productFragment";
import {ValidConfig} from "../types/config.ts";

export const getProductById: (
  productId: string | number,
  config: ValidConfig,
) => Promise<Product | undefined> = (productId, config) => {
  return request<{
    site: {
      product: Product;
    };
  }>(
    config.graphqlEndpoint,
    gql`
        ${PRODUCT_FRAGMENT}
        query productData($productId: ID) {
            site {
                product(id: $productId) {
                    ...ProductData
                }
            }
        }
    `,
    {
      productId: String(productId),
    },
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    }
  )
  .then((response) => response.site.product)
};

export const getProductByEntityId: (
  productId: string | number,
  config: ValidConfig,
) => Promise<Product | undefined> = (productId, config) => {
  return request<{
    site: {
      product: Product;
    };
  }>(
    config.graphqlEndpoint,
    gql`
        ${PRODUCT_FRAGMENT}
        query productData($productId: Int!) {
            site {
                product(entityId: $productId) {
                    ...ProductData
                }
            }
        }
    `,
    {
      productId: Number(productId),
    },
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    }
  )
  .then((response) => response.site.product)
};

