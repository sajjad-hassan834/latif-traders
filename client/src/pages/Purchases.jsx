import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, ArrowDownToLine, Trash2, RotateCcw } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

export default function Purchases() {
  const { canManageInventory } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // New Purchase Form
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [purRes, supRes, prodRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/parties/suppliers'),
        api.get('/products')
      ]);

      if (purRes.success) setPurchases(purRes.purchases);
      if (supRes.success) setSuppliers(supRes.suppliers);
      if (prodRes.success) setProducts(prodRes.products);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addItemToBill = (productId) => {
    const prod = products.find(p => p.id === Number(productId));
    if (!prod) return;

    setItems([...items, {
      product_id: prod.id,
      name: prod.name,
      unit: prod.unit,
      batch_no: `LOT-${Date.now().toString().slice(-5)}`,
      expiry_date: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      quantity: 10,
      unit_price: prod.purchase_price || 0,
      discount: 0
    }]);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unit_price)) - (Number(it.discount) || 0), 0);
  const grandTotal = Math.max(0, subtotal - (Number(discount) || 0));

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!supplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Please add at least one product item.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/purchases', {
        supplier_id: Number(supplierId),
        supplier_invoice_no: supplierInvoiceNo.trim(),
        purchase_date: purchaseDate,
        items,
        discount: Number(discount) || 0,
        paid_amount: paidAmount === '' ? grandTotal : Number(paidAmount),
        payment_method: paymentMethod,
        notes: notes.trim()
      });

      if (res.success) {
        setShowNewModal(false);
        setItems([]);
        setSupplierInvoiceNo('');
        setPaidAmount('');
        setNotes('');
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  const viewPurchase = async (id) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      if (res.success) {
        setSelectedPurchase(res);
        setShowDetailModal(true);
      }
    } catch (err) {
      alert('Failed to load purchase details');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem' }}>Purchases & Supplier Invoices</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Record cold-chain supplier shipments, batch expiration dates, and payable balances.
          </p>
        </div>
        {canManageInventory && (
          <button onClick={() => setShowNewModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>New Purchase Bill</span>
          </button>
        )}
      </div>

      {/* PURCHASES LIST */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Internal Inv #</th>
                <th>Supplier Bill #</th>
                <th>Date</th>
                <th>Supplier Name</th>
                <th>Items</th>
                <th style={{ textAlign: 'right' }}>Grand Total</th>
                <th style={{ textAlign: 'right' }}>Paid Amount</th>
                <th style={{ textAlign: 'right' }}>Payable Due</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>Loading purchases...</td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No purchases recorded yet.</td></tr>
              ) : (
                purchases.map(p => (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontWeight: 700, color: '#0284c7' }}>{p.invoice_no}</td>
                    <td className="mono" style={{ color: '#64748b' }}>{p.supplier_invoice_no || '-'}</td>
                    <td>{formatDate(p.purchase_date)}</td>
                    <td style={{ fontWeight: 600 }}>{p.supplier_name}</td>
                    <td>{p.item_count} items</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(p.grand_total)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPKR(p.paid_amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {p.balance_due > 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatPKR(p.balance_due)}</span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Settled</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => viewPurchase(p.id)} className="btn btn-secondary btn-sm">
                        <Eye size={15} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW PURCHASE BILL MODAL */}
      {showNewModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>Create Supplier Purchase Bill</h3>
              <button onClick={() => setShowNewModal(false)}>✕</button>
            </div>

            {errorMsg && (
              <div style={{ margin: '1rem 1.5rem 0', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleSavePurchase}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Supplier *</label>
                    <select
                      className="form-control"
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (Payable: ₨ {s.current_balance})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Supplier Bill #</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. INV-9874"
                      value={supplierInvoiceNo}
                      onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Purchase Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* ADD PRODUCT TO BILL */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Add Product to Shipment</label>
                    <select
                      className="form-control"
                      onChange={(e) => {
                        if (e.target.value) {
                          addItemToBill(e.target.value);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">-- Select Product to Add --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* LINE ITEMS TABLE */}
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Batch / Lot No</th>
                        <th>Expiry Date</th>
                        <th style={{ width: '100px' }}>Quantity</th>
                        <th style={{ width: '120px' }}>Cost Rate</th>
                        <th style={{ textAlign: 'right' }}>Total (PKR)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr><td colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>No products added to bill yet.</td></tr>
                      ) : (
                        items.map((it, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{it.name}</td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                value={it.batch_no}
                                onChange={(e) => updateItem(idx, 'batch_no', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                className="form-control"
                                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                value={it.expiry_date}
                                onChange={(e) => updateItem(idx, 'expiry_date', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '4px 8px', fontSize: '0.85rem', width: '80px' }}
                                min="1"
                                value={it.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100px' }}
                                value={it.unit_price}
                                onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {formatPKR(Number(it.quantity) * Number(it.unit_price))}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                style={{ color: '#ef4444' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAYMENT & SETTLEMENT */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Grand Total (PKR)</label>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>
                      {formatPKR(grandTotal)}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Paid Amount (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder={String(grandTotal)}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Saving...' : 'Save & Increase Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {showDetailModal && selectedPurchase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <h3>Purchase Bill: {selectedPurchase.purchase.invoice_no}</h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Supplier: {selectedPurchase.purchase.supplier_name} • Date: {formatDate(selectedPurchase.purchase.purchase_date)}
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Batch #</th>
                    <th>Expiry Date</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Cost Rate</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.items.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                      <td className="mono">{it.batch_no || '-'}</td>
                      <td>{formatDate(it.expiry_date)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.quantity} {it.unit}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(it.unit_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(it.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <div style={{ width: '250px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Grand Total:</span>
                    <strong>{formatPKR(selectedPurchase.purchase.grand_total)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Paid:</span>
                    <span>{formatPKR(selectedPurchase.purchase.paid_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                    <span>Payable Due:</span>
                    <strong>{formatPKR(selectedPurchase.purchase.balance_due)}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
