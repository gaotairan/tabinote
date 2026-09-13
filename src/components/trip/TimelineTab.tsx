import React, { useState } from 'react';
import {
  Clock,
  Plus,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  Train,
  Plane,
  Car,
  Bus,
  Footprints,
  Ship,
  Utensils,
  Hotel,
  Camera,
  Activity,
  CalendarDays,
} from 'lucide-react';
import type {
  Trip,
  DaySchedule,
  ScheduleItem,
  ScheduleCategory,
  TransportType,
} from '../../types/trip';
import { Modal } from '../common/Modal';
import './TimelineTab.css';

interface TimelineTabProps {
  trip: Trip;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({
  trip,
  onUpdateTrip,
}) => {
  const [activeDayNumber, setActiveDayNumber] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // フォーム用状態
  const [itemTime, setItemTime] = useState('09:00');
  const [itemEndTime, setItemEndTime] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemCategory, setItemCategory] = useState<ScheduleCategory>('sightseeing');
  const [itemTransportType, setItemTransportType] = useState<TransportType>('train');
  const [itemLocation, setItemLocation] = useState('');
  const [itemMemo, setItemMemo] = useState('');
  const [itemCost, setItemCost] = useState('');

  const currentDay =
    trip.days.find((d) => d.dayNumber === activeDayNumber) || trip.days[0];

  const handleOpenAdd = () => {
    setEditingItem(null);
    setItemTime('10:00');
    setItemEndTime('');
    setItemTitle('');
    setItemCategory('sightseeing');
    setItemTransportType('train');
    setItemLocation('');
    setItemMemo('');
    setItemCost('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setItemTime(item.time || '10:00');
    setItemEndTime(item.endTime || '');
    setItemTitle(item.title);
    setItemCategory(item.category);
    setItemTransportType(item.transportType || 'train');
    setItemLocation(item.location || '');
    setItemMemo(item.memo || '');
    setItemCost(item.cost ? item.cost.toString() : '');
    setIsModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) return;

    const locationTrimmed = itemLocation.trim();
    const locationUrl = locationTrimmed
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationTrimmed)}`
      : undefined;

    const newItem: ScheduleItem = {
      id: editingItem ? editingItem.id : 'item-' + Date.now(),
      time: itemTime.trim() || '終日',
      endTime: itemEndTime.trim() || undefined,
      title: itemTitle.trim(),
      category: itemCategory,
      transportType: itemCategory === 'transport' ? itemTransportType : undefined,
      location: locationTrimmed || undefined,
      locationUrl,
      memo: itemMemo.trim() || undefined,
      cost: itemCost ? parseInt(itemCost, 10) : undefined,
    };

    const updatedDays = trip.days.map((day) => {
      if (day.dayNumber === activeDayNumber) {
        let items = [...day.items];
        if (editingItem) {
          items = items.map((it) => (it.id === editingItem.id ? newItem : it));
        } else {
          items.push(newItem);
        }
        // 時刻順にソート
        items.sort((a, b) => {
          if (a.time === '終日') return -1;
          if (b.time === '終日') return 1;
          return a.time.localeCompare(b.time);
        });
        return { ...day, items };
      }
      return day;
    });

    onUpdateTrip({ ...trip, days: updatedDays });
    setIsModalOpen(false);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!confirm('この予定を削除しますか？')) return;
    const updatedDays = trip.days.map((day) => {
      if (day.dayNumber === activeDayNumber) {
        return {
          ...day,
          items: day.items.filter((it) => it.id !== itemId),
        };
      }
      return day;
    });
    onUpdateTrip({ ...trip, days: updatedDays });
  };

  const handleAddNewDay = () => {
    const nextNum = trip.days.length + 1;
    // 最終日の翌日を計算
    const lastDay = trip.days[trip.days.length - 1];
    let nextDate = trip.endDate;
    if (lastDay) {
      const d = new Date(lastDay.date);
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().split('T')[0];
    }
    const newDay: DaySchedule = {
      dayNumber: nextNum,
      date: nextDate,
      title: `${nextNum}日目`,
      items: [],
    };
    onUpdateTrip({
      ...trip,
      endDate: nextDate > trip.endDate ? nextDate : trip.endDate,
      days: [...trip.days, newDay],
    });
    setActiveDayNumber(nextNum);
  };

  const getCategoryIcon = (item: ScheduleItem) => {
    if (item.category === 'transport') {
      switch (item.transportType) {
        case 'train':
          return <Train size={18} />;
        case 'plane':
          return <Plane size={18} />;
        case 'car':
          return <Car size={18} />;
        case 'bus':
          return <Bus size={18} />;
        case 'walk':
          return <Footprints size={18} />;
        case 'ship':
          return <Ship size={18} />;
        default:
          return <Train size={18} />;
      }
    }
    switch (item.category) {
      case 'food':
        return <Utensils size={18} />;
      case 'hotel':
        return <Hotel size={18} />;
      case 'activity':
        return <Activity size={18} />;
      case 'sightseeing':
        return <Camera size={18} />;
      default:
        return <CalendarDays size={18} />;
    }
  };

  const getCategoryClass = (category: ScheduleCategory) => {
    switch (category) {
      case 'transport':
        return 'cat-transport';
      case 'food':
        return 'cat-food';
      case 'hotel':
        return 'cat-hotel';
      case 'activity':
        return 'cat-activity';
      case 'sightseeing':
        return 'cat-sightseeing';
      default:
        return 'cat-other';
    }
  };

  return (
    <div className="timeline-tab fade-in">
      {/* 日程セレクターバー */}
      <div className="day-selector-bar">
        <div className="day-tabs-scroll">
          {trip.days.map((day) => {
            const isActive = day.dayNumber === activeDayNumber;
            const dateObj = new Date(day.date);
            const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
            const dayOfWeekStr = isNaN(dateObj.getTime())
              ? ''
              : `(${daysOfWeek[dateObj.getDay()]})`;

            return (
              <button
                key={day.dayNumber}
                className={`day-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveDayNumber(day.dayNumber)}
              >
                <span className="day-number-tag">Day {day.dayNumber}</span>
                <span className="day-date-tag">
                  {day.date.slice(5)} {dayOfWeekStr}
                </span>
              </button>
            );
          })}
          <button
            className="day-tab-btn add-day-btn"
            onClick={handleAddNewDay}
            title="日程（日目）を追加"
          >
            <Plus size={16} />
            <span>日を追加</span>
          </button>
        </div>
      </div>

      {/* 選択中の日のヘッダー */}
      {currentDay && (
        <div className="current-day-header">
          <div>
            <h3 className="day-title">
              {currentDay.dayNumber}日目 ({currentDay.date})
            </h3>
            {currentDay.title && (
              <p className="day-subtitle">{currentDay.title}</p>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>予定を追加</span>
          </button>
        </div>
      )}

      {/* タイムラインリスト */}
      {currentDay && currentDay.items.length === 0 ? (
        <div className="empty-timeline">
          <Clock size={40} className="empty-clock" />
          <h4>この日の予定はまだありません</h4>
          <p>「予定を追加」ボタンからタイムラインを作成しましょう！</p>
          <button className="btn btn-secondary" onClick={handleOpenAdd}>
            <Plus size={16} />
            <span>最初の予定を追加</span>
          </button>
        </div>
      ) : (
        <div className="timeline-list">
          {currentDay?.items.map((item, index) => {
            const catClass = getCategoryClass(item.category);
            return (
              <div key={item.id} className="timeline-item">
                {/* タイムライン時間 */}
                <div className="timeline-time-col">
                  <span className="time-primary">{item.time}</span>
                  {item.endTime && (
                    <span className="time-secondary">〜{item.endTime}</span>
                  )}
                </div>

                {/* タイムラインの軸・アイコン */}
                <div className="timeline-axis">
                  <div className={`timeline-icon-box ${catClass}`}>
                    {getCategoryIcon(item)}
                  </div>
                  {index < currentDay.items.length - 1 && (
                    <div className="timeline-line" />
                  )}
                </div>

                {/* 予定詳細カード */}
                <div className="timeline-card">
                  <div className="timeline-card-header">
                    <h4 className="item-title">{item.title}</h4>
                    <div className="item-actions">
                      <button
                        className="action-icon-btn"
                        onClick={() => handleOpenEdit(item)}
                        title="編集"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="action-icon-btn delete-btn"
                        onClick={() => handleDeleteItem(item.id)}
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {item.location && (
                    <div className="item-location-row">
                      <MapPin size={14} className="location-icon" />
                      <span className="location-text">{item.location}</span>
                      {item.locationUrl && (
                        <a
                          href={item.locationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="maps-link-badge"
                        >
                          <span>マップで開く</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  )}

                  {item.memo && (
                    <div className="item-memo-box">
                      <p className="item-memo-text">{item.memo}</p>
                    </div>
                  )}

                  {item.cost && (
                    <div className="item-cost-badge">
                      <span>目安費用: ¥{item.cost.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 予定追加・編集モーダル */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? '予定を編集' : '新しい予定を追加'}
        maxWidth="500px"
      >
        <form onSubmit={handleSaveItem} className="fade-in">
          <div className="form-group">
            <label>カテゴリー *</label>
            <div className="category-select-grid">
              {[
                { id: 'sightseeing' as ScheduleCategory, label: '観光', icon: Camera },
                { id: 'transport' as ScheduleCategory, label: '移動', icon: Train },
                { id: 'food' as ScheduleCategory, label: '食事', icon: Utensils },
                { id: 'hotel' as ScheduleCategory, label: '宿泊', icon: Hotel },
                { id: 'activity' as ScheduleCategory, label: '体験', icon: Activity },
                { id: 'other' as ScheduleCategory, label: 'その他', icon: CalendarDays },
              ].map((c) => {
                const Icon = c.icon;
                const isSelected = itemCategory === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cat-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => setItemCategory(c.id)}
                  >
                    <Icon size={16} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {itemCategory === 'transport' && (
            <div className="form-group">
              <label>移動手段</label>
              <div className="transport-type-row">
                {[
                  { id: 'train' as TransportType, label: '電車・新幹線' },
                  { id: 'plane' as TransportType, label: '飛行機' },
                  { id: 'car' as TransportType, label: '車・レンタカー' },
                  { id: 'bus' as TransportType, label: 'バス' },
                  { id: 'walk' as TransportType, label: '徒歩' },
                  { id: 'ship' as TransportType, label: '船' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`transport-btn ${itemTransportType === t.id ? 'active' : ''}`}
                    onClick={() => setItemTransportType(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>予定のタイトル *</label>
            <input
              type="text"
              className="form-input"
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder="例: 清水寺の舞台を散策"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>開始時間</label>
              <input
                type="text"
                className="form-input"
                value={itemTime}
                onChange={(e) => setItemTime(e.target.value)}
                placeholder="例: 14:00"
              />
            </div>
            <div className="form-group flex-1">
              <label>終了時間（任意）</label>
              <input
                type="text"
                className="form-input"
                value={itemEndTime}
                onChange={(e) => setItemEndTime(e.target.value)}
                placeholder="例: 16:30"
              />
            </div>
          </div>

          <div className="form-group">
            <label>場所・目的地（Googleマップ連携用）</label>
            <div className="input-with-icon">
              <MapPin size={16} className="input-icon" />
              <input
                type="text"
                className="form-input"
                value={itemLocation}
                onChange={(e) => setItemLocation(e.target.value)}
                placeholder="例: 清水寺 本堂"
              />
            </div>
          </div>

          <div className="form-group">
            <label>メモ・予約番号・注意事項</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={itemMemo}
              onChange={(e) => setItemMemo(e.target.value)}
              placeholder="例: チケットはWEB購入済み。靴を脱ぐので脱ぎやすい靴で！"
            />
          </div>

          <div className="form-group">
            <label>費用目安（円）</label>
            <input
              type="number"
              className="form-input"
              value={itemCost}
              onChange={(e) => setItemCost(e.target.value)}
              placeholder="例: 1200"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
            <span>{editingItem ? '予定を更新' : '予定を追加'}</span>
          </button>
        </form>
      </Modal>
    </div>
  );
};
