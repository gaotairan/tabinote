import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Download,
  Check,
  Smartphone,
  FileText,
  Share2,
  AlertCircle,
  Sparkles,
  Maximize2,
  Globe,
  Wifi,
  Mail,
  ExternalLink,
  Plus,
  Trash2,
  Users,
  Printer,
} from 'lucide-react';
import type { Trip } from '../../types/trip';
import { Modal } from '../common/Modal';
import { storageService } from '../../services/storage';
import { shareService } from '../../services/shareService';
import { MemberAvatar } from '../common/MemberAvatar';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  onOpenPrint?: () => void;
  isCloudConnected?: boolean;
  onOpenCloudSync?: () => void;
}

/**
 * QRコードの規格外例外（Data too longなど）でReactツリー全体がクラッシュするのを防ぐ安全ラッパー
 */
class SafeQrCode extends React.Component<
  { value: string; size: number; level: 'L' | 'M'; marginSize: number },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('SafeQrCode render error caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="qr-too-large-fallback">
          <AlertCircle size={32} color="#f59e0b" />
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '6px' }}>
            QRコードを表示できませんでした
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            下の「URLコピー」をご利用ください
          </p>
        </div>
      );
    }

    return (
      <QRCodeSVG
        value={this.props.value}
        size={this.props.size}
        level={this.props.level}
        marginSize={this.props.marginSize}
      />
    );
  }
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  trip,
  onOpenPrint,
  isCloudConnected = false,
  onOpenCloudSync,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedEmailText, setCopiedEmailText] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // メール送信用のState
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() =>
    (trip.members || []).filter((m) => !!m.email).map((m) => m.id)
  );
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState('');

  // ローカル開発環境判定
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  // ローカル環境でのベースURLモード（デフォルトはスマホや別端末から即アクセスできるGitHub Pages公開URL）
  const [urlMode, setUrlMode] = useState<'current' | 'github_pages' | 'custom_ip'>(
    isLocalhost ? 'github_pages' : 'current'
  );
  const [customIp, setCustomIp] = useState('');

  // 共有用ベースURLの決定
  const effectiveOrigin = useMemo(() => {
    if (urlMode === 'github_pages') {
      return 'https://gaotairan.github.io/tabinote';
    }
    if (urlMode === 'custom_ip' && customIp.trim()) {
      let ip = customIp.trim();
      if (!ip.startsWith('http://') && !ip.startsWith('https://')) {
        ip = `http://${ip}`;
      }
      return ip;
    }
    return undefined; // デフォルトは window.location.origin
  }, [urlMode, customIp]);

  // しおりデータ全体が内包された完全共有URLを生成（URLコピー・メール・LINE送信用）
  const snapshotShareUrl = useMemo(() => {
    try {
      return shareService.generateShareUrl(trip, effectiveOrigin);
    } catch (e) {
      console.error('Failed to generate share URL:', e);
      return window.location.href;
    }
  }, [trip, effectiveOrigin]);

  // クラウド常時自動同期用の超短縮URL（#trip-xxx）
  const cloudShareUrl = useMemo(() => {
    const origin = effectiveOrigin ? effectiveOrigin.replace(/\/+$/, '') : window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}#${trip.id}`;
  }, [effectiveOrigin, trip.id]);

  // 実際の共有URL（クラウド同期時は短縮URL、未同期時はスナップショットURL）
  const shareUrl = isCloudConnected ? cloudShareUrl : snapshotShareUrl;

  // スマホカメラでの高速・確実な読み取り用に最適化されたQRコード用URL
  const qrCodeInfo = useMemo(() => {
    if (isCloudConnected) {
      return { url: cloudShareUrl, isLightweight: false };
    }
    try {
      return shareService.generateQrCodeUrl(trip, effectiveOrigin);
    } catch (e) {
      console.error('Failed to generate QR code URL:', e);
      return { url: snapshotShareUrl, isLightweight: false };
    }
  }, [isCloudConnected, cloudShareUrl, trip, effectiveOrigin, snapshotShareUrl]);

  // Web Share API（スマホのLINEやメッセージなど）対応判定
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // データ長に応じた誤り訂正レベル（Lにしてセル密度を最小化し、スマホカメラでの高速読み取りを担保）
  const qrLevel = 'L';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      alert('URLのコピーに失敗しました');
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: `【旅のしおり】${trip.title}`,
        text: `「${trip.title}」（${trip.startDate}〜${trip.endDate} @${trip.destination}）の旅のしおりを共有します！`,
        url: shareUrl,
      });
    } catch {
      // ユーザーキャンセル等は無視
    }
  };

  // LINEやメッセージ送信用テキストサマリー
  const handleCopySummary = async () => {
    let text = `【旅のしおり: ${trip.title}】\n`;
    text += `日程: ${trip.startDate} 〜 ${trip.endDate}\n`;
    text += `目的地: ${trip.destination}\n\n`;
    text += `▼ しおりを開く（スマホで確認・自動保存）:\n${shareUrl}\n\n`;
    text += `【スケジュール概要】\n`;
    trip.days.forEach((day) => {
      text += `\n■ ${day.dayNumber}日目 (${day.date})\n`;
      day.items.forEach((item) => {
        text += `・${item.time} ${item.title}${item.location ? ` @${item.location}` : ''}\n`;
      });
    });
    if (trip.memo) {
      text += `\n【メモ】\n${trip.memo}\n`;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      alert('コピーに失敗しました');
    }
  };

  const handleDownloadJson = () => {
    const jsonStr = storageService.exportTripAsJson(trip);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.title.replace(/\s+/g, '_')}_しおり.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 選択されたメンバーのメールアドレス＋直接追加メールアドレス
  const targetEmails = useMemo(() => {
    const fromMembers = trip.members
      .filter((m) => selectedMemberIds.includes(m.id) && !!m.email)
      .map((m) => m.email!.trim());
    const merged = Array.from(new Set([...fromMembers, ...customEmails.map((e) => e.trim())]));
    return merged.filter((e) => e.length > 0);
  }, [trip.members, selectedMemberIds, customEmails]);

  // メール件名・本文
  const emailSubject = `【旅のしおり】${trip.title} のご案内`;
  const emailBody = useMemo(() => {
    let body = `旅のしおり「${trip.title}」を共有します！\n\n`;
    body += `■ 日程: ${trip.startDate} 〜 ${trip.endDate}\n`;
    body += `■ 目的地: ${trip.destination}\n\n`;
    body += `▼ しおりを開く（スマホで開くと自動保存・オフライン閲覧可能）:\n`;
    body += `${shareUrl}\n\n`;
    if (trip.password) {
      body += `旅の合言葉: ${trip.password}\n`;
    }
    if (trip.memo) {
      body += `【メモ・連絡先】\n${trip.memo}\n\n`;
    }
    body += `みんなで素敵な旅にしましょう！✨`;
    return body;
  }, [trip, shareUrl]);

  // メーラーアプリで送信 (mailto:)
  const handleSendViaMailApp = () => {
    if (targetEmails.length === 0) {
      alert('送信先メールアドレスを1つ以上選択または入力してください');
      return;
    }
    const to = targetEmails.join(',');
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  // Gmail Webで新規作成
  const handleSendViaGmail = () => {
    if (targetEmails.length === 0) {
      alert('送信先メールアドレスを1つ以上選択または入力してください');
      return;
    }
    const to = encodeURIComponent(targetEmails.join(','));
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // メール本文と宛先をクリップボードにコピー
  const handleCopyEmailContent = async () => {
    let text = `宛先: ${targetEmails.join(', ') || '(未指定)'}\n`;
    text += `件名: ${emailSubject}\n\n`;
    text += emailBody;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedEmailText(true);
      setTimeout(() => setCopiedEmailText(false), 2000);
    } catch {
      alert('コピーに失敗しました');
    }
  };

  // メンバー選択切り替え
  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  // カスタムメールアドレス追加
  const handleAddCustomEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newEmailInput.trim()) return;
    if (!customEmails.includes(newEmailInput.trim())) {
      setCustomEmails([...customEmails, newEmailInput.trim()]);
    }
    setNewEmailInput('');
  };

  // カスタムメールアドレス削除
  const handleRemoveCustomEmail = (emailToRemove: string) => {
    setCustomEmails(customEmails.filter((e) => e !== emailToRemove));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="旅のしおりを共有・スマホに保存"
      maxWidth="600px"
    >
      <div className="share-modal-content fade-in">
        {/* スマホ読み取り用QRコード（中央大きく表示） */}
        <div className="qr-section-centered">
          <div
            className="qr-box-large"
            onClick={() => setIsZoomed(!isZoomed)}
            title="クリックして拡大 / 縮小"
          >
            <SafeQrCode
              value={qrCodeInfo.url}
              size={isZoomed ? 300 : 220}
              level={qrLevel}
              marginSize={2}
            />
            <div className="qr-zoom-hint">
              <Maximize2 size={13} />
              <span>{isZoomed ? '標準サイズに戻す' : 'クリックで特大表示'}</span>
            </div>
          </div>

          <div className="qr-info-centered">
            <div className="qr-title-row">
              <Smartphone size={18} />
              <h4>スマホのカメラで読み取って即保存</h4>
            </div>
            <p className="qr-desc">
              QRコードをスマホで読み取ると、このしおりがそのまま開き、端末に<strong>自動保存</strong>されます。ログイン不要・オフラインでも閲覧可能です。
            </p>
            {isCloudConnected ? (
              <div
                className="qr-features-badge"
                style={{
                  background: '#dcfce7',
                  color: '#166534',
                  border: '1px solid #86efac',
                  padding: '6px 12px',
                  borderRadius: '20px',
                }}
              >
                <span
                  className="cloud-sync-pulse-dot"
                  style={{ display: 'inline-block', marginRight: '6px' }}
                />
                <span>クラウド常時同期中：スマホで編集した内容もPCに即時自動反映されます！</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="qr-features-badge">
                  <Sparkles size={13} />
                  <span>
                    {qrCodeInfo.isLightweight
                      ? '全日程・時間・場所・時差設定を完全同期'
                      : '全日程・持ち物リスト・時差設定を完全同期'}
                  </span>
                </div>
                {onOpenCloudSync && (
                  <button
                    type="button"
                    onClick={onOpenCloudSync}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      color: '#2563eb',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 0',
                      textDecoration: 'underline',
                      alignSelf: 'flex-start',
                    }}
                  >
                    ☁️ スマホとPCで常時自動同期させたい方はこちら（クラウド設定）
                  </button>
                )}
              </div>
            )}
            {!isCloudConnected && qrCodeInfo.isLightweight && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                ※持ち物やお土産・支出を含む全データは、下の「URLコピー」や「メール送信」で送れます
              </p>
            )}
          </div>
        </div>

        {/* ローカル環境時の注意ヒント ＆ 切り替えオプション */}
        {isLocalhost && (
          <div className="share-localhost-box">
            <div className="share-localhost-header">
              <AlertCircle size={16} className="hint-icon" />
              <span className="hint-title">PCローカル（localhost）で実行中</span>
            </div>
            <p className="hint-text">
              スマホのカメラで <code>localhost</code> のQRコードを読み取ってもスマホはPCに接続できません。スマホで読み取る場合は以下のいずれかを選択してください：
            </p>
            <div className="url-mode-selector">
              <button
                type="button"
                className={`mode-btn ${urlMode === 'github_pages' ? 'active' : ''}`}
                onClick={() => setUrlMode('github_pages')}
              >
                <Globe size={14} />
                <span>GitHub Pages公開URLで生成（推奨）</span>
              </button>
              <button
                type="button"
                className={`mode-btn ${urlMode === 'custom_ip' ? 'active' : ''}`}
                onClick={() => setUrlMode('custom_ip')}
              >
                <Wifi size={14} />
                <span>同一Wi-Fi（PCのIPアドレス）</span>
              </button>
              <button
                type="button"
                className={`mode-btn ${urlMode === 'current' ? 'active' : ''}`}
                onClick={() => setUrlMode('current')}
              >
                <span>現在のlocalhostのまま</span>
              </button>
            </div>

            {urlMode === 'custom_ip' && (
              <div className="custom-ip-input-row">
                <input
                  type="text"
                  placeholder="例: 192.168.1.15:5173"
                  value={customIp}
                  onChange={(e) => setCustomIp(e.target.value)}
                  className="form-input"
                />
                <span className="ip-help">
                  PCのコマンドプロンプトで <code>ipconfig</code> を実行したIPv4アドレス
                </span>
              </div>
            )}
          </div>
        )}

        {/* 共有リンク（LINEやSNSで送る） */}
        <div className="share-action-box">
          <label className="action-label">共有リンク（LINEやチャットで送信）</label>
          <div className="url-copy-row">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="form-input truncate"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button className="btn btn-primary" onClick={handleCopyUrl}>
              {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedUrl ? 'コピー完了' : 'URLコピー'}</span>
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', marginBottom: 0 }}>
            ※このURLをLINEやメール等で送ると、相手の端末でしおりがそのまま開き、端末に自動保存されます。
          </p>
        </div>

        {/* 参加メンバーにメールでしおりを送信セクション */}
        <div className="share-email-section">
          <div className="email-section-header">
            <div className="email-section-title">
              <Mail size={17} className="icon-mail" />
              <span>参加メンバーにメールでしおりを送信</span>
            </div>
            <span className="email-recipients-count">
              宛先: {targetEmails.length}件選択中
            </span>
          </div>

          <p className="email-section-desc">
            作成したしおりのURLと旅の情報を、参加メンバーの指定メールアドレスへ送信できます。
          </p>

          {/* メンバー選択チェックリスト */}
          <div className="member-email-selection-box">
            <div className="selection-box-label">
              <Users size={14} />
              <span>しおり参加メンバーから選択:</span>
            </div>

            <div className="member-email-checkboxes">
              {trip.members.map((m) => {
                const hasEmail = !!m.email;
                const isSelected = selectedMemberIds.includes(m.id);

                return (
                  <label
                    key={m.id}
                    className={`member-email-check-item ${!hasEmail ? 'disabled' : ''} ${
                      isSelected && hasEmail ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!hasEmail}
                      checked={isSelected && hasEmail}
                      onChange={() => toggleMemberSelection(m.id)}
                    />
                    <MemberAvatar
                      name={m.name}
                      avatarColor={m.avatarColor}
                      avatarUrl={m.avatarUrl}
                      size="xs"
                    />
                    <span className="member-check-name">{m.name}</span>
                    {hasEmail ? (
                      <span className="member-check-addr">({m.email})</span>
                    ) : (
                      <span className="member-check-no-addr">(メール未設定)</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* 直接メールアドレスを指定して追加 */}
          <form onSubmit={handleAddCustomEmail} className="custom-email-input-row">
            <input
              type="email"
              placeholder="他のメールアドレスを指定して追加 (例: friend@example.com)"
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              className="form-input flex-1"
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={!newEmailInput.trim()}
            >
              <Plus size={14} />
              <span>宛先追加</span>
            </button>
          </form>

          {/* 追加されたカスタムメールアドレスのタグ */}
          {customEmails.length > 0 && (
            <div className="custom-emails-tags-row">
              {customEmails.map((addr) => (
                <span key={addr} className="custom-email-tag">
                  <Mail size={12} />
                  <span>{addr}</span>
                  <button
                    type="button"
                    className="tag-remove-btn"
                    onClick={() => handleRemoveCustomEmail(addr)}
                    title="宛先から削除"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* メール送信・作成アクションボタン群 */}
          <div className="email-action-buttons-grid">
            <button
              type="button"
              className="btn btn-primary email-btn-primary"
              onClick={handleSendViaMailApp}
              disabled={targetEmails.length === 0}
              title="お使いのメールアプリ（Outlook, Mail等）を起動"
            >
              <Mail size={16} />
              <span>メールソフトで送信</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary email-btn-gmail"
              onClick={handleSendViaGmail}
              disabled={targetEmails.length === 0}
              title="Web版Gmailで新規メール作成画面を開く"
            >
              <ExternalLink size={15} />
              <span>Gmailで作成</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary email-btn-copy"
              onClick={handleCopyEmailContent}
              title="メール本文・しおりURLをクリップボードにコピー"
            >
              {copiedEmailText ? (
                <Check size={15} color="#10b981" />
              ) : (
                <Copy size={15} />
              )}
              <span>{copiedEmailText ? '本文コピー完了！' : 'メール本文をコピー'}</span>
            </button>
          </div>
        </div>

        {/* スマホ標準共有ボタン（スマホブラウザで開いている場合） */}
        {canNativeShare && (
          <button
            className="btn btn-primary share-native-btn"
            onClick={handleNativeShare}
          >
            <Share2 size={16} />
            <span>スマホの共有メニューを開く（LINE・AirDropなど）</span>
          </button>
        )}

        {/* PDF作成 / 印刷ボタン */}
        {onOpenPrint && (
          <button
            type="button"
            className="btn btn-secondary share-pdf-btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '10px 16px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: 'var(--text-main)',
              fontWeight: 700,
            }}
            onClick={() => {
              onClose();
              onOpenPrint();
            }}
          >
            <Printer size={16} color="var(--primary)" />
            <span>しおりをPDF出力 / A4印刷する</span>
          </button>
        )}

        {/* テキスト概要コピー（LINE等で送る用）＆ JSON保存 */}
        <div className="share-buttons-row">
          <button className="btn btn-secondary flex-1" onClick={handleCopySummary}>
            {copiedSummary ? (
              <Check size={16} color="#10b981" />
            ) : (
              <FileText size={16} />
            )}
            <span>{copiedSummary ? 'コピー完了！' : '日程テキストをコピー'}</span>
          </button>

          <button className="btn btn-secondary flex-1" onClick={handleDownloadJson}>
            <Download size={16} />
            <span>JSONファイルで保存</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
