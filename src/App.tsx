import React, { useState, useEffect } from 'react';
import type { Trip } from './types/trip';
import { storageService } from './services/storage';
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
import './App.css';

export const App: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>(() => storageService.getTrips());
  const [activeTripId, setActiveTripId] = useState<string | null>(() => {
    // URLハッシュがある場合はそのIDを優先
    const hash = window.location.hash.replace('#', '');
    if (hash) return hash;
    return storageService.getActiveTripId();
  });
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // モーダル管理
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCalendarImportOpen, setIsCalendarImportOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // URLハッシュと同期
  useEffect(() => {
    if (activeTripId) {
      window.location.hash = activeTripId;
      storageService.setActiveTripId(activeTripId);
    } else {
      window.location.hash = '';
      storageService.setActiveTripId(null);
    }
  }, [activeTripId]);

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
      <CreateTripModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaveTrip={handleSaveNewTrip}
      />

      {/* しおり編集モーダル */}
      {activeTrip && (
        <CreateTripModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSaveTrip={handleUpdateTrip}
          initialTrip={activeTrip}
        />
      )}

      {/* Googleカレンダー連携・自動生成モーダル */}
      <GoogleCalendarImportModal
        isOpen={isCalendarImportOpen}
        onClose={() => setIsCalendarImportOpen(false)}
        onTripGenerated={(trip) => {
          setTrips(storageService.getTrips());
          setActiveTripId(trip.id);
          setActiveTab('timeline'); // 生成後はタイムラインをすぐ確認できるように
        }}
      />

      {/* 共有モーダル */}
      {activeTrip && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          trip={activeTrip}
        />
      )}
    </div>
  );
};
