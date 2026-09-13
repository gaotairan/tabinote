import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import type {
  Trip,
  ScheduleCategory,
  TransportType,
  PackingCategory,
  ExpenseCategory,
} from '../types/trip';
import { PRESET_COVERS } from '../mock/sampleTrip';
import { PRESET_AVATARS } from '../utils/imageUtils';

const CATS: ScheduleCategory[] = [
  'transport',
  'sightseeing',
  'food',
  'hotel',
  'activity',
  'other',
];

const TRANS: TransportType[] = ['train', 'plane', 'car', 'bus', 'walk', 'ship'];

const PACK_CATS: PackingCategory[] = [
  'essential',
  'clothes',
  'electronics',
  'toiletries',
  'other',
];

const EXP_CATS: ExpenseCategory[] = [
  'transport',
  'food',
  'hotel',
  'ticket',
  'shopping',
  'other',
];

/**
 * Uint8ArrayをBase64URL文字列に変換（ブラウザ互換）
 */
function u8ToBase64Url(u8: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < u8.length; i += chunkSize) {
    const chunk = u8.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL文字列をUint8Arrayに変換（ブラウザ互換・空白やエンコード耐性強化）
 */
function base64UrlToU8(b64url: string): Uint8Array {
  // 空白・改行・URLエスケープを徹底サニタイズ
  let cleaned = (b64url || '').trim().replace(/\s+/g, '');
  if (cleaned.includes('%')) {
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {
      // ignore
    }
  }
  let b64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  const binary = atob(b64);
  const len = binary.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8[i] = binary.charCodeAt(i);
  }
  return u8;
}

/**
 * カバー画像がプリセットに一致するか判定し短縮記号（@0〜@7）を返す
 * 外部URLやBase64画像の場合は、URL破損やQRコード上限を避けるためデフォルトプリセット(@0)に安全フォールバック
 */
function resolveCoverForShare(coverUrl?: string): string {
  if (!coverUrl) return '@0';
  for (let i = 0; i < PRESET_COVERS.length; i++) {
    const p = PRESET_COVERS[i];
    if (coverUrl === p.id || coverUrl === p.url || (p.url && coverUrl.includes(p.url.slice(0, 40)))) {
      return '@' + i;
    }
  }
  // カスタムアップロード画像（data:image/...）や長大な外部URLはURL/QRコードの破損を防ぐため@0に安全フォールバック
  return '@0';
}

/**
 * スマホカメラでの高速・確実なQRコード読み取り用に最適化された軽量配列に圧縮
 * （主要スケジュール＋基本情報に特化し、確実に400〜900文字前後に圧縮）
 */
function packTripForQr(t: Trip): unknown[] {
  // カバー画像は必ずプリセット（@0〜@7）に解決し、Base64画像を完全排除
  const cover = resolveCoverForShare(t.coverImage);

  // メンバーアバターもBase64を排除（プリセットのみ*0〜、それ以外は空文字＝イニシャル色付き丸アイコン）
  const members = t.members?.map((m) => {
    let av = '';
    if (m.avatarUrl) {
      const pIdx = PRESET_AVATARS.findIndex((p) => p.url === m.avatarUrl);
      if (pIdx >= 0) {
        av = '*' + pIdx;
      }
    }
    return [m.name, m.avatarColor, m.role || '', av];
  }) || [];

  const days = t.days?.map((d) => [
    d.dayNumber,
    d.date,
    d.title || '',
    d.items?.map((it) => [
      it.time,
      it.title,
      CATS.indexOf(it.category),
      it.location || '',
      it.memo ? it.memo.slice(0, 80) : '', // QRコードのセル密度を抑えるためメモを適度な長さに安全制限
      it.endTime || '',
      it.transportType ? TRANS.indexOf(it.transportType) : -1,
      it.cost || 0,
    ]) || [],
  ]) || [];

  return [
    'qr', // QR軽量バージョン識別子
    t.title,
    t.destination,
    t.startDate,
    t.endDate,
    cover,
    t.themeColor || '#2563eb',
    t.timeZoneOffset ?? 0,
    t.timeZoneName || '',
    t.memo ? t.memo.slice(0, 150) : '',
    members,
    days,
  ];
}

/**
 * しおりデータをQRコード・URL共有用に最適化されたコンパクト配列に圧縮
 */
function packTrip(t: Trip): unknown[] {
  // カバー画像はプリセット短縮（@0〜@7）、カスタム画像の場合はURL破損防止のため安全フォールバック
  const cover = resolveCoverForShare(t.coverImage);

  // メンバーアバター（プリセットは*0〜、Base64等の長大画像はURL破損を防ぐため除外してイニシャル表示にフォールバック）
  const membersPacked = t.members?.map((m) => {
    let av = '';
    if (m.avatarUrl) {
      const pIdx = PRESET_AVATARS.findIndex((p) => p.url === m.avatarUrl);
      if (pIdx >= 0) {
        av = '*' + pIdx;
      } else if (!m.avatarUrl.startsWith('data:')) {
        av = m.avatarUrl; // 短い外部URLなら保持
      }
    }
    return [m.id, m.name, m.avatarColor, m.role || '', m.email || '', av];
  }) || [];

  return [
    1, // バージョン
    t.id,
    t.title,
    t.subtitle || '',
    t.destination,
    t.startDate,
    t.endDate,
    cover,
    t.themeColor || '#2563eb',
    t.timeZoneOffset ?? 0,
    t.timeZoneName || '',
    t.memo || '',
    membersPacked,
    t.days?.map((d) => [
      d.dayNumber,
      d.date,
      d.title || '',
      d.items?.map((it) => {
        // 標準的なGoogleマップURLはlocationからスマホ側で自動復元できるため除外して大幅軽量化
        let customUrl = it.locationUrl || '';
        if (
          customUrl.includes('maps.google.com') ||
          customUrl.includes('google.com/maps')
        ) {
          customUrl = '';
        }
        return [
          // 自動生成されたIDは送信不要（復元時に連番自動付与）
          it.id?.startsWith('item-') ? '' : it.id || '',
          it.time,
          it.endTime || '',
          it.title,
          CATS.indexOf(it.category),
          it.location || '',
          it.memo || '',
          it.cost || 0,
          it.transportType ? TRANS.indexOf(it.transportType) : -1,
          customUrl,
        ];
      }) || [],
    ]) || [],
    t.packingList?.map((p) => [
      p.id?.startsWith('p-') || p.id?.startsWith('p') ? '' : p.id || '',
      p.name,
      PACK_CATS.indexOf(p.category),
      p.isChecked ? 1 : 0,
      p.assignedMemberId || '',
    ]) || [],
    t.souvenirs?.map((s) => [
      s.id?.startsWith('s-') || s.id?.startsWith('s') ? '' : s.id || '',
      s.name,
      s.forWhom || '',
      s.place || '',
      s.isBought ? 1 : 0,
      s.price || 0,
      s.memo || '',
    ]) || [],
    t.expenses?.map((e) => [
      e.id?.startsWith('e-') || e.id?.startsWith('e') ? '' : e.id || '',
      e.title,
      e.amount,
      e.payerId,
      e.targetMemberIds || [],
      e.date,
      EXP_CATS.indexOf(e.category),
      e.memo || '',
    ]) || [],
  ];
}

/**
 * コンパクト配列からTripオブジェクトを復元
 */
function unpackTrip(arr: unknown[]): Trip {
  // QR軽量バージョンの場合（主要スケジュール＋基本情報）
  if (Array.isArray(arr) && arr[0] === 'qr') {
    const [
      , // 'qr'
      title,
      destination,
      startDate,
      endDate,
      cover,
      themeColor,
      timeZoneOffset,
      timeZoneName,
      memo,
      members,
      days,
    ] = arr as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      number,
      string,
      string,
      [string, string, string, string?][],
      [number, string, string, [string, string, number, string, string, string, number, number][]][]
    ];

    let coverImage = cover;
    if (typeof cover === 'string' && cover.startsWith('@')) {
      const idx = parseInt(cover.slice(1), 10);
      coverImage = PRESET_COVERS[idx]?.url || PRESET_COVERS[0].url;
    }

    const now = new Date().toISOString();

    return {
      id: 'trip-' + Date.now(),
      title: title || '無題のしおり',
      destination: destination || '',
      startDate: startDate || '',
      endDate: endDate || '',
      coverImage: coverImage || PRESET_COVERS[0].url,
      themeColor: themeColor || '#2563eb',
      timeZoneOffset: timeZoneOffset ?? 0,
      timeZoneName: timeZoneName || undefined,
      memo: memo || undefined,
      members: (members || []).map(([name, avatarColor, role, avatarUrl], idx) => {
        let restoredAvatar = avatarUrl;
        if (restoredAvatar && restoredAvatar.startsWith('*')) {
          const pIdx = parseInt(restoredAvatar.slice(1), 10);
          restoredAvatar = PRESET_AVATARS[pIdx]?.url || undefined;
        }
        return {
          id: 'm' + (idx + 1),
          name: name || 'メンバー',
          avatarColor: avatarColor || '#3b82f6',
          role: role || undefined,
          avatarUrl: restoredAvatar || undefined,
        };
      }),
      days: (days || []).map(([dayNumber, date, dayTitle, items]) => ({
        dayNumber,
        date,
        title: dayTitle || undefined,
        items: (items || []).map(
          ([time, itTitle, catIdx, location, itMemo, endTime, transIdx, cost], itemIdx) => ({
            id: `it-${dayNumber}-${itemIdx + 1}`,
            time: time || '09:00',
            endTime: endTime || undefined,
            title: itTitle || '予定',
            category: CATS[catIdx] || 'other',
            location: location || undefined,
            locationUrl: location
              ? `https://maps.google.com/?q=${encodeURIComponent(location)}`
              : undefined,
            memo: itMemo || undefined,
            transportType: transIdx >= 0 ? TRANS[transIdx] : undefined,
            cost: cost || undefined,
          })
        ),
      })),
      packingList: [],
      souvenirs: [],
      expenses: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  // 完全版（バージョン1または既存形式）
  const [
    , // version
    id,
    title,
    subtitle,
    destination,
    startDate,
    endDate,
    cover,
    themeColor,
    timeZoneOffset,
    timeZoneName,
    memo,
    members,
    days,
    packingList,
    souvenirs,
    expenses,
  ] = arr as [
    number,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    number,
    string,
    string,
    [string, string, string, string, string?, string?][],
    [number, string, string, [string, string, string, string, number, string, string, number, number, string][]][],
    [string, string, number, number, string][],
    [string, string, string, string, number, number, string][],
    [string, string, number, string, string[], string, number, string][]
  ];

  // プリセットカバーの復元
  let coverImage = cover;
  if (typeof cover === 'string' && cover.startsWith('@')) {
    const idx = parseInt(cover.slice(1), 10);
    coverImage = PRESET_COVERS[idx]?.url || PRESET_COVERS[0].url;
  }

  const now = new Date().toISOString();

  const restored: Trip = {
    id: id || 'trip-' + Date.now(),
    title: title || '無題のしおり',
    subtitle: subtitle || undefined,
    destination: destination || '',
    startDate: startDate || '',
    endDate: endDate || '',
    coverImage: coverImage || PRESET_COVERS[0].url,
    themeColor: themeColor || '#2563eb',
    timeZoneOffset: timeZoneOffset ?? 0,
    timeZoneName: timeZoneName || undefined,
    memo: memo || undefined,
    members: (members || []).map(([mid, name, avatarColor, role, email, avatarUrl], idx) => {
      let restoredAvatar = avatarUrl;
      if (restoredAvatar && restoredAvatar.startsWith('*')) {
        const pIdx = parseInt(restoredAvatar.slice(1), 10);
        restoredAvatar = PRESET_AVATARS[pIdx]?.url || undefined;
      }
      return {
        id: mid || 'm' + (idx + 1),
        name: name || 'メンバー',
        avatarColor: avatarColor || '#3b82f6',
        role: role || undefined,
        email: email || undefined,
        avatarUrl: restoredAvatar || undefined,
      };
    }),
    days: (days || []).map(([dayNumber, date, dayTitle, items]) => ({
      dayNumber,
      date,
      title: dayTitle || undefined,
      items: (items || []).map(
        ([itId, time, endTime, itTitle, catIdx, location, itMemo, cost, transIdx, locationUrl], itemIdx) => ({
          id: itId || `it-${dayNumber}-${itemIdx}`,
          time: time || '09:00',
          endTime: endTime || undefined,
          title: itTitle || '予定',
          category: CATS[catIdx] || 'other',
          location: location || undefined,
          memo: itMemo || undefined,
          cost: cost || undefined,
          transportType: transIdx >= 0 ? TRANS[transIdx] : undefined,
          locationUrl:
            locationUrl ||
            (location ? `https://maps.google.com/?q=${encodeURIComponent(location)}` : undefined),
        })
      ),
    })),
    packingList: (packingList || []).map(([pid, name, catIdx, checked, assignedMemberId], idx) => ({
      id: pid || 'p' + idx,
      name: name || '持ち物',
      category: PACK_CATS[catIdx] || 'essential',
      isChecked: Boolean(checked),
      assignedMemberId: assignedMemberId || undefined,
    })),
    souvenirs: (souvenirs || []).map(([sid, name, forWhom, place, isBought, price, sMemo], idx) => ({
      id: sid || 's' + idx,
      name: name || 'お土産',
      forWhom: forWhom || undefined,
      place: place || undefined,
      isBought: Boolean(isBought),
      price: price || undefined,
      memo: sMemo || undefined,
    })),
    expenses: (expenses || []).map(([eid, expTitle, amount, payerId, targetMemberIds, date, catIdx, eMemo], idx) => ({
      id: eid || 'e' + idx,
      title: expTitle || '支出',
      amount: amount || 0,
      payerId: payerId || 'm1',
      targetMemberIds: targetMemberIds || [],
      date: date || startDate,
      category: EXP_CATS[catIdx] || 'other',
      memo: eMemo || undefined,
    })),
    createdAt: now,
    updatedAt: now,
  };

  return restored;
}

export const shareService = {
  /**
   * しおりを圧縮してBase64URL文字列に変換
   */
  compressTrip(trip: Trip): string {
    try {
      const packed = packTrip(trip);
      const json = JSON.stringify(packed);
      const u8 = strToU8(json);
      const deflated = deflateSync(u8, { level: 9 });
      return u8ToBase64Url(deflated);
    } catch (e) {
      console.error('Failed to compress trip:', e);
      throw new Error('しおりデータの圧縮に失敗しました');
    }
  },

  /**
   * Base64URL文字列からしおりを復元
   */
  decompressTrip(b64url: string): Trip | null {
    try {
      const u8 = base64UrlToU8(b64url);
      const inflated = inflateSync(u8);
      const json = strFromU8(inflated);
      const packed = JSON.parse(json);

      // 配列形式（packTripまたはpackTripForQr形式）の場合
      if (Array.isArray(packed)) {
        return unpackTrip(packed);
      }

      // 従来の完全なJSONオブジェクト形式が直接渡された場合のフォールバック
      if (packed && typeof packed === 'object' && packed.title) {
        return packed as Trip;
      }

      return null;
    } catch (e) {
      console.error('Failed to decompress trip from share string:', e);
      return null;
    }
  },

  /**
   * 共有用URLを生成（完全版データ）
   * @param trip しおりオブジェクト
   * @param customOrigin ローカルIP指定など任意のオリジン（省略時は window.location.origin）
   */
  generateShareUrl(trip: Trip, customOrigin?: string): string {
    const compressed = this.compressTrip(trip);
    const origin = customOrigin ? customOrigin.replace(/\/+$/, '') : window.location.origin;
    const pathname = window.location.pathname;
    return `${origin}${pathname}#share=${compressed}`;
  },

  /**
   * QRコード生成用URLを取得
   * （スマホカメラでの高速・高認識率読み取りのため、1,200文字以下なら完全版、超える場合は主要スケジュール軽量版を自動生成）
   */
  generateQrCodeUrl(trip: Trip, customOrigin?: string): { url: string; isLightweight: boolean } {
    const fullUrl = this.generateShareUrl(trip, customOrigin);
    // 1,200文字以下なら完全版URLのままQRコード化（スマホカメラで即座に読める快適サイズ）
    if (fullUrl.length <= 1200) {
      return { url: fullUrl, isLightweight: false };
    }
    // 1,200文字を超える場合はQR専用軽量ペイロード（全日程・時間・場所・時差に特化）を生成
    try {
      const packed = packTripForQr(trip);
      const json = JSON.stringify(packed);
      const u8 = strToU8(json);
      const deflated = deflateSync(u8, { level: 9 });
      const b64 = u8ToBase64Url(deflated);
      const origin = customOrigin ? customOrigin.replace(/\/+$/, '') : window.location.origin;
      const pathname = window.location.pathname;
      return {
        url: `${origin}${pathname}#share=${b64}`,
        isLightweight: true,
      };
    } catch (e) {
      console.error('Failed to generate QR code URL:', e);
      return { url: fullUrl, isLightweight: false };
    }
  },

  /**
   * URLハッシュまたはURL文字列から共有しおりデータを抽出・復元
   */
  parseShareDataFromUrl(urlOrHash: string): Trip | null {
    try {
      const raw = (urlOrHash || '').trim();
      let sharePayload = '';

      if (raw.includes('share=')) {
        const afterPrefix = raw.slice(raw.indexOf('share=') + 'share='.length);
        // 末尾のクエリ・ハッシュ・空白・改行などを切り離す
        sharePayload = afterPrefix.split(/[&#\s?]/)[0];
      } else if (raw.includes('#')) {
        sharePayload = raw.split('#')[1] || '';
      } else {
        sharePayload = raw;
      }

      // 末尾スラッシュや記号・空白を除去
      sharePayload = sharePayload.replace(/[/\\'">\s)]+$/, '').replace(/^[/\\'"<\s(]+/, '');

      if (!sharePayload) return null;

      // QRリーダーやブラウザによるURLエスケープ（%2D, %5F, %2B等）をデコード
      try {
        if (sharePayload.includes('%')) {
          sharePayload = decodeURIComponent(sharePayload);
        }
      } catch {
        // デコード不能ならそのまま
      }

      return this.decompressTrip(sharePayload);
    } catch (e) {
      console.error('Failed to parse share data from URL:', e);
      return null;
    }
  },
};
