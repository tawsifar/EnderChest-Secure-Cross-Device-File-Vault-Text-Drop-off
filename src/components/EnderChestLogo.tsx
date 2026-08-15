import React from 'react';

interface EnderChestLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showGlow?: boolean;
  className?: string;
}

export default function EnderChestLogo({
  size = 'md',
  showGlow = true,
  className = '',
}: EnderChestLogoProps) {
  const dimensionMap = {
    sm: 36,
    md: 48,
    lg: 72,
    xl: 96,
  };

  const dim = dimensionMap[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: dim, height: dim }}
    >
      {showGlow && (
        <div
          className="absolute inset-0 rounded-lg bg-teal-500/20 blur-md animate-eye-glow pointer-events-none"
          style={{ transform: 'scale(1.15)' }}
        />
      )}

      {/* Custom EnderChest Logo Image */}
      <img
        src="https://minecraft.wiki/images/Ender_Chest.png"
        alt="EnderChest Logo"
        className="relative z-10 drop-shadow-md object-cover rounded-xl"
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
      />
    </div>
  );
}
