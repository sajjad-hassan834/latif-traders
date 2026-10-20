import React from 'react';

/**
 * ShopOS brand logo image.
 * Props:
 *   size  – width & height in px (default 36)
 *   className – optional CSS class
 *   style – optional inline styles
 */
export default function LtLogo({ size = 36, className = '', style = {} }) {
  return (
    <img
      src="/logo.png"
      alt="ShopOS Logo"
      width={size}
      height={size}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '8px',
        objectFit: 'contain',
        display: 'block',
        ...style
      }}
    />
  );
}
