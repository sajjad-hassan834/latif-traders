import React, { useState, useMemo } from 'react';
import { Printer, Check, X, ShieldAlert } from 'lucide-react';
import api from '../../utils/api';
import { formatPKR } from '../../utils/formatters';
import { playAudio } from '../../utils/audio';

const DENOMINATIONS = [
  { val: 5000, label: '₨ 5,000 Notes' },
  { val: 1000, label: '₨ 1,000 Notes' },
  { val: 500, label: '₨ 500 Notes' },
  { val: 100, label: '₨ 100 Notes' },
  { val: 50, label: '₨ 50 Notes' },
  { val: 20, label: '₨ 20 Notes' },
  { val: 10, label: '₨ 10 Notes' }
];

export default function ShiftCloseModal({ isOpen, onClose, onShiftClosed }) {
  const [counts, setCounts] = useState({
    5000: '',
    1000: '',
    500: '',
    100: '',
    50: '',
    20: '',
    10: '',
    coins: ''
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const totalCounted = useMemo(() => {
    let sum = Number(counts.coins) || 0;
    DENOMINATIONS.forEach(d => {
      const qty = Number(counts[d.val]) || 0;
      sum += qty * d.val;
    });
    return sum;
  }, [counts]);

  const handleCountChange = (val, rawText) => {
    setCounts(prev => ({ ...prev, [val]: rawText }));
    playAudio('click');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const res = await api.post('/payments/shift/close', {
        counted_cash: totalCounted,
        denominations: counts,
        notes: notes.trim()
      });

      if (res.success) {
        playAudio('tender');
        setResult(res);
        if (onShiftClosed) onShiftClosed(res);
      } else {
        setError(res.message || 'Failed to close shift.');
        playAudio('error');
      }
    } catch (err) {
      setError(err.message || 'Error submitting blind cash count.');
      playAudio('error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '480px', width: '92%', borderRadius: '12px' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>🔒</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>
                {result ? 'Shift Reconciliation Summary' : 'End Shift (Blind Cash Count)'}
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {result ? 'Reconciliation finalized against register ledger' : 'Enter drawer physical cash without prior expected balance'}
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

        {!result ? (
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ padding: '1.25rem', maxHeight: '68vh', overflowY: 'auto' }}>
              {error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#dc2626',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.825rem',
                  marginBottom: '1rem'
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem', lineHeight: 1.4 }}>
                Count every note in your physical cash drawer and input quantities below. Denominations will automatically sum up.
              </div>

              {/* Denominations Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {DENOMINATIONS.map(d => {
                  const qty = Number(counts[d.val]) || 0;
                  const rowSubtotal = qty * d.val;
                  return (
                    <div
                      key={d.val}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.6rem',
                        background: 'var(--hover-bg)',
                        borderRadius: '6px',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <span style={{ fontSize: '0.825rem', fontWeight: 600, minWidth: '100px' }}>
                        {d.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>x</span>
                        <input
                          type="number"
                          min="0"
                          className="form-control mono"
                          style={{ width: '70px', padding: '0.25rem 0.5rem', textAlign: 'center', height: '30px' }}
                          placeholder="0"
                          value={counts[d.val]}
                          onChange={(e) => handleCountChange(d.val, e.target.value)}
                        />
                        <span style={{ minWidth: '80px', textAlign: 'right', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-title)' }}>
                          {formatPKR(rowSubtotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Loose Coins */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.4rem 0.6rem',
                    background: 'var(--hover-bg)',
                    borderRadius: '6px',
                    border: '1px solid var(--border)'
                  }}
                >
                  <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>🪙 Loose Coins / Small Cash</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="form-control mono"
                      style={{ width: '100px', padding: '0.25rem 0.5rem', textAlign: 'right', height: '30px' }}
                      placeholder="0.00"
                      value={counts.coins}
                      onChange={(e) => handleCountChange('coins', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Total Counted Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-title)' }}>
                  Total Physical Count:
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
                  {formatPKR(totalCounted)}
                </span>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Shift Handover Notes (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Left Rs. 5,000 float for evening cashier"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                style={{ minWidth: '140px' }}
                disabled={loading}
              >
                {loading ? 'Reconciling...' : 'Submit & Close Shift'}
              </button>
            </div>
          </form>
        ) : (
          /* RESULT / VARIANCE DISPLAY */
          <div className="modal-body" style={{ padding: '1.25rem' }}>
            <div style={{
              background: result.variance === 0
                ? 'rgba(16, 185, 129, 0.1)'
                : (result.variance > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
              border: `1px solid ${result.variance === 0 ? '#10b981' : (result.variance > 0 ? '#3b82f6' : '#ef4444')}`,
              padding: '1rem',
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: result.variance === 0 ? '#059669' : (result.variance > 0 ? '#2563eb' : '#dc2626') }}>
                {result.variance === 0 ? '✓ Balanced Cash Drawer' : (result.variance > 0 ? '▲ Cash Surplus (Over)' : '▼ Cash Shortage')}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '4px', color: 'var(--text-title)' }}>
                {result.variance > 0 ? `+${formatPKR(result.variance)}` : formatPKR(result.variance)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Physical Counted Cash:</span>
                <strong style={{ color: 'var(--text-title)' }}>{formatPKR(result.countedCash)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Expected Register Balance:</span>
                <strong style={{ color: 'var(--text-title)' }}>{formatPKR(result.expectedCash)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Net Variance:</span>
                <strong style={{ color: result.variance >= 0 ? '#059669' : '#dc2626' }}>
                  {formatPKR(result.variance)}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handlePrintSummary}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={14} />
                <span>Print Report</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

