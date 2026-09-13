import React, { useState } from 'react';
import { PRESET_AVATARS } from '../../utils/imageUtils';
import './MemberAvatar.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

interface MemberAvatarProps {
  name: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', { px: number; fontSize: string }> = {
  xs: { px: 18, fontSize: '0.6rem' },
  sm: { px: 24, fontSize: '0.72rem' },
  md: { px: 32, fontSize: '0.88rem' },
  lg: { px: 42, fontSize: '1.05rem' },
  xl: { px: 64, fontSize: '1.6rem' },
};

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  avatarColor = '#3b82f6',
  avatarUrl,
  size = 'md',
  className = '',
  style = {},
  title,
}) => {
  // 短縮記号（*0, *1等）が直接渡された場合の解決フォールバック
  let resolvedUrl = avatarUrl;
  if (resolvedUrl && resolvedUrl.startsWith('*')) {
    const pIdx = parseInt(resolvedUrl.slice(1), 10);
    resolvedUrl = PRESET_AVATARS[pIdx]?.url || resolvedUrl;
  }

  const [prevUrl, setPrevUrl] = useState(resolvedUrl);
  const [imgError, setImgError] = useState(false);

  // URLが変わったらエラー状態を直接リセット
  if (prevUrl !== resolvedUrl) {
    setPrevUrl(resolvedUrl);
    setImgError(false);
  }

  let dimensionPx = 32;
  let fontPx = '0.88rem';

  if (typeof size === 'number') {
    dimensionPx = size;
    fontPx = `${Math.max(10, Math.round(size * 0.4))}px`;
  } else if (SIZE_MAP[size]) {
    dimensionPx = SIZE_MAP[size].px;
    fontPx = SIZE_MAP[size].fontSize;
  }

  const initialLetter = name ? name.trim().slice(0, 1) : '?';
  const showImage = Boolean(resolvedUrl && !imgError);

  return (
    <div
      className={`member-avatar-unified ${showImage ? 'has-image' : 'initial-fallback'} ${className}`}
      style={{
        width: `${dimensionPx}px`,
        height: `${dimensionPx}px`,
        minWidth: `${dimensionPx}px`,
        minHeight: `${dimensionPx}px`,
        backgroundColor: avatarColor,
        fontSize: fontPx,
        ...style,
      }}
      title={title ?? name}
      aria-label={name}
    >
      {showImage ? (
        <img
          src={avatarUrl!}
          alt={name}
          className="member-avatar-img"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <span className="member-avatar-initial">{initialLetter}</span>
      )}
    </div>
  );
};
