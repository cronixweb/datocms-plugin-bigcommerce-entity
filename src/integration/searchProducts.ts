import request, { gql } from "graphql-request";
import { Product } from "../types/product";
import { PRODUCT_FRAGMENT } from "./productFragment";
import {ValidConfig} from "../types/config.ts";

export type ProductsPage = {
  products: Product[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export const searchProductsPage = (
  term: string,
  config: ValidConfig,
  first: number,
  after?: string | null,
): Promise<ProductsPage> => {
  return request<{
    site: {
      search: {
        searchProducts: {
          products: {
            pageInfo: {
              hasNextPage: boolean;
              endCursor: string | null;
            };
            edges: {
              node: Product;
            }[];
          };
        };
      };
    };
  }>(
    config.graphqlEndpoint,
    gql`
        ${PRODUCT_FRAGMENT}
        query productSearch($term: String, $first: Int!, $after: String) {
            site {
                search {
                    searchProducts(filters: { searchTerm: $term }) {
                        products(first: $first, after: $after) {
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                            edges {
                                node {
                                    ...ProductData
                                }
                            }
                        }
                    }
                }
            }
        }
    `,
    {
      term,
      first,
      after,
    },
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    }
  )
  .then((response) => ({
    products: response.site.search.searchProducts.products.edges.map((e) => e.node),
    hasNextPage: response.site.search.searchProducts.products.pageInfo.hasNextPage,
    endCursor: response.site.search.searchProducts.products.pageInfo.endCursor,
  }));
};

export const searchProducts: (
  term: string,
  config: ValidConfig
) => Promise<Product[]> = async (term: string = "", config) => {
  const firstPage = await searchProductsPage(term, config, 50, null);
  return firstPage.products;
};
