import React, { useState } from 'react';
import { Gift, Plus, Trash2, Check, MapPin, Tag } from 'lucide-react';
import type { Trip, SouvenirItem } from '../../types/trip';
import './SouvenirTab.css';

interface SouvenirTabProps {
  trip: Trip;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export const SouvenirTab: React.FC<SouvenirTabProps> = ({
  trip,
  onUpdateTrip,
}) => {
  const [name, setName] = useState('');
  const [forWhom, setForWhom] = useState('');
  const [place, setPlace] = useState('');
  const [price, setPrice] = useState('');
  const [memo, setMemo] = useState('');

  const souvenirs = trip.souvenirs || [];
  const boughtCount = souvenirs.filter((s) => s.isBought).length;
  const totalPrice = souvenirs.reduce((sum, s) => sum + (s.price || 0), 0);

  const handleToggleBought = (id: string) => {
    const updated = souvenirs.map((s) =>
      s.id === id ? { ...s, isBought: !s.isBought } : s
    );
    onUpdateTrip({ ...trip, souvenirs: updated });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newItem: SouvenirItem = {
      id: 's-' + Date.now(),
      name: name.trim(),
      forWhom: forWhom.trim() || undefined,
      place: place.trim() || undefined,
      isBought: false,
      price: price ? parseInt(price, 10) : undefined,
      memo: memo.trim() || undefined,
    };

    onUpdateTrip({ ...trip, souvenirs: [...souvenirs, newItem] });
    setName('');
    setForWhom('');
    setPlace('');
    setPrice('');
    setMemo('');
  };

  const handleDelete = (id: string) => {
    onUpdateTrip({
      ...trip,
      souvenirs: souvenirs.filter((s) => s.id !== id),
    });
  };

  return (
    <div className="souvenir-tab fade-in">
      {/* サマリーカード */}
      <div className="souvenir-summary-card">
        <div className="summary-col">
          <span className="summary-label">購入・達成状況</span>
          <strong className="summary-value">
            {boughtCount} / {souvenirs.length} 件完了
          </strong>
        </div>
        <div className="summary-col">
          <span className="summary-label">お土産の合計目安予算</span>
          <strong className="summary-value price-highlight">
            ¥{totalPrice.toLocaleString()}
          </strong>
        </div>
      </div>

      {/* 新規登録フォーム */}
      <div className="add-souvenir-card">
        <h4 className="form-title">お土産・買いたいもの・Wishリストを追加</h4>
        <form onSubmit={handleAdd} className="souvenir-form">
          <div className="form-row">
            <div className="form-group flex-1">
              <label>品名・やりたいこと *</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 阿闍梨餅、八ツ橋、抹茶パフェ"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>渡す相手 / 対象</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 職場、家族、自分用"
                value={forWhom}
                onChange={(e) => setForWhom(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>買う場所 / お店</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 京都駅伊勢丹、清水寺参道"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
              />
            </div>
            <div className="form-group flex-1">
              <label>目安金額（円）</label>
              <input
                type="number"
                className="form-input"
                placeholder="例: 1500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>メモ・備考</label>
            <input
              type="text"
              className="form-input"
              placeholder="例: 日持ちが短いので最終日に購入する！"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary add-souvenir-btn">
            <Plus size={16} />
            <span>リストに追加</span>
          </button>
        </form>
      </div>

      {/* お土産一覧リスト */}
      {souvenirs.length === 0 ? (
        <div className="empty-souvenirs">
          <Gift size={40} className="empty-gift" />
          <h4>お土産・Wishリストがまだありません</h4>
          <p>買いたいものや食べたいものをメモしておくと買い忘れを防げます！</p>
        </div>
      ) : (
        <div className="souvenirs-grid">
          {souvenirs.map((item) => (
            <div
              key={item.id}
              className={`souvenir-card ${item.isBought ? 'bought' : ''}`}
              onClick={() => handleToggleBought(item.id)}
            >
              <div className="checkbox-custom">
                {item.isBought && <Check size={14} color="#ffffff" strokeWidth={3} />}
              </div>

              <div className="souvenir-content">
                <div className="souvenir-title-row">
                  <span className="souvenir-name">{item.name}</span>
                  {item.price && (
                    <span className="souvenir-price">¥{item.price.toLocaleString()}</span>
                  )}
                </div>

                <div className="souvenir-tags-row">
                  {item.forWhom && (
                    <span className="souvenir-tag for-tag">
                      <Tag size={11} />
                      {item.forWhom}
                    </span>
                  )}
                  {item.place && (
                    <span className="souvenir-tag place-tag">
                      <MapPin size={11} />
                      {item.place}
                    </span>
                  )}
                </div>

                {item.memo && <p className="souvenir-memo">{item.memo}</p>}
              </div>

              <button
                className="delete-item-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
                title="削除"
                aria-label="削除"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
