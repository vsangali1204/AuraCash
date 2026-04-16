import { gql } from "@apollo/client";

const CATEGORY_FIELDS = gql`
  fragment CategoryFields on CategoryType {
    id
    name
    categoryType
    color
    icon
  }
`;

export const CATEGORIES_QUERY = gql`
  ${CATEGORY_FIELDS}
  query Categories($categoryType: String) {
    categories(categoryType: $categoryType) {
      ...CategoryFields
    }
  }
`;

export const CREATE_CATEGORY_MUTATION = gql`
  ${CATEGORY_FIELDS}
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      ...CategoryFields
    }
  }
`;

export const UPDATE_CATEGORY_MUTATION = gql`
  ${CATEGORY_FIELDS}
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      ...CategoryFields
    }
  }
`;

export const DELETE_CATEGORY_MUTATION = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;
