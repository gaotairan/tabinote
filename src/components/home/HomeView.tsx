import React, { useRef } from 'react';
import {
  Calendar,
  Plus,
  MapPin,
  Users,
  Upload,
  Sparkles,
  Trash2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { Trip } from '../../types/trip';
import { differenceInCalendarDays, parseISO, isFuture, isToday } from 'date-fns';
import './HomeView.css';

interface HomeViewProps {
  trips: Trip[];
  onSelectTrip: (tripId: string) => void;
  onOpenCreate: () => void;
  onOpenCalendarImport: () => void;
  onDeleteTrip: (tripId: string) => void;
  onImportJson: (jsonStr: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  trips,
  onSelectTrip,
  onOpenCreate,
  onOpenCalendarImport,
  onDeleteTrip,
  onImportJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJson(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getTripStatus = (trip: Trip) => {
    const start = parseISO(trip.startDate);
    const end = parseISO(trip.endDate);
    const now = new Date();

    if (isToday(start) || (start <= now && now <= end)) {
      return { label: '旅行中！✨', className: 'status-active' };
    }
    if (isFuture(start)) {
      const diff = differenceInCalendarDays(start, now);
      return {
        label: diff === 0 ? '明日出発！' : `あと ${diff} 日`,
        className: 'status-future',
      };
    }
    return { label: '旅の思い出 📖', className: 'status-past' };
  };

  return (
    <div className="home-view fade-in">
      {/* ヒーローバナー */}
      <section className="hero-card">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} />
            <span>Googleカレンダー連携＆tabiori機能搭載</span>
          </div>
          <h2 className="hero-title">
            予定を入れるだけで、<br />
            自動で旅のしおりが完成。
          </h2>
          <p className="hero-desc">
            Googleカレンダーの予定からワンクリックでしおりを自動生成。スケジュール、持ち物、割り勘まで仲間と一緒にいつでもスマホで確認できます。
          </p>
          <div className="hero-actions">
            <button className="btn btn-hero-primary" onClick={onOpenCalendarImport}>
              <Calendar size={18} />
              <span>Googleカレンダーから自動作成</span>
            </button>
            <button className="btn btn-hero-secondary" onClick={onOpenCreate}>
              <Plus size={18} />
              <span>手動でしおりを作る</span>
            </button>
          </div>
        </div>
      </section>

      {/* しおり一覧セクション */}
      <section className="trips-section">
        <div className="section-header">
          <div>
            <h3 className="section-title">旅のしおり一覧</h3>
            <p className="section-subtitle">作成したしおりはオフラインでも確認できます</p>
          </div>
          <div className="section-tools">
            <button
              className="btn btn-sm btn-outline"
              onClick={() => fileInputRef.current?.click()}
              title="共有されたしおりJSONファイルを読み込む"
            >
              <Upload size={14} />
              <span>JSON復元</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="empty-trips-card">
            <Calendar size={48} className="empty-icon" />
            <h4>しおりがまだありません</h4>
            <p>Googleカレンダーから自動作成するか、新しいしおりを作ってみましょう！</p>
            <button className="btn btn-primary" onClick={onOpenCalendarImport}>
              <Calendar size={16} />
              <span>Googleカレンダーから作成</span>
            </button>
          </div>
        ) : (
          <div className="trips-grid">
            {trips.map((trip) => {
              const status = getTripStatus(trip);
              const startDay = parseISO(trip.startDate);
              const endDay = parseISO(trip.endDate);
              const nights = Math.max(0, differenceInCalendarDays(endDay, startDay));
              const daysCount = nights + 1;
              const durationText = nights > 0 ? `${nights}泊${daysCount}日` : '日帰り';

              return (
                <article
                  key={trip.id}
                  className="trip-card"
                  onClick={() => onSelectTrip(trip.id)}
                >
                  <div
                    className="trip-card-cover"
                    style={{ backgroundImage: `url(${trip.coverImage})` }}
                  >
                    <div className="trip-card-overlay" />
                    <span className={`trip-status-badge ${status.className}`}>
                      {status.label}
                    </span>
                    <button
                      className="trip-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`「${trip.title}」を削除しますか？`)) {
                          onDeleteTrip(trip.id);
                        }
                      }}
                      title="削除"
                      aria-label="削除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="trip-card-body">
                    <div className="trip-card-meta">
                      <span className="trip-destination">
                        <MapPin size={13} />
                        <span className="truncate">{trip.destination}</span>
                      </span>
                      <span className="trip-duration">
                        <Clock size={13} />
                        {durationText}
                      </span>
                    </div>

                    <h4 className="trip-card-title">{trip.title}</h4>
                    {trip.subtitle && (
                      <p className="trip-card-subtitle truncate">{trip.subtitle}</p>
                    )}

                    <div className="trip-card-footer">
                      <div className="trip-members-list">
                        <Users size={14} className="members-icon" />
                        <span className="members-text">
                          {trip.members.map((m) => m.name).join(', ') || 'メンバー未登録'}
                        </span>
                      </div>
                      <div className="open-arrow">
                        <span>開く</span>
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
