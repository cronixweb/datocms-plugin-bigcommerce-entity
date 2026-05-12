import request, { gql } from "graphql-request";
import { ValidConfig } from "../types/config.ts";
import { Category } from "../types/entity.ts";

type CategoryTreeItem = {
  entityId: number;
  name: string;
  path?: string;
  children?: CategoryTreeItem[];
};

const flattenCategoryTree = (nodes: CategoryTreeItem[]): Category[] => {
  const output: Category[] = [];

  const walk = (list: CategoryTreeItem[]) => {
    list.forEach((node) => {
      output.push({
        id: String(node.entityId),
        entityId: node.entityId,
        name: node.name,
        path: node.path,
      });
      if (node.children?.length) {
        walk(node.children);
      }
    });
  };

  walk(nodes);
  return output;
};

export const searchCategories = async (
  term: string,
  config: ValidConfig,
): Promise<Category[]> => {
  const response = await request<{
    site: {
      categoryTree: CategoryTreeItem[];
    };
  }>(
    config.graphqlEndpoint,
    gql`
        query categorySearch {
            site {
                categoryTree {
                    entityId
                    name
                    path
                    children {
                        entityId
                        name
                        path
                        children {
                            entityId
                            name
                            path
                            children {
                                entityId
                                name
                                path
                                children {
                                    entityId
                                    name
                                    path
                                }
                            }
                        }
                    }
                }
            }
        }
    `,
    undefined,
    {
      Authorization: `Bearer ${config.authorizationToken}`,
    },
  );

  const categories = flattenCategoryTree(response.site.categoryTree);
  const normalizedTerm = term.trim().toLowerCase();

  if (!normalizedTerm) {
    return categories;
  }

  return categories.filter((category) =>
    category.name.toLowerCase().includes(normalizedTerm),
  );
};
