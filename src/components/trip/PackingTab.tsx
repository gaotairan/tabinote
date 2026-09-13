import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Filter,
  Check,
  Sparkles,
  Shield,
  Shirt,
  Smartphone,
  Bath,
  MoreHorizontal,
} from 'lucide-react';
import type { Trip, PackingItem, PackingCategory } from '../../types/trip';
import confetti from 'canvas-confetti';
import './PackingTab.css';

interface PackingTabProps {
  trip: Trip;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export const PackingTab: React.FC<PackingTabProps> = ({
  trip,
  onUpdateTrip,
}) => {
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<PackingCategory>('essential');
  const [newItemMember, setNewItemMember] = useState<string>('all');

  const items = trip.packingList || [];
  const checkedCount = items.filter((i) => i.isChecked).length;
  const progressPercent =
    items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  const handleToggleCheck = (itemId: string) => {
    const updated = items.map((item) => {
      if (item.id === itemId) {
        const nextState = !item.isChecked;
        // すべてチェック完了した場合は紙吹雪
        if (nextState && checkedCount + 1 === items.length) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        return { ...item, isChecked: nextState };
      }
      return item;
    });
    onUpdateTrip({ ...trip, packingList: updated });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: PackingItem = {
      id: 'p-' + Date.now(),
      name: newItemName.trim(),
      category: newItemCategory,
      isChecked: false,
      assignedMemberId: newItemMember,
    };

    onUpdateTrip({ ...trip, packingList: [...items, newItem] });
    setNewItemName('');
  };

  const handleDeleteItem = (itemId: string) => {
    onUpdateTrip({
      ...trip,
      packingList: items.filter((i) => i.id !== itemId),
    });
  };

  const categories: { id: PackingCategory; label: string; icon: any }[] = [
    { id: 'essential', label: '必需品・貴重品', icon: Shield },
    { id: 'clothes', label: '衣類・防寒具', icon: Shirt },
    { id: 'electronics', label: '電子機器・充電器', icon: Smartphone },
    { id: 'toiletries', label: '洗面・衛生・薬', icon: Bath },
    { id: 'other', label: 'その他', icon: MoreHorizontal },
  ];

  // フィルタリングされたリスト
  const filteredItems = items.filter((item) => {
    if (selectedMemberFilter === 'all') return true;
    return item.assignedMemberId === selectedMemberFilter || item.assignedMemberId === 'all';
  });

  return (
    <div className="packing-tab fade-in">
      {/* 進捗プログレスカード */}
      <div className="packing-progress-card">
        <div className="progress-info-row">
          <div>
            <h3 className="progress-title">持ち物チェック進捗</h3>
            <span className="progress-counts">
              {checkedCount} / {items.length} 完了
            </span>
          </div>
          <span className="progress-badge">{progressPercent}%</span>
        </div>
        <div className="progress-bar-bg">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {progressPercent === 100 && items.length > 0 && (
          <div className="all-ready-banner">
            <Sparkles size={16} />
            <span>荷造り完了！忘れ物はありません。準備バッチリです！🎉</span>
          </div>
        )}
      </div>

      {/* 担当者フィルタ ＆ アイテム追加フォーム */}
      <div className="packing-controls">
        <div className="member-filter-row">
          <span className="filter-label">
            <Filter size={14} />
            <span>担当者:</span>
          </span>
          <button
            className={`filter-chip ${selectedMemberFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedMemberFilter('all')}
          >
            全員の持ち物
          </button>
          {trip.members.map((m) => (
            <button
              key={m.id}
              className={`filter-chip ${selectedMemberFilter === m.id ? 'active' : ''}`}
              onClick={() => setSelectedMemberFilter(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* クイック追加入力 */}
        <form onSubmit={handleAddItem} className="quick-add-form">
          <select
            className="form-select"
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value as PackingCategory)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className="form-select"
            value={newItemMember}
            onChange={(e) => setNewItemMember(e.target.value)}
          >
            <option value="all">全員</option>
            {trip.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="form-input flex-1"
            placeholder="新しい持ち物を追加（例: モバイルバッテリー）"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary add-item-btn">
            <Plus size={16} />
            <span>追加</span>
          </button>
        </form>
      </div>

      {/* カテゴリ別の持ち物リスト */}
      <div className="categories-list">
        {categories.map((cat) => {
          const catItems = filteredItems.filter((i) => i.category === cat.id);
          if (catItems.length === 0) return null;
          const Icon = cat.icon;

          return (
            <div key={cat.id} className="category-section">
              <div className="category-header">
                <Icon size={16} className="category-icon" />
                <h4 className="category-title">{cat.label}</h4>
                <span className="category-count">({catItems.length})</span>
              </div>

              <div className="packing-items-grid">
                {catItems.map((item) => {
                  const assignedMember = trip.members.find(
                    (m) => m.id === item.assignedMemberId
                  );

                  return (
                    <div
                      key={item.id}
                      className={`packing-item-card ${item.isChecked ? 'checked' : ''}`}
                      onClick={() => handleToggleCheck(item.id)}
                    >
                      <div className="checkbox-custom">
                        {item.isChecked && <Check size={14} color="#ffffff" strokeWidth={3} />}
                      </div>

                      <div className="item-details">
                        <span className="item-name">{item.name}</span>
                        {assignedMember && (
                          <span
                            className="member-tag"
                            style={{ backgroundColor: `${assignedMember.avatarColor}20`, color: assignedMember.avatarColor }}
                          >
                            {assignedMember.name}
                          </span>
                        )}
                      </div>

                      <button
                        className="delete-item-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.id);
                        }}
                        title="削除"
                        aria-label="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
