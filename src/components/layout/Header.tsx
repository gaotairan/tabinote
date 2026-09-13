import React from 'react';
import { Compass, Plus, Calendar, Share2, ArrowLeft, Printer, Cloud } from 'lucide-react';
import type { Trip } from '../../types/trip';
import './Header.css';

interface HeaderProps {
  activeTrip: Trip | null;
  isCloudConnected: boolean;
  onOpenCloudSync: () => void;
  onBackToHome: () => void;
  onOpenCreate: () => void;
  onOpenCalendarImport: () => void;
  onOpenShare?: () => void;
  onOpenExport?: () => void;
  onOpenPrint?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTrip,
  isCloudConnected,
  onOpenCloudSync,
  onBackToHome,
  onOpenCreate,
  onOpenCalendarImport,
  onOpenShare,
  onOpenPrint,
}) => {
  return (
    <header className="app-header glass-effect">
      <div className="header-inner">
        {activeTrip ? (
          <div className="header-left">
            <button
              className="back-btn"
              onClick={onBackToHome}
              title="しおり一覧に戻る"
              aria-label="しおり一覧に戻る"
            >
              <ArrowLeft size={18} />
              <span className="back-text">一覧</span>
            </button>
            <div className="header-trip-info">
              <h1 className="header-trip-title truncate">{activeTrip.title}</h1>
              <span className="header-trip-date">
                {activeTrip.startDate} 〜 {activeTrip.endDate}
              </span>
            </div>
          </div>
        ) : (
          <div className="header-left">
            <div className="brand-logo" onClick={onBackToHome}>
              <div className="brand-icon">
                <Compass size={22} className="compass-icon" />
              </div>
              <div className="brand-texts">
                <span className="brand-name">TabiNote</span>
                <span className="brand-tag">旅のしおり</span>
              </div>
            </div>
          </div>
        )}

        <div className="header-actions">
          {/* クラウド同期ステータスバッジ */}
          <button
            type="button"
            className={`cloud-sync-header-badge ${isCloudConnected ? 'connected' : 'disconnected'}`}
            onClick={onOpenCloudSync}
            title={
              isCloudConnected
                ? '☁️ クラウド常時同期中（クリックして詳細設定）'
                : '☁️ クラウド未設定（クリックして常時同期を設定）'
            }
          >
            {isCloudConnected ? (
              <>
                <span className="cloud-sync-pulse-dot" />
                <span>常時同期中</span>
              </>
            ) : (
              <>
                <Cloud size={14} />
                <span>クラウド設定</span>
              </>
            )}
          </button>

          {activeTrip ? (
            <>
              {onOpenPrint && (
                <button
                  className="btn btn-secondary print-btn"
                  onClick={onOpenPrint}
                  title="しおりをPDF出力・印刷"
                >
                  <Printer size={16} />
                  <span className="btn-text">PDF作成</span>
                </button>
              )}
              {onOpenShare && (
                <button
                  className="btn btn-secondary share-btn"
                  onClick={onOpenShare}
                  title="スマホで共有 / QRコード"
                >
                  <Share2 size={16} />
                  <span className="btn-text">共有・QR</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="btn btn-calendar"
                onClick={onOpenCalendarImport}
                title="Googleカレンダーから自動作成"
              >
                <Calendar size={16} />
                <span className="btn-text">Googleカレンダー連携</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={onOpenCreate}
                title="手動でしおりを新規作成"
              >
                <Plus size={16} />
                <span className="btn-text">新規作成</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
