import { gql } from "@apollo/client";

const RECURRENCE_FIELDS = gql`
  fragment RecurrenceFields on RecurrenceType {
    id
    description
    amount
    recurrenceType
    paymentMethod
    dayOfMonth
    useBusinessDay
    isActive
    startDate
    endDate
    accountId
    accountName
    creditCardId
    creditCardName
    categoryId
    categoryName
    nextExecutionDate
  }
`;

export const RECURRENCES_QUERY = gql`
  ${RECURRENCE_FIELDS}
  query Recurrences($activeOnly: Boolean) {
    recurrences(activeOnly: $activeOnly) {
      ...RecurrenceFields
    }
  }
`;

export const CREATE_RECURRENCE_MUTATION = gql`
  ${RECURRENCE_FIELDS}
  mutation CreateRecurrence($input: CreateRecurrenceInput!) {
    createRecurrence(input: $input) {
      ...RecurrenceFields
    }
  }
`;

export const UPDATE_RECURRENCE_MUTATION = gql`
  ${RECURRENCE_FIELDS}
  mutation UpdateRecurrence($input: UpdateRecurrenceInput!) {
    updateRecurrence(input: $input) {
      ...RecurrenceFields
    }
  }
`;

export const TOGGLE_RECURRENCE_MUTATION = gql`
  ${RECURRENCE_FIELDS}
  mutation ToggleRecurrence($id: ID!) {
    toggleRecurrence(id: $id) {
      ...RecurrenceFields
    }
  }
`;

export const DELETE_RECURRENCE_MUTATION = gql`
  mutation DeleteRecurrence($id: ID!) {
    deleteRecurrence(id: $id)
  }
`;

export const PROCESS_RECURRENCES_MUTATION = gql`
  mutation ProcessRecurrences {
    processRecurrences
  }
`;
