import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 15,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className = ''
}) {
  if (totalItems <= 0) return null;

  const isAll = itemsPerPage === 'All' || itemsPerPage === Infinity || Number(itemsPerPage) >= totalItems;
  const numericItemsPerPage = isAll ? totalItems : Math.max(1, Number(itemsPerPage) || 15);
  const totalPages = isAll ? 1 : Math.ceil(totalItems / numericItemsPerPage) || 1;

  const startItem = isAll ? 1 : Math.min(totalItems, (currentPage - 1) * numericItemsPerPage + 1);
  const endItem = isAll ? totalItems : Math.min(totalItems, currentPage * numericItemsPerPage);

  // Build page numbers array with ellipses
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(currentPage - 1);
      pages.push(currentPage);
      pages.push(currentPage + 1);
      pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`pagination-footer-bar no-print ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        borderTop: '1px solid #E5E7EB',
        background: '#FFFFFF',
        flexWrap: 'wrap',
        gap: '10px'
      }}
    >
      {/* Entry Count Summary */}
      <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
        Showing <strong style={{ color: '#0F172A' }}>{startItem}</strong> to{' '}
        <strong style={{ color: '#0F172A' }}>{endItem}</strong> of{' '}
        <strong style={{ color: '#0F172A' }}>{totalItems}</strong> entries
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {/* Page Size Selector */}
        {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
            <span>Show:</span>
            <div style={{ display: 'flex', gap: '3px' }}>
              {pageSizeOptions.map((opt) => {
                const isSelected = String(itemsPerPage) === String(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onPageSizeChange(opt)}
                    style={{
                      height: '26px',
                      padding: '0 8px',
                      borderRadius: '4px',
                      border: isSelected ? '1px solid #0F766E' : '1px solid #E2E8F0',
                      background: isSelected ? '#0F766E' : '#F8FAFC',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      fontSize: '11px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease'
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Page Navigation Controls */}
        {totalPages > 1 && onPageChange && (
          <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-nav-btn"
              aria-label="Previous Page"
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid #E5E7EB',
                background: currentPage === 1 ? '#F9FAFB' : '#FFFFFF',
                color: currentPage === 1 ? '#9CA3AF' : '#374151',
                fontSize: '12px',
                fontWeight: 500,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ArrowLeft size={13} />
              <span>Previous</span>
            </button>

            <div className="pagination-pages-group" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {getPageNumbers().map((p, idx) => {
                if (p === '...') {
                  return (
                    <span
                      key={`dots-${idx}`}
                      className="pagination-dots"
                      style={{ padding: '0 4px', color: '#9CA3AF', fontSize: '12px' }}
                    >
                      ...
                    </span>
                  );
                }
                const isActive = p === currentPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={`pagination-number-btn ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      minWidth: '30px',
                      height: '30px',
                      padding: '0 6px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid #0F766E' : '1px solid #E5E7EB',
                      background: isActive ? '#0F766E' : '#FFFFFF',
                      color: isActive ? '#FFFFFF' : '#374151',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-nav-btn"
              aria-label="Next Page"
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid #E5E7EB',
                background: currentPage === totalPages ? '#F9FAFB' : '#FFFFFF',
                color: currentPage === totalPages ? '#9CA3AF' : '#374151',
                fontSize: '12px',
                fontWeight: 500,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>Next</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
