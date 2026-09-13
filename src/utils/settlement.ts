import type { ExpenseItem, Member, SettlementResult } from '../types/trip';

/**
 * 参加メンバー間の割り勘精算を計算する
 */
export function calculateSettlements(
  expenses: ExpenseItem[],
  members: Member[]
): {
  balances: { [memberId: string]: number }; // 正: 受け取るべき額, 負: 支払うべき額
  settlements: SettlementResult[];
  totalSpent: number;
} {
  const balances: { [memberId: string]: number } = {};
  members.forEach((m) => {
    balances[m.id] = 0;
  });

  let totalSpent = 0;

  for (const exp of expenses) {
    totalSpent += exp.amount;
    // 支払った人はプラス
    if (balances[exp.payerId] !== undefined) {
      balances[exp.payerId] += exp.amount;
    }

    // 割り勘対象メンバー
    const targets =
      exp.targetMemberIds && exp.targetMemberIds.length > 0
        ? exp.targetMemberIds
        : members.map((m) => m.id);

    if (targets.length > 0) {
      const perPerson = exp.amount / targets.length;
      targets.forEach((tId) => {
        if (balances[tId] !== undefined) {
          balances[tId] -= perPerson;
        }
      });
    }
  }

  // 債権者（受け取る人）と債務者（払う人）に分ける
  const creditors: { memberId: string; amount: number }[] = [];
  const debtors: { memberId: string; amount: number }[] = [];

  for (const memberId of Object.keys(balances)) {
    const val = Math.round(balances[memberId]);
    if (val > 0) {
      creditors.push({ memberId, amount: val });
    } else if (val < 0) {
      debtors.push({ memberId, amount: -val });
    }
  }

  // 貪欲法による精算ルートの導出
  const settlements: SettlementResult[] = [];
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];

    const amount = Math.min(creditor.amount, debtor.amount);
    if (amount > 0) {
      settlements.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount,
      });
    }

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) cIdx++;
    if (debtor.amount === 0) dIdx++;
  }

  return { balances, settlements, totalSpent };
}
