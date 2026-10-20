import React, { useState, useEffect } from 'react';
import { Building2, Plus, FileText, DollarSign, Printer, Search, Edit, ChevronDown, Trash2, RefreshCw, ArrowUpRight } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/common/Pagination';
import ActionMenu from '../components/common/ActionMenu';

export default function Suppliers() {
  const { user, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = authIsAdmin || user?.role === 'admin';
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [selectedSup, setSelectedSup] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);

  useEffect(() => {
    const handleOutsideClick = () => setActionMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    contact_person: '',
    opening_balance: '0',
    notes: ''
  });

  const [editFormData, setEditFormData] = useState(null);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/parties/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      if (res.success) setSuppliers(res.suppliers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/parties/suppliers', formData);
      if (res.success) {
        setShowAddModal(false);
        setFormData({
          name: '',
          phone: '',
          address: '',
          contact_person: '',
          opening_balance: '0',
          notes: ''
        });
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to add supplier');
    }
  };

  const openEditSupplier = (sup) => {
    setSelectedSup(sup);
    setEditFormData({
      name: sup.name || '',
      phone: sup.phone || '',
      address: sup.address || '',
      contact_person: sup.contact_person || '',
      notes: sup.notes || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/parties/suppliers/${selectedSup.id}`, editFormData);
      if (res.success) {
        setShowEditModal(false);
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to update supplier');
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      const res = await api.delete(`/parties/suppliers/${supplierToDelete.id}`);
      if (res.success) {
        setShowDeleteModal(false);
        setSupplierToDelete(null);
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete supplier');
    }
  };

  const openLedger = async (sup, customStart = ledgerStartDate, customEnd = ledgerEndDate) => {
    try {
      setSelectedSup(sup);
      let url = `/parties/suppliers/${sup.id}/ledger?`;
      if (customStart) url += `start_date=${customStart}&`;
      if (customEnd) url += `end_date=${customEnd}&`;
      const res = await api.get(url);
      if (res.success) {
        setLedgerData(res);
        setShowLedgerModal(true);
      }
    } catch (err) {
      alert('Failed to load supplier ledger');
    }
  };

  const openPayModal = (sup) => {
    setSelectedSup(sup);
    setPayAmount(String(sup.current_balance > 0 ? sup.current_balance : ''));
    setShowPayModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/payments/supplier-payment', {
        supplier_id: selectedSup.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        payment_date: payDate,
        notes: payNotes.trim()
      });
      if (res.success) {
        setShowPayModal(false);
        setPayNotes('');
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to record supplier payment');
    }
  };

  const handleRecalculateBalances = async () => {
    if (!window.confirm('This will recalculate all supplier balances from actual purchase/payment/return data. Continue?')) return;
    try {
      setLoading(true);
      const res = await api.post('/parties/suppliers/recalculate-balances');
      if (res.success) {
        alert(res.message);
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to recalculate balances');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search suppliers by company or contact person..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadSuppliers()}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={handleRecalculateBalances} className="btn btn-secondary" title="Admin: Recalculate all supplier balances from actual data">
              <RefreshCw size={14} />
              <span>Recalculate Balances</span>
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>Add New Supplier</span>
          </button>
        </div>
      </div>

      {/* SUPPLIERS TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div className="table-responsive" style={{ minHeight: '300px', paddingBottom: '90px', overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: '700px' }}>
            <thead>
              <tr>
                <th>Supplier / Company</th>
                <th style={{ minWidth: '130px' }}>Contact Person</th>
                <th style={{ minWidth: '120px' }}>Phone</th>
                <th style={{ minWidth: '150px' }}>Address</th>
                <th style={{ textAlign: 'right', minWidth: '120px' }}>Outstanding Payable</th>
                <th style={{ textAlign: 'center', width: '85px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading suppliers...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No suppliers found.</td></tr>
              ) : (
                suppliers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(s => (
                  <tr key={s.id}>
                    <td style={{ minWidth: '180px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.name}</div>
                      {s.address && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {s.address}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: '#334155', fontWeight: 500 }}>{s.contact_person || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>{s.phone || '-'}</td>
                    <td><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.address || '-'}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {s.current_balance > 0 ? (
                        <span style={{ color: '#ef4444' }}>{formatPKR(s.current_balance)}</span>
                      ) : (
                        <span style={{ color: '#10b981' }}>Settled</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => openLedger(s)}
                          className="btn-table-action"
                          title="View statement & ledger"
                        >
                          <span>Details</span>
                          <ArrowUpRight size={13} />
                        </button>

                        <ActionMenu
                          title="Supplier Actions"
                          items={[
                            {
                              label: 'Edit Supplier',
                              icon: <Edit size={14} color="#0284c7" />,
                              onClick: () => openEditSupplier(s)
                            },
                            {
                              label: 'View Statement',
                              icon: <FileText size={14} color="#6366f1" />,
                              onClick: () => openLedger(s)
                            },
                            s.current_balance > 0 && {
                              label: 'Disburse Payment',
                              icon: <DollarSign size={14} color="#ef4444" />,
                              onClick: () => openPayModal(s)
                            },
                            isAdmin && { divider: true },
                            isAdmin && {
                              label: 'Delete Supplier',
                              icon: <Trash2 size={14} color="#dc2626" />,
                              danger: true,
                              onClick: () => {
                                setSupplierToDelete(s);
                                setShowDeleteModal(true);
                              }
                            }
                          ]}
                        />
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={suppliers.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Add New Supplier</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Register a distributor or vendor for procurement.
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Supplier / Company Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Dawn Bread & Frozen Foods"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Asim Butt (Sales Manager)"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="042-111567567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Factory / depot address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Opening Payable Balance (PKR)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="0"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER LEDGER MODAL */}
      {showLedgerModal && ledgerData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '880px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Supplier Statement: {ledgerData.supplier.name}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Contact: {ledgerData.supplier.contact_person || '-'} • Phone: {ledgerData.supplier.phone || '-'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Printer size={14} />
                  <span>Print Statement</span>
                </button>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowLedgerModal(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>From:</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={ledgerStartDate}
                    onChange={(e) => setLedgerStartDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>To:</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={ledgerEndDate}
                    onChange={(e) => setLedgerEndDate(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => openLedger(selectedSup, ledgerStartDate, ledgerEndDate)}
                >
                  Filter
                </button>
                {(ledgerStartDate || ledgerEndDate) && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setLedgerStartDate('');
                      setLedgerEndDate('');
                      openLedger(selectedSup, '', '');
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref #</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Credit (Purchase)</th>
                      <th style={{ textAlign: 'right' }}>Debit (Paid)</th>
                      <th style={{ textAlign: 'right' }}>Running Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.ledger.map((row, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(row.date)}</td>
                        <td className="mono">{row.ref_no}</td>
                        <td style={{ fontSize: '0.85rem' }}>{row.notes}</td>
                        <td style={{ textAlign: 'right', color: row.credit > 0 ? '#ef4444' : '#64748b' }}>
                          {row.credit > 0 ? formatPKR(row.credit) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: row.debit > 0 ? '#10b981' : '#64748b' }}>
                          {row.debit > 0 ? formatPKR(row.debit) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {formatPKR(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '350px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Total Purchases (Credit):</span>
                    <strong>{formatPKR(ledgerData.summary.total_credit)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Total Paid (Debit):</span>
                    <strong style={{ color: '#10b981' }}>{formatPKR(ledgerData.summary.total_debit)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, marginTop: '0.5rem', borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', color: '#ef4444' }}>
                    <span>Closing Payable:</span>
                    <span>{formatPKR(ledgerData.summary.closing_balance)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowLedgerModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* DISBURSE PAYMENT MODAL */}
      {showPayModal && selectedSup && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Pay Supplier</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Vendor: <strong>{selectedSup.name}</strong>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowPayModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#fee2e2', border: '1px solid #fecaca', padding: '0.75rem 1rem', borderRadius: '6px', color: '#991b1b', fontWeight: 600, fontSize: '0.85rem' }}>
                  Total Payable Outstanding: <strong>{formatPKR(selectedSup.current_balance)}</strong>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Amount (PKR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    required
                    min="1"
                    placeholder="Enter amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes / Cheque #</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Bank slip # / online transfer ref"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger btn-sm" style={{ minWidth: '130px' }}>Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {showEditModal && editFormData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Edit Supplier</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Update vendor details and contact information.
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Supplier / Company Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.contact_person}
                      onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => {
                        setShowEditModal(false);
                        setSupplierToDelete(selectedSup);
                        setShowDeleteModal(true);
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete Supplier</span>
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Update Supplier</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SUPPLIER MODAL */}
      {showDeleteModal && supplierToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px', width: '96%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} color="#dc2626" />
                <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.05rem', fontWeight: 700 }}>Confirm Delete Supplier</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete supplier <strong>"{supplierToDelete.name}"</strong>?
              {supplierToDelete.current_balance > 0 ? (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontWeight: 600, fontSize: '0.8rem' }}>
                  ⚠️ This supplier has an active payable balance of {formatPKR(supplierToDelete.current_balance)}. Please settle this balance before deleting.
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  This action will remove the supplier profile from your supplier directory. Historical purchase records will be preserved for financial auditing.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteSupplier}
                disabled={supplierToDelete.current_balance > 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={13} />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
