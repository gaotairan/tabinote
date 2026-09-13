import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';
import type {
  Trip,
  ScheduleCategory,
  TransportType,
  PackingCategory,
  ExpenseCategory,
} from '../types/trip';
import { PRESET_COVERS } from '../mock/sampleTrip';

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
 * Base64URL文字列をUint8Arrayに変換（ブラウザ互換）
 */
function base64UrlToU8(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
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
 * しおりデータをQRコード・URL共有用に最適化されたコンパクト配列に圧縮
 */
function packTrip(t: Trip): unknown[] {
  // プリセットカバーの短縮（@0 〜 @7）
  let cover = t.coverImage || '';
  for (let i = 0; i < PRESET_COVERS.length; i++) {
    const p = PRESET_COVERS[i];
    if (cover === p.id || cover === p.url || (p.url && cover.includes(p.url.slice(0, 40)))) {
      cover = '@' + i;
      break;
    }
  }

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
    t.members?.map((m) => [m.id, m.name, m.avatarColor, m.role || '', m.email || '']) || [],
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
    [string, string, string, string, string?][],
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
    members: (members || []).map(([mid, name, avatarColor, role, email], idx) => ({
      id: mid || 'm' + (idx + 1),
      name: name || 'メンバー',
      avatarColor: avatarColor || '#3b82f6',
      role: role || undefined,
      email: email || undefined,
    })),
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

      // 配列形式（packTrip形式）の場合
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
   * 共有用URLを生成
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
   * URLハッシュまたはURL文字列から共有しおりデータを抽出・復元
   */
  parseShareDataFromUrl(urlOrHash: string): Trip | null {
    try {
      const raw = urlOrHash || '';
      let sharePayload = '';

      if (raw.includes('share=')) {
        const afterPrefix = raw.slice(raw.indexOf('share=') + 'share='.length);
        sharePayload = afterPrefix.split(/[&#\s?]/)[0];
      } else if (raw.includes('#')) {
        sharePayload = raw.split('#')[1] || '';
      } else {
        sharePayload = raw;
      }

      if (!sharePayload) return null;

      // QRリーダーやブラウザによるURLエスケープ（%2D, %5F, %2B等）をデコード
      try {
        sharePayload = decodeURIComponent(sharePayload);
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
