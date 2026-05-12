import { gql } from "graphql-request";

export const CATEGORY_FRAGMENT = gql`
    fragment CategoryData on Category {
        id
        entityId
        name
        path
    }
`;
