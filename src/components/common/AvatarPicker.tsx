import React, { useState, useRef } from 'react';
import { Camera, Upload, Link as LinkIcon, RotateCcw, Sparkles, Check, X } from 'lucide-react';
import { MemberAvatar } from './MemberAvatar';
import { cropAndCompressImage, PRESET_AVATARS } from '../../utils/imageUtils';
import './AvatarPicker.css';

interface AvatarPickerProps {
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  onChangeColor: (color: string) => void;
  onChangeAvatarUrl: (url: string | undefined) => void;
  colorPresets: string[];
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  name,
  avatarColor,
  avatarUrl,
  onChangeColor,
  onChangeAvatarUrl,
  colorPresets,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'url' | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ファイルアップロードハンドラー
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const compressedDataUrl = await cropAndCompressImage(file, 200, 0.85);
      onChangeAvatarUrl(compressedDataUrl);
      setActiveTab(null);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '画像の読み込みに失敗しました');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // URL入力適用ハンドラー
  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    onChangeAvatarUrl(urlInput.trim());
    setUrlInput('');
    setActiveTab(null);
  };

  // プリセット選択
  const handleSelectPreset = (url: string) => {
    onChangeAvatarUrl(url);
    setActiveTab(null);
  };

  // 画像削除（イニシャル＋カラーに戻す）
  const handleRemoveImage = () => {
    onChangeAvatarUrl(undefined);
    setActiveTab(null);
    setErrorMessage(null);
  };

  return (
    <div className="avatar-picker-container">
      {/* 隠しファイルインプット */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      <div className="avatar-picker-main">
        {/* アバタープレビュー */}
        <div className="avatar-preview-wrapper">
          <MemberAvatar
            name={name || '名'}
            avatarColor={avatarColor}
            avatarUrl={avatarUrl}
            size="lg"
            className="avatar-preview-bubble"
          />
          <button
            type="button"
            className="avatar-overlay-btn"
            onClick={() => fileInputRef.current?.click()}
            title="端末から写真を変更"
          >
            <Camera size={14} />
          </button>
        </div>

        {/* アクションボタン群 */}
        <div className="avatar-actions-area">
          <div className="avatar-btn-row">
            <button
              type="button"
              className="btn-avatar-action"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload size={13} />
              <span>{isProcessing ? '処理中...' : '写真を選ぶ'}</span>
            </button>

            <button
              type="button"
              className={`btn-avatar-action ${activeTab === 'preset' ? 'active' : ''}`}
              onClick={() => setActiveTab(activeTab === 'preset' ? null : 'preset')}
            >
              <Sparkles size={13} />
              <span>プリセット</span>
            </button>

            <button
              type="button"
              className={`btn-avatar-action ${activeTab === 'url' ? 'active' : ''}`}
              onClick={() => setActiveTab(activeTab === 'url' ? null : 'url')}
            >
              <LinkIcon size={13} />
              <span>URL指定</span>
            </button>

            {avatarUrl && (
              <button
                type="button"
                className="btn-avatar-action danger"
                onClick={handleRemoveImage}
                title="画像を解除して頭文字に戻す"
              >
                <RotateCcw size={12} />
                <span>戻す</span>
              </button>
            )}
          </div>

          <span className="avatar-picker-hint">
            {avatarUrl
              ? 'カスタム画像が設定されています（タップで変更可能）'
              : 'スマホの写真やイラスト画像に変更できます'}
          </span>
        </div>
      </div>

      {/* エラーメッセージ */}
      {errorMessage && (
        <div className="avatar-error-banner">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* プリセット選択パレット */}
      {activeTab === 'preset' && (
        <div className="avatar-tab-panel preset-panel slide-down">
          <div className="panel-header">
            <span className="panel-title">おすすめアバターから選択</span>
            <button
              type="button"
              className="btn-close-panel"
              onClick={() => setActiveTab(null)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="presets-grid">
            {PRESET_AVATARS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`preset-avatar-btn ${avatarUrl === item.url ? 'selected' : ''}`}
                onClick={() => handleSelectPreset(item.url)}
                title={item.label}
              >
                <img src={item.url} alt={item.label} className="preset-img" />
                {avatarUrl === item.url && (
                  <div className="preset-check-badge">
                    <Check size={10} color="#fff" strokeWidth={3} />
                  </div>
                )}
                <span className="preset-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* URL入力パネル */}
      {activeTab === 'url' && (
        <form onSubmit={handleApplyUrl} className="avatar-tab-panel url-panel slide-down">
          <div className="panel-header">
            <span className="panel-title">画像のWebリンク (URL) を指定</span>
            <button
              type="button"
              className="btn-close-panel"
              onClick={() => setActiveTab(null)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="url-input-group">
            <input
              type="url"
              className="form-input"
              placeholder="https://example.com/avatar.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!urlInput.trim()}
            >
              適用
            </button>
          </div>
        </form>
      )}

      {/* テーマカラー選択（背景色 / イニシャル用） */}
      <div className="avatar-color-section">
        <label className="color-section-label">
          テーマカラー <span className="color-section-sub">（画像未設定時や背景に使用）</span>
        </label>
        <div className="color-presets-row">
          {colorPresets.map((color) => (
            <button
              key={color}
              type="button"
              className={`color-dot-btn ${avatarColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onChangeColor(color)}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
