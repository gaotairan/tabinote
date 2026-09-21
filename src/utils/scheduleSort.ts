import type { ScheduleItem } from '../types/trip';

/**
 * 全角英数・記号を半角に正規化
 */
function toHalfWidth(str: string): string {
  return str
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ':')
    .replace(/〜|～/g, '~');
}

/**
 * 時刻文字列から分単位の数値（0〜1439）を抽出する
 * @param timeStr "09:30", "9:30", "22:00", "9:30〜", "終日" など
 * @returns 分（0〜1439）。"終日" の場合は -1。パースできない場合は null。
 */
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim();
  if (!trimmed) return null;

  if (trimmed === '終日' || trimmed.toLowerCase() === 'all day') {
    return -1;
  }

  const normalized = toHalfWidth(trimmed);

  // 1. "09:30" or "9:30" or "9:30:00"
  const colonMatch = normalized.match(/(\d{1,2}):(\d{1,2})(?::\d{1,2})?/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes;
    }
  }

  // 2. "9時30分" or "9時"
  const jpnMatch = normalized.match(/(\d{1,2})\s*時(?:\s*(\d{1,2})\s*分?)?/);
  if (jpnMatch) {
    const hours = parseInt(jpnMatch[1], 10);
    const minutes = jpnMatch[2] ? parseInt(jpnMatch[2], 10) : 0;
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes;
    }
  }

  return null;
}

/**
 * 入力された時刻文字列を "HH:mm" 形式（例: "09:30"）に正規化する。
 * パースできない場合や "終日" は元の文字列をトリムして返す。
 */
export function normalizeTimeString(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (trimmed === '終日' || trimmed.toLowerCase() === 'all day') {
    return '終日';
  }

  const normalized = toHalfWidth(trimmed);

  // 単独の時刻 (例: "9:30", " 09:30 ")
  const match = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
  }

  // "9時30分"
  const jpnMatch = normalized.match(/^(\d{1,2})\s*時(?:\s*(\d{1,2})\s*分?)?$/);
  if (jpnMatch) {
    const h = parseInt(jpnMatch[1], 10);
    const m = jpnMatch[2] ? parseInt(jpnMatch[2], 10) : 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
  }

  return trimmed;
}

/**
 * 2つの予定アイテムを時刻順（昇順）に比較する関数
 * - "終日" は最優先（先頭）
 * - 9:30 (570分) < 22:00 (1320分) のように数値で正しく比較
 * - 開始時刻が同じ場合は終了時刻で比較
 * - 時刻なし・未定は末尾
 */
export function compareScheduleItems(a: ScheduleItem, b: ScheduleItem): number {
  const minA = parseTimeToMinutes(a.time);
  const minB = parseTimeToMinutes(b.time);

  // 両方終日の場合
  if (minA === -1 && minB === -1) return 0;
  // 終日は先頭
  if (minA === -1) return -1;
  if (minB === -1) return 1;

  // どちらも時刻パースできた場合
  if (minA !== null && minB !== null) {
    if (minA !== minB) {
      return minA - minB;
    }
    // 開始時刻が同じ場合、終了時刻で比較
    const endMinA = parseTimeToMinutes(a.endTime);
    const endMinB = parseTimeToMinutes(b.endTime);
    if (endMinA !== null && endMinB !== null && endMinA !== endMinB) {
      return endMinA - endMinB;
    }
    return 0;
  }

  // 片方のみ時刻パースできた場合、時刻ありを優先
  if (minA !== null && minB === null) return -1;
  if (minA === null && minB !== null) return 1;

  // どちらも時刻パースできない場合は文字列比較
  return (a.time || '').localeCompare(b.time || '');
}

/**
 * 予定アイテムのリストを時間順にソートした新しい配列を返す
 */
export function sortScheduleItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort(compareScheduleItems);
}
