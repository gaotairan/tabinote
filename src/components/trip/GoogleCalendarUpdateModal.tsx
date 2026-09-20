import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Key,
  AlertCircle,
  MapPin,
  FileUp,
  RefreshCw,
  Layers,
  ArrowLeft,
  CheckSquare,
  Square,
  ShieldCheck,
  CalendarCheck2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { parseICS } from '../../services/icsParser';
import type { RawCalendarEvent } from '../../services/icsParser';
import {
  getGoogleAccessToken,
  fetchAllCalendarEvents,
} from '../../services/googleCalendar';
import { storageService } from '../../services/storage';
import type { Trip } from '../../types/trip';
import {
  resolveCalendarEventsForTrip,
  syncCalendarEventsIntoTrip,
  type ResolvedCalendarItem,
  type CalendarSyncMode,
} from '../../services/calendarSync';
import confetti from 'canvas-confetti';
import './GoogleCalendarUpdateModal.css';

interface GoogleCalendarUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onTripUpdated: (
    updatedTrip: Trip,
    summary: { addedCount: number; skippedCount: number; expandedDaysCount: number }
  ) => void;
}

export const GoogleCalendarUpdateModal: React.FC<GoogleCalendarUpdateModalProps> = ({
  isOpen,
  onClose,
  trip,
  onTripUpdated,
}) => {
  // ステップ: 'fetch' (取得方法選択) -> 'preview' (予定一覧確認・マージ設定)
  const [step, setStep] = useState<'fetch' | 'preview'>('fetch');
  const [activeTab, setActiveTab] = useState<'oauth' | 'ics' | 'text'>('oauth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 取得した予定
  const [resolvedItems, setResolvedItems] = useState<ResolvedCalendarItem[]>([]);

  // マージ設定
  const [syncMode, setSyncMode] = useState<CalendarSyncMode>('merge');
  const [autoExpandDates, setAutoExpandDates] = useState(true);

  // Google OAuth連携用パラメータ
  const [clientId, setClientId] = useState(() => storageService.getGoogleClientId());
  const [oauthStartDate, setOauthStartDate] = useState(trip.startDate);
  const [oauthEndDate, setOauthEndDate] = useState(trip.endDate);

  // ICS解析用
  const fileInputRef = useRef<HTMLInputElement>(null);

  // テキスト直接入力用
  const [textInput, setTextInput] = useState('');
  const [textTripDate, setTextTripDate] = useState(trip.startDate);

  // 既存の登録済み予定総数
  const totalExistingItems = trip.days.reduce((acc, d) => acc + d.items.length, 0);

  // RawEventsからResolvedItemsへ変換してプレビューへ遷移
  const proceedToPreview = (events: RawCalendarEvent[]) => {
    if (events.length === 0) {
      setError('予定が見つかりませんでした');
      return;
    }

    const items = resolveCalendarEventsForTrip(events, trip);
    setResolvedItems(items);
    setError(null);
    setStep('preview');
  };

  // Google OAuthによる取得
  const handleGoogleOAuthFetch = async () => {
    if (!clientId.trim()) {
      setError('Google Client IDを入力してください');
      return;
    }
    setError(null);
    setLoading(true);
    storageService.setGoogleClientId(clientId.trim());

    try {
      const token = await getGoogleAccessToken(clientId.trim());
      const minDate = new Date(`${oauthStartDate}T00:00:00`);
      const maxDate = new Date(`${oauthEndDate}T23:59:59`);

      const { events, calendarCount } = await fetchAllCalendarEvents(token, minDate, maxDate);
      if (events.length === 0) {
        setError(
          `指定期間（${oauthStartDate} 〜 ${oauthEndDate}）に予定が見つかりませんでした（${calendarCount}個のカレンダーを検索）。\nGoogleカレンダーに登録されている予定の日付が上記期間内にあるかご確認ください。`
        );
        setLoading(false);
        return;
      }
      proceedToPreview(events);
    } catch (err: any) {
      setError('Google連携エラー: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // ICSファイル読み込み
  const handleIcsFile = (file: File) => {
    setError(null);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const events = parseICS(content);
        if (events.length === 0) {
          setError('カレンダー予定が見つかりませんでした。有効な.icsファイルかご確認ください。');
          setLoading(false);
          return;
        }
        proceedToPreview(events);
      } catch (err: any) {
        setError('ファイルの解析に失敗しました: ' + (err.message || ''));
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('ファイルの読み込みに失敗しました');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  // サンプルデータ読み込み（テスト用）
  const handleLoadSampleIcs = () => {
    const sDate = trip.startDate.replace(/-/g, '');
    const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VEVENT
DTSTART:${sDate}T090000Z
DTEND:${sDate}T103000Z
SUMMARY:新幹線・特急で出発
LOCATION:東京駅 新幹線ホーム
DESCRIPTION:指定席・座席番号7号車12A
END:VEVENT
BEGIN:VEVENT
DTSTART:${sDate}T120000Z
DTEND:${sDate}T133000Z
SUMMARY:名物ランチ＆地元グルメ
LOCATION:人気カフェ・レストラン
DESCRIPTION:事前予約済み（12:00〜）
END:VEVENT
BEGIN:VEVENT
DTSTART:${sDate}T150000Z
DTEND:${sDate}T170000Z
SUMMARY:主要観光スポット巡り
LOCATION:展望スポット・名所
DESCRIPTION:チケット持参・記念写真撮影
END:VEVENT
BEGIN:VEVENT
DTSTART:${sDate}T183000Z
DTEND:${sDate}T203000Z
SUMMARY:ホテルチェックイン＆ディナー
LOCATION:宿泊ホテル
DESCRIPTION:チェックイン手続き・部屋で荷物整理
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(sampleIcs);
    proceedToPreview(events);
  };

  // テキストからの解析
  const handleParseText = () => {
    if (!textInput.trim()) {
      setError('予定テキストを入力してください');
      return;
    }
    setError(null);
    const lines = textInput.split('\n').filter((l) => l.trim().length > 0);
    const events: RawCalendarEvent[] = [];

    lines.forEach((line) => {
      const timeMatch = line.match(/(\d{1,2}:\d{2})/);
      const time = timeMatch ? timeMatch[1] : '09:00';
      const [h, m] = time.split(':').map((v) => parseInt(v, 10));

      const evDate = new Date(`${textTripDate}T00:00:00`);
      evDate.setHours(h, m, 0);

      let summary = line.replace(/(\d{1,2}:\d{2})\s*(〜|-)?\s*(\d{1,2}:\d{2})?/, '').trim();
      let location = '';

      if (summary.includes('場所:')) {
        const parts = summary.split('場所:');
        summary = parts[0].trim();
        location = parts[1].trim();
      } else if (summary.includes('@')) {
        const parts = summary.split('@');
        summary = parts[0].trim();
        location = parts[1].trim();
      }

      events.push({
        summary: summary || '予定',
        start: evDate,
        isAllDay: !timeMatch,
        location: location || undefined,
      });
    });

    if (events.length === 0) {
      setError('予定を認識できませんでした');
      return;
    }

    proceedToPreview(events);
  };

  // アイテムの選択トグル
  const handleToggleSelectItem = (id: string) => {
    setResolvedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // 一括選択 / 一括解除
  const handleSelectAll = (select: boolean) => {
    setResolvedItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  // 選択中のアイテム数
  const selectedCount = resolvedItems.filter((it) => it.selected).length;

  // しおり更新の確定実行
  const handleExecuteSync = () => {
    if (selectedCount === 0) {
      setError('取り込む予定を1つ以上選択してください');
      return;
    }

    try {
      const result = syncCalendarEventsIntoTrip(trip, resolvedItems, {
        mode: syncMode,
        autoExpandDates,
      });

      storageService.saveTrip(result.updatedTrip);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      onTripUpdated(result.updatedTrip, {
        addedCount: result.addedCount,
        skippedCount: result.skippedCount,
        expandedDaysCount: result.expandedDaysCount,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'しおりの更新に失敗しました');
    }
  };

  // 日付ごとのグループ化（プレビュー用）
  const groupedItems = resolvedItems.reduce<Record<string, ResolvedCalendarItem[]>>(
    (acc, item) => {
      if (!acc[item.localDateStr]) {
        acc[item.localDateStr] = [];
      }
      acc[item.localDateStr].push(item);
      return acc;
    },
    {}
  );

  // 既存の予定と重複するかどうかのチェック（バッジ表示用）
  const checkIsAlreadyInTrip = (item: ResolvedCalendarItem): boolean => {
    const targetDay = trip.days.find((d) => d.date === item.localDateStr);
    if (!targetDay) return false;
    const cleanItemTitle = item.title.trim().toLowerCase();
    return targetDay.items.some((ex) => {
      const cleanEx = ex.title.trim().toLowerCase();
      return (
        (cleanEx === cleanItemTitle || cleanEx.includes(cleanItemTitle) || cleanItemTitle.includes(cleanEx)) &&
        ex.time === item.localTimeStr
      );
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Googleカレンダーでしおりをアップデート"
      maxWidth="720px"
    >
      <div className="cal-update-modal-content">
        {/* しおり情報バナー */}
        <div className="cal-update-trip-banner">
          <div className="cal-update-trip-info">
            <span className="cal-update-trip-tag">対象しおり</span>
            <strong className="cal-update-trip-title">{trip.title}</strong>
            <span className="cal-update-trip-dates">
              （{trip.startDate} 〜 {trip.endDate} / 現在の予定 {totalExistingItems}件）
            </span>
          </div>
          <div className="cal-update-protect-badge" title="持ち物や精算データは保持されます">
            <ShieldCheck size={14} />
            <span>既存データ保護</span>
          </div>
        </div>

        {error && (
          <div className="import-error-banner">
            <AlertCircle size={16} />
            <div style={{ whiteSpace: 'pre-wrap' }}>{error}</div>
          </div>
        )}

        {/* ========================================================
            STEP 1: カレンダー予定の取得 (step === 'fetch')
           ======================================================== */}
        {step === 'fetch' && (
          <div className="cal-update-fetch-step">
            {/* タブナビゲーション */}
            <div className="import-tabs">
              <button
                className={`import-tab ${activeTab === 'oauth' ? 'active' : ''}`}
                onClick={() => setActiveTab('oauth')}
              >
                <RefreshCw size={15} />
                <span>Googleアカウント連携</span>
              </button>
              <button
                className={`import-tab ${activeTab === 'ics' ? 'active' : ''}`}
                onClick={() => setActiveTab('ics')}
              >
                <Upload size={15} />
                <span>.ics ファイル</span>
              </button>
              <button
                className={`import-tab ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTab('text')}
              >
                <FileText size={15} />
                <span>テキスト貼り付け</span>
              </button>
            </div>

            {/* TAB 1: Google OAuth直接連携 */}
            {activeTab === 'oauth' && (
              <div className="tab-pane fade-in">
                <div className="cal-oauth-box">
                  <div className="cal-form-row">
                    <div className="cal-form-group flex-1">
                      <label>取得開始日</label>
                      <input
                        type="date"
                        value={oauthStartDate}
                        onChange={(e) => setOauthStartDate(e.target.value)}
                        className="cal-input"
                      />
                    </div>
                    <div className="cal-form-group flex-1">
                      <label>取得終了日</label>
                      <input
                        type="date"
                        value={oauthEndDate}
                        onChange={(e) => setOauthEndDate(e.target.value)}
                        className="cal-input"
                      />
                    </div>
                  </div>

                  <div className="cal-form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Key size={14} />
                      <span>Google OAuth クライアントID</span>
                    </label>
                    <input
                      type="text"
                      placeholder="例: xxxxx.apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="cal-input"
                    />
                    <p className="cal-hint-text">
                      Google Cloud Consoleで発行した「OAuth 2.0 クライアント ID」を入力します。
                    </p>
                  </div>

                  <div className="cal-actions-center">
                    <button
                      className="btn btn-primary cal-large-btn"
                      onClick={handleGoogleOAuthFetch}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={16} className="spin-icon" />
                          <span>Googleカレンダーから予定を取得中...</span>
                        </>
                      ) : (
                        <>
                          <CalendarCheck2 size={16} />
                          <span>カレンダーから最新予定を取得</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ICSファイル */}
            {activeTab === 'ics' && (
              <div className="tab-pane fade-in">
                <div
                  className="dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleIcsFile(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <FileUp size={44} className="dropzone-icon" />
                  <h4>カレンダーファイル (.ics) を選択またはドロップ</h4>
                  <p>Googleカレンダーや各種カレンダーアプリからエクスポートした .ics ファイル</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".ics"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleIcsFile(e.target.files[0]);
                      }
                    }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }}>
                    ファイルを選択
                  </button>
                </div>

                <div className="sample-test-box">
                  <div className="sample-test-info">
                    <Sparkles size={16} className="sparkle-icon" />
                    <span>テスト用サンプル予定でアップデートを試す</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm sample-btn"
                    onClick={handleLoadSampleIcs}
                  >
                    サンプルを読み込む
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: テキスト貼り付け */}
            {activeTab === 'text' && (
              <div className="tab-pane fade-in">
                <div className="cal-form-group" style={{ marginBottom: '12px' }}>
                  <label>予定の日付</label>
                  <input
                    type="date"
                    value={textTripDate}
                    onChange={(e) => setTextTripDate(e.target.value)}
                    className="cal-input"
                    style={{ maxWidth: '200px' }}
                  />
                </div>

                <div className="cal-form-group">
                  <label>日程テキストを貼り付け</label>
                  <textarea
                    rows={6}
                    placeholder={`例:\n10:00 新幹線で移動\n12:30 ランチ 場所:カフェ\n15:00 観光スポット見学\n19:00 ホテルチェックイン`}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="cal-textarea"
                  />
                </div>

                <div className="cal-actions-center" style={{ marginTop: '16px' }}>
                  <button className="btn btn-primary" onClick={handleParseText}>
                    <Sparkles size={16} />
                    <span>テキストから予定を抽出</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            STEP 2: 予定プレビュー＆マージ設定 (step === 'preview')
           ======================================================== */}
        {step === 'preview' && (
          <div className="cal-update-preview-step fade-in">
            {/* 上部コントロールバー */}
            <div className="cal-preview-header">
              <button
                type="button"
                className="cal-back-link"
                onClick={() => setStep('fetch')}
              >
                <ArrowLeft size={14} />
                <span>取得方法の再選択に戻る</span>
              </button>
              <div className="cal-preview-count-badge">
                取得: {resolvedItems.length}件 / 選択中: <strong>{selectedCount}件</strong>
              </div>
            </div>

            {/* 更新モード選択 */}
            <div className="cal-mode-selector-section">
              <label className="cal-section-title">
                <Layers size={15} />
                <span>しおりへの反映モードを選択</span>
              </label>

              <div className="cal-mode-grid">
                <label
                  className={`cal-mode-card ${syncMode === 'merge' ? 'selected' : ''}`}
                  onClick={() => setSyncMode('merge')}
                >
                  <input
                    type="radio"
                    name="syncMode"
                    value="merge"
                    checked={syncMode === 'merge'}
                    onChange={() => setSyncMode('merge')}
                  />
                  <div className="cal-mode-card-body">
                    <div className="cal-mode-card-title">
                      <strong>差分・追加マージ</strong>
                      <span className="cal-recommend-tag">推奨</span>
                    </div>
                    <p className="cal-mode-card-desc">
                      既存の予定（{totalExistingItems}件）をそのまま残し、カレンダーの新規予定を追加します。同一日時の重複予定は自動でスキップされます。
                    </p>
                  </div>
                </label>

                <label
                  className={`cal-mode-card ${syncMode === 'replace' ? 'selected' : ''}`}
                  onClick={() => setSyncMode('replace')}
                >
                  <input
                    type="radio"
                    name="syncMode"
                    value="replace"
                    checked={syncMode === 'replace'}
                    onChange={() => setSyncMode('replace')}
                  />
                  <div className="cal-mode-card-body">
                    <div className="cal-mode-card-title">
                      <strong>タイムライン全体を最新化（置き換え）</strong>
                    </div>
                    <p className="cal-mode-card-desc">
                      タイムラインの全日程を、今回選択したカレンダー予定で一括更新・再構築します。（※持ち物・精算・メンバー等は保持されます）
                    </p>
                  </div>
                </label>
              </div>

              {/* 日程自動拡張オプション */}
              <label className="cal-checkbox-option">
                <input
                  type="checkbox"
                  checked={autoExpandDates}
                  onChange={(e) => setAutoExpandDates(e.target.checked)}
                />
                <span>旅行期間外の予定がある場合、しおりの日程（開始日・終了日）を自動で拡張する</span>
              </label>
            </div>

            {/* 予定リスト一覧＆個別選択 */}
            <div className="cal-items-list-section">
              <div className="cal-items-list-header">
                <label className="cal-section-title">
                  <CalendarCheck2 size={15} />
                  <span>取り込む予定を選択 ({selectedCount}/{resolvedItems.length})</span>
                </label>
                <div className="cal-items-list-actions">
                  <button
                    type="button"
                    className="cal-text-btn"
                    onClick={() => handleSelectAll(true)}
                  >
                    全選択
                  </button>
                  <span className="cal-divider">|</span>
                  <button
                    type="button"
                    className="cal-text-btn"
                    onClick={() => handleSelectAll(false)}
                  >
                    全解除
                  </button>
                </div>
              </div>

              <div className="cal-items-scroll-area">
                {Object.keys(groupedItems).sort().map((dateStr) => {
                  const dayItems = groupedItems[dateStr];
                  const existingDay = trip.days.find((d) => d.date === dateStr);

                  return (
                    <div key={dateStr} className="cal-day-group">
                      <div className="cal-day-group-header">
                        <span className="cal-day-date">{dateStr}</span>
                        {existingDay ? (
                          <span className="cal-day-label">
                            {existingDay.dayNumber}日目（既存 {existingDay.items.length}件）
                          </span>
                        ) : (
                          <span className="cal-day-new-badge">＋ 新規追加される日</span>
                        )}
                      </div>

                      <div className="cal-day-items">
                        {dayItems.map((item) => {
                          const isAlready = checkIsAlreadyInTrip(item);

                          return (
                            <div
                              key={item.id}
                              className={`cal-item-card ${item.selected ? 'selected' : ''}`}
                              onClick={() => handleToggleSelectItem(item.id)}
                            >
                              <button
                                type="button"
                                className="cal-item-check-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelectItem(item.id);
                                }}
                              >
                                {item.selected ? (
                                  <CheckSquare size={18} className="cal-check-active" />
                                ) : (
                                  <Square size={18} className="cal-check-inactive" />
                                )}
                              </button>

                              <div className="cal-item-time-box">
                                <span className="cal-item-time">{item.localTimeStr}</span>
                                {item.localEndTimeStr && (
                                  <span className="cal-item-endtime">〜{item.localEndTimeStr}</span>
                                )}
                              </div>

                              <div className="cal-item-main">
                                <div className="cal-item-title-row">
                                  <strong className="cal-item-title">{item.title}</strong>
                                  {isAlready && syncMode === 'merge' && (
                                    <span
                                      className="cal-item-duplicate-badge"
                                      title="すでにしおりに同一または類似の予定があります（マージ時はスキップされます）"
                                    >
                                      登録済み
                                    </span>
                                  )}
                                </div>
                                {item.location && (
                                  <div className="cal-item-location">
                                    <MapPin size={12} />
                                    <span>{item.location}</span>
                                  </div>
                                )}
                                {item.memo && (
                                  <p className="cal-item-memo truncate">{item.memo}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* フッター確定アクション */}
            <div className="cal-preview-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-primary cal-execute-btn"
                onClick={handleExecuteSync}
                disabled={selectedCount === 0}
              >
                <RefreshCw size={16} />
                <span>しおりをアップデート ({selectedCount}件を反映)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
