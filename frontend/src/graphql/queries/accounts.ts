import { gql } from "@apollo/client";

const ACCOUNT_FIELDS = gql`
  fragment AccountFields on AccountType {
    id
    name
    bank
    accountType
    initialBalance
    currentBalance
    color
    isActive
    createdAt
  }
`;

export const ACCOUNTS_QUERY = gql`
  ${ACCOUNT_FIELDS}
  query Accounts {
    accounts {
      ...AccountFields
    }
  }
`;

export const ACCOUNT_QUERY = gql`
  ${ACCOUNT_FIELDS}
  query Account($id: ID!) {
    account(id: $id) {
      ...AccountFields
    }
  }
`;

export const CREATE_ACCOUNT_MUTATION = gql`
  ${ACCOUNT_FIELDS}
  mutation CreateAccount($input: CreateAccountInput!) {
    createAccount(input: $input) {
      ...AccountFields
    }
  }
`;

export const UPDATE_ACCOUNT_MUTATION = gql`
  ${ACCOUNT_FIELDS}
  mutation UpdateAccount($input: UpdateAccountInput!) {
    updateAccount(input: $input) {
      ...AccountFields
    }
  }
`;

export const DELETE_ACCOUNT_MUTATION = gql`
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id)
  }
`;
