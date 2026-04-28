import { gql } from "@apollo/client";

export const RECEIVABLE_SUMMARY_QUERY = gql`
  query ReceivableSummary {
    receivableSummary {
      debtorName
      totalAmount
      receivedAmount
      pendingAmount
      transactionCount
    }
  }
`;

export const RECEIVABLE_TRANSACTIONS_QUERY = gql`
  query ReceivableTransactions($debtorName: String, $status: String, $period: String) {
    receivableTransactions(debtorName: $debtorName, status: $status, period: $period) {
      id
      description
      amount
      transactionType
      paymentMethod
      date
      competenceDate
      receiptStatus
      receivedAmount
      remainingAmount
      debtorName
      installmentNumber
      totalInstallments
      account {
        id
        name
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
      }
    }
  }
`;

export const RECEIPTS_QUERY = gql`
  query Receipts($transactionId: ID!) {
    receipts(transactionId: $transactionId) {
      id
      transactionId
      amountReceived
      receiptDate
      destinationAccountId
      destinationAccountName
      notes
      createdAt
    }
  }
`;

export const CREATE_RECEIPT_MUTATION = gql`
  mutation CreateReceipt($input: CreateReceiptInput!) {
    createReceipt(input: $input) {
      id
      amountReceived
      receiptDate
      destinationAccountName
    }
  }
`;

export const BULK_RECEIVE_MUTATION = gql`
  mutation BulkReceive($input: BulkReceiveInput!) {
    bulkReceive(input: $input)
  }
`;

export const DELETE_RECEIPT_MUTATION = gql`
  mutation DeleteReceipt($id: ID!) {
    deleteReceipt(id: $id)
  }
`;
