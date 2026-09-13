/**
 * 時差・タイムゾーン換算ユーティリティ
 */

export interface TimeZonePreset {
  id: string;
  name: string;
  offset: number; // 日本時間(JST: UTC+9)との時差 (現地時刻 - 日本時刻)
  // 例: バルセロナ夏時間 CEST(UTC+2) は JST(UTC+9) より 7時間遅いので -7
  region: string;
  flag: string;
}

export const TIMEZONE_PRESETS: TimeZonePreset[] = [
  { id: 'jp', name: '日本国内 / 韓国 (時差なし)', offset: 0, region: '日本・東アジア', flag: '🇯🇵' },
  { id: 'tw_cn', name: '台湾 / 中国 / 香港 / シンガポール (-1時間)', offset: -1, region: '東アジア・東南アジア', flag: '🇹🇼' },
  { id: 'th_vn', name: 'タイ / ベトナム / インドネシア西部 (-2時間)', offset: -2, region: '東南アジア', flag: '🇹🇭' },
  { id: 'in', name: 'インド (-3.5時間)', offset: -3.5, region: '南アジア', flag: '🇮🇳' },
  { id: 'uae', name: 'ドバイ / UAE (-5時間)', offset: -5, region: '中東', flag: '🇦🇪' },
  { id: 'eu_summer', name: 'スペイン / フランス / イタリア / ドイツ (夏時間: -7時間)', offset: -7, region: '西欧・中央欧州 (夏)', flag: '🇪🇸' },
  { id: 'eu_winter', name: 'スペイン / フランス / イタリア / ドイツ (冬時間: -8時間)', offset: -8, region: '西欧・中央欧州 (冬)', flag: '🇪🇺' },
  { id: 'uk_summer', name: 'イギリス / ロンドン (夏時間: -8時間)', offset: -8, region: '英国 (夏)', flag: '🇬🇧' },
  { id: 'uk_winter', name: 'イギリス / ロンドン (冬時間: -9時間)', offset: -9, region: '英国 (冬)', flag: '🇬🇧' },
  { id: 'us_ny_summer', name: 'アメリカ東部 / ニューヨーク (夏時間: -13時間)', offset: -13, region: '北米東部 (夏)', flag: '🇺🇸' },
  { id: 'us_ny_winter', name: 'アメリカ東部 / ニューヨーク (冬時間: -14時間)', offset: -14, region: '北米東部 (冬)', flag: '🇺🇸' },
  { id: 'us_la_summer', name: 'アメリカ西部 / ロサンゼルス (夏時間: -16時間)', offset: -16, region: '北米太平洋 (夏)', flag: '🇺🇸' },
  { id: 'us_la_winter', name: 'アメリカ西部 / ロサンゼルス (冬時間: -17時間)', offset: -17, region: '北米太平洋 (冬)', flag: '🇺🇸' },
  { id: 'us_hi', name: 'ハワイ・ホノルル (-19時間)', offset: -19, region: 'ハワイ', flag: '🌺' },
  { id: 'us_gu', name: 'グアム・サイパン (+1時間)', offset: 1, region: 'ミクロネシア', flag: '🇬🇺' },
  { id: 'au_syd_summer', name: 'オーストラリア / シドニー (夏時間: +2時間)', offset: 2, region: 'オセアニア (夏)', flag: '🇦🇺' },
  { id: 'au_syd_winter', name: 'オーストラリア / シドニー (冬時間: +1時間)', offset: 1, region: 'オセアニア (冬)', flag: '🇦🇺' },
];

export interface ConvertedTime {
  time: string; // "17:00" or "終日"
  dayOffset: number; // -1: 前日, 0: 当日, 1: 翌日
  formatted: string; // "17:00" or "+1日 05:00" or "前日 22:00"
}

/**
 * 時刻文字列（例: "10:00"）を時差に基づいて換算する
 * @param timeStr "HH:mm" または "終日"
 * @param offsetHours 日本時間との時差 (現地時刻 - 日本時刻)。例: バルセロナなら -7
 * @param toJst true: 現地時間 → 日本時間, false: 日本時間 → 現地時間
 */
export function convertTimeToTimezone(
  timeStr: string | undefined,
  offsetHours: number,
  toJst: boolean
): ConvertedTime {
  if (!timeStr || timeStr === '終日') {
    return { time: '終日', dayOffset: 0, formatted: '終日' };
  }

  const parts = timeStr.split(':');
  if (parts.length < 2) {
    return { time: timeStr, dayOffset: 0, formatted: timeStr };
  }

  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) {
    return { time: timeStr, dayOffset: 0, formatted: timeStr };
  }

  // 現地時間から日本時間へ: JST = Local - offsetHours (例: 10:00 - (-7) = 17:00)
  // 日本時間から現地時間へ: Local = JST + offsetHours (例: 17:00 + (-7) = 10:00)
  const shiftHours = toJst ? -offsetHours : offsetHours;

  const totalOriginalMinutes = hour * 60 + minute;
  const shiftMinutes = Math.round(shiftHours * 60);
  let totalConvertedMinutes = totalOriginalMinutes + shiftMinutes;

  let dayOffset = 0;

  while (totalConvertedMinutes < 0) {
    totalConvertedMinutes += 24 * 60;
    dayOffset -= 1;
  }

  while (totalConvertedMinutes >= 24 * 60) {
    totalConvertedMinutes -= 24 * 60;
    dayOffset += 1;
  }

  const convertedHour = Math.floor(totalConvertedMinutes / 60);
  const convertedMin = totalConvertedMinutes % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const time = `${pad(convertedHour)}:${pad(convertedMin)}`;

  let formatted = time;
  if (dayOffset === 1) {
    formatted = `+1日 ${time}`;
  } else if (dayOffset > 1) {
    formatted = `+${dayOffset}日 ${time}`;
  } else if (dayOffset === -1) {
    formatted = `-1日 ${time}`;
  } else if (dayOffset < -1) {
    formatted = `${dayOffset}日 ${time}`;
  }

  return { time, dayOffset, formatted };
}

/**
 * テキスト（地名、タイトル、タイムゾーンID）から時差設定を推測する
 */
export function inferTimeZone(
  text: string,
  timeZoneId?: string
): { offset: number; name: string } | null {
  const lower = `${text} ${timeZoneId || ''}`.toLowerCase();

  // タイムゾーンID直接マッチ
  if (timeZoneId) {
    const tzLower = timeZoneId.toLowerCase();
    if (tzLower.includes('madrid') || tzLower.includes('paris') || tzLower.includes('rome') || tzLower.includes('berlin') || tzLower.includes('europe/')) {
      return { offset: -7, name: '西欧・バルセロナ (夏時間: -7h)' };
    }
    if (tzLower.includes('london')) {
      return { offset: -8, name: '英国・ロンドン (夏時間: -8h)' };
    }
    if (tzLower.includes('shanghai') || tzLower.includes('taipei') || tzLower.includes('hong_kong') || tzLower.includes('singapore')) {
      return { offset: -1, name: '台湾 / 中国 / 香港 / シンガポール (-1h)' };
    }
    if (tzLower.includes('bangkok') || tzLower.includes('ho_chi_minh') || tzLower.includes('jakarta')) {
      return { offset: -2, name: 'タイ / ベトナム (-2h)' };
    }
    if (tzLower.includes('honolulu') || tzLower.includes('hawaii')) {
      return { offset: -19, name: 'ハワイ・ホノルル (-19h)' };
    }
    if (tzLower.includes('new_york')) {
      return { offset: -13, name: 'ニューヨーク (夏時間: -13h)' };
    }
    if (tzLower.includes('los_angeles')) {
      return { offset: -16, name: 'ロサンゼルス (夏時間: -16h)' };
    }
    if (tzLower.includes('sydney')) {
      return { offset: 2, name: 'シドニー (夏時間: +2h)' };
    }
    if (tzLower.includes('tokyo') || tzLower.includes('asia/seoul')) {
      return { offset: 0, name: '日本国内 / 韓国 (時差なし)' };
    }
  }

  // キーワードマッチ
  if (/バルセロナ|barcelona|マドリード|madrid|スペイン|spain|パリ|paris|フランス|france|ローマ|rome|イタリア|italy|ドイツ|germany|スイス|swiss/.test(lower)) {
    return { offset: -7, name: '西欧・バルセロナ (夏時間: -7h)' };
  }
  if (/ロンドン|london|イギリス|uk|英国/.test(lower)) {
    return { offset: -8, name: '英国・ロンドン (夏時間: -8h)' };
  }
  if (/台湾|台北|taipei|上海|shanghai|北京|香港|hong kong|シンガポール|singapore/.test(lower)) {
    return { offset: -1, name: '台湾 / 中国 / 香港 / シンガポール (-1h)' };
  }
  if (/タイ|バンコク|bangkok|プーケット|ベトナム|ダナン|ハノイ|ホーチミン/.test(lower)) {
    return { offset: -2, name: 'タイ / ベトナム (-2h)' };
  }
  if (/ハワイ|hawaii|ホノルル|honolulu|ワイキキ|waikiki/.test(lower)) {
    return { offset: -19, name: 'ハワイ・ホノルル (-19h)' };
  }
  if (/ニューヨーク|new york|nyc/.test(lower)) {
    return { offset: -13, name: 'ニューヨーク (夏時間: -13h)' };
  }
  if (/ロサンゼルス|los angeles|la|サンフランシスコ|san francisco/.test(lower)) {
    return { offset: -16, name: 'ロサンゼルス (夏時間: -16h)' };
  }
  if (/シドニー|sydney|メルボルン|オーストラリア|australia/.test(lower)) {
    return { offset: 2, name: 'シドニー (夏時間: +2h)' };
  }

  return null;
}
