/**
 * 画像の自動クロップ＆圧縮・リサイズユーティリティ
 */

/**
 * アップロードされた画像ファイルを中央正方形にクロップ＆リサイズし、
 * 容量を抑えたBase64データURI文字列として取得します。
 * 
 * @param file ユーザーが選択した画像ファイル
 * @param targetSize 出力正方形の一辺（px、デフォルト200px）
 * @param quality 圧縮品質（0.0〜1.0、デフォルト0.85）
 * @returns Base64データURI（例: data:image/jpeg;base64,...）
 */
export async function cropAndCompressImage(
  file: File,
  targetSize = 200,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 画像ファイルかチェック
    if (!file.type.startsWith('image/')) {
      reject(new Error('画像ファイルを選択してください'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('画像の読み込みに失敗しました'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas contextの取得に失敗しました'));
            return;
          }

          // 中央正方形クロップ計算
          const naturalWidth = img.naturalWidth || img.width;
          const naturalHeight = img.naturalHeight || img.height;
          const minSide = Math.min(naturalWidth, naturalHeight);

          const sx = (naturalWidth - minSide) / 2;
          const sy = (naturalHeight - minSide) / 2;

          // 背景を白で塗る（透過PNG対策）
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetSize, targetSize);

          // 中央正方形を描画
          ctx.drawImage(
            img,
            sx,
            sy,
            minSide,
            minSide,
            0,
            0,
            targetSize,
            targetSize
          );

          // JPEGで軽量圧縮
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('画像データの解析に失敗しました'));
      };

      img.src = src;
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込み中にエラーが発生しました'));
    };

    reader.readAsDataURL(file);
  });
}

export interface PresetAvatar {
  id: string;
  label: string;
  category: 'travel' | 'people' | 'animal';
  url: string;
}

/**
 * メンバー用おすすめプリセットアバター集（旅＆人物＆キャラクター）
 * 軽量かつ高品質なUnsplash正方形画像（160x160にクロップ済み）
 */
export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'traveler-m1',
    label: 'カメラ男子',
    category: 'travel',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'traveler-f1',
    label: 'カメラ女子',
    category: 'travel',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'traveler-m2',
    label: '爽やか男性',
    category: 'people',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'traveler-f2',
    label: '笑顔の女性',
    category: 'people',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'traveler-m3',
    label: 'アウトドア男性',
    category: 'travel',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'traveler-f3',
    label: '帽子女子',
    category: 'travel',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'pet-cat',
    label: '旅ネコ',
    category: 'animal',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'pet-dog',
    label: '旅イヌ',
    category: 'animal',
    url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'traveler-sunglasses',
    label: 'サングラス',
    category: 'travel',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80',
  },
];
