import { initializeApp, getApps, getApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
  doc,
  getDoc,
} from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

const STORAGE_KEY_FIREBASE_CONFIG = 'tabiori_firebase_config_v1';

let cachedDb: Firestore | null = null;
let cachedApp: FirebaseApp | null = null;

/**
 * テキストからFirebase Configをパース（JSONまたはJSオブジェクトのコピペに対応）
 */
export function parseFirebaseConfigInput(rawInput: string): FirebaseConfig {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('設定が入力されていません');
  }

  // もし "const firebaseConfig = { ... };" のようなコードブロックが貼り付けられた場合
  let jsonCandidate = trimmed;
  if (jsonCandidate.includes('{') && jsonCandidate.includes('}')) {
    const startIndex = jsonCandidate.indexOf('{');
    const endIndex = jsonCandidate.lastIndexOf('}');
    jsonCandidate = jsonCandidate.slice(startIndex, endIndex + 1);
  }

  // キーにクォートがないJSオブジェクト表現をJSON化できるように補正
  let parsed: any;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    try {
      // 簡易的なJSオブジェクト表記（apiKey: "xxx" 等）をJSON風に変換してパース
      const relaxedJson = jsonCandidate
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2": ')
        .replace(/'/g, '"')
        .replace(/,\s*}/g, '}');
      parsed = JSON.parse(relaxedJson);
    } catch {
      throw new Error('Firebase設定の形式が無効です。JSONまたはFirebaseコンソールの設定コードを貼り付けてください。');
    }
  }

  if (!parsed.apiKey || !parsed.projectId) {
    throw new Error('apiKey と projectId は必須項目です');
  }

  return {
    apiKey: String(parsed.apiKey).trim(),
    authDomain: parsed.authDomain ? String(parsed.authDomain).trim() : undefined,
    projectId: String(parsed.projectId).trim(),
    storageBucket: parsed.storageBucket ? String(parsed.storageBucket).trim() : undefined,
    messagingSenderId: parsed.messagingSenderId ? String(parsed.messagingSenderId).trim() : undefined,
    appId: parsed.appId ? String(parsed.appId).trim() : '',
    measurementId: parsed.measurementId ? String(parsed.measurementId).trim() : undefined,
  };
}

// 本番用デフォルトFirebase設定（初期状態から何もしなくても常時自動同期が動作）
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: 'AIzaSyBQg1WZ0-5hBktbYNlemX0WombtUmvzTzs',
  authDomain: 'tabinote-928f9.firebaseapp.com',
  projectId: 'tabinote-928f9',
  storageBucket: 'tabinote-928f9.firebasestorage.app',
  messagingSenderId: '939318087265',
  appId: '1:939318087265:web:eb7bd3e048de393157a420',
  measurementId: 'G-CV4LDQ1Q14',
};

export const firebaseService = {
  /**
   * 現在のFirebase設定を取得（LocalStorage > 環境変数 > 本番デフォルト設定）
   */
  getConfig(): FirebaseConfig | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
      if (saved) {
        // "disabled" と明示的に解除された場合
        if (saved === '"disabled"') return null;
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse saved firebase config:', e);
    }

    // 環境変数フォールバック
    const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (envApiKey && envProjectId) {
      return {
        apiKey: envApiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: envProjectId,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      };
    }

    // 本番デフォルト設定
    return DEFAULT_FIREBASE_CONFIG;
  },

  /**
   * 設定を保存して初期化キャッシュをリセット
   */
  async saveConfig(config: FirebaseConfig): Promise<void> {
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
    await this.reset();
  },

  /**
   * 設定を無効化（ローカル単独モードへ切り替え）
   */
  async clearConfig(): Promise<void> {
    localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, '"disabled"');
    await this.reset();
  },

  /**
   * 本番推奨デフォルト設定にリセット
   */
  async resetToDefault(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY_FIREBASE_CONFIG);
    await this.reset();
  },

  /**
   * クラウド同期が有効（設定済み）かどうか
   */
  isConfigured(): boolean {
    return this.getConfig() !== null;
  },

  /**
   * Firestoreインスタンスを取得
   */
  getFirestoreDb(): Firestore | null {
    if (cachedDb) return cachedDb;

    const config = this.getConfig();
    if (!config) return null;

    try {
      const app = getApps().length === 0 ? initializeApp(config) : getApp();
      cachedApp = app;

      try {
        // オフラインキャッシュと複数タブ同期を有効化
        cachedDb = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch (cacheErr) {
        // すでに初期化済み等の場合は既存を取得
        cachedDb = getFirestore(app);
      }

      return cachedDb;
    } catch (e) {
      console.error('Failed to initialize Firebase / Firestore:', e);
      return null;
    }
  },

  /**
   * キャッシュされたアプリ・DBを安全にリセット
   */
  async reset(): Promise<void> {
    cachedDb = null;
    if (cachedApp) {
      try {
        await deleteApp(cachedApp);
      } catch (e) {
        console.warn('Failed to delete firebase app during reset:', e);
      }
      cachedApp = null;
    }
  },

  /**
   * Firebase/Firestoreへの接続テスト
   */
  async testConnection(config: FirebaseConfig): Promise<{ success: boolean; message: string }> {
    const testAppName = `test-app-${Date.now()}`;
    let testApp: FirebaseApp | null = null;
    try {
      testApp = initializeApp(config, testAppName);
      const testDb = getFirestore(testApp);
      // __test_connection__ ドキュメントの読み取り試行
      const testRef = doc(testDb, '_healthcheck_', 'ping');
      await getDoc(testRef);
      return {
        success: true,
        message: 'Firebase Firestoreへの接続に成功しました！常時自動同期を利用できます。',
      };
    } catch (err: any) {
      console.error('Firebase test connection failed:', err);
      // パーミッションエラー（permission-denied）なら接続自体は確立している
      if (err?.code === 'permission-denied') {
        return {
          success: true,
          message: 'Firebaseへの接続は確認できましたが、Firestoreのセキュリティルールで拒否されました。firestore.rulesの設定をご確認ください。',
        };
      }
      return {
        success: false,
        message: `接続に失敗しました: ${err?.message || '設定内容をご確認ください'}`,
      };
    } finally {
      if (testApp) {
        try {
          await deleteApp(testApp);
        } catch {
          // ignore
        }
      }
    }
  },
};
