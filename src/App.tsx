import React, { useState, useEffect } from 'react';
import type { Trip } from './types/trip';
import { storageService } from './services/storage';
import { shareService } from './services/shareService';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import type { TabType } from './components/layout/Navigation';
import { HomeView } from './components/home/HomeView';
import { CreateTripModal } from './components/home/CreateTripModal';
import { GoogleCalendarImportModal } from './components/home/GoogleCalendarImportModal';
import { TripOverviewTab } from './components/trip/TripOverviewTab';
import { TimelineTab } from './components/trip/TimelineTab';
import { PackingTab } from './components/trip/PackingTab';
import { SouvenirTab } from './components/trip/SouvenirTab';
import { ExpenseTab } from './components/trip/ExpenseTab';
import { ShareModal } from './components/trip/ShareModal';
import { Sparkles, X, AlertTriangle } from 'lucide-react';
import './App.css';

export const App: React.FC = () => {
  // 共有データ（#share=...）からの初回読み込み判定
  const initialShareResult = (() => {
    if (typeof window === 'undefined') return { trip: null, failed: false };
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('share=') || hash.includes('share=')) {
      const imported = shareService.parseShareDataFromUrl(window.location.href);
      if (imported) {
        storageService.saveTrip(imported);
        return { trip: imported, failed: false };
      }
      return { trip: null, failed: true };
    }
    return { trip: null, failed: false };
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
    // URLハッシュがある場合はそのIDを優先
    const hash = window.location.hash.replace('#', '');
    if (hash && !hash.startsWith('share=')) return hash;
    return storageService.getActiveTripId();
  });

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(() => {
    if (initialShareTrip) {
      return {
        message: `🎉 旅のしおり「${initialShareTrip.title}」を読み込み、端末に保存しました！`,
        type: 'success',
      };
    }
    if (initialShareResult.failed) {
      return {
        message: '⚠️ 共有しおりデータの読み込みに失敗しました。URLが途中で途切れていないかご確認ください。',
        type: 'error',
      };
    }
    return null;
  });

  // モーダル管理
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCalendarImportOpen, setIsCalendarImportOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

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

  // ブラウザ起動中の共有リンク読み込み（hashchange検知）
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('share=') || hash.includes('share=')) {
        const imported = shareService.parseShareDataFromUrl(window.location.href);
        if (imported) {
          storageService.saveTrip(imported);
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
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
  };

  // しおり作成
  const handleSaveNewTrip = (newTrip: Trip) => {
    storageService.saveTrip(newTrip);
    setTrips(storageService.getTrips());
    setActiveTripId(newTrip.id);
    setActiveTab('overview');
  };

  // しおり削除
  const handleDeleteTrip = (tripId: string) => {
    storageService.deleteTrip(tripId);
    setTrips(storageService.getTrips());
    if (activeTripId === tripId) {
      setActiveTripId(null);
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
        onBackToHome={() => {
          setActiveTripId(null);
          setActiveTab('overview');
        }}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenCalendarImport={() => setIsCalendarImportOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
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
          />
        ) : (
          <div className="trip-content-container fade-in">
            {activeTab === 'overview' && (
              <TripOverviewTab
                trip={activeTrip}
                onEditTrip={() => setIsEditOpen(true)}
                onUpdateTrip={handleUpdateTrip}
              />
            )}
            {activeTab === 'timeline' && (
              <TimelineTab
                trip={activeTrip}
                onUpdateTrip={handleUpdateTrip}
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

      {/* 共有モーダル */}
      {activeTrip && isShareOpen && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          trip={activeTrip}
        />
      )}
    </div>
  );
};
