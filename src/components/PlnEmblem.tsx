import { useState } from 'react';

interface PlnEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlnEmblemProps['size']>, string> = {
  sm: 'w-8 h-9 rounded-lg p-1',
  md: 'w-11 h-12 rounded-xl p-1',
  lg: 'w-14 h-16 rounded-xl p-1.5',
  xl: 'w-20 h-24 rounded-2xl p-2',
};

export function PlnEmblem({ size = 'md', className = '' }: PlnEmblemProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden bg-white border border-sky-200/90 shadow-sm shrink-0 flex items-center justify-center ${SIZE_CLASSES[size]} ${className}`}
    >
      {!imgFailed ? (
        <img
          src="/assets/aistudio/image_1141f2f1.png"
          alt="Logo Resmi PLN"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain select-none"
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full"
          role="img"
          aria-label="Lambang Resmi PT PLN (Persero)"
        >
          <rect
            x="3"
            y="3"
            width="58"
            height="58"
            rx="6"
            fill="#FFF200"
            stroke="#EAB308"
            strokeWidth="1.5"
          />
          <path
            d="M11 26 C19 23, 27 29, 36 26 C43 24, 48 25.5, 53 26.5 L53 30.5 C48 29.5, 43 28, 36 30 C27 33, 19 27, 11 30 Z"
            fill="#00A2E9"
          />
          <path
            d="M11 35 C19 32, 27 38, 36 35 C43 33, 48 34.5, 53 35.5 L53 39.5 C48 38.5, 43 37, 36 39 C27 42, 19 36, 11 39 Z"
            fill="#00A2E9"
          />
          <path
            d="M11 44 C19 41, 27 47, 36 44 C43 42, 48 43.5, 53 44.5 L53 48.5 C48 47.5, 43 46, 36 48 C27 51, 19 45, 11 48 Z"
            fill="#00A2E9"
          />
          <polygon
            points="39,8 21,34 32,34 25,56 45,28 34,28"
            fill="#ED1C24"
            stroke="#FFF200"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
