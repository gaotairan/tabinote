import React from 'react';
import {
  Info,
  Clock,
  CheckSquare,
  Gift,
  Coins,
} from 'lucide-react';
import './Navigation.css';

export type TabType = 'overview' | 'timeline' | 'packing' | 'souvenirs' | 'expenses';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  packingUncheckedCount?: number;
  souvenirsCount?: number;
  expensesCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  packingUncheckedCount = 0,
}) => {
  const tabs = [
    { id: 'overview' as TabType, label: '概要', icon: Info },
    { id: 'timeline' as TabType, label: 'スケジュール', icon: Clock },
    {
      id: 'packing' as TabType,
      label: '持ち物',
      icon: CheckSquare,
      badge: packingUncheckedCount > 0 ? packingUncheckedCount : undefined,
    },
    { id: 'souvenirs' as TabType, label: 'お土産・Wish', icon: Gift },
    { id: 'expenses' as TabType, label: '割り勘精算', icon: Coins },
  ];

  return (
    <>
      {/* PC・タブレット向け ナビゲーションバー */}
      <nav className="desktop-nav" aria-label="メインナビゲーション">
        <div className="desktop-nav-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`desktop-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="nav-badge">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* スマホ向け ボトムナビゲーションバー */}
      <nav className="bottom-nav glass-effect" aria-label="モバイルナビゲーション">
        <div className="bottom-nav-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="bottom-nav-icon-wrap">
                  <Icon size={20} />
                  {tab.badge !== undefined && (
                    <span className="bottom-nav-badge">{tab.badge}</span>
                  )}
                </div>
                <span className="bottom-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
