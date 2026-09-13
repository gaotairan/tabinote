import React from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Edit3,
  Sun,
  Shield,
  Clock,
} from 'lucide-react';
import type { Trip } from '../../types/trip';
import { differenceInCalendarDays, parseISO, isFuture, isToday } from 'date-fns';
import './TripOverviewTab.css';

interface TripOverviewTabProps {
  trip: Trip;
  onEditTrip: () => void;
}

export const TripOverviewTab: React.FC<TripOverviewTabProps> = ({
  trip,
  onEditTrip,
}) => {
  const startDay = parseISO(trip.startDate);
  const endDay = parseISO(trip.endDate);
  const now = new Date();
  const nights = Math.max(0, differenceInCalendarDays(endDay, startDay));
  const daysCount = nights + 1;
  const durationText = nights > 0 ? `${nights}泊${daysCount}日` : '日帰り';

  let countdownText = '';
  let countdownSub = '';
  let badgeClass = 'countdown-future';

  if (isToday(startDay) || (startDay <= now && now <= endDay)) {
    countdownText = '旅行中！✨';
    countdownSub = '素敵な思い出を作りましょう！';
    badgeClass = 'countdown-active';
  } else if (isFuture(startDay)) {
    const diff = differenceInCalendarDays(startDay, now);
    countdownText = diff === 0 ? '明日出発！🎉' : `あと ${diff} 日`;
    countdownSub = `${trip.startDate} に出発`;
    badgeClass = 'countdown-future';
  } else {
    countdownText = '旅の思い出 📖';
    countdownSub = 'お疲れ様でした！';
    badgeClass = 'countdown-past';
  }

  const weatherUrl = `https://weather.yahoo.co.jp/weather/search/?p=${encodeURIComponent(
    trip.destination
  )}`;

  return (
    <div className="trip-overview fade-in">
      {/* ヒーローカバー */}
      <div
        className="overview-hero"
        style={{ backgroundImage: `url(${trip.coverImage})` }}
      >
        <div className="overview-hero-overlay" />
        <div className="overview-hero-content">
          <div className="overview-badge-row">
            <span className={`countdown-badge ${badgeClass}`}>
              <Clock size={14} />
              <span>{countdownText} ({countdownSub})</span>
            </span>
            <button
              className="edit-trip-btn glass-effect"
              onClick={onEditTrip}
              title="しおり情報を編集"
            >
              <Edit3 size={15} />
              <span>編集</span>
            </button>
          </div>

          <h2 className="overview-title">{trip.title}</h2>
          {trip.subtitle && <p className="overview-subtitle">{trip.subtitle}</p>}

          <div className="overview-meta-chips">
            <span className="meta-chip">
              <Calendar size={14} />
              <span>
                {trip.startDate} 〜 {trip.endDate} ({durationText})
              </span>
            </span>
            <span className="meta-chip">
              <MapPin size={14} />
              <span>{trip.destination}</span>
            </span>
          </div>
        </div>
      </div>

      {/* グリッドカードレイアウト */}
      <div className="overview-grid">
        {/* メンバーカード */}
        <div className="overview-card">
          <div className="card-header-icon">
            <Users size={18} className="icon-blue" />
            <h3 className="card-title">参加メンバー ({trip.members.length}名)</h3>
          </div>
          <div className="members-grid">
            {trip.members.map((member) => (
              <div key={member.id} className="member-card-item">
                <div
                  className="member-avatar"
                  style={{ backgroundColor: member.avatarColor }}
                >
                  {member.name.slice(0, 1)}
                </div>
                <div className="member-info">
                  <span className="member-name">{member.name}</span>
                  {member.role && (
                    <span className="member-role-badge">{member.role}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 旅の合言葉・メモ・緊急連絡先 */}
        <div className="overview-card">
          <div className="card-header-icon">
            <Shield size={18} className="icon-amber" />
            <h3 className="card-title">メモ・合言葉・連絡先</h3>
          </div>
          {trip.password && (
            <div className="password-banner">
              <span className="pwd-label">合言葉:</span>
              <span className="pwd-val">{trip.password}</span>
            </div>
          )}
          <div className="memo-content">
            {trip.memo ? (
              <p className="memo-text">{trip.memo}</p>
            ) : (
              <p className="memo-empty">メモはまだ登録されていません。</p>
            )}
          </div>
        </div>

        {/* 現地の天気リンク */}
        <div className="overview-card weather-card">
          <div className="card-header-icon">
            <Sun size={18} className="icon-yellow" />
            <h3 className="card-title">{trip.destination} の天気情報</h3>
          </div>
          <p className="weather-desc">
            出発前の服装選びや傘の準備に、最新の天気予報・降水確率を確認しましょう。
          </p>
          <a
            href={weatherUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary weather-link-btn"
          >
            <Sun size={16} />
            <span>Yahoo!天気で予報を見る ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
};
