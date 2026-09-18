import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'var(--primary)', bg = 'var(--primary-light)' }) {
  return (
    <div className="card stat-card" style={{ '--stat-accent': color, '--stat-bg': bg }}>
      <div>
        <div className="stat-label">{title}</div>
        <div className="stat-value">{value}</div>
        {subtitle && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {subtitle}
          </div>
        )}
      </div>
      {Icon && (
        <div className="stat-icon">
          <Icon size={18} />
        </div>
      )}
    </div>
  );
}
