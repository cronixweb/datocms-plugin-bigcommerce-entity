import request, { gql } from "graphql-request";
import { ValidConfig } from "../types/config.ts";
import { Brand } from "../types/entity.ts";
import { BRAND_FRAGMENT } from "./brandFragment.ts";

export const getBrandById = (
  brandId: string | number,
  config: ValidConfig,
): Promise<Brand | undefined> => {
  return request<{
    site: {
      brand: Brand;
    };
  }>(
    config.graphqlEndpoint,
    gql`
        ${BRAND_FRAGMENT}
        query brandData($brandId: ID) {
            site {
                brand(id: $brandId) {
                    ...BrandData
                }
            }
        }
    `,
    {
      brandId: String(brandId),
    },
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    },
  ).then((response) => response.site.brand);
};

export const getBrandByEntityId = (
  brandId: string | number,
  config: ValidConfig,
): Promise<Brand | undefined> => {
  return request<{
    site: {
      brand: Brand;
    };
  }>(
    config.graphqlEndpoint,
    gql`
        ${BRAND_FRAGMENT}
        query brandData($brandId: Int!) {
            site {
                brand(entityId: $brandId) {
                    ...BrandData
                }
            }
        }
    `,
    {
      brandId: Number(brandId),
    },
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    },
  ).then((response) => response.site.brand);
};
