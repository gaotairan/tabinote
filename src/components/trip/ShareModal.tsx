import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Download,
  Check,
  Smartphone,
  FileText,
} from 'lucide-react';
import type { Trip } from '../../types/trip';
import { Modal } from '../common/Modal';
import { storageService } from '../../services/storage';
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

  const currentUrl = window.location.href;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (e) {
      alert('URLのコピーに失敗しました');
    }
  };

  // LINEやメッセージ送信用テキストサマリー
  const handleCopySummary = async () => {
    let text = `【旅のしおり: ${trip.title}】\n`;
    text += `日程: ${trip.startDate} 〜 ${trip.endDate}\n`;
    text += `目的地: ${trip.destination}\n\n`;
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
    } catch (e) {
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
      title="旅のしおりを共有・保存"
      maxWidth="500px"
    >
      <div className="share-modal-content fade-in">
        {/* スマホ読み取り用QRコード */}
        <div className="qr-section">
          <div className="qr-box">
            <QRCodeSVG value={currentUrl} size={160} level="M" />
          </div>
          <div className="qr-info">
            <div className="qr-title-row">
              <Smartphone size={16} />
              <h4>スマホで読み取って確認</h4>
            </div>
            <p className="qr-desc">
              スマホのカメラでQRコードを読み取ると、外出先でも同じしおりを確認できます。
            </p>
          </div>
        </div>

        {/* リンクコピー */}
        <div className="share-action-box">
          <label className="action-label">アプリURL</label>
          <div className="url-copy-row">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="form-input truncate"
            />
            <button className="btn btn-primary" onClick={handleCopyUrl}>
              {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedUrl ? 'コピー完了' : 'コピー'}</span>
            </button>
          </div>
        </div>

        {/* テキスト概要コピー（LINE等で送る用） */}
        <div className="share-buttons-row">
          <button className="btn btn-secondary flex-1" onClick={handleCopySummary}>
            {copiedSummary ? <Check size={16} color="#10b981" /> : <FileText size={16} />}
            <span>{copiedSummary ? 'コピーしました！' : '日程テキストをコピー'}</span>
          </button>

          <button className="btn btn-secondary flex-1" onClick={handleDownloadJson}>
            <Download size={16} />
            <span>JSONで保存</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
