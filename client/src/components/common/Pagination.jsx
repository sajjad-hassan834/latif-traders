import React from 'react';

export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
      </div>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '4px 10px',
            fontSize: '0.85rem',
            background: currentPage === 1 ? '#f1f5f9' : '#fff',
            color: currentPage === 1 ? '#94a3b8' : '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
          }}
        >
          Previous
        </button>
        <span style={{ padding: '4px 10px', fontSize: '0.85rem', fontWeight: 600, background: '#0284c7', color: '#fff', borderRadius: '4px' }}>
          {currentPage}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '4px 10px',
            fontSize: '0.85rem',
            background: currentPage === totalPages ? '#f1f5f9' : '#fff',
            color: currentPage === totalPages ? '#94a3b8' : '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
