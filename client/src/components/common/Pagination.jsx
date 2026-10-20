import React from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from 'lucide-react';

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage = 15,
  onPageChange,
  pageSizeOptions = [10, 15, 25, 50],
  onPageSizeChange
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  // When only 1 page exists or no items: show nothing at all
  if (totalItems <= 0 || totalPages <= 1) return null;

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
      className="pagination-footer-bar"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid #E5E7EB',
        background: '#FFFFFF'
      }}
    >
      <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-nav-btn"
          aria-label="Previous Page"
          style={{
            height: '32px',
            padding: '0 12px',
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

        <div className="pagination-pages-group" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="pagination-dots" style={{ padding: '0 4px', color: '#9CA3AF', fontSize: '12px' }}>
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
                  minWidth: '32px',
                  height: '32px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #0F766E' : '1px solid #E5E7EB',
                  background: isActive ? '#0F766E' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#374151',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
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
            height: '32px',
            padding: '0 12px',
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
    </div>
  );
}
