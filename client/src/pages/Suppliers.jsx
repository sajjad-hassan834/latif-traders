import React, { useState, useEffect } from 'react';
import { Building2, Plus, FileText, DollarSign, Printer, Search, Edit, ChevronDown } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
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
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* SUPPLIERS TABLE */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="table">
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
                suppliers.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.name}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.contact_person || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.phone || '-'}</td>
                    <td><span style={{ fontSize: '0.85rem', color: '#64748b' }}>{s.address || '-'}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {s.current_balance > 0 ? (
                        <span style={{ color: '#ef4444' }}>{formatPKR(s.current_balance)}</span>
                      ) : (
                        <span style={{ color: '#10b981' }}>Settled</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuId(actionMenuId === s.id ? null : s.id);
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
                          title="Supplier Actions"
                        >
                          <span>Action</span>
                          <ChevronDown size={12} />
                        </button>

                        {actionMenuId === s.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15), 0 4px 6px -2px rgba(0,0,0,0.08)',
                              zIndex: 100,
                              minWidth: '150px',
                              padding: '4px 0',
                              textAlign: 'left'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setActionMenuId(null);
                                openEditSupplier(s);
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
                              <span>Edit Supplier</span>
                            </button>

                            <button
                              onClick={() => {
                                setActionMenuId(null);
                                openLedger(s);
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
                              <FileText size={13} color="#6366f1" />
                              <span>View Statement</span>
                            </button>

                            {s.current_balance > 0 && (
                              <button
                                onClick={() => {
                                  setActionMenuId(null);
                                  openPayModal(s);
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
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <DollarSign size={13} color="#ef4444" />
                                <span>Disburse Payment</span>
                              </button>
                            )}
                          </div>
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

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New Frozen Food Distributor</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Asim Butt (Sales Manager)"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
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

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Factory / depot address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER LEDGER MODAL */}
      {showLedgerModal && ledgerData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <h3>Supplier Statement: {ledgerData.supplier.name}</h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Contact: {ledgerData.supplier.contact_person || '-'} • Phone: {ledgerData.supplier.phone || '-'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  <Printer size={15} />
                  <span>Print Statement</span>
                </button>
                <button onClick={() => setShowLedgerModal(false)}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', background: '#f8fafc', padding: '0.6rem 0.75rem', borderRadius: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>From:</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={ledgerStartDate}
                    onChange={(e) => setLedgerStartDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>To:</span>
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
                <table className="table">
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
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', minWidth: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>Total Purchases (Credit):</span>
                    <strong>{formatPKR(ledgerData.summary.total_credit)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>Total Paid (Debit):</span>
                    <strong style={{ color: '#10b981' }}>{formatPKR(ledgerData.summary.total_debit)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, marginTop: '0.5rem', borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', color: '#ef4444' }}>
                    <span>Closing Payable:</span>
                    <span>{formatPKR(ledgerData.summary.closing_balance)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLedgerModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* DISBURSE PAYMENT MODAL */}
      {showPayModal && selectedSup && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Pay Supplier: {selectedSup.name}</h3>
              <button onClick={() => setShowPayModal(false)}>✕</button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#fee2e2', padding: '0.75rem 1rem', borderRadius: '8px', color: '#991b1b', fontWeight: 600 }}>
                  Total Payable Outstanding: {formatPKR(selectedSup.current_balance)}
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Amount (PKR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    required
                    min="1"
                    placeholder="Enter amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Payment Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
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

                <div className="form-group">
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger">Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {showEditModal && editFormData && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Supplier Information</h3>
              <button onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdateSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Supplier / Company Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.contact_person}
                      onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
