import React, { useState, useEffect } from 'react';
import { Sliders, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR } from '../utils/formatters';

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
        // Reload product batches
        handleProductChange(selectedProduct);
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
            <h3 style={{ fontSize: '1.2rem' }}>Frozen Food Stock Adjustment</h3>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
    </div>
  );
}
