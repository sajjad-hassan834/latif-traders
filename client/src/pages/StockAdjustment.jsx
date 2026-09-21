import React, { useState, useEffect } from 'react';
import { Sliders, AlertTriangle, CheckCircle, Package, History } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters';

export default function StockAdjustment() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('DAMAGE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/products/adjust/history');
      if (res.success) setHistory(res.adjustments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await api.get('/products');
        if (res.success) setProducts(res.products);
      } catch (err) {
        console.error(err);
      }
    }
    loadProducts();
    loadHistory();
  }, []);

  const handleProductChange = async (prodId) => {
    setSelectedProduct(prodId);
    setSelectedBatch('');
    if (!prodId) {
      setBatches([]);
      return;
    }

    try {
      const res = await api.get(`/products/${prodId}`);
      if (res.success) {
        setBatches(res.batches);
        if (res.batches.length > 0) {
          setSelectedBatch(res.batches[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProduct || !quantity || !reason) {
      setErrorMsg('Product, quantity, and reason are required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/products/adjust', {
        product_id: Number(selectedProduct),
        batch_id: selectedBatch ? Number(selectedBatch) : null,
        type: adjustmentType,
        quantity: Number(quantity),
        reason: reason.trim()
      });

      if (res.success) {
        setSuccessMsg(`Adjustment recorded! Ref: ${res.data.adjustment_no}, New Available Stock: ${res.data.new_stock}`);
        setQuantity('');
        setReason('');
        // Reload product batches and audit history
        handleProductChange(selectedProduct);
        loadHistory();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  const prod = products.find(p => p.id === Number(selectedProduct));

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {successMsg && (
        <div style={{ padding: '1rem', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', fontWeight: 600 }}>
          ✔ {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontWeight: 600 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Sliders size={24} color="var(--primary)" />
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>Stock Adjustment</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Record damaged, melted, expired, lost or sample food items with mandatory audit reasons.
            </p>
          </div>
        </div>

        <form onSubmit={handleAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div className="form-group">
            <label className="form-label">Select Frozen Product *</label>
            <select
              className="form-control"
              value={selectedProduct}
              onChange={(e) => handleProductChange(e.target.value)}
              required
            >
              <option value="">-- Choose Product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku}) • Available: {p.current_stock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {batches.length > 0 && (
            <div className="form-group">
              <label className="form-label">Select Target Batch Lot *</label>
              <select
                className="form-control"
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    Lot: {b.batch_no} • Qty: {b.quantity} {prod?.unit} • Exp: {b.expiry_date}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Adjustment Type *</label>
              <select
                className="form-control"
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value)}
              >
                <option value="DAMAGE">Defective / Packaging Damaged (Reduce)</option>
                <option value="MELTED">Melted / Thawed / Temperature Abuse (Reduce)</option>
                <option value="EXPIRED">Expired Past Date (Reduce)</option>
                <option value="SAMPLE">Free Sample / Tasting (Reduce)</option>
                <option value="LOST">Lost / Stock Counting Shortage (Reduce)</option>
                <option value="COUNT_DIFF">Stock Counting Excess (Increase)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity ({prod?.unit || 'units'}) *</label>
              <input
                type="number"
                className="form-control"
                placeholder="Enter units to adjust"
                min="0.1"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason / Explanation *</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="e.g., Compressor failure in Freezer #2 thawed 3 packets; or supplier carton arrived torn."
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-danger"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {submitting ? 'Processing...' : 'Apply Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>

      {/* STOCK ADJUSTMENT AUDIT HISTORY */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Adjustment History & Waste Audit Log</h3>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Showing last {history.length} events</span>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', minWidth: '700px' }}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Ref #</th>
                <th>Product</th>
                <th>Batch #</th>
                <th>Type</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th>Mandatory Reason</th>
                <th>Logged By</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Loading adjustment logs...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No stock adjustments recorded yet.</td></tr>
              ) : (
                history.map(row => {
                  const typeColors = {
                    DAMAGE: 'badge-danger',
                    MELTED: 'badge-danger',
                    EXPIRED: 'badge-warning',
                    SAMPLE: 'badge-info',
                    LOST: 'badge-danger',
                    COUNT_DIFF: 'badge-success'
                  };
                  return (
                    <tr key={row.id}>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>{formatDateTime(row.created_at)}</td>
                      <td className="mono" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{row.adjustment_no}</td>
                      <td style={{ fontWeight: 600 }}>
                        <div>{row.product_name}</div>
                        <div className="mono" style={{ fontSize: '0.7rem', color: '#64748b' }}>{row.sku}</div>
                      </td>
                      <td className="mono" style={{ fontSize: '0.8rem' }}>{row.batch_no || '-'}</td>
                      <td>
                        <span className={`badge ${typeColors[row.type] || 'badge-secondary'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: row.type === 'COUNT_DIFF' ? '#10b981' : '#ef4444' }}>
                        {row.type === 'COUNT_DIFF' ? `+${row.quantity}` : `-${row.quantity}`} {row.unit}
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: '250px' }}>{row.reason}</td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>{row.user_name || 'Staff'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
