import { useState } from 'react';
import kalebajengEmblemLightImg from '../assets/images/kalebajeng_emblem_light_1795586564231.jpg';

interface KalebajengEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<KalebajengEmblemProps['size']>, string> = {
  sm: 'w-9 h-9 rounded-lg p-0.5',
  md: 'w-12 h-12 rounded-xl p-0.5',
  lg: 'w-16 h-16 rounded-xl p-1',
  xl: 'w-24 h-24 rounded-2xl p-1.5',
};

export function KalebajengEmblem({
  size = 'md',
  className = '',
}: KalebajengEmblemProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden bg-white border border-amber-300/90 shadow-sm shrink-0 flex items-center justify-center ${SIZE_CLASSES[size]} ${className}`}
    >
      {!imgFailed ? (
        <img
          src={kalebajengEmblemLightImg}
          alt="Ikonik Wilayah Kalebajeng, Kecamatan Bajeng, Kabupaten Gowa, Sulawesi Selatan"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain select-none"
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full p-1"
          role="img"
          aria-label="Ikonik Wilayah Kalebajeng Sulawesi Selatan"
        >
          <polygon
            points="32,4 58,20 50,54 32,60 14,54 6,20"
            fill="#0284c7"
            stroke="#f59e0b"
            strokeWidth="2.5"
          />
          <polygon points="32,16 48,32 16,32" fill="#facc15" />
          <polygon points="32,22 44,34 20,34" fill="#059669" />
          <rect x="20" y="35" width="24" height="12" fill="#facc15" rx="1" />
          <path
            d="M27 12 C29 16, 35 16, 37 12"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
