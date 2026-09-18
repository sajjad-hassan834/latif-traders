import React, { useState } from 'react';
import { Barcode, Printer, X } from 'lucide-react';
import { formatPKR } from '../../utils/formatters';

export default function BarcodeLabelModal({ product, onClose }) {
  const [copies, setCopies] = useState(12);
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
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Barcode size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem' }}>Print Barcode Stickers: {product.name}</h3>
          </div>
          <button onClick={onClose} style={{ color: '#64748b' }}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ background: '#f8fafc' }}>
          {/* CONTROLS */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', background: '#fff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Number of Labels</label>
              <input
                type="number"
                className="form-control"
                style={{ width: '80px', height: '28px' }}
                min="1"
                max="100"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Format</label>
              <select
                className="form-control"
                style={{ height: '28px', fontSize: '0.8rem' }}
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value)}
              >
                <option value="sheet">A4 Sticker Sheet (Grid)</option>
                <option value="single">Single Thermal Sticker (50×30mm)</option>
              </select>
            </div>
          </div>

          {/* PRINTABLE BARCODE LABELS CONTAINER */}
          <div className="printable-area">
            <div style={{
              display: 'grid',
              gridTemplateColumns: labelSize === 'single' ? '1fr' : 'repeat(3, 1fr)',
              gap: '8px',
              maxWidth: labelSize === 'single' ? '220px' : '100%',
              margin: '0 auto',
              background: '#fff',
              padding: '10px',
              borderRadius: '6px'
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
