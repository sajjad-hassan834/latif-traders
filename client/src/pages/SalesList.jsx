import React, { useState, useEffect } from 'react';
import { Search, Printer, Eye, RotateCcw, Calendar, Download, ChevronDown, Trash2, Edit3 } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/common/Pagination';

export default function SalesList() {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [selectedSale, setSelectedSale] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSale, setEditSale] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editPaidAmount, setEditPaidAmount] = useState(0);
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSaleId, setDeleteSaleId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [returnSuccess, setReturnSuccess] = useState('');

  useEffect(() => {
    const handleOutsideClick = () => setActionMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleExportCSV = () => {
    if (!sales.length) return;
    exportToCSV('Sales_Invoices', sales, [
      { label: 'Invoice No', key: 'invoice_no' },
      { label: 'Sale Date', key: 'sale_date' },
      { label: 'Customer', key: 'customer_name', format: (v) => v || 'Walk-in Counter' },
      { label: 'Sale Type', key: 'sale_type' },
      { label: 'Subtotal (PKR)', key: 'subtotal' },
      { label: 'Discount (PKR)', key: 'discount' },
      { label: 'Grand Total (PKR)', key: 'grand_total' },
      { label: 'Paid Amount (PKR)', key: 'paid_amount' },
      { label: 'Balance Due (PKR)', key: 'balance_due' },
      { label: 'Payment Method', key: 'payment_method' },
      { label: 'Payment Status', key: 'payment_status' },
      { label: 'Cashier', key: 'cashier_name' }
    ]);
  };

  const loadSales = async () => {
    try {
      setLoading(true);
      let query = `/sales?`;
      if (startDate) query += `start_date=${startDate}&`;
      if (endDate) query += `end_date=${endDate}&`;
      if (search) query += `search=${encodeURIComponent(search)}&`;

      const res = await api.get(query);
      if (res.success) setSales(res.sales);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [startDate, endDate]);

  const handleViewInvoice = async (id) => {
    try {
      const res = await api.get(`/sales/${id}`);
      if (res.success) setSelectedSale(res);
    } catch (err) {
      alert('Failed to load invoice details');
    }
  };

  const handleOpenEdit = async (id) => {
    try {
      const res = await api.get(`/sales/${id}`);
      if (res.success) {
        setEditSale(res.sale);
        setEditItems(res.items.map(i => ({
          id: i.id,
          product_id: i.product_id,
          batch_id: i.batch_id,
          name: i.product_name,
          brand_name: i.brand_name || i.supplier_name,
          unit: i.unit || 'pkt',
          unit_price: Number(i.unit_price) || 0,
          original_quantity: Number(i.quantity),
          quantity: Number(i.quantity),
          discount: Number(i.discount) || 0,
          total_price: Number(i.total_price) || 0
        })));
        setEditDiscount(Number(res.sale.discount) || 0);
        setEditPaidAmount(Number(res.sale.paid_amount) || 0);
        setEditReason('');
        setShowEditModal(true);
      }
    } catch (err) {
      alert('Failed to load invoice for editing');
    }
  };

  const submitEditSale = async () => {
    if (!editSale) return;
    try {
      setEditSubmitting(true);
      const payload = {
        items: editItems.map(i => ({
          id: i.id,
          product_id: i.product_id,
          batch_id: i.batch_id,
          quantity: Number(i.quantity) || 0,
          unit_price: Number(i.unit_price) || 0,
          discount: Number(i.discount) || 0
        })),
        discount: Number(editDiscount) || 0,
        paid_amount: Number(editPaidAmount) || 0,
        reason: editReason
      };

      const res = await api.put(`/sales/${editSale.id}`, payload);
      if (res.success) {
        setReturnSuccess(`Bill ${editSale.invoice_no} updated! Stock & customer balance updated successfully.`);
        setShowEditModal(false);
        setEditSale(null);
        loadSales();
      }
    } catch (err) {
      alert(err.message || 'Failed to update sale invoice');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteSale = async () => {
    if (!deleteSaleId) return;
    try {
      setDeleteSubmitting(true);
      const res = await api.delete(`/sales/${deleteSaleId}`, { reason: deleteReason });
      if (res.success) {
        setReturnSuccess(res.message || 'Sale deleted and stock reversed.');
        setShowDeleteModal(false);
        setDeleteSaleId(null);
        setDeleteReason('');
        loadSales();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete sale');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {returnSuccess && (
        <div style={{ padding: '1rem', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', fontWeight: 600 }}>
          ✔ {returnSuccess}
        </div>
      )}

      {/* FILTERS BAR */}
      <div className="card" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px' }}>
          <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Search</label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.2rem', height: '36px' }}
              placeholder="Search by invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadSales()}
            />
          </div>
        </div>

        <div>
          <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>From</label>
          <input
            type="date"
            className="form-control"
            style={{ minWidth: '150px', height: '36px' }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>To</label>
          <input
            type="date"
            className="form-control"
            style={{ minWidth: '150px', height: '36px' }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '1px' }}>
          <button onClick={loadSales} className="btn btn-secondary btn-sm" style={{ height: '36px' }}>
            Filter
          </button>

          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm" style={{ height: '36px' }} title="Export to CSV / Excel">
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* SALES TABLE */}
      <div className="card" style={{ padding: '0', overflow: 'visible', paddingBottom: '110px' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', minWidth: '780px' }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Sale Type</th>
                <th>Items</th>
                <th style={{ textAlign: 'right' }}>Grand Total</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>Loading sales records...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No sales found for the selected period.</td>
                </tr>
              ) : (
                sales.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{ fontWeight: 700, color: '#0284c7' }}>{s.invoice_no}</td>
                    <td>{formatDateTime(s.created_at || s.sale_date)}</td>
                    <td style={{ fontWeight: 600 }}>{s.customer_name || 'Walk-in Retail'}</td>
                    <td><span className="badge badge-info">{s.sale_type}</span></td>
                    <td>{s.item_count} items</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(s.grand_total)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPKR(s.paid_amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {s.balance_due > 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatPKR(s.balance_due)}</span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Paid</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', position: 'relative' }}>
                      {isAdmin ? (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === s.id ? null : s.id); }}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.775rem' }}
                          >
                            Action <ChevronDown size={13} />
                          </button>
                          {actionMenuId === s.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                                background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 50, minWidth: '150px', padding: '4px'
                              }}
                            >
                              <button
                                onClick={() => { handleViewInvoice(s.id); setActionMenuId(null); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
                                onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.target.style.background = 'none'}
                              >
                                <Printer size={14} /> View / Print
                              </button>
                              <button
                                onClick={() => { handleOpenEdit(s.id); setActionMenuId(null); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px', color: '#0284c7' }}
                                onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.target.style.background = 'none'}
                              >
                                <Edit3 size={14} /> Edit Bill
                              </button>
                              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
                              <button
                                onClick={() => { setDeleteSaleId(s.id); setShowDeleteModal(true); setActionMenuId(null); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px', color: '#ef4444' }}
                                onMouseEnter={(e) => e.target.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.target.style.background = 'none'}
                              >
                                <Trash2 size={14} /> Delete Sale
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewInvoice(s.id)}
                            className="btn btn-secondary btn-sm"
                            title="Print / View Invoice"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(s.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#0284c7' }}
                            title="Edit Bill"
                          >
                            <Edit3 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={sales.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* PRINT INVOICE MODAL */}
      {selectedSale && !showReturnModal && (
        <PrintInvoiceModal
          sale={selectedSale.sale}
          items={selectedSale.items}
          settings={selectedSale.settings}
          onClose={() => setSelectedSale(null)}
        />
      )}

      {/* EDIT SALE / INVOICE MODAL */}
      {showEditModal && editSale && (() => {
        const calcSubtotal = editItems.reduce((acc, it) => {
          const qty = Number(it.quantity) || 0;
          const rate = Number(it.unit_price) || 0;
          const disc = Number(it.discount) || 0;
          return acc + Math.max(0, (qty * rate) - disc);
        }, 0);
        const calcGrandTotal = Math.max(0, calcSubtotal - Number(editDiscount || 0));
        const calcPaid = Number(editPaidAmount) || 0;
        const calcBalanceDue = Math.max(0, calcGrandTotal - calcPaid);
        const oldDue = Number(editSale.balance_due) || 0;
        const dueDelta = calcBalanceDue - oldDue;

        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '780px', width: '95%' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit3 size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Bill / Invoice ({editSale.invoice_no})</h3>
                </div>
                <button onClick={() => setShowEditModal(false)}>✕</button>
              </div>

              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.825rem' }}>
                  <div><strong>Customer:</strong> {editSale.customer_name || 'Walk-in Retail Customer'}</div>
                  <div><strong>Date:</strong> {formatDateTime(editSale.created_at || editSale.sale_date)}</div>
                  <div><strong>Sale Type:</strong> <span className="badge badge-info">{editSale.sale_type}</span></div>
                  <div><strong>Payment:</strong> {editSale.payment_method || 'Cash'}</div>
                </div>

                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#065f46' }}>
                  📦 <strong>Stock & Ledger Reversal:</strong> If you reduce quantities (e.g. from 3 to 1), the reversed items will automatically be restored to your inventory stock and the bill/customer debt will adjust instantly upon saving.
                </div>

                <div className="table-responsive" style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <table className="table" style={{ width: '100%', margin: 0, fontSize: '0.825rem' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#fff' }}>
                        <th style={{ padding: '8px 10px' }}>Item Description</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Original Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>New Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Stock Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => {
                        const qty = Number(item.quantity) || 0;
                        const origQty = Number(item.original_quantity) || 0;
                        const rate = Number(item.unit_price) || 0;
                        const lineTotal = Math.max(0, (qty * rate) - (Number(item.discount) || 0));
                        const diff = qty - origQty;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 600 }}>{item.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.brand_name || 'Latif Traders'}</div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {formatPKR(rate)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span className="badge badge-secondary" style={{ padding: '3px 8px' }}>
                                {origQty} {item.unit}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                className="form-control form-control-sm"
                                style={{ width: '85px', textAlign: 'center', fontWeight: 700, margin: '0 auto' }}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value));
                                  const updated = [...editItems];
                                  updated[idx].quantity = val;
                                  setEditItems(updated);
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {formatPKR(lineTotal)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {diff < 0 ? (
                                <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.75rem', background: '#dcfce7', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                  +{Math.abs(diff)} to Stock 📦
                                </span>
                              ) : diff > 0 ? (
                                <span style={{ color: '#ea580c', fontWeight: 600, fontSize: '0.75rem', background: '#ffedd5', padding: '3px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                  -{diff} from Stock
                                </span>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No Change</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem', marginTop: '1.2rem' }}>
                  <div>
                    <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reason for Modification *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g., Customer returned 1 item, corrected quantity"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                      />
                    </div>

                    {editSale.customer_id && editSale.customer_id > 1 && (
                      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#0369a1' }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>Customer Ledger Impact:</div>
                        <div>Previous Bill Balance Due: <strong>{formatPKR(oldDue)}</strong></div>
                        <div>New Bill Balance Due: <strong>{formatPKR(calcBalanceDue)}</strong></div>
                        <div style={{ marginTop: '4px', fontWeight: 700, color: dueDelta < 0 ? '#16a34a' : dueDelta > 0 ? '#ef4444' : '#0369a1' }}>
                          Customer Debt Net Change: {dueDelta > 0 ? `+${formatPKR(dueDelta)}` : formatPKR(dueDelta)}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <strong>{formatPKR(calcSubtotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Discount (₨):</span>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        style={{ width: '90px', textAlign: 'right' }}
                        value={editDiscount}
                        onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                      <strong>New Grand Total:</strong>
                      <strong style={{ color: '#0284c7' }}>{formatPKR(calcGrandTotal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Paid Amount (₨):</span>
                      <input
                        type="number"
                        min="0"
                        className="form-control form-control-sm"
                        style={{ width: '90px', textAlign: 'right' }}
                        value={editPaidAmount}
                        onChange={(e) => setEditPaidAmount(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem' }}>
                      <span>New Balance Due:</span>
                      <strong style={{ color: calcBalanceDue > 0 ? '#ef4444' : '#10b981' }}>
                        {calcBalanceDue > 0 ? formatPKR(calcBalanceDue) : 'Paid (Settled)'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={editSubmitting}
                  onClick={submitEditSale}
                >
                  {editSubmitting ? 'Saving & Updating Stock...' : 'Save & Update Bill'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DELETE SALE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>Delete Sale Invoice</h3>
              <button onClick={() => { setShowDeleteModal(false); setDeleteSaleId(null); setDeleteReason(''); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600, margin: 0 }}>
                  This will permanently delete this sale and reverse all stock, payments, and customer balances.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Reason for deletion *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Wrong bill, customer didn't purchase"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteSaleId(null); setDeleteReason(''); }}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={!deleteReason.trim() || deleteSubmitting}
                onClick={handleDeleteSale}
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete & Reverse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
