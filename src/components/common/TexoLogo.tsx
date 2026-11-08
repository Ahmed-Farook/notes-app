import React from 'react';
export { TexoMark } from './TexoMark';

interface TexoLogoProps {
  size?: number;
  className?: string;
}

export const TexoLogo: React.FC<TexoLogoProps> = ({ size = 28, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="texō"
    >
      <path
        d="M28 0H78L120 42V92A28 28 0 0 1 92 120H28A28 28 0 0 1 0 92V28A28 28 0 0 1 28 0Z"
        fill="#263850"
      />
      <path d="M78 0L120 42H90A12 12 0 0 1 78 30Z" fill="#4C627E" />
      <g
        transform="translate(19.8 27.5) scale(0.58)"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M52 20V70C52 90 63 101 80 99C90 98 96 92 98 84"
          stroke="#F5F0E6"
          strokeWidth="15"
        />
        <path d="M20 56C44 54 72 44 98 36" stroke="#263850" strokeWidth="23" />
        <path d="M20 56C44 54 72 44 88 37" stroke="#F5F0E6" strokeWidth="15" />
      </g>
    </svg>
  );
};

