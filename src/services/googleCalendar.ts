import type { RawCalendarEvent } from './icsParser';

declare global {
  interface Window {
    google?: any;
  }
}

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

/**
 * Google Identity Services (GIS) スクリプトを動的ロード
 */
export function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.getElementById('google-gis-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (err) => reject(err));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error('Google Identity Servicesの読み込みに失敗しました: ' + e));
    document.head.appendChild(script);
  });
}

/**
 * Google OAuth 2.0でサインインしてアクセストークンを取得する
 */
export async function getGoogleAccessToken(clientId: string): Promise<string> {
  if (!window.google?.accounts?.oauth2) {
    await loadGisScript();
  }

  return new Promise((resolve, reject) => {
    try {
      let isSettled = false;
      const timeoutId = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          reject(
            new Error(
              '認証がタイムアウトしました。ポップアップがブロックされているか、閉じられた可能性があります。'
            )
          );
        }
      }, 45000);

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        error_callback: (err: any) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutId);
            reject(
              new Error(
                err?.message ||
                  'Googleログイン画面がブロックされたか閉じられました。ポップアップを許可してください。'
              )
            );
          }
        },
        callback: (response: any) => {
          if (isSettled) return;
          isSettled = true;
          clearTimeout(timeoutId);

          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('アクセストークンを取得できませんでした'));
          }
        },
      });

      // ユーザージェスチャー直下で実行
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  primary?: boolean;
}

/**
 * ユーザーのカレンダー一覧を取得する
 */
export async function fetchCalendarList(accessToken: string): Promise<GoogleCalendarInfo[]> {
  try {
    const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [{ id: 'primary', summary: 'メインカレンダー', primary: true }];
    const data = await res.json();
    return (data.items || []).map((c: any) => ({
      id: c.id,
      summary: c.summary,
      primary: !!c.primary,
    }));
  } catch (e) {
    console.error('Failed to fetch calendar list:', e);
    return [{ id: 'primary', summary: 'メインカレンダー', primary: true }];
  }
}

/**
 * 指定期間のGoogleカレンダー予定を取得する（複数カレンダー対応）
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarId: string = 'primary'
): Promise<RawCalendarEvent[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn(`Calendar API warning for ${calendarId}:`, errorText);
    return [];
  }

  const data = await res.json();
  const items = data.items || [];

  return items
    .filter((item: any) => {
      if (item.status === 'cancelled') return false;
      // 日本の祝日カレンダー等の自動除外（祝日や日節など）
      if (
        calendarId.includes('holiday@group.v.calendar.google.com') ||
        calendarId.includes('contacts@group.v.calendar.google.com')
      ) {
        return false;
      }
      return true;
    })
    .map((item: any) => {
      const isAllDay = !!item.start.date;

      let localDateStr = '';
      let localTimeStr: string | undefined = undefined;
      let localEndTimeStr: string | undefined = undefined;

      if (isAllDay) {
        localDateStr = item.start.date; // "2026-09-21"
      } else if (item.start.dateTime) {
        const startDt = new Date(item.start.dateTime);
        // 日本時間 (JST: UTC+9) の日時を算出
        const jstEpoch = startDt.getTime() + 9 * 60 * 60 * 1000;
        const jstDate = new Date(jstEpoch);
        const jstY = jstDate.getUTCFullYear();
        const jstM = (jstDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const jstD = jstDate.getUTCDate().toString().padStart(2, '0');
        const jstH = jstDate.getUTCHours().toString().padStart(2, '0');
        const jstMin = jstDate.getUTCMinutes().toString().padStart(2, '0');

        localDateStr = `${jstY}-${jstM}-${jstD}`;
        localTimeStr = `${jstH}:${jstMin}`;
      }

      if (item.end?.dateTime) {
        const endDt = new Date(item.end.dateTime);
        const jstEpoch = endDt.getTime() + 9 * 60 * 60 * 1000;
        const jstDate = new Date(jstEpoch);
        const jstH = jstDate.getUTCHours().toString().padStart(2, '0');
        const jstMin = jstDate.getUTCMinutes().toString().padStart(2, '0');
        localEndTimeStr = `${jstH}:${jstMin}`;
      }

      // 生の文字列表記（split('T')）
      let rawDateStr: string | undefined = undefined;
      let rawTimeStr: string | undefined = undefined;
      if (item.start?.dateTime) {
        const [dPart, tPart] = item.start.dateTime.split('T');
        rawDateStr = dPart;
        if (tPart) rawTimeStr = tPart.substring(0, 5);
      }

      const start = isAllDay
        ? new Date(`${item.start.date}T00:00:00`)
        : new Date(item.start.dateTime);
      const end = item.end
        ? isAllDay
          ? new Date(`${item.end.date}T00:00:00`)
          : new Date(item.end.dateTime)
        : undefined;

      return {
        summary: item.summary || '(無題の予定)',
        start,
        end,
        isAllDay,
        location: item.location,
        description: item.description,
        localDateStr,
        localTimeStr,
        localEndTimeStr,
        rawDateStr,
        rawTimeStr,
        timeZone: item.start.timeZone,
      };
    });
}

/**
 * 全カレンダーから指定期間の予定をまとめて取得する
 */
export async function fetchAllCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<{ events: RawCalendarEvent[]; calendarCount: number }> {
  const calendars = await fetchCalendarList(accessToken);
  const allEvents: RawCalendarEvent[] = [];
  const seenKeys = new Set<string>();

  for (const cal of calendars) {
    const events = await fetchCalendarEvents(accessToken, timeMin, timeMax, cal.id);
    for (const ev of events) {
      const key = `${ev.summary}_${ev.start.getTime()}_${ev.location || ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allEvents.push(ev);
      }
    }
  }

  allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { events: allEvents, calendarCount: calendars.length };
}
