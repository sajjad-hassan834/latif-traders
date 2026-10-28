import React from 'react';

/**
 * TenantLogo renders the active tenant's brand logo.
 * If a custom logo_url is provided, it renders that image.
 * If the tenant is default tenant and no custom logo is uploaded, it renders the default logo.
 * For all other tenants without a logo, it renders a clean, professional monogram with the
 * first letter of the shop's name, guaranteeing zero logo leakage across tenants.
 */
export default function TenantLogo({ tenant, size = 32, style = {}, className = '' }) {
  const shopName = tenant?.business_name || 'Shop';
  const initial = shopName.trim().charAt(0).toUpperCase() || 'S';

  if (tenant?.logo_url) {
    return (
      <img
        src={tenant.logo_url}
        alt={shopName}
        width={size}
        height={size}
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '8px',
          objectFit: 'cover',
          display: 'block',
          border: '1px solid var(--border)',
          ...style
        }}
        onError={(e) => {
          // If image fails to load, fall back to monogram
          e.currentTarget.style.display = 'none';
          if (e.currentTarget.nextSibling) {
            e.currentTarget.nextSibling.style.display = 'flex';
          }
        }}
      />
    );
  }

  // Base default store
  if (tenant?.is_default) {
    return (
      <img
        src="/logo.png"
        alt={shopName}
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

  // Tenant monogram badge for all other shops without a custom logo
  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '8px',
        background: 'linear-gradient(135deg, var(--primary) 0%, #0284c7 100%)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: `${Math.max(12, Math.round(size * 0.45))}px`,
        textTransform: 'uppercase',
        flexShrink: 0,
        boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
        letterSpacing: '0.02em',
        ...style
      }}
      title={shopName}
    >
      {initial}
    </div>
  );
}
