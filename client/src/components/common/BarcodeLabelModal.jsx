import React, { useState } from 'react';
import { Barcode, Printer, X } from 'lucide-react';
import { formatPKR } from '../../utils/formatters';

export default function BarcodeLabelModal({ product, onClose }) {
  const [copies, setCopies] = useState(1);
  const [labelSize, setLabelSize] = useState('single'); // 'single' (thermal 50x30mm) or 'sheet' (A4 grid)

  if (!product) return null;

  const code = product.barcode || product.sku;

  // Simple clean SVG barcode generator (pseudo Code128 visual bars based on string hash/chars)
  const generateBars = (str) => {
    const bars = [];
    let seed = 0;
    for (let i = 0; i < str.length; i++) seed += str.charCodeAt(i);

    // Generate 42 alternating black and white bars of varying widths (1px to 3px)
    for (let i = 0; i < 46; i++) {
      const isBlack = i % 2 === 0;
      const width = ((seed * (i + 1) * 7) % 3) + 1;
      bars.push({ isBlack, width });
    }
    return bars;
  };

  const bars = generateBars(code);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '580px', overflowX: 'hidden' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Barcode size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem' }}>Barcode Sticker: {product.name}</h3>
          </div>
          <button onClick={onClose} style={{ color: '#64748b' }}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ background: '#f8fafc', overflowX: 'hidden' }}>
          {/* CONTROLS */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            background: '#fff',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Copies to Print</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    className="form-control"
                    style={{ width: '70px', height: '28px', textAlign: 'center', fontWeight: 700 }}
                    min="1"
                    max="500"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                  />
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[1, 5, 10].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCopies(n)}
                        style={{
                          height: '28px',
                          padding: '0 6px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: copies === n ? '1px solid #0284c7' : '1px solid #e2e8f0',
                          background: copies === n ? '#e0f2fe' : '#f8fafc',
                          color: copies === n ? '#0369a1' : '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    {Number(product.current_stock) > 0 && (
                      <button
                        type="button"
                        onClick={() => setCopies(Number(product.current_stock))}
                        style={{
                          height: '28px',
                          padding: '0 6px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: copies === Number(product.current_stock) ? '1px solid #0284c7' : '1px solid #e2e8f0',
                          background: copies === Number(product.current_stock) ? '#e0f2fe' : '#f8fafc',
                          color: copies === Number(product.current_stock) ? '#0369a1' : '#475569',
                          cursor: 'pointer'
                        }}
                        title={`Set to current in-hand stock (${product.current_stock})`}
                      >
                        Stock ({product.current_stock})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Format</label>
              <select
                className="form-control"
                style={{ height: '28px', fontSize: '0.8rem' }}
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value)}
              >
                <option value="single">Single Thermal Sticker (50×30mm)</option>
                <option value="sheet">A4 Sticker Sheet (Grid)</option>
              </select>
            </div>
          </div>

          {/* PRINTABLE BARCODE LABELS CONTAINER */}
          <div style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
            Showing sticker for: <strong style={{ color: '#0f172a' }}>{product.name}</strong> • Code: <strong className="mono" style={{ color: '#0284c7' }}>{code}</strong>
          </div>
          <div className="printable-area">
            <div style={{
              display: 'grid',
              gridTemplateColumns: labelSize === 'single' ? '1fr' : 'repeat(3, 1fr)',
              gap: '8px',
              maxWidth: labelSize === 'single' ? '240px' : '100%',
              margin: '0 auto',
              background: '#fff',
              padding: '12px',
              borderRadius: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              {Array.from({ length: copies }).map((_, idx) => (
                <div key={idx} style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: '4px',
                  padding: '6px',
                  textAlign: 'center',
                  background: '#fff'
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                    LATIF TRADERS
                  </div>
                  <div style={{ fontSize: '9px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {product.name}
                  </div>

                  {/* SVG Barcode */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '4px 0', height: '28px' }}>
                    <svg height="28" width="120">
                      {bars.reduce((acc, bar, i) => {
                        const x = acc.currentX;
                        acc.currentX += bar.width + 1;
                        if (bar.isBlack) {
                          acc.elements.push(
                            <rect key={i} x={x} y="0" width={bar.width} height="28" fill="#000" />
                          );
                        }
                        return acc;
                      }, { currentX: 0, elements: [] }).elements}
                    </svg>
                  </div>

                  <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px' }}>
                    {code}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
                    Price: {formatPKR(product.sale_price)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <Printer size={15} />
            <span>Print Labels</span>
          </button>
        </div>
      </div>
    </div>
  );
}
