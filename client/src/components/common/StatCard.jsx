import React from 'react';

/**
 * Reusable StatCard component (SadaxCart style)
 * props: { label, value, trend ('up' | 'down' | 'neutral'), subtitle }
 * - trend 'up': green dash indicator (#10B981)
 * - trend 'down': red dash indicator (#EF4444)
 * - trend 'neutral': yellow dash indicator (#F59E0B)
 */
export default function StatCard({ label, title, value, trend = 'up', subtitle }) {
  const displayLabel = label || title;

  const getTrendColor = () => {
    if (trend === 'down') return '#EF4444';
    if (trend === 'neutral') return '#F59E0B';
    return '#10B981';
  };

  return (
    <div className="sadax-stat-card">
      <div className="sadax-stat-label">{displayLabel}</div>
      <div className="sadax-stat-value">{value}</div>
      <div
        className="sadax-trend-dash"
        style={{ backgroundColor: getTrendColor() }}
      />
      {subtitle && <div className="sadax-stat-subtext">{subtitle}</div>}
    </div>
  );
}
