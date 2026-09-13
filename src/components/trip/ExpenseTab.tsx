import React, { useState } from 'react';
import {
  Coins,
  Plus,
  Trash2,
  ArrowRight,
  Receipt,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import type { Trip, ExpenseItem, ExpenseCategory } from '../../types/trip';
import { calculateSettlements } from '../../utils/settlement';
import { Modal } from '../common/Modal';
import { format } from 'date-fns';
import './ExpenseTab.css';

interface ExpenseTabProps {
  trip: Trip;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export const ExpenseTab: React.FC<ExpenseTabProps> = ({
  trip,
  onUpdateTrip,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // フォーム用状態
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(trip.members[0]?.id || '');
  const [targetMemberIds, setTargetMemberIds] = useState<string[]>(() =>
    trip.members.map((m) => m.id)
  );
  const [date, setDate] = useState(trip.startDate || format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [memo, setMemo] = useState('');

  const expenses = trip.expenses || [];
  const { balances, settlements, totalSpent } = calculateSettlements(
    expenses,
    trip.members
  );

  const handleOpenAdd = () => {
    setTitle('');
    setAmount('');
    setPayerId(trip.members[0]?.id || '');
    setTargetMemberIds(trip.members.map((m) => m.id));
    setDate(trip.startDate || format(new Date(), 'yyyy-MM-dd'));
    setCategory('food');
    setMemo('');
    setIsModalOpen(true);
  };

  const handleToggleTarget = (memberId: string) => {
    if (targetMemberIds.includes(memberId)) {
      if (targetMemberIds.length === 1) {
        alert('最低1人の対象者を選択してください');
        return;
      }
      setTargetMemberIds(targetMemberIds.filter((id) => id !== memberId));
    } else {
      setTargetMemberIds([...targetMemberIds, memberId]);
    }
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount, 10);
    if (!title.trim() || isNaN(numAmount) || numAmount <= 0) return;

    const newExpense: ExpenseItem = {
      id: 'e-' + Date.now(),
      title: title.trim(),
      amount: numAmount,
      payerId,
      targetMemberIds,
      date,
      category,
      memo: memo.trim() || undefined,
    };

    onUpdateTrip({ ...trip, expenses: [...expenses, newExpense] });
    setIsModalOpen(false);
  };

  const handleDeleteExpense = (id: string) => {
    if (!confirm('この支払い記録を削除しますか？')) return;
    onUpdateTrip({
      ...trip,
      expenses: expenses.filter((e) => e.id !== id),
    });
  };

  const getMember = (id: string) => trip.members.find((m) => m.id === id);

  return (
    <div className="expense-tab fade-in">
      {/* 支出総額カード */}
      <div className="expense-overview-card">
        <div className="total-spent-box">
          <span className="overview-label">旅行中の合計支出</span>
          <h3 className="total-spent-number">¥{totalSpent.toLocaleString()}</h3>
          <span className="per-person-note">
            （{trip.members.length}名換算：1人平均 約¥
            {Math.round(totalSpent / (trip.members.length || 1)).toLocaleString()}）
          </span>
        </div>

        <button className="btn btn-primary add-expense-btn" onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>支払いを記録</span>
        </button>
      </div>

      {/* 割り勘精算レポート */}
      <div className="settlement-section">
        <div className="section-title-row">
          <Coins size={18} className="icon-amber" />
          <h4 className="settlement-title">精算ルート（送金指示）</h4>
        </div>

        {settlements.length === 0 ? (
          <div className="no-settlement-needed">
            <CheckCircle2 size={18} color="#10b981" />
            <span>精算の必要はありません（全額精算済み、または支払いなし）</span>
          </div>
        ) : (
          <div className="settlements-grid">
            {settlements.map((s, index) => {
              const fromMember = getMember(s.fromMemberId);
              const toMember = getMember(s.toMemberId);

              return (
                <div key={index} className="settlement-card">
                  <div className="settlement-route">
                    <div className="route-member">
                      <span
                        className="member-avatar-mini"
                        style={{ backgroundColor: fromMember?.avatarColor }}
                      >
                        {fromMember?.name.slice(0, 1)}
                      </span>
                      <span className="member-name-text">{fromMember?.name}</span>
                    </div>

                    <div className="route-arrow">
                      <span className="arrow-label">が支払う</span>
                      <ArrowRight size={18} />
                    </div>

                    <div className="route-member">
                      <span
                        className="member-avatar-mini"
                        style={{ backgroundColor: toMember?.avatarColor }}
                      >
                        {toMember?.name.slice(0, 1)}
                      </span>
                      <span className="member-name-text">{toMember?.name}</span>
                    </div>
                  </div>

                  <div className="settlement-amount">
                    ¥{s.amount.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* メンバー別収支バランス */}
      <div className="balances-section">
        <h4 className="balances-title">メンバー別 支払い状況</h4>
        <div className="balances-table-card">
          {trip.members.map((m) => {
            const bal = balances[m.id] || 0;
            const isPlus = bal > 0;
            const isZero = bal === 0;

            return (
              <div key={m.id} className="balance-row">
                <div className="balance-member">
                  <span
                    className="member-avatar-mini"
                    style={{ backgroundColor: m.avatarColor }}
                  >
                    {m.name.slice(0, 1)}
                  </span>
                  <span className="balance-name">{m.name}</span>
                </div>
                <div className="balance-status">
                  {isZero ? (
                    <span className="bal-neutral">±0円</span>
                  ) : isPlus ? (
                    <span className="bal-plus">
                      +¥{bal.toLocaleString()}（受け取り）
                    </span>
                  ) : (
                    <span className="bal-minus">
                      -¥{Math.abs(bal).toLocaleString()}（支払い）
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 支払い記録一覧 */}
      <div className="expenses-list-section">
        <div className="section-title-row">
          <Receipt size={18} className="icon-blue" />
          <h4 className="settlement-title">支払い履歴 ({expenses.length}件)</h4>
        </div>

        {expenses.length === 0 ? (
          <div className="empty-expenses">
            <p>支払い記録はまだありません。「支払いを記録」から入力してください。</p>
          </div>
        ) : (
          <div className="expenses-table">
            {expenses.map((exp) => {
              const payer = getMember(exp.payerId);

              return (
                <div key={exp.id} className="expense-item-row">
                  <div className="expense-left">
                    <span className="expense-date">{exp.date}</span>
                    <strong className="expense-title">{exp.title}</strong>
                    <div className="expense-meta">
                      <span>支払者: {payer?.name || '不明'}</span>
                      {exp.memo && <span className="expense-memo">({exp.memo})</span>}
                    </div>
                  </div>

                  <div className="expense-right">
                    <span className="expense-amount-badge">
                      ¥{exp.amount.toLocaleString()}
                    </span>
                    <button
                      className="delete-item-btn"
                      onClick={() => handleDeleteExpense(exp.id)}
                      title="削除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 支払い登録モーダル */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="支払いを記録する"
        maxWidth="500px"
      >
        <form onSubmit={handleSaveExpense} className="fade-in">
          <div className="form-group">
            <label>内容・品目 *</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: レンタカー代、夕食代、新幹線チケット"
              required
            />
          </div>

          <div className="form-group">
            <label>支払金額（円） *</label>
            <input
              type="number"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例: 12000"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>支払った人 *</label>
              <select
                className="form-select"
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
              >
                {trip.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>日付</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>割り勘対象メンバー（チェックされた人で等分）</label>
            <div className="target-members-checkboxes">
              {trip.members.map((m) => {
                const isSelected = targetMemberIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`target-member-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleTarget(m.id)}
                  >
                    <UserCheck size={14} />
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>メモ（任意）</label>
            <input
              type="text"
              className="form-input"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="カード払い、ポイント利用など"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            <span>支払いを保存</span>
          </button>
        </form>
      </Modal>
    </div>
  );
};
