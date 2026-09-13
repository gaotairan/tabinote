import React, { useState, useRef } from 'react';
import {
  Calendar,
  FileText,
  Upload,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  MapPin,
  FileUp,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { parseICS } from '../../services/icsParser';
import type { RawCalendarEvent } from '../../services/icsParser';
import { generateTripFromEvents } from '../../services/tripGenerator';
import {
  getGoogleAccessToken,
  fetchAllCalendarEvents,
} from '../../services/googleCalendar';
import { storageService } from '../../services/storage';
import type { Trip } from '../../types/trip';
import confetti from 'canvas-confetti';
import './GoogleCalendarImportModal.css';

interface GoogleCalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripGenerated: (trip: Trip) => void;
}

export const GoogleCalendarImportModal: React.FC<GoogleCalendarImportModalProps> = ({
  isOpen,
  onClose,
  onTripGenerated,
}) => {
  const [activeTab, setActiveTab] = useState<'ics' | 'oauth' | 'text'>('ics');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ICS解析用
  const [parsedEvents, setParsedEvents] = useState<RawCalendarEvent[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customDestination, setCustomDestination] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google OAuth連携用
  const [clientId, setClientId] = useState(() => storageService.getGoogleClientId());
  const [oauthStartDate, setOauthStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [oauthEndDate, setOauthEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });

  // テキスト直接入力用
  const [textInput, setTextInput] = useState('');
  const [textTripDate, setTextTripDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // ICSファイル読み込み処理
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
        setParsedEvents(events);
        // 推測タイトル
        const firstLoc = events.find((ev) => ev.location)?.location || '';
        if (firstLoc) {
          setCustomDestination(firstLoc.split(/[,、\s]/)[0]);
        }
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

  // サンプルICSファイル（北海道旅行）でテストする
  const handleLoadSampleIcs = () => {
    const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VEVENT
DTSTART:20261101T080000Z
DTEND:20261101T093000Z
SUMMARY:羽田空港集合・新千歳空港行きフライト
LOCATION:羽田空港 第2ターミナル
DESCRIPTION:ANAの搭乗口へ7:40までに集合！
END:VEVENT
BEGIN:VEVENT
DTSTART:20261101T103000Z
DTEND:20261101T113000Z
SUMMARY:レンタカー受取＆ドライブ出発
LOCATION:新千歳空港レンタカー受付
DESCRIPTION:免責補償加入済み。ETCカード挿入確認。
END:VEVENT
BEGIN:VEVENT
DTSTART:20261101T123000Z
DTEND:20261101T140000Z
SUMMARY:小樽運河沿いで海鮮丼ランチ
LOCATION:小樽運河 食堂街
DESCRIPTION:海鮮丼とホタテバター焼きを堪能
END:VEVENT
BEGIN:VEVENT
DTSTART:20261101T150000Z
DTEND:20261101T170000Z
SUMMARY:小樽オルゴール堂＆堺町通り散策
LOCATION:小樽オルゴール堂本館
DESCRIPTION:お土産のお菓子（ルタオ）購入
END:VEVENT
BEGIN:VEVENT
DTSTART:20261101T183000Z
DTEND:20261101T203000Z
SUMMARY:札幌市内ホテルチェックイン＆ジンギスカン夕食
LOCATION:サッポロビール園
DESCRIPTION:予約名：たろう（19:00〜）食べ飲み放題コース
END:VEVENT
BEGIN:VEVENT
DTSTART:20261102T090000Z
DTEND:20261102T120000Z
SUMMARY:旭山動物園見学
LOCATION:旭山動物園
DESCRIPTION:ペンギンの散歩、シロクマのもぐもぐタイム
END:VEVENT
BEGIN:VEVENT
DTSTART:20261102T130000Z
DTEND:20261102T143000Z
SUMMARY:旭川ラーメン村でランチ
LOCATION:旭川ラーメン村
DESCRIPTION:生姜醤油ラーメンまたは味噌ラーメン
END:VEVENT
BEGIN:VEVENT
DTSTART:20261102T160000Z
DTEND:20261102T180000Z
SUMMARY:美瑛・青い池と白金温泉
LOCATION:美瑛 白金青い池
DESCRIPTION:神秘的な青い水面とライトアップ鑑賞
END:VEVENT
BEGIN:VEVENT
DTSTART:20261103T100000Z
DTEND:20261103T120000Z
SUMMARY:羊ヶ丘展望台 クラーク像
LOCATION:さっぽろ羊ヶ丘展望台
DESCRIPTION:「Boys, be ambitious」のポーズで記念撮影
END:VEVENT
BEGIN:VEVENT
DTSTART:20261103T140000Z
DTEND:20261103T160000Z
SUMMARY:新千歳空港でお土産購入＆ソフトクリーム
LOCATION:新千歳空港 国内線ターミナル
DESCRIPTION:白い恋人、じゃがポックル、海産物をゲット
END:VEVENT
BEGIN:VEVENT
DTSTART:20261103T170000Z
DTEND:20261103T184500Z
SUMMARY:羽田行きフライト出発
LOCATION:新千歳空港
DESCRIPTION:楽しかった北海道旅行も終了！お疲れ様でした！
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(sampleIcs);
    setParsedEvents(events);
    setCustomTitle('北海道・小樽＆美瑛 2泊3日の旅 ☃️');
    setCustomDestination('北海道（札幌・小樽・旭川）');
    setError(null);
  };

  // しおり生成の確定実行
  const handleCreateTrip = () => {
    if (parsedEvents.length === 0) return;
    try {
      const trip = generateTripFromEvents(parsedEvents, {
        customTitle: customTitle || undefined,
        customDestination: customDestination || undefined,
      });

      storageService.saveTrip(trip);
      storageService.setActiveTripId(trip.id);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      onTripGenerated(trip);
      onClose();
    } catch (err: any) {
      setError(err.message || 'しおりの生成に失敗しました');
    }
  };

  // Google OAuth直接連携の実行
  const handleGoogleOAuthImport = async () => {
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
          `指定期間（${oauthStartDate} 〜 ${oauthEndDate}）に予定が見つかりませんでした（${calendarCount}個のカレンダーを検索）。\nGoogleカレンダーに入力されている予定の「日付（西暦含む）」が上記期間内に入っているかご確認ください。`
        );
        setLoading(false);
        return;
      }
      setParsedEvents(events);
      setActiveTab('ics'); // プレビュー確認へ遷移
    } catch (err: any) {
      setError('Google連携エラー: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // テキストから予定解析
  const handleParseText = () => {
    if (!textInput.trim()) {
      setError('予定テキストを入力してください');
      return;
    }
    setError(null);
    const lines = textInput.split('\n').filter((l) => l.trim().length > 0);
    const events: RawCalendarEvent[] = [];

    lines.forEach((line) => {
      // "10:00 東京駅集合" や "10:00〜12:00 清水寺散策 場所:清水寺" のようなパターン
      const timeMatch = line.match(/(\d{1,2}:\d{2})/);
      const time = timeMatch ? timeMatch[1] : '09:00';
      const [h, m] = time.split(':').map((v) => parseInt(v, 10));

      const evDate = new Date(`${textTripDate}T00:00:00`);
      evDate.setHours(h, m, 0);

      // 時間部分を除去したテキスト
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

    setParsedEvents(events);
    setActiveTab('ics');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Googleカレンダーから自動でしおりを作成"
      maxWidth="640px"
    >
      <div className="import-modal-content">
        {/* タブナビゲーション */}
        <div className="import-tabs">
          <button
            className={`import-tab ${activeTab === 'ics' ? 'active' : ''}`}
            onClick={() => setActiveTab('ics')}
          >
            <FileUp size={16} />
            <span>.icsファイル（推奨）</span>
          </button>
          <button
            className={`import-tab ${activeTab === 'oauth' ? 'active' : ''}`}
            onClick={() => setActiveTab('oauth')}
          >
            <Calendar size={16} />
            <span>Google直接連携</span>
          </button>
          <button
            className={`import-tab ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            <FileText size={16} />
            <span>テキスト貼り付け</span>
          </button>
        </div>

        {error && (
          <div className="import-error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* タブ1: .icsファイルインポート */}
        {activeTab === 'ics' && (
          <div className="tab-pane fade-in">
            {parsedEvents.length === 0 ? (
              <div className="ics-upload-area">
                <div
                  className="dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleIcsFile(file);
                  }}
                >
                  <Upload size={36} className="dropzone-icon" />
                  <h4>カレンダーファイル（.ics）を選択</h4>
                  <p>またはここにファイルをドラッグ＆ドロップ</p>
                  <span className="dropzone-hint">
                    ※Googleカレンダー設定の「エクスポート」からダウンロードしたファイル
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".ics,text/calendar"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleIcsFile(file);
                  }}
                />

                <div className="sample-test-box">
                  <div className="sample-test-info">
                    <Sparkles size={16} className="sparkle-icon" />
                    <span>今すぐ試したい方はこちら：</span>
                  </div>
                  <button
                    className="btn btn-outline sample-btn"
                    onClick={handleLoadSampleIcs}
                  >
                    北海道2泊3日サンプルの予定を読み込む
                  </button>
                </div>
              </div>
            ) : (
              /* 解析済み予定のプレビュー＆作成フォーム */
              <div className="ics-preview-section">
                <div className="preview-header">
                  <div className="preview-count">
                    <CheckCircle2 size={18} color="#10b981" />
                    <span>{parsedEvents.length} 件の予定を読み込みました！</span>
                  </div>
                  <button
                    className="btn-text-only"
                    onClick={() => {
                      setParsedEvents([]);
                      setCustomTitle('');
                      setCustomDestination('');
                    }}
                  >
                    やり直す
                  </button>
                </div>

                <div className="form-group">
                  <label>しおりのタイトル</label>
                  <input
                    type="text"
                    className="form-input"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="例: 北海道 2泊3日の旅 ☃️"
                  />
                </div>

                <div className="form-group">
                  <label>主な目的地</label>
                  <input
                    type="text"
                    className="form-input"
                    value={customDestination}
                    onChange={(e) => setCustomDestination(e.target.value)}
                    placeholder="例: 北海道（札幌・小樽）"
                  />
                </div>

                <div className="events-preview-list">
                  <label className="list-label">抽出されたタイムライン予定</label>
                  <div className="events-scroll">
                    {parsedEvents.map((ev, i) => (
                      <div key={i} className="preview-event-card">
                        <div className="preview-event-time">
                          <Clock size={12} />
                          <span>
                            {ev.isAllDay
                              ? '終日'
                              : ev.start.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                          </span>
                        </div>
                        <div className="preview-event-body">
                          <strong className="preview-event-title">{ev.summary}</strong>
                          {ev.location && (
                            <span className="preview-event-loc">
                              <MapPin size={12} />
                              {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-block"
                  onClick={handleCreateTrip}
                >
                  <Sparkles size={18} />
                  <span>この予定から旅のしおりを自動生成！</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* タブ2: Google OAuth連携 */}
        {activeTab === 'oauth' && (
          <div className="tab-pane fade-in">
            <div className="oauth-guide">
              <p>
                Google Identity Servicesを使用して、あなたのGoogleカレンダーから直接予定を取得します。
              </p>
            </div>

            <div className="form-group">
              <label>Google Cloud Client ID</label>
              <div className="input-with-icon">
                <Key size={16} className="input-icon" />
                <input
                  type="text"
                  className="form-input"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                />
              </div>
              <span className="form-hint">
                ※Client IDはブラウザのLocalStorageにのみ保存されます。
              </span>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>旅行の開始日</label>
                <input
                  type="date"
                  className="form-input"
                  value={oauthStartDate}
                  onChange={(e) => setOauthStartDate(e.target.value)}
                />
              </div>
              <div className="form-group flex-1">
                <label>旅行の終了日</label>
                <input
                  type="date"
                  className="form-input"
                  value={oauthEndDate}
                  onChange={(e) => setOauthEndDate(e.target.value)}
                />
              </div>
            </div>

            <button
              className="btn btn-primary btn-block"
              onClick={handleGoogleOAuthImport}
              disabled={loading}
            >
              {loading ? (
                <span>Googleと通信中...</span>
              ) : (
                <>
                  <Calendar size={18} />
                  <span>Googleカレンダーの予定を取得</span>
                </>
              )}
            </button>

            <div className="oauth-help-box">
              <div className="help-title">
                <HelpCircle size={14} />
                <span>Client IDをお持ちでない場合</span>
              </div>
              <p>
                Google Cloudの設定がまだの場合は、左上の「<strong>.icsファイル</strong>」タブをご利用ください。Googleカレンダーの「設定」→「カレンダーのエクスポート」からZIPを取得し、中にあるファイルをドロップするだけで即座に自動生成できます！
              </p>
            </div>
          </div>
        )}

        {/* タブ3: テキスト貼り付け */}
        {activeTab === 'text' && (
          <div className="tab-pane fade-in">
            <div className="form-group">
              <label>旅行日（基準日）</label>
              <input
                type="date"
                className="form-input"
                value={textTripDate}
                onChange={(e) => setTextTripDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>予定テキスト（時刻とタイトル）</label>
              <textarea
                className="form-textarea"
                rows={7}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`09:00 東京駅集合\n11:30 京都駅到着 場所:京都駅\n12:30 祇園でランチ 場所:祇園\n14:00 清水寺観光\n18:30 先斗町でディナー`}
              />
              <span className="form-hint">
                ※行ごとに時刻と予定を記入するだけで自動解析します。
              </span>
            </div>

            <button
              className="btn btn-primary btn-block"
              onClick={handleParseText}
            >
              <Sparkles size={18} />
              <span>予定テキストを解析してしおり作成へ</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
