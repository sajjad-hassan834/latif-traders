import React from 'react';

/**
 * Reusable StatusBadge component (SadaxCart pill badge with indicator dot)
 * props: { status, label }
 * Automatically selects color & dot based on status
 */
export default function StatusBadge({ status = 'Completed', label }) {
  const safeStatus = status || 'Completed';
  const raw = String(safeStatus).trim().toLowerCase();
  const normalized = raw.replace(/[_\s]+/g, '-');

  let pillClass = 'sadax-pill-completed';
  let displayLabel = label || safeStatus;

  if (['completed', 'published', 'active', 'delivered'].includes(normalized)) {
    pillClass = 'sadax-pill-completed';
    if (!label) {
      if (normalized === 'published') displayLabel = 'Published';
      else if (normalized === 'delivered') displayLabel = 'Delivered';
      else displayLabel = 'Completed';
    }
  } else if (['pending', 'accepted', 'ready', 'ready-for-delivery'].includes(normalized)) {
    pillClass = 'sadax-pill-pending';
    if (!label) {
      if (normalized === 'ready-for-delivery' || normalized === 'ready') displayLabel = 'Ready for Delivery';
      else if (normalized === 'accepted') displayLabel = 'Accepted';
      else displayLabel = 'Pending';
    }
  } else if (['processing', 'confirmed'].includes(normalized)) {
    pillClass = 'sadax-pill-processing';
    if (!label) {
      displayLabel = normalized === 'confirmed' ? 'Confirmed' : 'Processing';
    }
  } else if (['cancelled', 'out-stock', 'out-of-stock', 'rejected', 'void'].includes(normalized)) {
    pillClass = 'sadax-pill-cancelled';
    if (!label) {
      if (normalized.includes('out')) displayLabel = 'Out Stock';
      else if (normalized === 'rejected') displayLabel = 'Rejected';
      else displayLabel = 'Cancelled';
    }
  } else if (['new', 'low-stock', 'low'].includes(normalized)) {
    pillClass = 'sadax-pill-new';
    if (!label) {
      displayLabel = normalized.includes('low') ? 'Low Stock' : 'New';
    }
  } else if (['draft', 'draft-list', 'inactive', 'archived'].includes(normalized)) {
    pillClass = 'sadax-pill-draft';
    if (!label) {
      if (normalized.includes('draft')) displayLabel = 'Draft List';
      else displayLabel = 'Inactive';
    }
  }

  return (
    <span className={`sadax-status-pill ${pillClass}`}>
      <span className="sadax-status-dot" />
      <span>{displayLabel}</span>
    </span>
  );
}
