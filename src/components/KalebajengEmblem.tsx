import { useState } from 'react';
import kalebajengEmblemImg from '../assets/images/kalebajeng_regional_emblem_1795579001344.jpg';

interface KalebajengEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<KalebajengEmblemProps['size']>, string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-14 h-14 rounded-xl',
  xl: 'w-20 h-20 rounded-2xl',
};

export function KalebajengEmblem({
  size = 'md',
  className = '',
}: KalebajengEmblemProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden bg-slate-900 border border-amber-400/50 shadow-sm shrink-0 flex items-center justify-center ${SIZE_CLASSES[size]} ${className}`}
    >
      {!imgFailed ? (
        <img
          src={kalebajengEmblemImg}
          alt="Lambang wilayah Kalebajeng, Kecamatan Bajeng, Kabupaten Gowa, Sulawesi Selatan"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover select-none"
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full p-1.5"
          role="img"
          aria-label="Lambang Kalebajeng Sulawesi Selatan"
        >
          {/* Sulapa Appa outer diamond & pentagonal Makassar shield */}
          <polygon
            points="32,4 58,20 50,54 32,60 14,54 6,20"
            fill="#064e3b"
            stroke="#fbbf24"
            strokeWidth="2.5"
          />
          {/* Timbasila stepped Makassar gable roof */}
          <polygon points="32,16 48,32 16,32" fill="#f59e0b" />
          <polygon points="32,22 44,34 20,34" fill="#0f172a" />
          {/* Balla Lompoa house pillars */}
          <rect x="20" y="35" width="24" height="12" fill="#fbbf24" rx="1" />
          <line x1="24" y1="47" x2="24" y2="53" stroke="#fbbf24" strokeWidth="2.5" />
          <line x1="32" y1="47" x2="32" y2="53" stroke="#fbbf24" strokeWidth="2.5" />
          <line x1="40" y1="47" x2="40" y2="53" stroke="#fbbf24" strokeWidth="2.5" />
          {/* Ulu Tedong horn ornament */}
          <path
            d="M27 12 C29 16, 35 16, 37 12"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
