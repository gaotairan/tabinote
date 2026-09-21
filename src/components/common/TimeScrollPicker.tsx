import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock,
  Sun,
  Coffee,
  Moon,
  Sparkles,
  X,
  Keyboard,
  Sliders,
} from 'lucide-react';
import './TimeScrollPicker.css';

interface TimeScrollPickerProps {
  startTime: string; // 例: "10:00" または "終日"
  endTime: string; // 例: "11:30" または ""
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
}

const ITEM_HEIGHT = 40; // 1アイテムの高さ (px)
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_30 = ['00', '30'];
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const MINUTES_1 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

type MinuteStep = 1 | 5 | 30;

export const TimeScrollPicker: React.FC<TimeScrollPickerProps> = ({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
}) => {
  // 'start' | 'end' どちらの時間を編集しているか
  const [activeTarget, setActiveTarget] = useState<'start' | 'end'>('start');

  // 分の刻みステップ (1分 / 5分 / 30分)
  const [minuteStep, setMinuteStep] = useState<MinuteStep>(5);

  // 直接手入力モードの切り替え
  const [isManualInput, setIsManualInput] = useState(false);

  const hoursListRef = useRef<HTMLDivElement>(null);
  const minutesListRef = useRef<HTMLDivElement>(null);

  // スクロール検知中のイベントループ抑止フラグ
  const isProgrammaticScrollRef = useRef(false);

  const isAllDay = startTime === '終日';

  // 現在編集対象の時刻から「時」「分」を抽出
  const currentTargetValue = activeTarget === 'start' ? (isAllDay ? '10:00' : startTime) : endTime;

  const parseTime = (timeStr: string) => {
    if (!timeStr || timeStr === '終日') return { hour: '10', minute: '00' };
    const parts = timeStr.split(':');
    const h = parts[0] ? parts[0].padStart(2, '0') : '10';
    const m = parts[1] ? parts[1].padStart(2, '0') : '00';
    return { hour: h, minute: m };
  };

  const { hour: currentHour, minute: currentMinute } = parseTime(currentTargetValue);

  const minutesList = minuteStep === 1 ? MINUTES_1 : minuteStep === 30 ? MINUTES_30 : MINUTES_5;

  // 指定の時・分にリストをスクロール
  const scrollToValues = useCallback((h: string, m: string, smooth = true) => {
    isProgrammaticScrollRef.current = true;

    const hIndex = HOURS.indexOf(h);
    if (hIndex !== -1 && hoursListRef.current) {
      hoursListRef.current.scrollTo({
        top: hIndex * ITEM_HEIGHT,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }

    // 分のインデックスを見つける（5分刻みの場合は近似値）
    let mIndex = minutesList.indexOf(m);
    if (mIndex === -1) {
      // 最も近い分を選択
      const numM = parseInt(m, 10) || 0;
      let closestDiff = 999;
      let closestIdx = 0;
      minutesList.forEach((val, idx) => {
        const diff = Math.abs(parseInt(val, 10) - numM);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = idx;
        }
      });
      mIndex = closestIdx;
    }

    if (mIndex !== -1 && minutesListRef.current) {
      minutesListRef.current.scrollTo({
        top: mIndex * ITEM_HEIGHT,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 350);
  }, [minutesList]);

  // activeTargetが変わった時、またはminuteStepが変わった時にスクロール位置を同期
  useEffect(() => {
    if (isAllDay && activeTarget === 'start') return;
    if (activeTarget === 'end' && !endTime) return;
    const timer = setTimeout(() => {
      scrollToValues(currentHour, currentMinute, false);
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTarget, minuteStep, scrollToValues]);

  // 分の刻みステップ切り替え
  const handleMinuteStepChange = (step: MinuteStep) => {
    setMinuteStep(step);
    if (step === 30) {
      // 30分単位に切り替えた場合、00または30に補正
      const numM = parseInt(currentMinute, 10) || 0;
      const roundedM = numM < 15 ? '00' : numM < 45 ? '30' : '00';
      if (roundedM !== currentMinute) {
        updateTime(currentHour, roundedM);
        setTimeout(() => scrollToValues(currentHour, roundedM, true), 50);
      }
    } else if (step === 5) {
      // 5分単位に切り替えた場合、直近の5分刻みに丸める
      const numM = parseInt(currentMinute, 10) || 0;
      let rounded = Math.round(numM / 5) * 5;
      if (rounded === 60) rounded = 55;
      const roundedM = String(rounded).padStart(2, '0');
      if (roundedM !== currentMinute) {
        updateTime(currentHour, roundedM);
        setTimeout(() => scrollToValues(currentHour, roundedM, true), 50);
      }
    }
  };

  // スクロール停止検知用タイマー
  const hourScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateTime = (h: string, m: string) => {
    const formatted = `${h}:${m}`;
    if (activeTarget === 'start') {
      onStartTimeChange(formatted);
    } else {
      onEndTimeChange(formatted);
    }
  };

  const handleHourScroll = () => {
    if (isProgrammaticScrollRef.current || !hoursListRef.current) return;
    if (hourScrollTimeoutRef.current) clearTimeout(hourScrollTimeoutRef.current);

    hourScrollTimeoutRef.current = setTimeout(() => {
      if (!hoursListRef.current) return;
      const scrollTop = hoursListRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(HOURS.length - 1, index));
      const selectedH = HOURS[clampedIndex];

      if (selectedH && selectedH !== currentHour) {
        updateTime(selectedH, currentMinute);
      }
    }, 80);
  };

  const handleMinuteScroll = () => {
    if (isProgrammaticScrollRef.current || !minutesListRef.current) return;
    if (minuteScrollTimeoutRef.current) clearTimeout(minuteScrollTimeoutRef.current);

    minuteScrollTimeoutRef.current = setTimeout(() => {
      if (!minutesListRef.current) return;
      const scrollTop = minutesListRef.current.scrollTop;
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(minutesList.length - 1, index));
      const selectedM = minutesList[clampedIndex];

      if (selectedM && selectedM !== currentMinute) {
        updateTime(currentHour, selectedM);
      }
    }, 80);
  };

  const handleSelectHour = (h: string) => {
    updateTime(h, currentMinute);
    scrollToValues(h, currentMinute, true);
  };

  const handleSelectMinute = (m: string) => {
    updateTime(currentHour, m);
    scrollToValues(currentHour, m, true);
  };

  // プリセット時間設定
  const handleSetPreset = (timeStr: string) => {
    if (activeTarget === 'start') {
      onStartTimeChange(timeStr);
    } else {
      onEndTimeChange(timeStr);
    }
    const { hour: h, minute: m } = parseTime(timeStr);
    scrollToValues(h, m, true);
  };

  // 開始時間からの相対加算 (終了時間用: +30分, +1時間, +2時間など)
  const handleAddRelativeTime = (addMinutes: number) => {
    const baseTimeStr = isAllDay ? '10:00' : startTime || '10:00';
    const { hour: baseH, minute: baseM } = parseTime(baseTimeStr);
    const totalMinutes = (parseInt(baseH, 10) * 60 + parseInt(baseM, 10) + addMinutes) % (24 * 60);
    const nextH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const nextM = String(totalMinutes % 60).padStart(2, '0');
    const formatted = `${nextH}:${nextM}`;
    onEndTimeChange(formatted);
    scrollToValues(nextH, nextM, true);
  };

  // 現在時刻にセット
  const handleSetCurrentTime = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    // 5分刻みに丸める
    let m = Math.round(now.getMinutes() / 5) * 5;
    if (m === 60) m = 55;
    const mStr = String(m).padStart(2, '0');
    const formatted = `${h}:${mStr}`;
    if (activeTarget === 'start') {
      onStartTimeChange(formatted);
    } else {
      onEndTimeChange(formatted);
    }
    scrollToValues(h, mStr, true);
  };

  return (
    <div className="time-scroll-picker-container">
      {/* 上部: 開始時間 / 終了時間の切り替えカード */}
      <div className="time-target-toggle-row">
        <button
          type="button"
          className={`time-target-card ${activeTarget === 'start' ? 'active' : ''}`}
          onClick={() => {
            setActiveTarget('start');
            if (startTime && startTime !== '終日') {
              const { hour: h, minute: m } = parseTime(startTime);
              setTimeout(() => scrollToValues(h, m, false), 50);
            }
          }}
        >
          <div className="time-target-label">
            <Clock size={14} />
            <span>開始時間</span>
          </div>
          <div className="time-target-value">
            {startTime || '10:00'}
          </div>
        </button>

        <div className="time-target-arrow">→</div>

        <button
          type="button"
          className={`time-target-card ${activeTarget === 'end' ? 'active' : ''}`}
          onClick={() => {
            setActiveTarget('end');
            if (endTime) {
              const { hour: h, minute: m } = parseTime(endTime);
              setTimeout(() => scrollToValues(h, m, false), 50);
            } else {
              // 終了時間が空の場合、開始時刻 + 1時間をデフォルト提案
              handleAddRelativeTime(60);
            }
          }}
        >
          <div className="time-target-label">
            <Clock size={14} />
            <span>終了時間 (任意)</span>
          </div>
          <div className="time-target-value">
            {endTime ? endTime : <span className="time-placeholder">設定なし</span>}
          </div>
        </button>
      </div>

      {/* 終日モードの特別表示 (開始時間選択時) */}
      {activeTarget === 'start' && isAllDay ? (
        <div className="allday-active-panel">
          <div className="allday-banner">
            <Sun size={20} className="allday-sun-icon" />
            <div>
              <div className="allday-title">終日の予定</div>
              <div className="allday-subtitle">特定の時刻を指定せず、タイムラインの上部に表示されます</div>
            </div>
          </div>
          <button
            type="button"
            className="btn-exit-allday"
            onClick={() => {
              onStartTimeChange('10:00');
              setTimeout(() => scrollToValues('10', '00', false), 50);
            }}
          >
            時刻を指定する (10:00〜)
          </button>
        </div>
      ) : activeTarget === 'end' && !endTime ? (
        /* 終了時間が未設定の場合 */
        <div className="no-endtime-panel">
          <p className="no-endtime-desc">終了時間は未設定です（任意）</p>
          <div className="endtime-quick-actions">
            <button
              type="button"
              className="btn-set-endtime"
              onClick={() => handleAddRelativeTime(30)}
            >
              +30分後に設定
            </button>
            <button
              type="button"
              className="btn-set-endtime primary"
              onClick={() => handleAddRelativeTime(60)}
            >
              +1時間後に設定
            </button>
            <button
              type="button"
              className="btn-set-endtime"
              onClick={() => handleAddRelativeTime(120)}
            >
              +2時間後に設定
            </button>
          </div>
        </div>
      ) : isManualInput ? (
        /* 手動入力モード */
        <div className="manual-time-input-panel">
          <div className="manual-time-row">
            <label>時刻を直接入力:</label>
            <input
              type="text"
              className="form-input manual-input-field"
              value={activeTarget === 'start' ? startTime : endTime}
              onChange={(e) => {
                if (activeTarget === 'start') {
                  onStartTimeChange(e.target.value);
                } else {
                  onEndTimeChange(e.target.value);
                }
              }}
              placeholder="例: 14:00"
            />
          </div>
          <button
            type="button"
            className="btn-switch-scroll"
            onClick={() => setIsManualInput(false)}
          >
            <Sliders size={14} />
            <span>スクロール選択に戻す</span>
          </button>
        </div>
      ) : (
        /* ドラムロール・スクロールピッカー本体 */
        <div className="wheel-picker-section">
          <div className="wheel-picker-wrapper">
            {/* 中央ハイライトレンズ */}
            <div className="wheel-highlight-lens" />
            {/* 上下のグラデーションシャドウ */}
            <div className="wheel-mask-top" />
            <div className="wheel-mask-bottom" />

            {/* 「時」カラム */}
            <div className="wheel-column">
              <div className="wheel-column-header">時</div>
              <div
                className="wheel-scroll-list"
                ref={hoursListRef}
                onScroll={handleHourScroll}
              >
                <div className="wheel-padding" />
                <div className="wheel-padding" />
                {HOURS.map((h) => {
                  const isSelected = h === currentHour;
                  return (
                    <div
                      key={h}
                      className={`wheel-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectHour(h)}
                    >
                      {h}
                    </div>
                  );
                })}
                <div className="wheel-padding" />
                <div className="wheel-padding" />
              </div>
            </div>

            {/* コロン */}
            <div className="wheel-colon">:</div>

            {/* 「分」カラム */}
            <div className="wheel-column">
              <div className="wheel-column-header">分</div>
              <div
                className="wheel-scroll-list"
                ref={minutesListRef}
                onScroll={handleMinuteScroll}
              >
                <div className="wheel-padding" />
                <div className="wheel-padding" />
                {minutesList.map((m) => {
                  const isSelected = m === currentMinute;
                  return (
                    <div
                      key={m}
                      className={`wheel-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectMinute(m)}
                    >
                      {m}
                    </div>
                  );
                })}
                <div className="wheel-padding" />
                <div className="wheel-padding" />
              </div>
            </div>
          </div>

          {/* ピッカー補助ツールバー */}
          <div className="picker-toolbar-row">
            <div className="minute-step-group">
              <span className="step-group-label">刻み:</span>
              <div className="step-buttons-segmented">
                <button
                  type="button"
                  className={`step-segment-btn ${minuteStep === 1 ? 'active' : ''}`}
                  onClick={() => handleMinuteStepChange(1)}
                  title="1分刻みで細かく選択"
                >
                  1分
                </button>
                <button
                  type="button"
                  className={`step-segment-btn ${minuteStep === 5 ? 'active' : ''}`}
                  onClick={() => handleMinuteStepChange(5)}
                  title="標準の5分刻み"
                >
                  5分
                </button>
                <button
                  type="button"
                  className={`step-segment-btn ${minuteStep === 30 ? 'active' : ''}`}
                  onClick={() => handleMinuteStepChange(30)}
                  title="30分刻みでざっくり選択"
                >
                  30分
                </button>
              </div>
            </div>

            <button
              type="button"
              className="step-toggle-btn"
              onClick={() => setIsManualInput(true)}
              title="キーボードで手入力"
            >
              <Keyboard size={13} />
              <span>手入力</span>
            </button>
          </div>
        </div>
      )}

      {/* 下部クイックプリセット・ショートカット */}
      <div className="quick-presets-section">
        <div className="quick-presets-label">クイック選択:</div>
        <div className="quick-presets-chips">
          {activeTarget === 'start' ? (
            <>
              <button
                type="button"
                className={`quick-chip ${startTime === '09:00' ? 'active' : ''}`}
                onClick={() => handleSetPreset('09:00')}
              >
                <Sun size={12} />
                <span>09:00 (朝)</span>
              </button>
              <button
                type="button"
                className={`quick-chip ${startTime === '12:00' ? 'active' : ''}`}
                onClick={() => handleSetPreset('12:00')}
              >
                <Coffee size={12} />
                <span>12:00 (昼)</span>
              </button>
              <button
                type="button"
                className={`quick-chip ${startTime === '15:00' ? 'active' : ''}`}
                onClick={() => handleSetPreset('15:00')}
              >
                <Sun size={12} />
                <span>15:00 (午後)</span>
              </button>
              <button
                type="button"
                className={`quick-chip ${startTime === '18:00' ? 'active' : ''}`}
                onClick={() => handleSetPreset('18:00')}
              >
                <Moon size={12} />
                <span>18:00 (夜)</span>
              </button>
              <button
                type="button"
                className="quick-chip"
                onClick={handleSetCurrentTime}
              >
                <Sparkles size={12} />
                <span>今すぐ</span>
              </button>
              <button
                type="button"
                className={`quick-chip allday-chip ${isAllDay ? 'active' : ''}`}
                onClick={() => onStartTimeChange('終日')}
              >
                <span>終日</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="quick-chip"
                onClick={() => handleAddRelativeTime(30)}
              >
                <span>+30分</span>
              </button>
              <button
                type="button"
                className="quick-chip"
                onClick={() => handleAddRelativeTime(60)}
              >
                <span>+1時間</span>
              </button>
              <button
                type="button"
                className="quick-chip"
                onClick={() => handleAddRelativeTime(90)}
              >
                <span>+1.5時間</span>
              </button>
              <button
                type="button"
                className="quick-chip"
                onClick={() => handleAddRelativeTime(120)}
              >
                <span>+2時間</span>
              </button>
              {endTime && (
                <button
                  type="button"
                  className="quick-chip clear-chip"
                  onClick={() => onEndTimeChange('')}
                >
                  <X size={12} />
                  <span>終了時間をなしにする</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
