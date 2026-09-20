import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import type { Trip, DaySchedule, ScheduleItem } from '../types/trip';
import type { RawCalendarEvent } from './icsParser';
import { inferCategory } from './tripGenerator';
import { shiftDateTime } from '../utils/timezone';

export type CalendarSyncMode = 'merge' | 'replace';

export interface CalendarSyncOptions {
  mode: CalendarSyncMode;
  autoExpandDates?: boolean;
  timeConvertMode?: 'convert_to_local' | 'keep_original';
  targetTimeZoneOffset?: number;
  targetTimeZoneName?: string;
}

export interface ResolvedCalendarItem {
  id: string;
  raw: RawCalendarEvent;
  localDateStr: string;
  localTimeStr: string;
  localEndTimeStr?: string;
  title: string;
  location?: string;
  locationUrl?: string;
  memo?: string;
  category: ScheduleItem['category'];
  transportType?: ScheduleItem['transportType'];
  selected: boolean;
}

export interface CalendarSyncResult {
  updatedTrip: Trip;
  addedCount: number;
  skippedCount: number;
  expandedDaysCount: number;
}

/**
 * RawCalendarEvent の配列を、しおりのタイムゾーン設定に合わせて現地時間の日時情報に解決する
 */
export function resolveCalendarEventsForTrip(
  events: RawCalendarEvent[],
  trip: Trip,
  options?: {
    timeConvertMode?: 'convert_to_local' | 'keep_original';
    targetTimeZoneOffset?: number;
  }
): ResolvedCalendarItem[] {
  const effectiveOffset = options?.targetTimeZoneOffset ?? trip.timeZoneOffset ?? 0;
  const timeConvertMode = options?.timeConvertMode || 'convert_to_local';

  return events.map((ev, index) => {
    const baseDate = ev.localDateStr || format(ev.start, 'yyyy-MM-dd');
    const baseTime = ev.isAllDay ? '終日' : ev.localTimeStr || format(ev.start, 'HH:mm');
    const baseEndTime =
      ev.localEndTimeStr || (ev.end && !ev.isAllDay ? format(ev.end, 'HH:mm') : undefined);

    let localDateStr = baseDate;
    let localTimeStr = baseTime;
    let localEndTimeStr = baseEndTime;

    if (!ev.isAllDay) {
      if (timeConvertMode === 'convert_to_local' && effectiveOffset !== 0) {
        const startShifted = shiftDateTime(baseDate, baseTime, effectiveOffset);
        const endShifted = baseEndTime
          ? shiftDateTime(baseDate, baseEndTime, effectiveOffset)
          : undefined;

        localDateStr = startShifted.dateStr;
        localTimeStr = startShifted.timeStr || baseTime;
        localEndTimeStr = endShifted?.timeStr || undefined;
      } else {
        localDateStr = ev.rawDateStr || baseDate;
        localTimeStr = ev.rawTimeStr || baseTime;
      }
    }

    const matchText = `${ev.summary} ${ev.location || ''} ${ev.description || ''}`;
    const { category, transportType } = inferCategory(matchText);

    const location = ev.location?.trim();
    const locationUrl = location
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
      : undefined;

    return {
      id: `cal-item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`,
      raw: ev,
      localDateStr,
      localTimeStr,
      localEndTimeStr,
      title: ev.summary || '予定',
      location,
      locationUrl,
      memo: ev.description?.trim(),
      category,
      transportType,
      selected: true,
    };
  });
}

/**
 * 2つの予定が実質的に同一（重複）かどうかを判定する
 */
function isDuplicateScheduleItem(existing: ScheduleItem, incoming: ResolvedCalendarItem): boolean {
  // タイトルの正規化（空白除去、小文字化）
  const cleanA = existing.title.trim().toLowerCase();
  const cleanB = incoming.title.trim().toLowerCase();

  // 完全一致または前方一致、かつ時刻が一致
  if (cleanA === cleanB && existing.time === incoming.localTimeStr) {
    return true;
  }

  // タイトルが一方に含まれていて、時刻が完全一致
  if (
    existing.time === incoming.localTimeStr &&
    (cleanA.includes(cleanB) || cleanB.includes(cleanA)) &&
    cleanA.length > 2 &&
    cleanB.length > 2
  ) {
    return true;
  }

  return false;
}

/**
 * 解決されたカレンダー予定を作成済みのしおり（Trip）にマージまたは置き換え更新する
 */
export function syncCalendarEventsIntoTrip(
  trip: Trip,
  resolvedItems: ResolvedCalendarItem[],
  options: CalendarSyncOptions
): CalendarSyncResult {
  const selectedItems = resolvedItems.filter((it) => it.selected);

  if (selectedItems.length === 0) {
    return {
      updatedTrip: trip,
      addedCount: 0,
      skippedCount: 0,
      expandedDaysCount: 0,
    };
  }

  const autoExpand = options.autoExpandDates !== false;
  let newStartDate = trip.startDate;
  let newEndDate = trip.endDate;

  // 日程範囲の拡張チェック
  if (autoExpand) {
    for (const item of selectedItems) {
      if (item.localDateStr < newStartDate) {
        newStartDate = item.localDateStr;
      }
      if (item.localDateStr > newEndDate) {
        newEndDate = item.localDateStr;
      }
    }
  }

  // 開始日〜終了日の日数を算出
  const startDay = parseISO(newStartDate);
  const endDay = parseISO(newEndDate);
  const totalDays = Math.max(1, differenceInCalendarDays(endDay, startDay) + 1);

  // 既存のDayScheduleを日付キーでマップ化
  const existingDaysMap = new Map<string, DaySchedule>();
  for (const day of trip.days) {
    existingDaysMap.set(day.date, day);
  }

  let addedCount = 0;
  let skippedCount = 0;

  // 新しい日程リストを構築
  const newDays: DaySchedule[] = [];

  for (let i = 0; i < totalDays; i++) {
    const curDate = new Date(startDay);
    curDate.setDate(curDate.getDate() + i);
    const dateStr = format(curDate, 'yyyy-MM-dd');
    const dayNumber = i + 1;

    const existingDay = existingDaysMap.get(dateStr);
    const dayTitle = existingDay?.title || `${dayNumber}日目`;

    let currentItems: ScheduleItem[] = [];

    if (options.mode === 'merge' && existingDay) {
      // 差分マージモード: 既存の予定を引き継ぐ
      currentItems = [...existingDay.items];
    }

    // この日の選択されたカレンダー予定を取得
    const itemsForThisDay = selectedItems.filter((it) => it.localDateStr === dateStr);

    for (const calItem of itemsForThisDay) {
      if (options.mode === 'merge') {
        // 重複チェック
        const duplicate = currentItems.some((ex) => isDuplicateScheduleItem(ex, calItem));
        if (duplicate) {
          skippedCount++;
          continue;
        }
      }

      // 新しいScheduleItemを作成
      const newScheduleItem: ScheduleItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
        time: calItem.localTimeStr,
        endTime: calItem.localEndTimeStr,
        title: calItem.title,
        category: calItem.category,
        transportType: calItem.transportType,
        location: calItem.location,
        locationUrl: calItem.locationUrl,
        memo: calItem.memo,
      };

      currentItems.push(newScheduleItem);
      addedCount++;
    }

    // 時刻順にソート（終日は先頭）
    currentItems.sort((a, b) => {
      if (a.time === '終日') return -1;
      if (b.time === '終日') return 1;
      return a.time.localeCompare(b.time);
    });

    newDays.push({
      dayNumber,
      date: dateStr,
      title: dayTitle,
      items: currentItems,
    });
  }

  const expandedDaysCount = Math.max(0, newDays.length - trip.days.length);

  const updatedTrip: Trip = {
    ...trip,
    startDate: newStartDate,
    endDate: newEndDate,
    days: newDays,
    updatedAt: new Date().toISOString(),
  };

  return {
    updatedTrip,
    addedCount,
    skippedCount,
    expandedDaysCount,
  };
}
