import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

export default function PrintKotModal({
  isOpen,
  onClose,
  kotNumber,
  tableNo = 'Table 1',
  diningMode = 'dine_in',
  items = [],
  notes = '',
  serverName = 'Cashier'
}) {
  const printRef = useRef(null);

  if (!isOpen) return null;

  const currentKot = kotNumber || `KOT-${Date.now().toString().slice(-4)}`;
  const orderTime = formatDateTime(new Date());

  const handlePrint = () => {
    window.print();
  };

  const getDiningLabel = (mode) => {
    switch (mode) {
      case 'dine_in': return 'DINE IN';
      case 'takeaway': return 'TAKEAWAY';
      case 'delivery': return 'DELIVERY';
      default: return mode.toUpperCase();
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '420px', width: '92%', borderRadius: '12px' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>🍳</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>
                Kitchen Order Ticket (KOT)
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Thermal 80mm Kitchen Dispatch Preview
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.25rem' }}>
          {/* 80mm KOT Printable Slip Container */}
          <div
            ref={printRef}
            className="kot-printable-slip"
            style={{
              background: '#fff',
              color: '#000',
              padding: '16px',
              borderRadius: '6px',
              fontFamily: '"DM Mono", monospace, Courier, sans-serif',
              fontSize: '13px',
              border: '1px dashed #cbd5e1',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '1px' }}>*** KITCHEN ORDER ***</div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
                {getDiningLabel(diningMode)} {diningMode === 'dine_in' ? `— ${tableNo}` : ''}
              </div>
            </div>

            <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #ddd', paddingBottom: '6px' }}>
              <div><strong>KOT:</strong> {currentKot}</div>
              <div><strong>Staff:</strong> {serverName}</div>
            </div>

            <div style={{ fontSize: '11px', marginBottom: '10px', color: '#333' }}>
              <div><strong>Time:</strong> {orderTime}</div>
            </div>

            {/* Item List for Kitchen */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000', fontSize: '12px' }}>
                  <th style={{ textAlign: 'left', paddingBottom: '4px' }}>ITEM</th>
                  <th style={{ textAlign: 'right', paddingBottom: '4px', width: '60px' }}>QTY</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ textAlign: 'center', padding: '12px', color: '#666' }}>No items in order</td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                      <td style={{ padding: '6px 0', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, fontSize: '14px' }}>
                          {item.name || item.product_name}
                        </div>
                        {item.modifiers && (
                          <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600, marginTop: '2px' }}>
                            ⚡ {typeof item.modifiers === 'string' ? item.modifiers : JSON.stringify(item.modifiers)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', padding: '6px 0', verticalAlign: 'top', fontSize: '16px', fontWeight: 900 }}>
                        x{item.quantity}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {notes && (
              <div style={{ border: '1px solid #000', padding: '6px', borderRadius: '4px', marginTop: '6px', fontSize: '11px' }}>
                <strong>SPECIAL INSTRUCTIONS:</strong>
                <div style={{ fontStyle: 'italic', marginTop: '2px' }}>{notes}</div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', color: '#666' }}>
              --- End of KOT ---
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e11d48', borderColor: '#e11d48' }}
          >
            <Printer size={14} />
            <span>Print KOT</span>
          </button>
        </div>
      </div>
    </div>
  );
}

