import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  X,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Info,
  CheckSquare,
  Gift,
  DollarSign,
  FileText,
  Users,
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
  Globe,
} from 'lucide-react';
import type {
  Trip,
  ScheduleItem,
  PackingCategory,
} from '../../types/trip';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { MemberAvatar } from '../common/MemberAvatar';
import { calculateSettlements } from '../../utils/settlement';
import { shareService } from '../../services/shareService';
import './PrintPreviewModal.css';

// QRコード生成エラーで親コンポーネントがクラッシュするのを防ぐ安全ラッパー
class SafeQRCodeBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('QR Code generation failed, falling back to icon:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{ padding: '8px', color: '#94a3b8', fontSize: '0.7rem', textAlign: 'center' }}>
            <Globe size={24} style={{ margin: '0 auto 4px' }} />
            <span>しおりQR</span>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  // セクション出力カスタマイズ
  const [includeCoverPhoto, setIncludeCoverPhoto] = useState(true);
  const [includeMembers, setIncludeMembers] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [includePacking, setIncludePacking] = useState(true);
  const [includeSouvenirs, setIncludeSouvenirs] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeMemo, setIncludeMemo] = useState(true);
  const [includeQrCode, setIncludeQrCode] = useState(true);

  // 旅行期間の安全な計算
  const durationText = useMemo(() => {
    try {
      if (!trip?.startDate || !trip?.endDate) return '';
      const startDay = parseISO(trip.startDate);
      const endDay = parseISO(trip.endDate);
      if (isNaN(startDay.getTime()) || isNaN(endDay.getTime())) return '';
      const nights = Math.max(0, differenceInCalendarDays(endDay, startDay));
      const daysCount = nights + 1;
      return nights > 0 ? `${nights}泊${daysCount}日` : '日帰り';
    } catch {
      return '';
    }
  }, [trip]);

  // メンバー一覧の安全な取得
  const members = useMemo(() => trip?.members || [], [trip?.members]);

  // 共有URLとQRコード用データの生成（安全ガード付き）
  const shareUrl = useMemo(() => {
    try {
      const url = shareService.generateShareUrl(trip);
      // QRコードの最大容量（約1200文字）を超える場合は、安全に現在URLを使用
      if (url && url.length < 1200) {
        return url;
      }
      return typeof window !== 'undefined' ? window.location.href : '';
    } catch (e) {
      console.warn('Failed to generate share URL for QR, fallback to current href:', e);
      return typeof window !== 'undefined' ? window.location.href : '';
    }
  }, [trip]);

  // 割り勘精算データの算出（安全ガード付き）
  const settlementData = useMemo(() => {
    try {
      if (!trip?.expenses || trip.expenses.length === 0 || members.length === 0) {
        return null;
      }
      return calculateSettlements(trip.expenses, members);
    } catch (e) {
      console.warn('Failed to calculate settlements for print preview:', e);
      return null;
    }
  }, [trip, members]);

  // カテゴリ別持ち物リスト（安全ガード付き）
  const packingByCategory = useMemo(() => {
    const map: Record<PackingCategory, NonNullable<typeof trip.packingList>> = {
      essential: [],
      clothes: [],
      electronics: [],
      toiletries: [],
      other: [],
    };
    (trip?.packingList || []).forEach((item) => {
      if (!item) return;
      const cat = item.category as PackingCategory;
      if (map[cat]) {
        map[cat].push(item);
      } else {
        map.other.push(item);
      }
    });
    return map;
  }, [trip?.packingList]);

  // 持ち物カテゴリ表示名
  const packingCategoryNames: Record<PackingCategory, string> = {
    essential: '貴重品・必需品',
    clothes: '衣類・身だしなみ',
    electronics: '電子機器・充電器',
    toiletries: '洗面・コスメ・薬品',
    other: 'その他',
  };

  // スケジュールカテゴリのアイコン
  const renderCategoryIcon = (item: ScheduleItem) => {
    if (!item) return <Sparkles size={14} />;
    switch (item.category) {
      case 'transport':
        switch (item.transportType) {
          case 'plane':
            return <Plane size={14} />;
          case 'car':
            return <Car size={14} />;
          case 'bus':
            return <Bus size={14} />;
          case 'walk':
            return <Footprints size={14} />;
          case 'ship':
            return <Ship size={14} />;
          default:
            return <Train size={14} />;
        }
      case 'food':
        return <Utensils size={14} />;
      case 'hotel':
        return <Hotel size={14} />;
      case 'sightseeing':
        return <Camera size={14} />;
      case 'activity':
        return <Activity size={14} />;
      default:
        return <Sparkles size={14} />;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !trip) return null;

  return (
    <div className="print-modal-overlay" onClick={onClose}>
      <div
        className="print-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="print-modal-header">
          <div className="print-modal-title-wrap">
            <div className="print-modal-icon-badge">
              <Printer size={22} />
            </div>
            <div>
              <h2 className="print-modal-title">しおりのPDF作成 / 印刷</h2>
              <p className="print-modal-subtitle">
                A4サイズに最適化されたレイアウトで印刷・PDF保存できます
              </p>
            </div>
          </div>
          <button
            className="print-modal-close-btn"
            onClick={onClose}
            aria-label="閉じる"
            title="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* 出力オプション & 印刷実行バー */}
        <div className="print-control-bar">
          <div className="print-options-grid">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              出力項目:
            </span>
            <label className="print-option-label">
              <input
                type="checkbox"
                checked={includeCoverPhoto}
                onChange={(e) => setIncludeCoverPhoto(e.target.checked)}
              />
              カバー写真
            </label>
            <label className="print-option-label">
              <input
                type="checkbox"
                checked={includeMembers}
                onChange={(e) => setIncludeMembers(e.target.checked)}
              />
              メンバー
            </label>
            <label className="print-option-label">
              <input
                type="checkbox"
                checked={includeTimeline}
                onChange={(e) => setIncludeTimeline(e.target.checked)}
              />
              タイムライン
            </label>
            <label className="print-option-label">
              <input
                type="checkbox"
                checked={includePacking}
                onChange={(e) => setIncludePacking(e.target.checked)}
              />
              持ち物リスト
            </label>
            <label className="print-option-label">
              <input
                type="checkbox"
                checked={includeSouvenirs}
                onChange={(e) => setIncludeSouvenirs(e.target.checked)}
              />
              お土産リスト
            </label>
            <label className="print-option-label">
              <input
                type="checkbox"
                checked={includeExpenses}
                onChange={(e) => setIncludeExpenses(e.target.checked)}
              />
              旅費・割り勘
            </label>
            <label className="print-option-label">
              <input
                type="checkbox"
                checked={includeMemo}
                onChange={(e) => setIncludeMemo(e.target.checked)}
              />
              メモ
            </label>
            <label className="print-option-label">
              <input
                type="checkbox"
                checked={includeQrCode}
                onChange={(e) => setIncludeQrCode(e.target.checked)}
              />
              スマホ連携QR
            </label>
          </div>

          <div className="print-actions-row">
            <div className="print-guide-tip">
              <Info size={15} />
              <span>
                印刷画面の<strong>「送信先」</strong>で<strong>「PDFに保存」</strong>を選択すると、PDFファイルとしてダウンロードできます。
              </span>
            </div>

            <button
              className="print-execute-btn"
              onClick={handlePrint}
              title="印刷ダイアログを開く（PDF保存可能）"
            >
              <Printer size={18} />
              <span>PDFを保存 / 印刷する</span>
            </button>
          </div>
        </div>

        {/* プレビュー表示スクロールエリア */}
        <div className="print-preview-scroll-area">
          <div className="print-sheet" id="print-shiori-container">
            {/* カバー・ヘッダーセクション */}
            <div className="print-cover-section">
              <div className="print-cover-header">
                <div style={{ flex: 1 }}>
                  <span className="print-brand-tag">TABINOTE TRAVEL GUIDE</span>
                  <h1 className="print-trip-title">{trip.title}</h1>
                  {trip.subtitle && (
                    <p className="print-trip-subtitle">{trip.subtitle}</p>
                  )}

                  <div className="print-meta-badges">
                    <span className="print-meta-badge">
                      <Calendar size={15} color="var(--primary)" />
                      {trip.startDate} 〜 {trip.endDate} ({durationText})
                    </span>
                    <span className="print-meta-badge">
                      <MapPin size={15} color="#ea580c" />
                      目的地: {trip.destination}
                    </span>
                    {trip.timeZoneOffset !== undefined && trip.timeZoneOffset !== 0 && (
                      <span className="print-meta-badge">
                        <Globe size={15} color="#0891b2" />
                        時差: {trip.timeZoneName || `JST ${trip.timeZoneOffset > 0 ? '+' : ''}${trip.timeZoneOffset}h`}
                      </span>
                    )}
                  </div>
                </div>

                {/* スマホ用QRコード */}
                {includeQrCode && shareUrl && (
                  <div className="print-qr-card">
                    <SafeQRCodeBoundary>
                      <QRCodeSVG
                        value={shareUrl}
                        size={80}
                        level="L"
                        marginSize={2}
                      />
                    </SafeQRCodeBoundary>
                    <span className="print-qr-caption">
                      スマホで最新しおりを閲覧
                    </span>
                  </div>
                )}
              </div>

              {/* カバー写真 */}
              {includeCoverPhoto && trip.coverImage && (
                <div className="print-cover-photo-wrapper">
                  <img
                    src={trip.coverImage}
                    alt={trip.title}
                    className="print-cover-photo"
                  />
                </div>
              )}

              {/* 参加メンバー一覧 */}
              {includeMembers && members.length > 0 && (
                <div className="print-members-box">
                  <div className="print-members-title">
                    <Users size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                    参加メンバー ({members.length}名)
                  </div>
                  <div className="print-members-list">
                    {members.map((member) => (
                      <div key={member.id} className="print-member-item">
                        <MemberAvatar
                          name={member.name}
                          avatarColor={member.avatarColor}
                          avatarUrl={member.avatarUrl}
                          size="sm"
                        />
                        <div>
                          <span className="print-member-name">{member.name}</span>
                          {member.role && (
                            <span className="print-member-role" style={{ marginLeft: '6px' }}>
                              {member.role}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* タイムライン・行程セクション */}
            {includeTimeline && trip.days && trip.days.length > 0 && (
              <section className="print-section">
                <div className="print-section-header">
                  <Clock size={20} color="var(--primary)" />
                  <h2 className="print-section-title">旅程スケジュール</h2>
                </div>

                {trip.days.map((day) => (
                  <div key={day.dayNumber} className="print-day-block">
                    <div className="print-day-header">
                      <div>
                        <span className="print-day-badge">Day {day.dayNumber}</span>
                        {day.title && (
                          <span className="print-day-title">{day.title}</span>
                        )}
                      </div>
                      <span className="print-day-date">{day.date}</span>
                    </div>

                    {day.items && day.items.length > 0 ? (
                      <table className="print-timeline-table">
                        <thead>
                          <tr>
                            <th style={{ width: '90px' }}>時刻</th>
                            <th>予定・スポット</th>
                            <th style={{ width: '100px', textAlign: 'right' }}>費用 / 備考</th>
                          </tr>
                        </thead>
                        <tbody>
                          {day.items.map((item) => (
                            <tr key={item.id}>
                              <td className="print-timeline-time">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {renderCategoryIcon(item)}
                                  {item.time}
                                  {item.endTime ? ` - ${item.endTime}` : ''}
                                </span>
                              </td>
                              <td>
                                <div className="print-timeline-item-title">{item.title}</div>
                                {item.location && (
                                  <div className="print-timeline-loc">
                                    <MapPin size={11} />
                                    {item.location}
                                  </div>
                                )}
                                {item.memo && (
                                  <div className="print-timeline-memo">
                                    {item.memo}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {item.cost ? (
                                  <span className="print-timeline-cost">
                                    ¥{item.cost.toLocaleString()}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                        予定が登録されていません
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* 持ち物チェックリスト */}
            {includePacking && trip.packingList && trip.packingList.length > 0 && (
              <section className="print-section">
                <div className="print-section-header">
                  <CheckSquare size={20} color="#10b981" />
                  <h2 className="print-section-title">持ち物チェックリスト</h2>
                </div>

                <div className="print-packing-grid">
                  {(['essential', 'clothes', 'electronics', 'toiletries', 'other'] as PackingCategory[]).map(
                    (cat) => {
                      const list = packingByCategory[cat];
                      if (!list || list.length === 0) return null;
                      return (
                        <div key={cat} className="print-packing-cat-card">
                          <div className="print-packing-cat-title">
                            {packingCategoryNames[cat]} ({list.length})
                          </div>
                          {list.map((item) => {
                            const assignee =
                              item.assignedMemberId && item.assignedMemberId !== 'all'
                                ? members.find((m) => m.id === item.assignedMemberId)?.name
                                : null;
                            return (
                              <div key={item.id} className="print-packing-item-row">
                                <span className="print-check-box-square" />
                                <span className="print-packing-name">{item.name}</span>
                                {assignee && (
                                  <span className="print-packing-assignee">
                                    {assignee}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                  )}
                </div>
              </section>
            )}

            {/* お土産リスト */}
            {includeSouvenirs && trip.souvenirs && trip.souvenirs.length > 0 && (
              <section className="print-section">
                <div className="print-section-header">
                  <Gift size={20} color="#ec4899" />
                  <h2 className="print-section-title">お土産リスト</h2>
                </div>

                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>確認</th>
                      <th>品名・お土産</th>
                      <th style={{ width: '100px' }}>渡す相手</th>
                      <th style={{ width: '130px' }}>購入場所</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>予算/価格</th>
                      <th>メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.souvenirs.map((s) => (
                      <tr key={s.id}>
                        <td style={{ textAlign: 'center' }}>
                          <span className="print-check-box-square" />
                        </td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>{s.forWhom || '-'}</td>
                        <td>{s.place || '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {s.price ? `¥${s.price.toLocaleString()}` : '-'}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: '#475569' }}>
                          {s.memo || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* 旅費・割り勘精算 */}
            {includeExpenses && trip.expenses && trip.expenses.length > 0 && (
              <section className="print-section">
                <div className="print-section-header">
                  <DollarSign size={20} color="#f59e0b" />
                  <h2 className="print-section-title">旅費・割り勘精算サマリー</h2>
                </div>

                {settlementData && (
                  <div style={{ marginBottom: '14px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ background: '#f8fafc', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>支出総額: </span>
                      <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                        ¥{settlementData.totalSpent.toLocaleString()}
                      </strong>
                    </div>
                    {settlementData.settlements.length > 0 ? (
                      <div style={{ background: '#ecfdf5', padding: '10px 16px', borderRadius: '8px', border: '1px solid #a7f3d0', flex: 1 }}>
                        <span style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 700 }}>精算ルート: </span>
                        <span style={{ fontSize: '0.85rem', color: '#047857' }}>
                          {settlementData.settlements.map((s, idx) => {
                            const from = members.find((m) => m.id === s.fromMemberId)?.name || '誰か';
                            const to = members.find((m) => m.id === s.toMemberId)?.name || '誰か';
                            return (
                              <span key={idx} style={{ marginRight: '10px' }}>
                                {from} → {to}: <strong>¥{Math.round(s.amount).toLocaleString()}</strong>
                              </span>
                            );
                          })}
                        </span>
                      </div>
                    ) : (
                      <div style={{ background: '#f1f5f9', padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                        精算完了済み（過不足なし）
                      </div>
                    )}
                  </div>
                )}

                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>日付</th>
                      <th>項目</th>
                      <th style={{ width: '90px' }}>立替者</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>金額</th>
                      <th>備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.expenses.map((e) => {
                      const payer = members.find((m) => m.id === e.payerId)?.name || '不明';
                      return (
                        <tr key={e.id}>
                          <td>{e.date}</td>
                          <td style={{ fontWeight: 600 }}>{e.title}</td>
                          <td>{payer}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            ¥{e.amount.toLocaleString()}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: '#475569' }}>
                            {e.memo || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}

            {/* メモ・注意事項 */}
            {includeMemo && trip.memo && (
              <section className="print-section">
                <div className="print-section-header">
                  <FileText size={20} color="#6366f1" />
                  <h2 className="print-section-title">メモ・注意事項・緊急連絡先</h2>
                </div>
                <div className="print-memo-box">
                  {trip.memo}
                </div>
              </section>
            )}

            {/* フッター */}
            <div className="print-footer">
              <span>旅のしおりアプリ「TabiNote」にて作成</span>
              <span>作成日: {new Date().toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
