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

/**
 * 指定期間のGoogleカレンダー予定を取得する
 */
export async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<RawCalendarEvent[]> {
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
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
    throw new Error(`Google Calendar APIエラー (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const items = data.items || [];

  return items.map((item: any) => {
    const isAllDay = !!item.start.date;
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
    };
  });
}
