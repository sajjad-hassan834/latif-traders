import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, ArrowDownToLine, Trash2, RotateCcw, Printer, Download } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
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
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

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

  const openReturnModal = async (id) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      if (res.success) {
        setReturnPurchase(res.purchase);
        setReturnItems(res.items.map(it => ({
          product_id: it.product_id,
          batch_id: it.batch_id || null,
          product_name: it.product_name,
          batch_no: it.batch_no || '-',
          purchased_qty: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          return_qty: 0,
          condition: 'DEFECTIVE'
        })));
        setReturnReason('');
        setShowReturnModal(true);
      }
    } catch (err) {
      alert('Failed to load purchase items for return');
    }
  };

  const handleReturnItemChange = (index, field, value) => {
    const updated = [...returnItems];
    updated[index][field] = value;
    setReturnItems(updated);
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    const activeReturns = returnItems.filter(it => Number(it.return_qty) > 0);
    if (activeReturns.length === 0) {
      alert('Please enter a return quantity greater than 0 for at least one item.');
      return;
    }

    // Validate return qty does not exceed purchased qty
    for (const it of activeReturns) {
      if (Number(it.return_qty) > it.purchased_qty) {
        alert(`Cannot return more than purchased quantity (${it.purchased_qty}) for ${it.product_name}`);
        return;
      }
    }

    try {
      setReturnSubmitting(true);
      const payload = {
        original_purchase_id: returnPurchase.id,
        reason: returnReason.trim() || 'Supplier return',
        items: activeReturns.map(it => ({
          product_id: it.product_id,
          batch_id: it.batch_id,
          quantity: Number(it.return_qty),
          unit_price: Number(it.unit_price),
          condition: it.condition
        }))
      };

      const res = await api.post('/purchases/returns', payload);
      if (res.success) {
        alert(`Purchase return recorded successfully! Ref: ${res.data.return_no}`);
        setShowReturnModal(false);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to submit purchase return');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleExportPurchases = () => {
    exportToCSV('Latif_Traders_Purchases', purchases, [
      { label: 'Invoice No', key: 'invoice_no' },
      { label: 'Supplier Bill #', key: 'supplier_invoice_no' },
      { label: 'Date', key: 'purchase_date' },
      { label: 'Supplier Name', key: 'supplier_name' },
      { label: 'Items Count', key: 'item_count' },
      { label: 'Grand Total (PKR)', key: 'grand_total' },
      { label: 'Paid (PKR)', key: 'paid_amount' },
      { label: 'Payable Due (PKR)', key: 'balance_due' },
      { label: 'Payment Method', key: 'payment_method' }
    ]);
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportPurchases} className="btn btn-secondary" title="Export Purchases to CSV">
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          {canManageInventory && (
            <button onClick={() => setShowNewModal(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>New Purchase Bill</span>
            </button>
          )}
        </div>
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
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button onClick={() => viewPurchase(p.id)} className="btn btn-secondary btn-sm" title="View & Print Bill">
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                        {canManageInventory && (
                          <button
                            onClick={() => openReturnModal(p.id)}
                            className="btn btn-warning btn-sm"
                            title="Return goods to supplier"
                          >
                            <RotateCcw size={14} />
                            <span>Return</span>
                          </button>
                        )}
                      </div>
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  <Printer size={15} />
                  <span>Print Bill</span>
                </button>
                <button onClick={() => setShowDetailModal(false)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="print-header" style={{ marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>LATIF TRADERS - PURCHASE VOUCHER</h2>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Commercial Market, Lahore • Cold-chain Supply Delivery Receiving Record
                </div>
              </div>

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

      {/* PURCHASE RETURN MODAL */}
      {showReturnModal && returnPurchase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RotateCcw size={18} color="#ef4444" />
                  <span>Return Goods to Supplier</span>
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Supplier: <strong>{returnPurchase.supplier_name}</strong> • Bill: <strong>{returnPurchase.invoice_no}</strong>
                </div>
              </div>
              <button onClick={() => setShowReturnModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitReturn}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', color: '#991b1b' }}>
                  Enter the quantity you wish to return. Submitting will automatically decrease inventory batches, create an audit movement, and deduct the return amount from the supplier's payable balance.
                </div>

                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Batch Lot</th>
                        <th style={{ textAlign: 'center' }}>Purchased</th>
                        <th style={{ width: '130px', textAlign: 'center' }}>Return Qty</th>
                        <th style={{ width: '160px' }}>Condition</th>
                        <th style={{ textAlign: 'right' }}>Cost Rate</th>
                        <th style={{ textAlign: 'right' }}>Total Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((it, idx) => {
                        const lineCredit = (Number(it.return_qty) || 0) * Number(it.unit_price);
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                            <td className="mono" style={{ fontSize: '0.8rem' }}>{it.batch_no}</td>
                            <td style={{ textAlign: 'center' }}>{it.purchased_qty} {it.unit}</td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ textAlign: 'center', fontWeight: 700 }}
                                min="0"
                                max={it.purchased_qty}
                                step="any"
                                value={it.return_qty}
                                onChange={(e) => handleReturnItemChange(idx, 'return_qty', e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                className="form-control form-control-sm"
                                value={it.condition}
                                onChange={(e) => handleReturnItemChange(idx, 'condition', e.target.value)}
                              >
                                <option value="DEFECTIVE">Packaging Defective</option>
                                <option value="MELTED">Melted / Thawed</option>
                                <option value="EXPIRED">Short Expiry</option>
                                <option value="RESELLABLE">Resellable Return</option>
                              </select>
                            </td>
                            <td style={{ textAlign: 'right' }}>{formatPKR(it.unit_price)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: lineCredit > 0 ? '#ef4444' : '#64748b' }}>
                              {lineCredit > 0 ? formatPKR(lineCredit) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', alignItems: 'center' }}>
                  <div className="form-group">
                    <label className="form-label">Return Reason / Explanation *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 5 boxes arrived thawed / torn packaging from distributor van"
                      required
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    />
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Deducted from Payable</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>
                      {formatPKR(returnItems.reduce((sum, it) => sum + ((Number(it.return_qty) || 0) * Number(it.unit_price)), 0))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>Cancel</button>
                <button type="submit" disabled={returnSubmitting} className="btn btn-danger">
                  {returnSubmitting ? 'Processing Return...' : 'Confirm Purchase Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
