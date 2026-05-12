import { gql } from "graphql-request";

export const BRAND_FRAGMENT = gql`
    fragment BrandData on Brand {
        id
        entityId
        name
        defaultImage {
            urlOriginal
            altText
        }
    }
`;
