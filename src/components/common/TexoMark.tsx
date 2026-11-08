import React from 'react';
import texoLogoBlue from '../../assets/texo-logo-blue.png';
import texoLogoWhite from '../../assets/texo-logo-white.png';

interface TexoMarkProps {
  size?: number;
  className?: string;
}

export const TexoMark: React.FC<TexoMarkProps> = ({ size = 20, className = '' }) => {
  return (
    <div
      className={`relative shrink-0 flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={texoLogoBlue}
        alt="texō"
        width={size}
        height={size}
        className="dark:hidden w-full h-full object-contain pointer-events-none"
        draggable={false}
      />
      <img
        src={texoLogoWhite}
        alt="texō"
        width={size}
        height={size}
        className="hidden dark:block w-full h-full object-contain pointer-events-none"
        draggable={false}
      />
    </div>
  );
};
