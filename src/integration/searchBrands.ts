import request, { gql } from "graphql-request";
import { ValidConfig } from "../types/config.ts";
import { Brand } from "../types/entity.ts";
import { BRAND_FRAGMENT } from "./brandFragment.ts";

const PAGE_SIZE = 50;

export const searchBrands = async (
  term: string,
  config: ValidConfig,
): Promise<Brand[]> => {
  const normalizedTerm = term.trim().toLowerCase();
  const allBrands: Brand[] = [];
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    const response: {
      site: {
        brands: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges: {
            node: Brand;
          }[];
        };
      };
    } = await request<{
      site: {
        brands: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges: {
            node: Brand;
          }[];
        };
      };
    }>(
      config.graphqlEndpoint,
      gql`
          ${BRAND_FRAGMENT}
          query brandSearch($first: Int!, $after: String) {
              site {
                  brands(first: $first, after: $after) {
                      pageInfo {
                          hasNextPage
                          endCursor
                      }
                      edges {
                          node {
                              ...BrandData
                          }
                      }
                  }
              }
          }
      `,
      {
        first: PAGE_SIZE,
        after,
      },
      {
        Authorization: `Bearer ${config.authorizationToken}`,
      },
    );

    allBrands.push(...response.site.brands.edges.map((edge: { node: Brand }) => edge.node));
    hasNextPage = response.site.brands.pageInfo.hasNextPage;
    after = response.site.brands.pageInfo.endCursor;
  }

  if (!normalizedTerm) {
    return allBrands;
  }

  return allBrands.filter((brand) =>
    brand.name.toLowerCase().includes(normalizedTerm),
  );
};
