export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Account {
  id: string;
  name: string;
  bank: string;
  accountType: string;
  initialBalance: number;
  currentBalance: number;
  color: string;
  isActive: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  categoryType: string;
  color: string;
  icon?: string | null;
}

export interface Invoice {
  id: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
}

export interface InvoiceWithCard extends Invoice {
  creditCardId: string;
  creditCardName: string;
  creditCardBrand: string;
}

export interface CreditCard {
  id: string;
  name: string;
  brand: string;
  totalLimit: number;
  availableLimit: number;
  closingDay: number;
  dueDay: number;
  isActive: boolean;
  accountId?: string | null;
  accountName?: string | null;
  createdAt: string;
  currentInvoice?: Invoice | null;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  transactionType: string;
  paymentMethod: string;
  date: string;
  competenceDate?: string | null;
  account?: Pick<Account, "id" | "name" | "color" | "accountType"> | null;
  creditCard?: Pick<CreditCard, "id" | "name" | "brand"> | null;
  invoice?: Pick<Invoice, "id" | "referenceMonth" | "dueDate" | "status"> | null;
  transferAccount?: Pick<Account, "id" | "name"> | null;
  category?: Pick<Category, "id" | "name" | "color" | "icon"> | null;
  isReceivable: boolean;
  debtorName?: string | null;
  receiptStatus?: string | null;
  receivedAmount: number;
  remainingAmount: number;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  isPendingRecurrence: boolean;
  recurrence?: { id: string; description: string } | null;
  notes?: string | null;
  createdAt: string;
}

export interface Recurrence {
  id: string;
  description: string;
  amount: number;
  recurrenceType: string;
  paymentMethod: string;
  dayOfMonth: number;
  useBusinessDay: boolean;
  isActive: boolean;
  startDate: string;
  endDate?: string | null;
  accountId: string;
  accountName: string;
  creditCardId?: string | null;
  creditCardName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  nextExecutionDate?: string | null;
}

export interface ReceivableSummary {
  debtorName: string;
  totalAmount: number;
  receivedAmount: number;
  pendingAmount: number;
  transactionCount: number;
}

export interface Receipt {
  id: string;
  transactionId: string;
  amountReceived: number;
  receiptDate: string;
  destinationAccountId: string;
  destinationAccountName: string;
  notes?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalBalance: number;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  totalReceivable: number;
  monthReceivable: number;
  futureIncomeAmount: number;
  pendingInvoicesAmount: number;
  futureExpensesAmount: number;
  projectedBalance: number;
  pendingRecurrencesCount: number;
  expenseByCategory: { categoryName: string; categoryColor: string; total: number; percentage: number }[];
  incomeByCategory: { categoryName: string; categoryColor: string; total: number; percentage: number }[];
  balanceHistory: { month: string; income: number; expense: number; balance: number }[];
}

export interface CalendarEvent {
  date: string;
  eventType: string;
  title: string;
  amount?: number | null;
  color: string;
}
