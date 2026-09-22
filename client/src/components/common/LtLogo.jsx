import React from 'react';

/**
 * Latif Traders brand logo – LT lettermark with snowflake.
 * Props:
 *   size  – width & height in px (default 36)
 *   className – optional CSS class
 */
export default function LtLogo({ size = 36, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="Latif Traders Logo"
    >
      {/* Navy – L vertical bar */}
      <rect x="8" y="8" width="18" height="68" rx="2" fill="#1a2e5e" />
      {/* Navy – L horizontal bar */}
      <rect x="8" y="62" width="46" height="18" rx="2" fill="#1a2e5e" />
      {/* Cyan – T top bar */}
      <rect x="32" y="8" width="60" height="18" rx="2" fill="#00aeef" />
      {/* Cyan – T vertical bar */}
      <rect x="72" y="8" width="18" height="54" rx="2" fill="#00aeef" />

      {/* Snowflake centred in the L/T intersection */}
      <g transform="translate(50,44)" stroke="#00aeef" strokeWidth="3.5" strokeLinecap="round">
        <line x1="0" y1="-13" x2="0" y2="13" />
        <line x1="-13" y1="0" x2="13" y2="0" />
        <line x1="-9.2" y1="-9.2" x2="9.2" y2="9.2" />
        <line x1="9.2" y1="-9.2" x2="-9.2" y2="9.2" />
        {/* arm nubs – top */}
        <line x1="-4" y1="-9" x2="0" y2="-13" /><line x1="4" y1="-9" x2="0" y2="-13" />
        {/* arm nubs – bottom */}
        <line x1="-4" y1="9" x2="0" y2="13" /><line x1="4" y1="9" x2="0" y2="13" />
        {/* arm nubs – left */}
        <line x1="-9" y1="-4" x2="-13" y2="0" /><line x1="-9" y1="4" x2="-13" y2="0" />
        {/* arm nubs – right */}
        <line x1="9" y1="-4" x2="13" y2="0" /><line x1="9" y1="4" x2="13" y2="0" />
      </g>
    </svg>
  );
}
