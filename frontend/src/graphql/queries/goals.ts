import { gql } from "@apollo/client";

const GOAL_FIELDS = gql`
  fragment GoalFields on GoalType {
    id
    name
    description
    targetAmount
    initialAmount
    currentAmount
    remainingAmount
    progressPct
    monthlyContribution
    priority
    targetDate
    accountId
    accountName
    color
    icon
    status
    contributions {
      id
      goalId
      amount
      date
      accountId
      accountName
      notes
    }
  }
`;

const GOAL_PROJECTION_FIELDS = gql`
  fragment GoalProjectionFields on GoalType {
    monthlyAllocation
    monthsToComplete
    forecastDate
    requiredMonthly
    onTrack
    isReachable
  }
`;

export const GOAL_PLAN_QUERY = gql`
  ${GOAL_FIELDS}
  ${GOAL_PROJECTION_FIELDS}
  query GoalPlan($monthlyBudget: Float, $strategy: String, $monthsWindow: Int) {
    goalPlan(monthlyBudget: $monthlyBudget, strategy: $strategy, monthsWindow: $monthsWindow) {
      monthlyBudget
      strategy
      monthsWindow
      budgetIsCustom
      exceedsCapacity
      totalTarget
      totalSaved
      totalRemaining
      committedMonthly
      allGoalsForecastDate
      monthsUntilAllGoals
      capacity {
        recurringIncome
        extraIncomeAverage
        totalIncome
        recurringExpenses
        cardInvoiceAverage
        variableExpenseAverage
        totalExpenses
        available
        monthsWindow
        incomeSources {
          description
          amount
          dayOfMonth
          accountName
        }
        expenseItems {
          description
          amount
          kind
        }
      }
      goals {
        ...GoalFields
        ...GoalProjectionFields
      }
    }
  }
`;

export const GOALS_QUERY = gql`
  ${GOAL_FIELDS}
  query Goals($status: String) {
    goals(status: $status) {
      ...GoalFields
    }
  }
`;

export const CREATE_GOAL_MUTATION = gql`
  ${GOAL_FIELDS}
  mutation CreateGoal($input: CreateGoalInput!) {
    createGoal(input: $input) {
      ...GoalFields
    }
  }
`;

export const UPDATE_GOAL_MUTATION = gql`
  ${GOAL_FIELDS}
  mutation UpdateGoal($input: UpdateGoalInput!) {
    updateGoal(input: $input) {
      ...GoalFields
    }
  }
`;

export const DELETE_GOAL_MUTATION = gql`
  mutation DeleteGoal($id: ID!) {
    deleteGoal(id: $id)
  }
`;

export const ARCHIVE_GOAL_MUTATION = gql`
  ${GOAL_FIELDS}
  mutation ArchiveGoal($id: ID!) {
    archiveGoal(id: $id) {
      ...GoalFields
    }
  }
`;

export const REORDER_GOALS_MUTATION = gql`
  ${GOAL_FIELDS}
  mutation ReorderGoals($ids: [ID!]!) {
    reorderGoals(ids: $ids) {
      ...GoalFields
    }
  }
`;

export const CREATE_GOAL_CONTRIBUTION_MUTATION = gql`
  ${GOAL_FIELDS}
  mutation CreateGoalContribution($input: CreateGoalContributionInput!) {
    createGoalContribution(input: $input) {
      ...GoalFields
    }
  }
`;

export const DELETE_GOAL_CONTRIBUTION_MUTATION = gql`
  mutation DeleteGoalContribution($id: ID!) {
    deleteGoalContribution(id: $id)
  }
`;

export const UPDATE_GOAL_PLAN_SETTINGS_MUTATION = gql`
  mutation UpdateGoalPlanSettings($input: UpdateGoalPlanSettingsInput!) {
    updateGoalPlanSettings(input: $input) {
      monthlyBudget
      strategy
      monthsWindow
      budgetIsCustom
    }
  }
`;
