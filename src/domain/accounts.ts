import type { Account, Cents, FinanceData, Id, IsoDate, RecurringExpense } from '@/types/models'
import { monthIndex, parseIsoDate } from '@/utils/dates'
import { dueDateIn } from './recurrence'

export interface AccountBalance {
  id: Id
  name: string
  balance: Cents
}

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0)

/** Addebiti della ricorrenza con data dopo `from` (esclusa) e fino a `to` (inclusa). */
function chargesBetween(r: RecurringExpense, from: IsoDate, to: IsoDate): number {
  const f = parseIsoDate(from)
  const t = parseIsoDate(to)
  let count = 0
  for (let i = monthIndex(f.year, f.month); i <= monthIndex(t.year, t.month); i++) {
    const due = dueDateIn(r, Math.floor(i / 12), i % 12)
    if (due && due > from && due <= to) count++
  }
  return count
}

/**
 * Saldo del conto a fine giornata di `today`: saldo di partenza più entrate meno uscite (una tantum e
 * ricorrenze alla loro scadenza) fatte con i suoi metodi di pagamento dopo la data di partenza.
 * I prestiti non hanno un metodo di pagamento e restano fuori.
 */
export function accountBalance(data: FinanceData, account: Account, today: IsoDate): Cents {
  const methods = new Set(account.paymentMethodIds)
  const from = account.openingDate
  const counts = (x: { date: IsoDate; paymentMethodId: Id }) => methods.has(x.paymentMethodId) && x.date > from && x.date <= today
  const income = sum(data.incomes.filter(counts).map((i) => i.amount))
  const oneTime = sum(data.oneTimeExpenses.filter(counts).map((e) => e.amount))
  const recurring = sum(
    data.recurringExpenses.filter((r) => methods.has(r.paymentMethodId)).map((r) => r.amount * chargesBetween(r, from, today)),
  )
  return account.openingAmount + income - oneTime - recurring
}

export function accountBalances(data: FinanceData, today: IsoDate): AccountBalance[] {
  return data.accounts.map((a) => ({ id: a.id, name: a.name, balance: accountBalance(data, a, today) }))
}
