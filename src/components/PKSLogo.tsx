import React from 'react';

interface PKSLogoProps {
  className?: string;
  size?: number;
}

export const PKSLogo: React.FC<PKSLogoProps> = ({ className = 'w-9 h-9', size }) => {
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full bg-[#F27D26] text-white font-black shadow-sm select-none ${className}`}
      style={style}
    >
      <img
        src="/pks_logo.svg"
        alt="PKS"
        className="w-full h-full object-contain rounded-full"
        onError={(e) => {
          // Fallback if SVG load fails
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
};
