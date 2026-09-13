export interface RawCalendarEvent {
  summary: string;
  start: Date;
  end?: Date;
  isAllDay: boolean;
  location?: string;
  description?: string;
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
        }
        break;
      }
      case 'DTEND': {
        const parsed = parseIcsDate(value, keyPart);
        if (parsed) {
          currentEvent.end = parsed.date;
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
): { date: Date; isAllDay: boolean } | null {
  const isAllDay = val.length === 8 && !val.includes('T');

  if (isAllDay) {
    const year = parseInt(val.substring(0, 4), 10);
    const month = parseInt(val.substring(4, 6), 10) - 1;
    const day = parseInt(val.substring(6, 8), 10);
    return { date: new Date(year, month, day, 0, 0, 0), isAllDay: true };
  }

  // 時刻付き "20261010T083000" or "20261010T083000Z"
  const cleanVal = val.replace('Z', '');
  const [datePart, timePart] = cleanVal.split('T');
  if (!datePart || !timePart) return null;

  const year = parseInt(datePart.substring(0, 4), 10);
  const month = parseInt(datePart.substring(4, 6), 10) - 1;
  const day = parseInt(datePart.substring(6, 8), 10);

  const hour = parseInt(timePart.substring(0, 2), 10) || 0;
  const minute = parseInt(timePart.substring(2, 4), 10) || 0;
  const second = parseInt(timePart.substring(4, 6), 10) || 0;

  if (val.endsWith('Z')) {
    // UTC
    return {
      date: new Date(Date.UTC(year, month, day, hour, minute, second)),
      isAllDay: false,
    };
  }

  // ローカル時間またはTZID指定
  return {
    date: new Date(year, month, day, hour, minute, second),
    isAllDay: false,
  };
}
