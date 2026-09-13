export interface RawCalendarEvent {
  summary: string;
  start: Date;
  end?: Date;
  isAllDay: boolean;
  location?: string;
  description?: string;
  localDateStr?: string; // "2026-09-22" (現地の日付)
  localTimeStr?: string; // "10:00" (現地の開始時刻)
  localEndTimeStr?: string; // "11:30" (現地の終了時刻)
  timeZone?: string;
}

/**
 * iCalendar (.ics) テキストを行結合処理（折り返し行のアンフォールド）した上でパースする
 */
export function parseICS(icsContent: string): RawCalendarEvent[] {
  // RFC 5545 準拠のアンフォールド（改行直後の空白またはタブを前の行と結合）
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\r|\n/);

  const events: RawCalendarEvent[] = [];
  let inEvent = false;
  let currentEvent: Partial<RawCalendarEvent> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      if (inEvent && currentEvent.summary && currentEvent.start) {
        events.push({
          summary: currentEvent.summary,
          start: currentEvent.start,
          end: currentEvent.end,
          isAllDay: currentEvent.isAllDay ?? false,
          location: currentEvent.location,
          description: currentEvent.description,
          localDateStr: currentEvent.localDateStr,
          localTimeStr: currentEvent.localTimeStr,
          localEndTimeStr: currentEvent.localEndTimeStr,
        });
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }

    if (!inEvent) continue;

    // KEY;PARAM=VAL:VALUE または KEY:VALUE
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const keyPart = trimmed.substring(0, colonIndex);
    let value = trimmed.substring(colonIndex + 1);

    // エスケープ文字の復元 (\, \;, \n)
    value = value.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');

    const key = keyPart.split(';')[0].toUpperCase();

    switch (key) {
      case 'SUMMARY':
        currentEvent.summary = value;
        break;
      case 'LOCATION':
        currentEvent.location = value;
        break;
      case 'DESCRIPTION':
        currentEvent.description = value;
        break;
      case 'DTSTART': {
        const parsed = parseIcsDate(value, keyPart);
        if (parsed) {
          currentEvent.start = parsed.date;
          currentEvent.isAllDay = parsed.isAllDay;
          currentEvent.localDateStr = parsed.dateStr;
          currentEvent.localTimeStr = parsed.timeStr;
        }
        break;
      }
      case 'DTEND': {
        const parsed = parseIcsDate(value, keyPart);
        if (parsed) {
          currentEvent.end = parsed.date;
          currentEvent.localEndTimeStr = parsed.timeStr;
        }
        break;
      }
    }
  }

  // 開始日時順にソート
  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return events;
}

/**
 * ICSの日付文字列をパースする
 * 例: "20261010T083000Z", "20261010T083000", "20261010"
 */
function parseIcsDate(
  val: string,
  _keyPart?: string
): { date: Date; isAllDay: boolean; dateStr: string; timeStr?: string } | null {
  const isAllDay = val.length === 8 && !val.includes('T');

  if (isAllDay) {
    const yStr = val.substring(0, 4);
    const mStr = val.substring(4, 6);
    const dStr = val.substring(6, 8);
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10) - 1;
    const day = parseInt(dStr, 10);
    return {
      date: new Date(year, month, day, 0, 0, 0),
      isAllDay: true,
      dateStr: `${yStr}-${mStr}-${dStr}`,
    };
  }

  // 時刻付き "20261010T083000" or "20261010T083000Z"
  const cleanVal = val.replace('Z', '');
  const [datePart, timePart] = cleanVal.split('T');
  if (!datePart || !timePart) return null;

  const yStr = datePart.substring(0, 4);
  const mStr = datePart.substring(4, 6);
  const dStr = datePart.substring(6, 8);
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10) - 1;
  const day = parseInt(dStr, 10);

  const hStr = timePart.substring(0, 2);
  const minStr = timePart.substring(2, 4);
  const hour = parseInt(hStr, 10) || 0;
  const minute = parseInt(minStr, 10) || 0;
  const second = parseInt(timePart.substring(4, 6), 10) || 0;

  const dateStr = `${yStr}-${mStr}-${dStr}`;
  const timeStr = `${hStr}:${minStr}`;

  return {
    date: new Date(year, month, day, hour, minute, second),
    isAllDay: false,
    dateStr,
    timeStr,
  };
}
