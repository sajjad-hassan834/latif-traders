import React from 'react';
import BrandLogo from './BrandLogo';

/**
 * ShoppyOS brand logo wrapper.
 * Props:
 *   size      – width & height in px (default 36)
 *   variant   – 'symbol' | 'horizontal' | 'stacked' | 'wordmark'
 *   tone      – 'auto' | 'dark' | 'light' | 'mono'
 *   className – optional CSS class
 *   style     – optional inline styles
 */
export default function LtLogo({
  size = 36,
  variant = 'symbol',
  tone = 'auto',
  className = '',
  style = {}
}) {
  return (
    <BrandLogo
      variant={variant}
      tone={tone}
      size={size}
      className={className}
      style={style}
    />
  );
}
