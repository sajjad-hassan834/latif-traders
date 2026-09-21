import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, ArrowDownToLine, Trash2, RotateCcw, Printer, Download, Package, Edit, ChevronDown, FileText } from 'lucide-react';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Edit Purchase Form
  const [editForm, setEditForm] = useState(null);

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
  const [brands, setBrands] = useState([]);
  const [activeStockPreview, setActiveStockPreview] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);

  useEffect(() => {
    const handleOutsideClick = () => setActionMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [purRes, supRes, prodRes, brandRes] = await Promise.all([
        api.get('/purchases'),
        api.get('/parties/suppliers'),
        api.get('/products'),
        api.get('/products/meta/brands').catch(() => ({ success: false, brands: [] }))
      ]);

      if (purRes.success) setPurchases(purRes.purchases);
      if (supRes.success) setSuppliers(supRes.suppliers);
      if (prodRes.success) setProducts(prodRes.products);
      if (brandRes?.success) setBrands(brandRes.brands);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadStockPreview = async (productId) => {
    try {
      const res = await api.get(`/purchases/product-stock-preview/${productId}`);
      if (res.success) {
        setActiveStockPreview(res);
      }
    } catch (err) {
      console.error('Failed to load stock preview:', err);
    }
  };

  const addItemToBill = (productId) => {
    const prod = products.find(p => p.id === Number(productId));
    if (!prod) return;

    setItems([...items, {
      product_id: prod.id,
      name: prod.name,
      brand: prod.brand || '',
      unit: prod.unit || 'pkt',
      batch_no: `LOT-${Date.now().toString().slice(-5)}`,
      expiry_date: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      quantity: 10,
      unit_price: prod.purchase_price || 0,
      discount: 0
    }]);

    loadStockPreview(prod.id);
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

  const openEditModal = async (id) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      if (res.success) {
        setEditForm({
          id: res.purchase.id,
          invoice_no: res.purchase.invoice_no,
          supplier_id: res.purchase.supplier_id,
          supplier_invoice_no: res.purchase.supplier_invoice_no || '',
          purchase_date: res.purchase.purchase_date,
          grand_total: res.purchase.grand_total,
          paid_amount: res.purchase.paid_amount,
          balance_due: res.purchase.balance_due,
          payment_method: res.purchase.payment_method || 'Cash',
          notes: res.purchase.notes || ''
        });
        setShowEditModal(true);
      }
    } catch (err) {
      alert('Failed to load purchase for editing');
    }
  };

  const handleUpdatePurchase = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/purchases/${editForm.id}`, {
        supplier_id: Number(editForm.supplier_id),
        supplier_invoice_no: editForm.supplier_invoice_no,
        purchase_date: editForm.purchase_date,
        paid_amount: Number(editForm.paid_amount) || 0,
        payment_method: editForm.payment_method,
        notes: editForm.notes
      });
      if (res.success) {
        setShowEditModal(false);
        setEditForm(null);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to update purchase');
    }
  };

  const handleDeletePurchase = async () => {
    if (!selectedPurchase) return;
    try {
      const res = await api.delete(`/purchases/${selectedPurchase.id}`);
      if (res.success) {
        setShowDeleteModal(false);
        setSelectedPurchase(null);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete purchase');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem' }}>Purchases & Supplier Invoices</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Record cold-chain supplier shipments, batch expiration dates, and payable balances.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={handleExportPurchases} className="btn btn-secondary btn-sm" title="Export Purchases to CSV">
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          {canManageInventory && (
            <button onClick={() => setShowNewModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>New Purchase Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* PURCHASES LIST */}
      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div className="table-responsive" style={{ paddingBottom: '110px', overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '720px' }}>
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
                purchases.map(p => {
                  const netTotal = p.grand_total - (p.returned_amount || 0);
                  const isFullyReturned = netTotal <= 0 && p.returned_amount > 0;
                  
                  return (
                  <tr key={p.id} style={{ opacity: isFullyReturned ? 0.6 : 1 }}>
                    <td className="mono" style={{ fontWeight: 700, color: '#0284c7' }}>
                      {p.invoice_no}
                      {p.returned_amount > 0 && (
                        <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '2px', fontWeight: 700, background: '#fee2e2', padding: '1px 4px', borderRadius: '4px', display: 'inline-block' }}>
                          {isFullyReturned ? 'FULLY RETURNED' : 'PARTIAL RETURN'}
                        </div>
                      )}
                    </td>
                    <td className="mono" style={{ color: '#64748b' }}>{p.supplier_invoice_no || '-'}</td>
                    <td>{formatDate(p.purchase_date)}</td>
                    <td style={{ fontWeight: 600 }}>{p.supplier_name}</td>
                    <td>{p.item_count} items</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {p.returned_amount > 0 ? (
                        <>
                          <div style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.75rem' }}>{formatPKR(p.grand_total)}</div>
                          <div>{formatPKR(netTotal)}</div>
                        </>
                      ) : (
                        formatPKR(p.grand_total)
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatPKR(p.paid_amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {isFullyReturned ? (
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Returned</span>
                      ) : p.balance_due > 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatPKR(p.balance_due)}</span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Settled</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuId(actionMenuId === p.id ? null : p.id);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderRadius: '5px'
                          }}
                          title="Purchase Actions"
                        >
                          <span>Action</span>
                          <ChevronDown size={12} />
                        </button>

                        {actionMenuId === p.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              boxShadow: '0 10px 25px -3px rgba(0,0,0,0.18), 0 4px 6px -2px rgba(0,0,0,0.08)',
                              zIndex: 9999,
                              minWidth: '160px',
                              padding: '4px 0',
                              textAlign: 'left'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setActionMenuId(null);
                                viewPurchase(p.id);
                              }}
                              style={{
                                width: '100%',
                                padding: '7px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: 'none',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#1e293b',
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <Eye size={13} color="#0284c7" />
                              <span>View Bill</span>
                            </button>

                            {canManageInventory && !isFullyReturned && (
                              <button
                                onClick={() => {
                                  setActionMenuId(null);
                                  openReturnModal(p.id);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'none',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  color: '#1e293b',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <RotateCcw size={13} color="#f59e0b" />
                                <span>Return Goods</span>
                              </button>
                            )}

                            {canManageInventory && (
                              <button
                                onClick={() => {
                                  setActionMenuId(null);
                                  openEditModal(p.id);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'none',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  color: '#1e293b',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <Edit size={13} color="#0284c7" />
                                <span>Edit Purchase</span>
                              </button>
                            )}

                            {canManageInventory && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuId(null);
                                  setSelectedPurchase(p);
                                  setShowDeleteModal(true);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'none',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  borderTop: '1px solid #f1f5f9'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <Trash2 size={13} color="#dc2626" />
                                <span>Delete Purchase</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })
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
                <div className="form-grid-3">
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px' }}>
                      <label className="form-label">Add Frozen Product to Shipment *</label>
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
                          <option key={p.id} value={p.id}>
                            {p.name} {p.brand ? `[${p.brand}]` : ''} • Prev Rate: ₨{p.purchase_price}/{p.unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* EXISTING STOCK & ACTIVE BATCHES PREVIEW (FIFO RATE COMPARISON) */}
                  {activeStockPreview && (
                    <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.75rem 0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Package size={16} color="#0284c7" />
                          <strong style={{ color: '#0369a1', fontSize: '0.875rem' }}>
                            Existing Stock: {activeStockPreview.product?.name} ({activeStockPreview.product?.brand || 'Frozen Item'})
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                          Total Current Available Stock: <strong style={{ color: '#0284c7', fontSize: '0.9rem' }}>{activeStockPreview.current_stock} {activeStockPreview.product?.unit}</strong>
                        </div>
                      </div>

                      {activeStockPreview.batches?.length === 0 ? (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          ℹ️ No active batches in inventory. This purchase will establish the initial FIFO stock lot.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Current Active Batches In Stock:
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.45rem' }}>
                            {activeStockPreview.batches.map(b => (
                              <div key={b.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.45rem 0.65rem', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                  <span className="mono" style={{ color: '#0284c7' }}>{b.batch_no}</span>
                                  <span style={{ color: '#059669', fontWeight: 700 }}>₨ {b.purchase_price} / {activeStockPreview.product?.unit}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.7rem', marginTop: '2px' }}>
                                  <span>Qty: {b.quantity} {activeStockPreview.product?.unit}</span>
                                  <span title="Supplier source">From: <strong>{b.supplier_name}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* LINE ITEMS TABLE */}
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', minWidth: '780px' }}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '150px' }}>Product</th>
                        <th style={{ minWidth: '110px' }}>Brand</th>
                        <th style={{ minWidth: '85px' }}>Unit</th>
                        <th style={{ width: '85px' }}>Quantity</th>
                        <th style={{ width: '110px' }}>Rate (₨)</th>
                        <th>Batch / Lot #</th>
                        <th>Expiry Date</th>
                        <th style={{ textAlign: 'right' }}>Total (PKR)</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr><td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>No products added to bill yet. Select a product above.</td></tr>
                      ) : (
                        items.map((it, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>
                              <button
                                type="button"
                                onClick={() => loadStockPreview(it.product_id)}
                                style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                title="Click to view existing stock & batches"
                              >
                                {it.name}
                              </button>
                            </td>
                            <td>
                              <input
                                type="text"
                                list={`brands-list-${idx}`}
                                className="form-control"
                                style={{ padding: '3px 6px', fontSize: '0.775rem' }}
                                placeholder="Brand"
                                value={it.brand || ''}
                                onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                              />
                              <datalist id={`brands-list-${idx}`}>
                                {brands.map(b => (
                                  <option key={b.id} value={b.name} />
                                ))}
                              </datalist>
                            </td>
                            <td>
                              <select
                                className="form-control"
                                style={{ padding: '3px 6px', fontSize: '0.775rem' }}
                                value={it.unit || 'pkt'}
                                onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                              >
                                <option value="KG">KG</option>
                                <option value="Packet">Packet</option>
                                <option value="pkt">pkt</option>
                                <option value="box">box</option>
                                <option value="piece">piece</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.8rem', width: '75px' }}
                                min="0.1"
                                step="any"
                                value={it.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.8rem', width: '95px' }}
                                min="0"
                                value={it.unit_price}
                                onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.75rem', width: '100px' }}
                                placeholder="Auto Lot"
                                value={it.batch_no}
                                onChange={(e) => updateItem(idx, 'batch_no', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                                value={it.expiry_date}
                                onChange={(e) => updateItem(idx, 'expiry_date', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {formatPKR(Number(it.quantity) * Number(it.unit_price))}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                title="Remove item"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAYMENT & SETTLEMENT */}
                <div className="form-grid-3" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
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
                    <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>
                      {Number(paidAmount || 0) < grandTotal ? (
                        <span style={{ color: '#ef4444' }}>
                          Credit / Outstanding: {formatPKR(grandTotal - Number(paidAmount || 0))} (Vendor Ledger)
                        </span>
                      ) : (
                        <span style={{ color: '#10b981' }}>Full Payment (No Udhaar)</span>
                      )}
                    </div>
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
                      <option value="Cheque">Cheque</option>
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

                <div className="form-grid-2" style={{ alignItems: 'center' }}>
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

      {/* EDIT PURCHASE MODAL */}
      {showEditModal && editForm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Edit Purchase: {editForm.invoice_no}</h3>
              <button onClick={() => { setShowEditModal(false); setEditForm(null); }}>✕</button>
            </div>
            <form onSubmit={handleUpdatePurchase}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Supplier *</label>
                    <select
                      className="form-control"
                      value={editForm.supplier_id}
                      onChange={(e) => setEditForm({ ...editForm, supplier_id: e.target.value })}
                      required
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier Bill #</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.supplier_invoice_no}
                      onChange={(e) => setEditForm({ ...editForm, supplier_invoice_no: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Purchase Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editForm.purchase_date}
                      onChange={(e) => setEditForm({ ...editForm, purchase_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={editForm.payment_method}
                      onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Grand Total:</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0284c7' }}>{formatPKR(editForm.grand_total)}</strong>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Paid Amount (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max={editForm.grand_total}
                      value={editForm.paid_amount}
                      onChange={(e) => setEditForm({ ...editForm, paid_amount: e.target.value })}
                    />
                    <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>
                      {Number(editForm.paid_amount || 0) < editForm.grand_total ? (
                        <span style={{ color: '#ef4444' }}>
                          New Payable Due: {formatPKR(editForm.grand_total - Number(editForm.paid_amount || 0))}
                        </span>
                      ) : (
                        <span style={{ color: '#10b981' }}>Full Payment</span>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Notes</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditForm(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PURCHASE CONFIRMATION MODAL */}
      {showDeleteModal && selectedPurchase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#dc2626' }}>Delete Purchase</h3>
              <button onClick={() => { setShowDeleteModal(false); setSelectedPurchase(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#991b1b' }}>
                  Are you sure you want to delete this purchase invoice?
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Invoice:</span>
                  <strong>{selectedPurchase.invoice_no}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Supplier:</span>
                  <strong>{selectedPurchase.supplier_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Grand Total:</span>
                  <strong>{formatPKR(selectedPurchase.grand_total)}</strong>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem', margin: '1rem 0 0' }}>
                This will reverse all stock batches and inventory movements created by this purchase. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setSelectedPurchase(null); }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeletePurchase}>Yes, Delete Purchase</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
