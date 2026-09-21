import React, { useState, useEffect } from 'react';
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
  Globe,
  Settings,
  ArrowUp,
  Layers,
  ListOrdered,
  CalendarCheck2,
  ArrowDownUp,
  ChevronUp,
  ChevronDown,
  Check,
} from 'lucide-react';
import type {
  Trip,
  DaySchedule,
  ScheduleItem,
  ScheduleCategory,
  TransportType,
} from '../../types/trip';
import { Modal } from '../common/Modal';
import { TimeScrollPicker } from '../common/TimeScrollPicker';
import {
  convertTimeToTimezone,
  TIMEZONE_PRESETS,
} from '../../utils/timezone';
import {
  compareScheduleItems,
  sortScheduleItems,
  normalizeTimeString,
} from '../../utils/scheduleSort';
import './TimelineTab.css';

interface TimelineTabProps {
  trip: Trip;
  onUpdateTrip: (updatedTrip: Trip) => void;
  onOpenCalendarUpdate?: () => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({
  trip,
  onUpdateTrip,
  onOpenCalendarUpdate,
}) => {
  const [activeDayNumber, setActiveDayNumber] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [editingOriginalDayNumber, setEditingOriginalDayNumber] = useState<number | null>(null);
  const [targetDayNumber, setTargetDayNumber] = useState(1);

  // 表示モード：日別タブ表示 ('tabs') vs 全日程縦スクロール表示 ('scroll')
  const [scheduleViewMode, setScheduleViewMode] = useState<'tabs' | 'scroll'>(() => {
    try {
      const saved = localStorage.getItem('tabinote_schedule_view_mode');
      if (saved === 'tabs' || saved === 'scroll') return saved;
    } catch {
      // localStorage disabled / fallback
    }
    return 'tabs';
  });

  // トップへ戻るフローティングボタン表示フラグ
  const [showScrollTop, setShowScrollTop] = useState(false);

  // 現地時間 / 日本時間(JST)の切り替え
  const [viewMode, setViewMode] = useState<'local' | 'jst'>('local');
  const [isTzModalOpen, setIsTzModalOpen] = useState(false);
  const [tzOffsetInput, setTzOffsetInput] = useState(trip.timeZoneOffset ?? 0);
  const [tzNameInput, setTzNameInput] = useState(trip.timeZoneName || '');

  // 時間順整列フィードバック用（整列された日程番号）
  const [sortedDayNumber, setSortedDayNumber] = useState<number | null>(null);

  // フォーム用状態
  const [itemTime, setItemTime] = useState('09:00');
  const [itemEndTime, setItemEndTime] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemCategory, setItemCategory] = useState<ScheduleCategory>('sightseeing');
  const [itemTransportType, setItemTransportType] = useState<TransportType>('train');
  const [itemLocation, setItemLocation] = useState('');
  const [itemMemo, setItemMemo] = useState('');
  const [itemCost, setItemCost] = useState('');

  // スクロール検知
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 250);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleViewMode = (mode: 'tabs' | 'scroll') => {
    setScheduleViewMode(mode);
    try {
      localStorage.setItem('tabinote_schedule_view_mode', mode);
    } catch {
      // ignore
    }
  };

  const handleDaySelect = (dayNumber: number) => {
    setActiveDayNumber(dayNumber);
    if (scheduleViewMode === 'scroll') {
      const targetEl = document.getElementById(`day-section-${dayNumber}`);
      if (targetEl) {
        const yOffset = -80;
        const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
  };

  const currentDay =
    trip.days.find((d) => d.dayNumber === activeDayNumber) || trip.days[0];

  const handleOpenAdd = (dayNumber?: number) => {
    const dNum = dayNumber ?? activeDayNumber;
    setTargetDayNumber(dNum);
    setEditingItem(null);
    setEditingOriginalDayNumber(null);
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

  const handleOpenEdit = (item: ScheduleItem, dayNumber: number) => {
    setTargetDayNumber(dayNumber);
    setEditingOriginalDayNumber(dayNumber);
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

    const normalizedTime = normalizeTimeString(itemTime) || '終日';
    const normalizedEndTime = itemEndTime.trim()
      ? normalizeTimeString(itemEndTime)
      : undefined;

    const newItem: ScheduleItem = {
      id: editingItem ? editingItem.id : 'item-' + Date.now(),
      time: normalizedTime,
      endTime: normalizedEndTime,
      title: itemTitle.trim(),
      category: itemCategory,
      transportType: itemCategory === 'transport' ? itemTransportType : undefined,
      location: locationTrimmed || undefined,
      locationUrl,
      memo: itemMemo.trim() || undefined,
      cost: itemCost ? parseInt(itemCost, 10) : undefined,
    };

    const updatedDays = trip.days.map((day) => {
      let items = [...day.items];

      // 日程間移動のケース
      if (
        editingItem &&
        editingOriginalDayNumber !== null &&
        editingOriginalDayNumber !== targetDayNumber
      ) {
        if (day.dayNumber === editingOriginalDayNumber) {
          items = items.filter((it) => it.id !== editingItem.id);
        }
        if (day.dayNumber === targetDayNumber) {
          items.push(newItem);
        }
      } else if (day.dayNumber === targetDayNumber) {
        if (editingItem) {
          items = items.map((it) => (it.id === editingItem.id ? newItem : it));
        } else {
          items.push(newItem);
        }
      }

      // 数値分換算による正確な時刻昇順ソート（終日は先頭）
      items.sort(compareScheduleItems);

      return { ...day, items };
    });

    onUpdateTrip({ ...trip, days: updatedDays });
    setIsModalOpen(false);
  };

  // 指定した日程の予定を時間順に並べ替える
  const handleSortDayItems = (dayNumber: number) => {
    const updatedDays = trip.days.map((day) => {
      if (day.dayNumber === dayNumber) {
        return {
          ...day,
          items: sortScheduleItems(day.items),
        };
      }
      return day;
    });

    onUpdateTrip({ ...trip, days: updatedDays });
    setSortedDayNumber(dayNumber);
    setTimeout(() => {
      setSortedDayNumber((prev) => (prev === dayNumber ? null : prev));
    }, 1800);
  };

  // 予定の手動上下移動
  const handleMoveItem = (
    itemId: string,
    dayNumber: number,
    direction: 'up' | 'down'
  ) => {
    const targetDay = trip.days.find((d) => d.dayNumber === dayNumber);
    if (!targetDay) return;

    const index = targetDay.items.findIndex((it) => it.id === itemId);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === targetDay.items.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newItems = [...targetDay.items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(newIndex, 0, moved);

    const updatedDays = trip.days.map((day) => {
      if (day.dayNumber === dayNumber) {
        return { ...day, items: newItems };
      }
      return day;
    });

    onUpdateTrip({ ...trip, days: updatedDays });
  };

  const handleDeleteItem = (itemId: string, dayNumber: number) => {
    if (!confirm('この予定を削除しますか？')) return;
    const updatedDays = trip.days.map((day) => {
      if (day.dayNumber === dayNumber) {
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
    if (scheduleViewMode === 'scroll') {
      setTimeout(() => {
        const targetEl = document.getElementById(`day-section-${nextNum}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const getCategoryIcon = (item: ScheduleItem) => {
    if (item.category === 'transport') {
      switch (item.transportType) {
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
        case 'train':
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

  const getDayOfWeekStr = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    return isNaN(dateObj.getTime()) ? '' : `(${daysOfWeek[dateObj.getDay()]})`;
  };

  // タイムラインの各アイテムをレンダリングする共通関数
  const renderTimelineItem = (
    item: ScheduleItem,
    dayNumber: number,
    index: number,
    totalItems: number
  ) => {
    const catClass = getCategoryClass(item.category);
    const tzOffset = trip.timeZoneOffset ?? 0;
    const hasTzDiff = tzOffset !== 0;

    // 時刻換算
    const startConv = convertTimeToTimezone(item.time, tzOffset, true);
    const endConv = item.endTime
      ? convertTimeToTimezone(item.endTime, tzOffset, true)
      : null;

    let displayTime = item.time;
    let displayEndTime = item.endTime;
    let subTimeText = '';
    let dayDiffTag = '';

    if (viewMode === 'local') {
      // 現地時間モード: メインは現地時間、サブはJST換算
      displayTime = item.time;
      displayEndTime = item.endTime;
      if (hasTzDiff && item.time !== '終日') {
        const subStart = startConv.formatted;
        const subEnd = endConv ? `〜${endConv.formatted}` : '';
        subTimeText = `JST ${subStart}${subEnd}`;
      }
    } else {
      // 日本時間モード: メインはJST換算、サブは現地時間
      if (item.time === '終日') {
        displayTime = '終日';
      } else {
        displayTime = startConv.time;
        displayEndTime = endConv ? endConv.time : undefined;
        if (startConv.dayOffset !== 0) {
          dayDiffTag =
            startConv.dayOffset > 0
              ? `+${startConv.dayOffset}日`
              : `${startConv.dayOffset}日`;
        }
        subTimeText = `現地 ${item.time}${item.endTime ? `〜${item.endTime}` : ''}`;
      }
    }

    return (
      <div key={item.id} className="timeline-item">
        {/* タイムライン時間 */}
        <div className="timeline-time-col">
          {dayDiffTag && (
            <span className="day-diff-badge">{dayDiffTag}</span>
          )}
          <span className="time-primary">{displayTime}</span>
          {displayEndTime && (
            <span className="time-secondary">〜{displayEndTime}</span>
          )}
          {subTimeText && (
            <span className="time-sub-converted">{subTimeText}</span>
          )}
        </div>

        {/* タイムラインの軸・アイコン */}
        <div className="timeline-axis">
          <div className={`timeline-icon-box ${catClass}`}>
            {getCategoryIcon(item)}
          </div>
          {index < totalItems - 1 && <div className="timeline-line" />}
        </div>

        {/* 予定詳細カード */}
        <div className="timeline-card">
          <div className="timeline-card-header">
            <h4 className="item-title">{item.title}</h4>
            <div className="item-actions">
              <button
                type="button"
                className="action-icon-btn move-btn"
                onClick={() => handleMoveItem(item.id, dayNumber, 'up')}
                disabled={index === 0}
                title={index === 0 ? undefined : '予定を1つ上へ移動'}
                aria-label="予定を1つ上へ移動"
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                className="action-icon-btn move-btn"
                onClick={() => handleMoveItem(item.id, dayNumber, 'down')}
                disabled={index === totalItems - 1}
                title={index === totalItems - 1 ? undefined : '予定を1つ下へ移動'}
                aria-label="予定を1つ下へ移動"
              >
                <ChevronDown size={15} />
              </button>
              <button
                type="button"
                className="action-icon-btn"
                onClick={() => handleOpenEdit(item, dayNumber)}
                title="編集"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                className="action-icon-btn delete-btn"
                onClick={() => handleDeleteItem(item.id, dayNumber)}
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
  };

  return (
    <div className="timeline-tab fade-in">
      {/* 上部コントロールバー（表示形式切り替え ＆ 日程ジャンプバー） */}
      <div className="schedule-header-controls">
        {/* 日程セレクター・ジャンプバー */}
        <div className="day-selector-bar">
          <div className="day-tabs-scroll">
            {trip.days.map((day) => {
              const isActive = day.dayNumber === activeDayNumber;
              const dayOfWeekStr = getDayOfWeekStr(day.date);

              return (
                <button
                  key={day.dayNumber}
                  type="button"
                  className={`day-tab-btn ${isActive ? 'active' : ''} ${
                    scheduleViewMode === 'scroll' ? 'jump-mode' : ''
                  }`}
                  onClick={() => handleDaySelect(day.dayNumber)}
                  title={
                    scheduleViewMode === 'scroll'
                      ? `${day.dayNumber}日目の位置へジャンプ`
                      : `${day.dayNumber}日目を表示`
                  }
                >
                  <span className="day-number-tag">Day {day.dayNumber}</span>
                  <span className="day-date-tag">
                    {day.date.slice(5)} {dayOfWeekStr}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="day-tab-btn add-day-btn"
              onClick={handleAddNewDay}
              title="日程（日目）を追加"
            >
              <Plus size={16} />
              <span>日を追加</span>
            </button>
          </div>
        </div>

        {/* コントロール列（表示形式スイッチ ＆ 時差切り替えバー） */}
        <div className="timeline-sub-bar">
          {/* 表示形式切り替えスイッチ（日別タブ ⇄ 全日程スクロール） */}
          <div className="view-mode-toggle-group" title="スケジュールの表示方法を切り替え">
            <button
              type="button"
              className={`view-mode-toggle-btn ${scheduleViewMode === 'tabs' ? 'active' : ''}`}
              onClick={() => handleToggleViewMode('tabs')}
            >
              <Layers size={14} />
              <span>日別タブ</span>
            </button>
            <button
              type="button"
              className={`view-mode-toggle-btn ${scheduleViewMode === 'scroll' ? 'active' : ''}`}
              onClick={() => handleToggleViewMode('scroll')}
            >
              <ListOrdered size={14} />
              <span>全日程（連続）</span>
            </button>
          </div>

          {/* 時差＆タイムゾーン情報・スイッチ */}
          <div className="timezone-group">
            <div className="timezone-info">
              <Globe size={15} style={{ color: 'var(--primary)' }} />
              <span className="timezone-badge">
                {trip.timeZoneName ||
                  (trip.timeZoneOffset !== undefined && trip.timeZoneOffset !== 0
                    ? `時差: ${trip.timeZoneOffset > 0 ? '+' : ''}${trip.timeZoneOffset}時間`
                    : '時差なし')}
              </span>
              <button
                type="button"
                className="timezone-settings-btn"
                onClick={() => {
                  setTzOffsetInput(trip.timeZoneOffset ?? 0);
                  setTzNameInput(trip.timeZoneName || '');
                  setIsTzModalOpen(true);
                }}
                title="時差・旅行先タイムゾーンを変更"
              >
                <Settings size={13} />
                <span>時差設定</span>
              </button>
            </div>

            {/* 現地時間 ⇄ 日本時間 切り替えスイッチ */}
            <div className="timezone-switch-group">
              <button
                type="button"
                className={`tz-switch-btn ${viewMode === 'local' ? 'active' : ''}`}
                onClick={() => setViewMode('local')}
              >
                <Clock size={13} />
                <span>現地時間</span>
              </button>
              <button
                type="button"
                className={`tz-switch-btn ${viewMode === 'jst' ? 'active' : ''}`}
                onClick={() => setViewMode('jst')}
              >
                <span>🇯🇵 日本時間</span>
              </button>
            </div>

            {onOpenCalendarUpdate && (
              <button
                type="button"
                className="btn btn-secondary btn-sm timeline-cal-sync-btn"
                onClick={onOpenCalendarUpdate}
                title="Googleカレンダーから予定を取得してアップデート"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <CalendarCheck2 size={14} style={{ color: 'var(--primary)' }} />
                <span>カレンダーから更新</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          表示パターン1: 日別タブ表示 (scheduleViewMode === 'tabs')
         ======================================================== */}
      {scheduleViewMode === 'tabs' && (
        <div className="tab-view-container fade-in">
          {/* 選択中の日のヘッダー */}
          {currentDay && (
            <div className="current-day-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="day-title">
                    {currentDay.dayNumber}日目 ({currentDay.date} {getDayOfWeekStr(currentDay.date)})
                  </h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: viewMode === 'local' ? '#eff6ff' : '#fef3c7',
                      color: viewMode === 'local' ? '#2563eb' : '#b45309',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      border: `1px solid ${viewMode === 'local' ? '#bfdbfe' : '#fde68a'}`,
                    }}
                  >
                    {viewMode === 'local' ? '現地時間表示' : '🇯🇵 日本時間 (JST)'}
                  </span>
                </div>
                {currentDay.title && (
                  <p className="day-subtitle">{currentDay.title}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {currentDay.items.length > 1 && (
                  <button
                    type="button"
                    className={`btn btn-secondary ${
                      sortedDayNumber === currentDay.dayNumber ? 'btn-sorted-active' : ''
                    }`}
                    onClick={() => handleSortDayItems(currentDay.dayNumber)}
                    title="この日の予定を開始時間順に自動整列"
                  >
                    {sortedDayNumber === currentDay.dayNumber ? (
                      <>
                        <Check size={14} style={{ color: '#10b981' }} />
                        <span style={{ color: '#10b981' }}>整列完了</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownUp size={14} />
                        <span>時間順に整列</span>
                      </>
                    )}
                  </button>
                )}
                {onOpenCalendarUpdate && (
                  <button
                    className="btn btn-secondary"
                    onClick={onOpenCalendarUpdate}
                    title="Googleカレンダーから予定を同期・更新"
                  >
                    <CalendarCheck2 size={15} />
                    <span>カレンダーから更新</span>
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => handleOpenAdd(currentDay.dayNumber)}>
                  <Plus size={16} />
                  <span>予定を追加</span>
                </button>
              </div>
            </div>
          )}

          {/* タイムラインリスト */}
          {currentDay && currentDay.items.length === 0 ? (
            <div className="empty-timeline">
              <Clock size={40} className="empty-clock" />
              <h4>この日の予定はまだありません</h4>
              <p>「予定を追加」またはGoogleカレンダーからスケジュールを取り込みましょう！</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => handleOpenAdd(currentDay.dayNumber)}>
                  <Plus size={16} />
                  <span>予定を追加</span>
                </button>
                {onOpenCalendarUpdate && (
                  <button className="btn btn-primary" onClick={onOpenCalendarUpdate}>
                    <CalendarCheck2 size={16} />
                    <span>カレンダーから取り込む</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="timeline-list">
                {currentDay?.items.map((item, index) =>
                  renderTimelineItem(item, currentDay.dayNumber, index, currentDay.items.length)
                )}
              </div>

              {/* リスト末尾のアクションエリア（予定追加 & 一番上へ戻る） */}
              <div className="timeline-footer-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenAdd(currentDay.dayNumber)}
                >
                  <Plus size={15} />
                  <span>この日に予定を追加</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm scroll-top-inline-btn"
                  onClick={scrollToTop}
                  title="上部の日程選択へ戻る"
                >
                  <ArrowUp size={15} />
                  <span>一番上（日程選択）へ戻る</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================
          表示パターン2: 全日程縦スクロール表示 (scheduleViewMode === 'scroll')
         ======================================================== */}
      {scheduleViewMode === 'scroll' && (
        <div className="scroll-view-container fade-in">
          {trip.days.map((day) => {
            const dayOfWeekStr = getDayOfWeekStr(day.date);
            return (
              <section
                key={day.dayNumber}
                id={`day-section-${day.dayNumber}`}
                className="day-scroll-section"
              >
                {/* 日ごとの見出しヘッダー */}
                <div className="day-scroll-header">
                  <div className="day-scroll-header-left">
                    <span className="day-scroll-badge">Day {day.dayNumber}</span>
                    <h3 className="day-scroll-date">
                      {day.date.slice(5)} {dayOfWeekStr}
                    </h3>
                    {day.title && <span className="day-scroll-title">{day.title}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {day.items.length > 1 && (
                      <button
                        type="button"
                        className={`btn btn-sm btn-secondary ${
                          sortedDayNumber === day.dayNumber ? 'btn-sorted-active' : ''
                        }`}
                        onClick={() => handleSortDayItems(day.dayNumber)}
                        title="この日の予定を開始時間順に自動整列"
                      >
                        {sortedDayNumber === day.dayNumber ? (
                          <>
                            <Check size={13} style={{ color: '#10b981' }} />
                            <span style={{ color: '#10b981' }}>整列完了</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownUp size={13} />
                            <span>時間順に整列</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-primary day-add-item-btn"
                      onClick={() => handleOpenAdd(day.dayNumber)}
                    >
                      <Plus size={14} />
                      <span>予定を追加</span>
                    </button>
                  </div>
                </div>

                {/* 日ごとのタイムラインリスト */}
                {day.items.length === 0 ? (
                  <div className="empty-day-box">
                    <p>この日の予定はまだありません</p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenAdd(day.dayNumber)}
                    >
                      <Plus size={13} />
                      <span>予定を追加</span>
                    </button>
                  </div>
                ) : (
                  <div className="timeline-list">
                    {day.items.map((item, index) =>
                      renderTimelineItem(item, day.dayNumber, index, day.items.length)
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {/* 全日程スクロール末尾のアクションエリア */}
          <div className="all-days-footer-actions">
            {onOpenCalendarUpdate && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onOpenCalendarUpdate}
              >
                <CalendarCheck2 size={16} />
                <span>Googleカレンダーから更新</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAddNewDay}
            >
              <Plus size={16} />
              <span>次の日程（Day {trip.days.length + 1}）を追加</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary scroll-top-inline-btn"
              onClick={scrollToTop}
            >
              <ArrowUp size={16} />
              <span>一番上へ戻る</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          画面右下のフローティング「一番上へ戻る」ボタン
         ======================================================== */}
      {showScrollTop && (
        <button
          type="button"
          className="floating-scroll-top-btn"
          onClick={scrollToTop}
          title="一番上へ戻る"
          aria-label="一番上へ戻る"
        >
          <ArrowUp size={18} />
          <span>TOP</span>
        </button>
      )}

      {/* ========================================================
          予定追加・編集モーダル
         ======================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? '予定を編集' : '新しい予定を追加'}
        maxWidth="500px"
      >
        <form onSubmit={handleSaveItem}>
          {/* 日程選択（どの日に追加・変更するか） */}
          <div className="form-group">
            <label>対象の日程 *</label>
            <select
              className="form-input"
              value={targetDayNumber}
              onChange={(e) => setTargetDayNumber(Number(e.target.value))}
            >
              {trip.days.map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  Day {d.dayNumber} ({d.date.slice(5)} {getDayOfWeekStr(d.date)}) {d.title ? `- ${d.title}` : ''}
                </option>
              ))}
            </select>
          </div>

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

          <div className="form-group">
            <TimeScrollPicker
              startTime={itemTime}
              endTime={itemEndTime}
              onStartTimeChange={setItemTime}
              onEndTimeChange={setItemEndTime}
            />
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
            <label>費用目安（任意）</label>
            <div className="input-with-prefix">
              <span className="input-prefix">¥</span>
              <input
                type="number"
                className="form-input"
                value={itemCost}
                onChange={(e) => setItemCost(e.target.value)}
                placeholder="例: 400"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary">
              {editingItem ? '更新する' : '追加する'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================
          タイムゾーン（時差）設定モーダル
         ======================================================== */}
      <Modal
        isOpen={isTzModalOpen}
        onClose={() => setIsTzModalOpen(false)}
        title="時差・タイムゾーンの設定"
        maxWidth="480px"
      >
        <div className="timezone-modal-content">
          <p className="tz-modal-desc">
            旅行先の国や都市を選択するか、日本時間（UTC+9）との時差を時間単位で入力してください。
            設定すると、現地時間と日本時間をワンタップで切り替え・換算表示できるようになります。
          </p>

          <div className="form-group">
            <label>人気のプリセットから選択</label>
            <div className="tz-presets-grid">
              {TIMEZONE_PRESETS.map((p) => {
                const isSelected =
                  trip.timeZoneOffset === p.offset &&
                  trip.timeZoneName === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    className={`tz-preset-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setTzOffsetInput(p.offset);
                      setTzNameInput(p.name);
                    }}
                  >
                    <div className="tz-preset-info">
                      <span className="tz-preset-flag">{p.flag}</span>
                      <div>
                        <div className="tz-preset-name">{p.name}</div>
                        <div className="tz-preset-region">{p.region}</div>
                      </div>
                    </div>
                    <span className="tz-preset-offset">
                      {p.offset === 0 ? '時差なし' : `${p.offset > 0 ? '+' : ''}${p.offset}h`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>タイムゾーン表示名</label>
            <input
              type="text"
              className="form-input"
              value={tzNameInput}
              onChange={(e) => setTzNameInput(e.target.value)}
              placeholder="例: バルセロナ・西欧 (夏時間 -7h)"
            />
          </div>

          <div className="form-group">
            <label>日本時間 (JST: UTC+9) との時差（時間）</label>
            <input
              type="number"
              step="0.5"
              className="form-input"
              value={tzOffsetInput}
              onChange={(e) => setTzOffsetInput(parseFloat(e.target.value) || 0)}
              placeholder="例: -7"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              ※ 日本より遅れている地域（欧米など）はマイナス（例: -7）、進んでいる地域はプラス（例: +2）
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsTzModalOpen(false)}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onUpdateTrip({
                  ...trip,
                  timeZoneOffset: tzOffsetInput,
                  timeZoneName: tzNameInput.trim() || undefined,
                });
                setIsTzModalOpen(false);
              }}
            >
              時差を保存
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
