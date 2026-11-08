import React, { useState } from 'react';
import { Camera, FileText, Upload, Sparkles, Check, X, AlertCircle } from 'lucide-react';
import { playBeep } from '../../utils/audio';

export default function AiBillScannerModal({ isOpen, onClose, onApplyItems, suppliers = [] }) {
  const [mode, setMode] = useState('text'); // 'text' or 'file'
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedBill, setParsedBill] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSampleText = () => {
    const sample = `DAWN BREAD & BAKERY DISTRIBUTORS
Invoice #: DBN-2026-8841
Date: 07/11/2026
Supplier: Dawn Foods

ITEMS RECEIVED:
1. Large Milky Bread - Lot LOT-B88 - Expiry 12/11/2026 - Qty 25 pkt @ Rs 140 = Rs 3500
2. Small White Bread - Lot LOT-S22 - Expiry 10/11/2026 - Qty 15 pkt @ Rs 90 = Rs 1350
3. Burger Buns 4pc - Lot LOT-BB1 - Expiry 11/11/2026 - Qty 20 pkt @ Rs 80 = Rs 1600

Total Items: 3
Grand Total: Rs 6450`;
    setInputText(sample);
  };

  const parseInvoiceContent = (rawText) => {
    setIsProcessing(true);
    playBeep('scan');

    setTimeout(() => {
      try {
        const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

        let invoiceNo = '';
        let invoiceDate = new Date().toISOString().split('T')[0];
        let supplierName = '';
        const items = [];

        for (const line of lines) {
          // Look for invoice number
          const invMatch = line.match(/(?:invoice|bill|inv)\s*(?:#|no|number)?[:\s]+([A-Z0-9-_]+)/i);
          if (invMatch && !invoiceNo) {
            invoiceNo = invMatch[1];
          }

          // Look for supplier
          const supMatch = line.match(/(?:supplier|vendor|from|distributor)[:\s]+([^,\n]+)/i);
          if (supMatch && !supplierName) {
            supplierName = supMatch[1].trim();
          }

          // Look for line item pattern: Name - Qty - Rate
          // e.g., "1. Large Milky Bread - Lot LOT-B88 - Expiry 12/11/2026 - Qty 25 pkt @ Rs 140 = Rs 3500"
          // or "Bread 10 120"
          const itemRegex = /(?:^\d+[\.\)]\s*)?([A-Za-z0-9\s&'-]+?)(?:\s*-\s*Lot\s*([A-Za-z0-9-]+))?(?:\s*-\s*Expiry\s*([0-9\/-]+))?\s*(?:-\s*Qty|Qty)?\s*(\d+(?:\.\d+)?)\s*(?:pkt|pcs|kg|carton|box|units)?\s*(?:@|at|\*|rate)?\s*(?:Rs|₨)?\s*(\d+(?:\.\d+)?)/i;
          const match = line.match(itemRegex);

          if (match && match[1] && match[4] && match[5]) {
            const rawName = match[1].trim().replace(/^[\d\.\-\s]+/, '');
            const batchNo = match[2] || `LOT-${Date.now().toString().slice(-4)}`;
            const expiry = match[3] || '';
            const qty = parseFloat(match[4]);
            const cost = parseFloat(match[5]);

            if (rawName.length > 2 && qty > 0) {
              items.push({
                product_name: rawName,
                quantity: qty,
                unit_price: cost,
                total_price: qty * cost,
                batch_no: batchNo,
                expiry_date: expiry
              });
            }
          }
        }

        // If no items matched by regex, fallback to smart line splitting
        if (items.length === 0) {
          for (const line of lines) {
            const parts = line.split(/[,\t|]/);
            if (parts.length >= 3) {
              const name = parts[0].trim();
              const qty = parseFloat(parts[1]);
              const cost = parseFloat(parts[2]);
              if (name && !isNaN(qty) && !isNaN(cost) && qty > 0) {
                items.push({
                  product_name: name,
                  quantity: qty,
                  unit_price: cost,
                  total_price: qty * cost,
                  batch_no: `LOT-${Date.now().toString().slice(-4)}`,
                  expiry_date: ''
                });
              }
            }
          }
        }

        setParsedBill({
          invoiceNo: invoiceNo || `PUR-${Date.now().toString().slice(-6)}`,
          date: invoiceDate,
          supplierName: supplierName || (suppliers[0]?.name || 'Supplier'),
          items
        });
        playBeep('tender');
      } catch (err) {
        console.error('Invoice parse error:', err);
      } finally {
        setIsProcessing(false);
      }
    }, 300);
  };

  const handleApply = () => {
    if (!parsedBill || !parsedBill.items.length) return;
    playBeep('tender');
    onApplyItems?.(parsedBill);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text, #0f172a)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#0284c720',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>AI Paper Bill & Invoice Scanner</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                Auto-extract items, batches, quantities & costs from supplier bill
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Area */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
              PASTE INVOICE TEXT OR OCR TRANSCRIPT
            </span>
            <button
              type="button"
              onClick={handleSampleText}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--primary, #0284c7)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Load Sample Bill
            </button>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={5}
            placeholder="Paste text from supplier delivery challan, printed parcha, or message..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--bg-subtle, #f8fafc)',
              color: 'inherit',
              fontSize: '12.5px',
              lineHeight: 1.4,
              fontFamily: 'monospace',
              outline: 'none',
              marginBottom: '12px'
            }}
          />

          <button
            type="button"
            disabled={!inputText.trim() || isProcessing}
            onClick={() => parseInvoiceContent(inputText)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary, #0284c7)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: !inputText.trim() || isProcessing ? 'not-allowed' : 'pointer',
              opacity: !inputText.trim() || isProcessing ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={16} />
            {isProcessing ? 'Analyzing Bill Content...' : 'Extract & Parse Bill Items'}
          </button>

          {/* Parsed Results Preview */}
          {parsedBill && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                <span>Bill #: <strong>{parsedBill.invoiceNo}</strong></span>
                <span>Supplier: <strong>{parsedBill.supplierName}</strong></span>
              </div>

              {parsedBill.items.length === 0 ? (
                <div style={{ padding: '12px', background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '12px' }}>
                  Could not identify any items. Please check the text format and try again.
                </div>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead style={{ background: 'var(--bg-subtle, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                      <tr>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Item</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cost</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedBill.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{it.product_name}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>{it.quantity}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>Rs {it.unit_price}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>Rs {it.total_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-subtle, #f8fafc)'
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
            {parsedBill ? `${parsedBill.items.length} items extracted` : 'Ready to parse'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted, #64748b)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!parsedBill || !parsedBill.items.length}
              onClick={handleApply}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary, #0284c7)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: !parsedBill || !parsedBill.items.length ? 'not-allowed' : 'pointer',
                opacity: !parsedBill || !parsedBill.items.length ? 0.6 : 1
              }}
            >
              <Check size={15} />
              Apply to Purchase Bill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

