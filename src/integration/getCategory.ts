import request, { gql } from "graphql-request";
import { ValidConfig } from "../types/config.ts";
import { Category } from "../types/entity.ts";
import { CATEGORY_FRAGMENT } from "./categoryFragment.ts";

export const getCategoryById = (
  categoryId: string | number,
  config: ValidConfig,
): Promise<Category | undefined> => {
  return request<{
    site: {
      category: Category;
    };
  }>(
    config.graphqlEndpoint,
    gql`
        ${CATEGORY_FRAGMENT}
        query categoryData($categoryId: ID) {
            site {
                category(id: $categoryId) {
                    ...CategoryData
                }
            }
        }
    `,
    {
      categoryId: String(categoryId),
    },
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    },
  ).then((response) => response.site.category);
};

export const getCategoryByEntityId = (
  categoryId: string | number,
  config: ValidConfig,
): Promise<Category | undefined> => {
  return request<{
    site: {
      category: Category;
    };
  }>(
    config.graphqlEndpoint,
    gql`
        ${CATEGORY_FRAGMENT}
        query categoryData($categoryId: Int!) {
            site {
                category(entityId: $categoryId) {
                    ...CategoryData
                }
            }
        }
    `,
    {
      categoryId: Number(categoryId),
    },
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    },
  ).then((response) => response.site.category);
};
