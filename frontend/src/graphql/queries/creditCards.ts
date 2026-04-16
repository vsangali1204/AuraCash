import { gql } from "@apollo/client";

const INVOICE_FIELDS = gql`
  fragment InvoiceFields on InvoiceType {
    id
    referenceMonth
    closingDate
    dueDate
    totalAmount
    paidAmount
    status
  }
`;

const CREDIT_CARD_FIELDS = gql`
  ${INVOICE_FIELDS}
  fragment CreditCardFields on CreditCardType {
    id
    name
    brand
    totalLimit
    availableLimit
    closingDay
    dueDay
    isActive
    accountId
    accountName
    createdAt
    currentInvoice {
      ...InvoiceFields
    }
  }
`;

export const CREDIT_CARDS_QUERY = gql`
  ${CREDIT_CARD_FIELDS}
  query CreditCards {
    creditCards {
      ...CreditCardFields
    }
  }
`;

export const CREDIT_CARD_QUERY = gql`
  ${CREDIT_CARD_FIELDS}
  query CreditCard($id: ID!) {
    creditCard(id: $id) {
      ...CreditCardFields
    }
  }
`;

export const INVOICES_QUERY = gql`
  ${INVOICE_FIELDS}
  query Invoices($creditCardId: ID!) {
    invoices(creditCardId: $creditCardId) {
      ...InvoiceFields
    }
  }
`;

export const CREATE_CREDIT_CARD_MUTATION = gql`
  ${CREDIT_CARD_FIELDS}
  mutation CreateCreditCard($input: CreateCreditCardInput!) {
    createCreditCard(input: $input) {
      ...CreditCardFields
    }
  }
`;

export const UPDATE_CREDIT_CARD_MUTATION = gql`
  ${CREDIT_CARD_FIELDS}
  mutation UpdateCreditCard($input: UpdateCreditCardInput!) {
    updateCreditCard(input: $input) {
      ...CreditCardFields
    }
  }
`;

export const DELETE_CREDIT_CARD_MUTATION = gql`
  mutation DeleteCreditCard($id: ID!) {
    deleteCreditCard(id: $id)
  }
`;

export const PAY_INVOICE_MUTATION = gql`
  ${INVOICE_FIELDS}
  mutation PayInvoice($input: PayInvoiceInput!) {
    payInvoice(input: $input) {
      ...InvoiceFields
    }
  }
`;
