import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import type {
  Trip,
  DaySchedule,
  ScheduleItem,
  ScheduleCategory,
  TransportType,
  PackingItem,
} from '../types/trip';
import type { RawCalendarEvent } from './icsParser';
import { PRESET_COVERS } from '../mock/sampleTrip';
import { inferTimeZone, shiftDateTime } from '../utils/timezone';

export interface GenerateTripOptions {
  customTitle?: string;
  customDestination?: string;
  coverUrl?: string;
  targetTimeZoneOffset?: number; // 日本時間(JST)との時差 (現地 - JST。例: バルセロナ夏時間なら -7)
  targetTimeZoneName?: string;
  timeConvertMode?: 'convert_to_local' | 'keep_original'; // 'convert_to_local': JSTから現地時間に時差換算, 'keep_original': そのまま
}

/**
 * イベントのテキストからカテゴリーを判定する
 */
function inferCategory(text: string): {
  category: ScheduleCategory;
  transportType?: TransportType;
} {
  const lower = text.toLowerCase();

  // 交通・移動関連
  if (
    /新幹線|特急|電車|jr|地下鉄|メトロ|train|station|駅/.test(lower)
  ) {
    return { category: 'transport', transportType: 'train' };
  }
  if (/飛行機|フライト|空港|airline|airport|flight|ana|jal/.test(lower)) {
    return { category: 'transport', transportType: 'plane' };
  }
  if (/レンタカー|ドライブ|車|car|高速|ic|sa|pa/.test(lower)) {
    return { category: 'transport', transportType: 'car' };
  }
  if (/バス|高速バス|bus/.test(lower)) {
    return { category: 'transport', transportType: 'bus' };
  }
  if (/フェリー|船|クルーズ|ship|ferry/.test(lower)) {
    return { category: 'transport', transportType: 'ship' };
  }
  if (/徒歩|散歩|散策|walk/.test(lower)) {
    return { category: 'transport', transportType: 'walk' };
  }

  // 宿泊関連
  if (/ホテル|旅館|宿|hotel|ryokan|チェックイン|チェックアウト|宿泊/.test(lower)) {
    return { category: 'hotel' };
  }

  // 食事関連
  if (
    /ランチ|ディナー|昼食|夕食|朝食|カフェ|ご飯|居酒屋|レストラン|cafe|lunch|dinner|bar|グルメ|食べ歩き/.test(
      lower
    )
  ) {
    return { category: 'food' };
  }

  // アクティビティ
  if (/体験|ツアー|トレッキング|登山|カヤック|スキー|ダイビング|遊園地|usj|ディズニー|disney/.test(lower)) {
    return { category: 'activity' };
  }

  // 観光関連
  if (
    /神社|寺|城|公園|庭園|水族館|動物園|博物館|美術館|タワー|展望台|観光|museum|shrine|temple|park/.test(
      lower
    )
  ) {
    return { category: 'sightseeing' };
  }

  return { category: 'other' };
}

/**
 * 基本的な持ち物リストの自動生成
 */
function generateDefaultPackingList(): PackingItem[] {
  return [
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: 'スマートフォン・充電器', category: 'electronics', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: 'モバイルバッテリー', category: 'electronics', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: '身分証・健康保険証', category: 'essential', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: '新幹線 / 航空券・各種チケット控え', category: 'essential', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: '着替え・下着（日数分）', category: 'clothes', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: '羽織りもの・防寒着', category: 'clothes', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: '洗面用具・スキンケア・歯ブラシ', category: 'toiletries', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: '常備薬・目薬・絆創膏', category: 'toiletries', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: '折りたたみ傘・雨具', category: 'essential', isChecked: false, assignedMemberId: 'all' },
    { id: 'p-' + Math.random().toString(36).substr(2, 9), name: 'エコバッグ・お土産袋', category: 'other', isChecked: false, assignedMemberId: 'all' },
  ];
}

/**
 * カレンダーイベントの配列から、しおり（Trip）オブジェクトを自動構築する
 */
export function generateTripFromEvents(
  events: RawCalendarEvent[],
  options?: GenerateTripOptions
): Trip {
  if (!events || events.length === 0) {
    throw new Error('予定が見つかりませんでした');
  }

  // 目的地とタイトルの推測
  let inferredDestination = options?.customDestination || '';
  let inferredTitle = options?.customTitle || '';

  // タイムゾーンの決定
  let effectiveOffset = options?.targetTimeZoneOffset;
  let effectiveTzName = options?.targetTimeZoneName;

  if (effectiveOffset === undefined) {
    const allTexts = events
      .map((e) => `${e.summary} ${e.location || ''} ${e.description || ''}`)
      .join(' ');
    const primaryTimeZone = events.find((e) => e.timeZone)?.timeZone;
    const inferredTz = inferTimeZone(`${inferredDestination} ${inferredTitle} ${allTexts}`, primaryTimeZone);
    if (inferredTz) {
      effectiveOffset = inferredTz.offset;
      effectiveTzName = inferredTz.name;
    } else {
      effectiveOffset = 0;
      effectiveTzName = '日本国内 / 韓国 (時差なし)';
    }
  }

  const timeConvertMode = options?.timeConvertMode || 'convert_to_local';

  // 各イベントを現地時間・現地日付に解決
  interface ResolvedEvent {
    raw: RawCalendarEvent;
    localDateStr: string;
    localTimeStr: string;
    localEndTimeStr?: string;
  }

  const resolvedEvents: ResolvedEvent[] = events.map((ev) => {
    const baseDate = ev.localDateStr || format(ev.start, 'yyyy-MM-dd');
    const baseTime = ev.isAllDay ? '終日' : ev.localTimeStr || format(ev.start, 'HH:mm');
    const baseEndTime = ev.localEndTimeStr || (ev.end && !ev.isAllDay ? format(ev.end, 'HH:mm') : undefined);

    if (ev.isAllDay) {
      return {
        raw: ev,
        localDateStr: baseDate,
        localTimeStr: '終日',
        localEndTimeStr: undefined,
      };
    }

    if (timeConvertMode === 'convert_to_local' && effectiveOffset !== 0) {
      // 日本時間(JST)から現地時間にシフト換算
      const startShifted = shiftDateTime(baseDate, baseTime, effectiveOffset);
      const endShifted = baseEndTime
        ? shiftDateTime(baseDate, baseEndTime, effectiveOffset)
        : undefined;

      return {
        raw: ev,
        localDateStr: startShifted.dateStr,
        localTimeStr: startShifted.timeStr || baseTime,
        localEndTimeStr: endShifted?.timeStr || undefined,
      };
    }

    // keep_original (または時差0): 生の数字またはカレンダーの時刻をそのまま現地時間として採用
    const directDate = ev.rawDateStr || baseDate;
    const directTime = ev.rawTimeStr || baseTime;
    return {
      raw: ev,
      localDateStr: directDate,
      localTimeStr: directTime,
      localEndTimeStr: baseEndTime,
    };
  });

  // 現地日付・時刻順にソート
  resolvedEvents.sort((a, b) => {
    const dComp = a.localDateStr.localeCompare(b.localDateStr);
    if (dComp !== 0) return dComp;
    if (a.localTimeStr === '終日') return -1;
    if (b.localTimeStr === '終日') return 1;
    return a.localTimeStr.localeCompare(b.localTimeStr);
  });

  const firstEvent = resolvedEvents[0];
  const lastEvent = resolvedEvents[resolvedEvents.length - 1];

  const startDateStr = firstEvent.localDateStr;
  const endDateStr = lastEvent.localDateStr;

  // 開始日〜終了日の日数を算出
  const startDay = parseISO(startDateStr);
  const endDay = parseISO(endDateStr);
  const totalDays = Math.max(1, differenceInCalendarDays(endDay, startDay) + 1);

  // 日付ごとのマップを作成
  const daysMap = new Map<string, ScheduleItem[]>();

  for (let i = 0; i < totalDays; i++) {
    const curDate = new Date(startDay);
    curDate.setDate(curDate.getDate() + i);
    const dateStr = format(curDate, 'yyyy-MM-dd');
    daysMap.set(dateStr, []);
  }

  // イベントを日別に振り分け
  for (const item of resolvedEvents) {
    const ev = item.raw;
    const dayItems = daysMap.get(item.localDateStr);

    if (dayItems) {
      const matchText = `${ev.summary} ${ev.location || ''} ${ev.description || ''}`;
      const { category, transportType } = inferCategory(matchText);

      const location = ev.location?.trim();
      const locationUrl = location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
        : undefined;

      dayItems.push({
        id: 'item-' + Math.random().toString(36).substr(2, 9),
        time: item.localTimeStr,
        endTime: item.localEndTimeStr,
        title: ev.summary,
        category,
        transportType,
        location,
        locationUrl,
        memo: ev.description?.trim(),
      });

      // 目的地の推測（もし未設定なら）
      if (!inferredDestination) {
        if (location) {
          inferredDestination = location.split(/[,、\s->]/)[0].trim();
        } else if (ev.isAllDay && ev.summary.length <= 10) {
          inferredDestination = ev.summary;
        }
      }
    }
  }

  if (!inferredDestination) {
    inferredDestination = '国内旅行';
  }

  if (!inferredTitle) {
    const nights = totalDays - 1;
    const durationLabel = nights > 0 ? `${nights}泊${totalDays}日` : '日帰り';
    inferredTitle = `${inferredDestination} ${durationLabel}の旅 ✈️`;
  }

  // DaySchedule 配列の作成
  const days: DaySchedule[] = [];
  let dayIndex = 1;
  daysMap.forEach((items, dateStr) => {
    items.sort((a, b) => {
      if (a.time === '終日') return -1;
      if (b.time === '終日') return 1;
      return a.time.localeCompare(b.time);
    });

    days.push({
      dayNumber: dayIndex,
      date: dateStr,
      title: `${dayIndex}日目 (${dateStr})`,
      items,
    });
    dayIndex++;
  });

  const tripId = 'trip-' + Date.now();
  const cover = options?.coverUrl || PRESET_COVERS[1].url;

  return {
    id: tripId,
    title: inferredTitle,
    subtitle: `${startDateStr} 〜 ${endDateStr} の旅行しおり`,
    destination: inferredDestination,
    startDate: startDateStr,
    endDate: endDateStr,
    coverImage: cover,
    themeColor: '#3b82f6',
    password: '',
    memo: 'Googleカレンダーから自動作成されたしおりです。自由に編集してオリジナルのしおりを完成させましょう！',
    members: [
      { id: 'm-owner', name: '自分', avatarColor: '#3b82f6', role: 'リーダー' },
    ],
    days,
    packingList: generateDefaultPackingList(),
    souvenirs: [],
    expenses: [],
    timeZoneOffset: effectiveOffset,
    timeZoneName: effectiveTzName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
