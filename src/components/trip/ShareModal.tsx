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
} from 'lucide-react';
import type { Trip } from '../../types/trip';
import { Modal } from '../common/Modal';
import { storageService } from '../../services/storage';
import { shareService } from '../../services/shareService';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // ローカル開発環境判定
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  // ローカル環境でのベースURLモード（'local' | 'github_pages' | 'custom_ip'）
  const [urlMode, setUrlMode] = useState<'current' | 'github_pages' | 'custom_ip'>('current');
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

  // しおりデータ全体が内包された共有URLを生成
  const shareUrl = useMemo(() => {
    try {
      return shareService.generateShareUrl(trip, effectiveOrigin);
    } catch (e) {
      console.error('Failed to generate share URL:', e);
      return window.location.href;
    }
  }, [trip, effectiveOrigin]);

  // Web Share API（スマホのLINEやメッセージなど）対応判定
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // データ長に応じた誤り訂正レベル（データが多い場合はLにしてセル密度を最小化）
  const qrLevel = shareUrl.length > 900 ? 'L' : 'M';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="旅のしおりを共有・スマホに保存"
      maxWidth="560px"
    >
      <div className="share-modal-content fade-in">
        {/* スマホ読み取り用QRコード（中央大きく表示） */}
        <div className="qr-section-centered">
          <div
            className="qr-box-large"
            onClick={() => setIsZoomed(!isZoomed)}
            title="クリックして拡大 / 縮小"
          >
            <QRCodeSVG
              value={shareUrl}
              size={isZoomed ? 300 : 230}
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
            <div className="qr-features-badge">
              <Sparkles size={13} />
              <span>全日程・持ち物リスト・時差設定を完全同期</span>
            </div>
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
          <label className="action-label">共有リンク（LINEやメールで送信）</label>
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
