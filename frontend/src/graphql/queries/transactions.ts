import { gql } from "@apollo/client";

const TRANSACTION_FIELDS = gql`
  fragment TransactionFields on TransactionType {
    id
    description
    amount
    transactionType
    paymentMethod
    date
    competenceDate
    notes
    createdAt
    isReceivable
    debtorName
    receiptStatus
    receivedAmount
    remainingAmount
    installmentNumber
    totalInstallments
    account {
      id
      name
      color
      accountType
    }
    creditCard {
      id
      name
      brand
    }
    invoice {
      id
      referenceMonth
      dueDate
      status
    }
    category {
      id
      name
      color
      icon
    }
  }
`;

export const TRANSACTIONS_QUERY = gql`
  ${TRANSACTION_FIELDS}
  query Transactions($filters: TransactionFilters, $limit: Int, $offset: Int) {
    transactions(filters: $filters, limit: $limit, offset: $offset) {
      ...TransactionFields
    }
  }
`;

export const INVOICE_TRANSACTIONS_QUERY = gql`
  ${TRANSACTION_FIELDS}
  query InvoiceTransactions($invoiceId: ID!) {
    invoiceTransactions(invoiceId: $invoiceId) {
      ...TransactionFields
    }
  }
`;

export const DASHBOARD_SUMMARY_QUERY = gql`
  query DashboardSummary($year: Int!, $month: Int!) {
    dashboardSummary(year: $year, month: $month) {
      totalBalance
      monthIncome
      monthExpense
      monthNet
      totalReceivable
      expenseByCategory {
        categoryName
        categoryColor
        total
        percentage
      }
      balanceHistory {
        month
        income
        expense
        balance
      }
    }
  }
`;

export const CALENDAR_EVENTS_QUERY = gql`
  query CalendarEvents($year: Int!, $month: Int!) {
    calendarEvents(year: $year, month: $month) {
      date
      eventType
      title
      amount
      color
    }
  }
`;

export const CREATE_TRANSACTION_MUTATION = gql`
  ${TRANSACTION_FIELDS}
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      ...TransactionFields
    }
  }
`;

export const UPDATE_TRANSACTION_MUTATION = gql`
  ${TRANSACTION_FIELDS}
  mutation UpdateTransaction($input: UpdateTransactionInput!) {
    updateTransaction(input: $input) {
      ...TransactionFields
    }
  }
`;

export const DELETE_TRANSACTION_MUTATION = gql`
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;
