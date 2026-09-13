import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Wifi,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { Modal } from './Modal';
import { firebaseService, parseFirebaseConfigInput, type FirebaseConfig } from '../../services/firebase';
import './CloudSyncModal.css';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [currentConfig, setCurrentConfig] = useState<FirebaseConfig | null>(null);
  const [inputConfigText, setInputConfigText] = useState('');
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = firebaseService.getConfig();
      setCurrentConfig(cfg);
      if (cfg) {
        setInputConfigText(JSON.stringify(cfg, null, 2));
      } else {
        setInputConfigText('');
      }
      setStatusMessage(null);
    }
  }, [isOpen]);

  const handleTestAndSave = async () => {
    setStatusMessage(null);
    let parsed: FirebaseConfig;
    try {
      parsed = parseFirebaseConfigInput(inputConfigText);
    } catch (e: any) {
      setStatusMessage({ text: e.message || '入力形式に誤りがあります', isError: true });
      return;
    }

    setTesting(true);
    try {
      const testResult = await firebaseService.testConnection(parsed);
      if (testResult.success) {
        await firebaseService.saveConfig(parsed);
        setCurrentConfig(parsed);
        setStatusMessage({ text: testResult.message, isError: false });
        onConfigChanged();
      } else {
        setStatusMessage({ text: testResult.message, isError: true });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `接続に失敗しました: ${err.message || '設定内容をご確認ください'}`,
        isError: true,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('クラウド同期を解除しますか？\n（作成したしおりデータは端末のLocalStorageに残ります）')) {
      await firebaseService.clearConfig();
      setCurrentConfig(null);
      setInputConfigText('');
      setStatusMessage({ text: 'クラウド同期を解除しました。現在は端末ローカル保存モードです。', isError: false });
      onConfigChanged();
    }
  };

  const handleResetDefault = async () => {
    await firebaseService.resetToDefault();
    const def = firebaseService.getConfig();
    setCurrentConfig(def);
    setInputConfigText(def ? JSON.stringify(def, null, 2) : '');
    setStatusMessage({ text: '本番推奨プロジェクト（tabinote-928f9）に復元しました！常時自動同期が有効です。', isError: false });
    onConfigChanged();
  };

  const isConnected = !!currentConfig;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="☁️ 常時自動同期（クラウド設定）" maxWidth="620px">
      <div className="cloud-sync-modal-body">
        {/* 現在の接続ステータス */}
        <div className={`cloud-sync-status-card ${isConnected ? 'connected' : ''}`}>
          <div className="cloud-sync-status-icon-wrapper">
            {isConnected ? (
              <Wifi size={24} color="#16a34a" />
            ) : (
              <Cloud size={24} color="#64748b" />
            )}
          </div>
          <div className="cloud-sync-status-info">
            <span className={`cloud-sync-status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '● リアルタイム自動同期中' : '○ 未接続（端末ローカル保存のみ）'}
            </span>
            <div className="cloud-sync-status-title">
              {isConnected
                ? `Firebaseプロジェクト: ${currentConfig.projectId}`
                : '常時同期が設定されていません'}
            </div>
            <div className="cloud-sync-status-desc">
              {isConnected ? (
                <span>
                  スマホとPC（
                  <Smartphone size={13} style={{ verticalAlign: 'middle' }} /> ↔{' '}
                  <Monitor size={13} style={{ verticalAlign: 'middle' }} />
                  ）で、予定の追加・編集やチェックが即座に自動反映されます。
                </span>
              ) : (
                'Firebaseを設定すると、スマホとPCで全く同じしおりを同時編集・リアルタイム同期できます。'
              )}
            </div>
          </div>
        </div>

        {/* 導入手順ガイド */}
        {!isConnected && (
          <div className="cloud-sync-guide-box">
            <div className="cloud-sync-guide-title">
              <CheckCircle2 size={16} color="#2563eb" />
              <span>Firebase（無料）の接続手順（3分で完了）</span>
            </div>
            <ol className="cloud-sync-guide-steps">
              <li>
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Firebaseコンソール <ExternalLink size={12} />
                </a>{' '}
                にGoogleアカウントでアクセスし、「プロジェクトを追加」を作成します（完全無料で使えます）。
              </li>
              <li>
                左メニューの「**Firestore Database**」を開き、「データベースの作成」を押します（テストモード推奨）。
              </li>
              <li>
                プロジェクトの設定画面（歯車マーク）で「Webアプリ（&lt;/&gt;）」を追加し、表示される <code>{'const firebaseConfig = { ... };'}</code> のコードを下の欄にそのまま貼り付けて「保存」を押します。
              </li>
            </ol>
          </div>
        )}

        {/* 入力フォーム */}
        <div className="cloud-sync-form-group">
          <label className="cloud-sync-form-label" htmlFor="firebase-config-input">
            Firebase設定コード（またはJSON）
          </label>
          <textarea
            id="firebase-config-input"
            className="cloud-sync-textarea"
            placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "my-trip-app",\n  appId: "1:..."\n};`}
            value={inputConfigText}
            onChange={(e) => setInputConfigText(e.target.value)}
            disabled={testing}
          />
          <span className="cloud-sync-input-hint">
            ※Firebaseコンソールの設定コードをそのままコピー＆ペーストできます。
          </span>
        </div>

        {/* ステータスメッセージ */}
        {statusMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: statusMessage.isError ? '#fef2f2' : '#f0fdf4',
              color: statusMessage.isError ? '#b91c1c' : '#15803d',
              border: `1px solid ${statusMessage.isError ? '#fca5a5' : '#86efac'}`,
            }}
          >
            {statusMessage.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* フッターアクション */}
        <div className="cloud-sync-actions">
          {!isConnected ? (
            <button
              type="button"
              className="cloud-sync-btn-save"
              style={{ background: '#16a34a' }}
              onClick={handleResetDefault}
              disabled={testing}
            >
              <RefreshCw size={15} />
              <span>本番推奨設定（自動同期）を有効化</span>
            </button>
          ) : (
            <button
              type="button"
              className="cloud-sync-btn-disconnect"
              onClick={handleDisconnect}
              disabled={testing}
            >
              <Trash2 size={15} />
              <span>同期解除（ローカルのみ）</span>
            </button>
          )}

          <button
            type="button"
            className="cloud-sync-btn-save"
            onClick={handleTestAndSave}
            disabled={testing || !inputConfigText.trim()}
          >
            {testing ? (
              <>
                <RefreshCw size={15} className="spin" />
                <span>接続確認中...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>{isConnected ? '設定を更新して再接続' : '接続テストして同期を開始'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
