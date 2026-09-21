import React, { useState, useEffect } from 'react';
import { Search, Printer, Eye, RotateCcw, Calendar, Download, ChevronDown, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import { useAuth } from '../context/AuthContext';

export default function SalesList() {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedSale, setSelectedSale] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnSuccess, setReturnSuccess] = useState('');
  const [actionMenuId, setActionMenuId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSaleId, setDeleteSaleId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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

  const handleOpenReturn = async (id) => {
    try {
      const res = await api.get(`/sales/${id}`);
      if (res.success) {
        setSelectedSale(res);
        setReturnItems(res.items.map(i => ({
          product_id: i.product_id,
          batch_id: i.batch_id,
          name: i.product_name,
          quantity: 1,
          max_quantity: i.quantity,
          unit_price: i.unit_price,
          condition: 'RESELLABLE'
        })));
        setShowReturnModal(true);
      }
    } catch (err) {
      alert('Failed to load invoice for return');
    }
  };

  const submitReturn = async () => {
    try {
      const res = await api.post('/sales/returns', {
        original_sale_id: selectedSale.sale.id,
        reason: returnReason,
        items: returnItems.filter(i => i.quantity > 0)
      });
      if (res.success) {
        setReturnSuccess(`Return ${res.data.return_no} processed! Stock reversed.`);
        setShowReturnModal(false);
        setSelectedSale(null);
        loadSales();
      }
    } catch (err) {
      alert(err.message || 'Failed to process sales return');
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
                sales.map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{ fontWeight: 700, color: '#0284c7' }}>{s.invoice_no}</td>
                    <td>{formatDate(s.sale_date)}</td>
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
                                onClick={() => { handleOpenReturn(s.id); setActionMenuId(null); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px', color: '#f59e0b' }}
                                onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.target.style.background = 'none'}
                              >
                                <RotateCcw size={14} /> Return
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
                            onClick={() => handleOpenReturn(s.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#f59e0b' }}
                            title="Sales Return"
                          >
                            <RotateCcw size={15} />
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

      {/* SALES RETURN MODAL */}
      {showReturnModal && selectedSale && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Process Sales Return ({selectedSale.sale.invoice_no})</h3>
              <button onClick={() => setShowReturnModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                Select quantity and condition of returned products. Resellable items will automatically return to stock.
              </p>

              {returnItems.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Rate: {formatPKR(item.unit_price)}</div>
                  </div>
                  <div>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max={item.max_quantity}
                      value={item.quantity}
                      onChange={(e) => {
                        const val = Math.min(item.max_quantity, Math.max(0, Number(e.target.value)));
                        const updated = [...returnItems];
                        updated[idx].quantity = val;
                        setReturnItems(updated);
                      }}
                    />
                  </div>
                  <div>
                    <select
                      className="form-control"
                      value={item.condition}
                      onChange={(e) => {
                        const updated = [...returnItems];
                        updated[idx].condition = e.target.value;
                        setReturnItems(updated);
                      }}
                    >
                      <option value="RESELLABLE">Resellable (Add to Stock)</option>
                      <option value="DAMAGED">Damaged / Melted</option>
                      <option value="DISCARDED">Discarded / Expired</option>
                    </select>
                  </div>
                </div>
              ))}

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Return Reason</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Customer reason (e.g., Wrong flavor, defect, thaw issue)"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={submitReturn}>Confirm Return</button>
            </div>
          </div>
        </div>
      )}

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
