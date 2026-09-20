import React, { useState, useEffect } from 'react';
import type { Trip } from './types/trip';
import { storageService } from './services/storage';
import { shareService } from './services/shareService';
import { firebaseService } from './services/firebase';
import { firestoreSync } from './services/firestoreSync';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import type { TabType } from './components/layout/Navigation';
import { HomeView } from './components/home/HomeView';
import { CreateTripModal } from './components/home/CreateTripModal';
import { GoogleCalendarImportModal } from './components/home/GoogleCalendarImportModal';
import { GoogleCalendarUpdateModal } from './components/trip/GoogleCalendarUpdateModal';
import { TripOverviewTab } from './components/trip/TripOverviewTab';
import { TimelineTab } from './components/trip/TimelineTab';
import { PackingTab } from './components/trip/PackingTab';
import { SouvenirTab } from './components/trip/SouvenirTab';
import { ExpenseTab } from './components/trip/ExpenseTab';
import { ShareModal } from './components/trip/ShareModal';
import { PrintPreviewModal } from './components/trip/PrintPreviewModal';
import { CloudSyncModal } from './components/common/CloudSyncModal';
import { Sparkles, X, AlertTriangle } from 'lucide-react';
import './App.css';

// 画面が真っ白になるのを防ぐエラーバウンダリ
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('AppErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', maxWidth: '600px', margin: '40px auto', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '12px' }}>⚠️ 予期せぬエラーが発生しました</h2>
          <p style={{ color: '#4b5563', fontSize: '0.9rem', marginBottom: '16px' }}>
            {this.state.error?.message || '不明なエラーが発生しました'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onReset) this.props.onReset();
              else window.location.reload();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            画面を再読み込みして復旧
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  // 共有データ（#share=... または ?share=...）からの初回読み込み判定
  const initialShareResult = (() => {
    if (typeof window === 'undefined') return { trip: null, failed: false, missingId: null };
    const fullHref = window.location.href;
    if (fullHref.includes('share=')) {
      const imported = shareService.parseShareDataFromUrl(fullHref);
      if (imported) {
        storageService.saveTrip(imported);
        return { trip: imported, failed: false, missingId: null };
      }
      return { trip: null, failed: true, missingId: null };
    }

    // もし#trip-xxxのID直接指定でアクセスされたが端末に存在しない場合を検出
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && !hash.startsWith('share=')) {
      const existing = storageService.getTripById(hash);
      if (!existing) {
        return { trip: null, failed: false, missingId: hash };
      }
    }

    return { trip: null, failed: false, missingId: null };
  })();

  const initialShareTrip = initialShareResult.trip;

  const [trips, setTrips] = useState<Trip[]>(() => {
    const loaded = storageService.getTrips();
    if (initialShareTrip && !loaded.some((t) => t.id === initialShareTrip.id)) {
      return [initialShareTrip, ...loaded];
    }
    return loaded;
  });

  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    if (initialShareTrip) return initialShareTrip.id;
    // URLハッシュがある場合はそのIDを優先（ただし端末内に存在する場合のみ）
    const hash = window.location.hash.replace('#', '').trim();
    if (hash && !hash.startsWith('share=')) {
      const exists = storageService.getTripById(hash);
      if (exists) return hash;
    }
    return storageService.getActiveTripId();
  });

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(() => {
    if (initialShareTrip) {
      return {
        message: `🎉 旅のしおり「${initialShareTrip.title}」を読み込み、端末に自動保存しました！`,
        type: 'success',
      };
    }
    if (initialShareResult.failed) {
      return {
        message: '⚠️ 共有しおりデータの読み込みに失敗しました。URLが途中で途切れていないかご確認ください。',
        type: 'error',
      };
    }
    if (initialShareResult.missingId) {
      return {
        message: `⚠️ 指定されたしおりは、この端末にまだ保存されていません。作成者に「共有リンク」または「QRコード」を発行してもらってください。`,
        type: 'error',
      };
    }
    return null;
  });

  // クラウド常時同期管理
  const [isCloudConnected, setIsCloudConnected] = useState(() => firebaseService.isConfigured());
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isSyncingAllCloud, setIsSyncingAllCloud] = useState(false);

  // クラウド全しおり同期・復元処理
  const syncAllTrips = async (showToast = false) => {
    if (!firebaseService.isConfigured()) return;
    setIsSyncingAllCloud(true);
    try {
      const currentLocal = storageService.getTrips();
      const deletedIds = storageService.getDeletedTripIds();
      const result = await firestoreSync.syncAllTripsWithCloud(currentLocal, deletedIds);

      // マージ結果をローカルに反映
      storageService.saveTrips(result.mergedTrips);
      setTrips(result.mergedTrips);

      if (result.addedCount > 0) {
        setToast({
          message: `☁️ クラウドから ${result.addedCount} 件のしおりを同期・復元しました！`,
          type: 'success',
        });
      } else if (showToast) {
        setToast({
          message: '☁️ クラウドと同期しました（最新の状態です）',
          type: 'success',
        });
      }
    } catch (e) {
      console.error('Failed to sync all trips with cloud:', e);
      if (showToast) {
        setToast({
          message: '⚠️ クラウド同期中にエラーが発生しました',
          type: 'error',
        });
      }
    } finally {
      setIsSyncingAllCloud(false);
    }
  };

  // 初回マウント時およびクラウド接続状態変更時の自動同期
  useEffect(() => {
    if (isCloudConnected) {
      syncAllTrips(false);
    }
  }, [isCloudConnected]);

  // クラウド同期設定が変化した際の自動初期化
  const handleCloudConfigChanged = () => {
    const configured = firebaseService.isConfigured();
    setIsCloudConnected(configured);
    if (configured) {
      if (activeTrip) {
        firestoreSync.saveTripToCloud(activeTrip);
      }
      syncAllTrips(true);
      setToast({
        message: '☁️ クラウド常時自動同期が有効化されました！',
        type: 'success',
      });
    }
  };

  // モーダル管理
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCalendarImportOpen, setIsCalendarImportOpen] = useState(false);
  const [isCalendarUpdateOpen, setIsCalendarUpdateOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // URLハッシュと同期
  useEffect(() => {
    if (activeTripId) {
      if (window.location.hash.startsWith('#share=')) {
        window.history.replaceState(null, '', window.location.pathname + '#' + activeTripId);
      } else {
        window.location.hash = activeTripId;
      }
      storageService.setActiveTripId(activeTripId);
    } else {
      if (!window.location.hash.startsWith('#share=')) {
        window.location.hash = '';
      }
      storageService.setActiveTripId(null);
    }
  }, [activeTripId]);

  // クラウドからの初回または未所持しおり自動フェッチ
  useEffect(() => {
    if (isCloudConnected && initialShareResult.missingId) {
      const missingId = initialShareResult.missingId;
      firestoreSync.fetchTripFromCloud(missingId).then((remoteTrip) => {
        if (remoteTrip) {
          storageService.saveTrip(remoteTrip);
          setTrips(storageService.getTrips());
          setActiveTripId(remoteTrip.id);
          setActiveTab('overview');
          setToast({
            message: `🎉 クラウドからしおり「${remoteTrip.title}」を読み込みました！`,
            type: 'success',
          });
        }
      });
    }
  }, [isCloudConnected, initialShareResult.missingId]);

  // アクティブなしおりのリアルタイム自動同期（他端末での編集を即時受信）
  useEffect(() => {
    if (!isCloudConnected || !activeTripId) return;

    const unsubscribe = firestoreSync.subscribeTrip(
      activeTripId,
      (remoteTrip) => {
        // リモートで更新されたデータを受け取ったら、ローカルstorageとstateを更新
        storageService.saveTrip(remoteTrip);
        setTrips((prevTrips) => {
          const idx = prevTrips.findIndex((t) => t.id === remoteTrip.id);
          if (idx >= 0) {
            const updated = [...prevTrips];
            updated[idx] = remoteTrip;
            return updated;
          }
          return [remoteTrip, ...prevTrips];
        });
      },
      (err) => {
        console.warn('Realtime sync subscription warning:', err);
      }
    );

    return () => unsubscribe();
  }, [activeTripId, isCloudConnected]);

  // ブラウザ起動中の共有リンク読み込み（hashchange検知）
  useEffect(() => {
    const handleHashChange = async () => {
      const fullHref = window.location.href;
      if (fullHref.includes('share=')) {
        const imported = shareService.parseShareDataFromUrl(fullHref);
        if (imported) {
          storageService.saveTrip(imported);
          if (isCloudConnected) {
            firestoreSync.saveTripToCloud(imported);
          }
          setTrips(storageService.getTrips());
          setActiveTripId(imported.id);
          setActiveTab('overview');
          window.history.replaceState(null, '', window.location.pathname + '#' + imported.id);
          setToast({
            message: `🎉 旅のしおり「${imported.title}」を読み込み、端末に保存しました！`,
            type: 'success',
          });
        } else {
          setToast({
            message: '⚠️ 共有しおりデータの読み込みに失敗しました。URLが途中で途切れていないかご確認ください。',
            type: 'error',
          });
        }
      } else {
        const hash = window.location.hash.replace('#', '').trim();
        if (hash) {
          const localTrip = storageService.getTripById(hash);
          if (localTrip) {
            setActiveTripId(hash);
          } else if (isCloudConnected) {
            // クラウドから取得を試行
            const remoteTrip = await firestoreSync.fetchTripFromCloud(hash);
            if (remoteTrip) {
              storageService.saveTrip(remoteTrip);
              setTrips(storageService.getTrips());
              setActiveTripId(remoteTrip.id);
              setActiveTab('overview');
            }
          }
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isCloudConnected]);

  // トースト自動非表示タイマー（成功は5秒、エラーは7秒後）
  useEffect(() => {
    if (toast) {
      const duration = toast.type === 'error' ? 7000 : 5000;
      const timer = setTimeout(() => {
        setToast(null);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const activeTrip = trips.find((t) => t.id === activeTripId) || null;

  // しおり更新
  const handleUpdateTrip = (updatedTrip: Trip) => {
    storageService.saveTrip(updatedTrip);
    setTrips(storageService.getTrips());
    if (isCloudConnected) {
      firestoreSync.saveTripToCloud(updatedTrip);
    }
  };

  // Googleカレンダー同期によるしおり更新完了時ハンドラー
  const handleTripUpdatedFromCalendar = (
    updatedTrip: Trip,
    summary: { addedCount: number; skippedCount: number; expandedDaysCount: number }
  ) => {
    handleUpdateTrip(updatedTrip);
    let msg = `📅 Googleカレンダーから ${summary.addedCount} 件の予定を反映しました！`;
    if (summary.skippedCount > 0) {
      msg += `（重複スキップ: ${summary.skippedCount}件）`;
    }
    if (summary.expandedDaysCount > 0) {
      msg += `（日程 +${summary.expandedDaysCount}日拡張）`;
    }
    setToast({
      message: msg,
      type: 'success',
    });
  };

  // しおり作成
  const handleSaveNewTrip = (newTrip: Trip) => {
    storageService.saveTrip(newTrip);
    setTrips(storageService.getTrips());
    setActiveTripId(newTrip.id);
    setActiveTab('overview');
    if (isCloudConnected) {
      firestoreSync.saveTripToCloud(newTrip);
    }
  };

  // しおり削除
  const handleDeleteTrip = (tripId: string) => {
    storageService.deleteTrip(tripId);
    setTrips(storageService.getTrips());
    if (activeTripId === tripId) {
      setActiveTripId(null);
    }
    if (isCloudConnected) {
      firestoreSync.deleteTripFromCloud(tripId);
    }
  };

  // JSONインポート
  const handleImportJson = (jsonString: string) => {
    try {
      const imported = storageService.importTripFromJson(jsonString);
      setTrips(storageService.getTrips());
      setActiveTripId(imported.id);
      setActiveTab('overview');
      alert(`「${imported.title}」を正常にインポートしました！`);
    } catch (e: any) {
      alert('しおりのインポートに失敗しました: ' + (e.message || ''));
    }
  };

  // 未完了持ち物数
  const packingUnchecked =
    activeTrip?.packingList?.filter((p) => !p.isChecked).length || 0;

  return (
    <div className="app-root">
      <Header
        activeTrip={activeTrip}
        isCloudConnected={isCloudConnected}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onBackToHome={() => {
          setActiveTripId(null);
          setActiveTab('overview');
        }}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenCalendarImport={() => setIsCalendarImportOpen(true)}
        onOpenCalendarUpdate={() => setIsCalendarUpdateOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenPrint={() => setIsPrintOpen(true)}
      />

      {/* 共有読み込み完了 / エラートースト */}
      {toast && (
        <aside
          className={`shared-toast-banner slide-down ${toast.type === 'error' ? 'error' : ''}`}
          aria-label="通知"
        >
          <div className="toast-content">
            {toast.type === 'error' ? (
              <AlertTriangle size={18} className="toast-icon" />
            ) : (
              <Sparkles size={18} className="toast-icon" />
            )}
            <span className="toast-text">{toast.message}</span>
          </div>
          <button
            className="toast-close-btn"
            onClick={() => setToast(null)}
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </aside>
      )}

      {activeTrip && (
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          packingUncheckedCount={packingUnchecked}
        />
      )}

      <main className="app-main-content">
        {!activeTrip ? (
          <HomeView
            trips={trips}
            onSelectTrip={(id) => {
              setActiveTripId(id);
              setActiveTab('overview');
            }}
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenCalendarImport={() => setIsCalendarImportOpen(true)}
            onDeleteTrip={handleDeleteTrip}
            onImportJson={handleImportJson}
            isCloudConnected={isCloudConnected}
            onSyncCloud={() => syncAllTrips(true)}
            isSyncingCloud={isSyncingAllCloud}
          />
        ) : (
          <div className="trip-content-container fade-in">
            {activeTab === 'overview' && (
              <TripOverviewTab
                trip={activeTrip}
                onEditTrip={() => setIsEditOpen(true)}
                onUpdateTrip={handleUpdateTrip}
                onOpenPrint={() => setIsPrintOpen(true)}
                onOpenCalendarUpdate={() => setIsCalendarUpdateOpen(true)}
              />
            )}
            {activeTab === 'timeline' && (
              <TimelineTab
                trip={activeTrip}
                onUpdateTrip={handleUpdateTrip}
                onOpenCalendarUpdate={() => setIsCalendarUpdateOpen(true)}
              />
            )}
            {activeTab === 'packing' && (
              <PackingTab
                trip={activeTrip}
                onUpdateTrip={handleUpdateTrip}
              />
            )}
            {activeTab === 'souvenirs' && (
              <SouvenirTab
                trip={activeTrip}
                onUpdateTrip={handleUpdateTrip}
              />
            )}
            {activeTab === 'expenses' && (
              <ExpenseTab
                trip={activeTrip}
                onUpdateTrip={handleUpdateTrip}
              />
            )}
          </div>
        )}
      </main>

      {/* 新規しおり作成モーダル */}
      {isCreateOpen && (
        <CreateTripModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSaveTrip={handleSaveNewTrip}
        />
      )}

      {/* しおり編集モーダル */}
      {activeTrip && isEditOpen && (
        <CreateTripModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSaveTrip={handleUpdateTrip}
          initialTrip={activeTrip}
        />
      )}

      {/* Googleカレンダー連携・自動生成モーダル */}
      {isCalendarImportOpen && (
        <GoogleCalendarImportModal
          isOpen={isCalendarImportOpen}
          onClose={() => setIsCalendarImportOpen(false)}
          onTripGenerated={(trip) => {
            setTrips(storageService.getTrips());
            setActiveTripId(trip.id);
            setActiveTab('timeline'); // 生成後はタイムラインをすぐ確認できるように
          }}
        />
      )}

      {/* 作成済みしおりのGoogleカレンダー同期・アップデートモーダル */}
      {activeTrip && isCalendarUpdateOpen && (
        <GoogleCalendarUpdateModal
          isOpen={isCalendarUpdateOpen}
          onClose={() => setIsCalendarUpdateOpen(false)}
          trip={activeTrip}
          onTripUpdated={handleTripUpdatedFromCalendar}
        />
      )}

      {/* 共有モーダル */}
      {activeTrip && isShareOpen && (
        <AppErrorBoundary onReset={() => setIsShareOpen(false)}>
          <ShareModal
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            trip={activeTrip}
            onOpenPrint={() => setIsPrintOpen(true)}
            isCloudConnected={isCloudConnected}
            onOpenCloudSync={() => {
              setIsShareOpen(false);
              setIsCloudSyncOpen(true);
            }}
          />
        </AppErrorBoundary>
      )}

      {/* しおりPDF作成 / 印刷プレビューモーダル */}
      {activeTrip && isPrintOpen && (
        <AppErrorBoundary onReset={() => setIsPrintOpen(false)}>
          <PrintPreviewModal
            isOpen={isPrintOpen}
            onClose={() => setIsPrintOpen(false)}
            trip={activeTrip}
          />
        </AppErrorBoundary>
      )}

      {/* クラウド常時自動同期 設定モーダル */}
      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        onConfigChanged={handleCloudConfigChanged}
      />
    </div>
  );
};
