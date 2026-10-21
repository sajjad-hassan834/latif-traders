import React, { useState, useEffect } from 'react';
import { Users, Plus, FileText, DollarSign, Printer, Search, Edit, ChevronDown, Trash2, ArrowUpRight, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/common/Pagination';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import ActionMenu from '../components/common/ActionMenu';

export default function Customers() {
  const { user, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = authIsAdmin || user?.role === 'admin';
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncingBalances, setSyncingBalances] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const ITEMS_PER_PAGE = 15;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [selectedCust, setSelectedCust] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [viewingSale, setViewingSale] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);

  const handleViewInvoiceDetails = async (invoiceNo) => {
    try {
      const res = await api.get(`/sales/${invoiceNo}`);
      if (res.success) {
        setViewingSale(res);
      }
    } catch (err) {
      alert('Failed to load bill details: ' + (err.message || ''));
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => setActionMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Add Customer Form
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    customer_type: 'Retail',
    opening_balance: '0',
    credit_limit: '0',
    notes: ''
  });

  const [editFormData, setEditFormData] = useState(null);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  // Receive Payment Form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/parties/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      if (res.success) setCustomers(res.customers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/parties/customers', formData);
      if (res.success) {
        setShowAddModal(false);
        setFormData({
          name: '',
          phone: '',
          address: '',
          customer_type: 'Retail',
          opening_balance: '0',
          credit_limit: '0',
          notes: ''
        });
        loadCustomers();
      }
    } catch (err) {
      alert(err.message || 'Failed to add customer');
    }
  };

  const openEditCustomer = (cust) => {
    setSelectedCust(cust);
    setEditFormData({
      name: cust.name || '',
      phone: cust.phone || '',
      address: cust.address || '',
      customer_type: cust.customer_type || 'Retail',
      credit_limit: cust.credit_limit || 0,
      notes: cust.notes || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/parties/customers/${selectedCust.id}`, editFormData);
      if (res.success) {
        setShowEditModal(false);
        loadCustomers();
      }
    } catch (err) {
      alert(err.message || 'Failed to update customer');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      const res = await api.delete(`/parties/customers/${customerToDelete.id}`);
      if (res.success) {
        setShowDeleteModal(false);
        setCustomerToDelete(null);
        loadCustomers();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  const openLedger = async (cust, customStart = ledgerStartDate, customEnd = ledgerEndDate) => {
    try {
      setSelectedCust(cust);
      let url = `/parties/customers/${cust.id}/ledger?`;
      if (customStart) url += `start_date=${customStart}&`;
      if (customEnd) url += `end_date=${customEnd}&`;
      const res = await api.get(url);
      if (res.success) {
        setLedgerData(res);
        setShowLedgerModal(true);
      }
    } catch (err) {
      alert('Failed to load ledger');
    }
  };

  const openPaymentModal = (cust) => {
    setSelectedCust(cust);
    setPayAmount(String(cust.current_balance > 0 ? cust.current_balance : ''));
    setShowPayModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/payments/customer-receipt', {
        customer_id: selectedCust.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        payment_date: payDate,
        notes: payNotes.trim()
      });
      if (res.success) {
        setShowPayModal(false);
        setPayNotes('');
        loadCustomers();
      }
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    }
  };

  const handleSyncCustomerBalances = async () => {
    try {
      setSyncingBalances(true);
      const res = await api.post('/customers/recalculate-balances');
      if (res.success) {
        alert(res.message);
        loadCustomers();
      }
    } catch (err) {
      alert(err.message || 'Failed to recalculate customer balances.');
    } finally {
      setSyncingBalances(false);
    }
  };

  const allCount = customers.length;
  const dueCount = customers.filter(c => Number(c.current_balance) > 0).length;
  const retailCount = customers.filter(c => c.customer_type === 'Retail').length;
  const wholesaleCount = customers.filter(c => c.customer_type === 'Wholesale').length;

  const filteredCustomers = customers.filter(c => {
    if (selectedFilter === 'due') return Number(c.current_balance) > 0;
    if (selectedFilter === 'retail') return c.customer_type === 'Retail';
    if (selectedFilter === 'wholesale') return c.customer_type === 'Wholesale';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Customers</h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '3px 0 0 0' }}>
            {allCount} total customers · {dueCount} with outstanding balance
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isAdmin && (
            <button
              type="button"
              onClick={handleSyncCustomerBalances}
              disabled={syncingBalances}
              className="btn btn-secondary btn-sm"
              title="Audit and re-calculate all customer balances from verified invoices & receipts"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px' }}
            >
              <RefreshCw size={14} className={syncingBalances ? 'spin' : ''} />
              <span>{syncingBalances ? 'Auditing...' : 'Audit & Sync Balances'}</span>
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ height: '36px' }}>
            <Plus size={16} />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* FILTER PILLS & SEARCH BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="filter-pills-bar">
          <button
            type="button"
            className={`filter-pill ${selectedFilter === 'all' ? 'active' : ''}`}
            onClick={() => { setSelectedFilter('all'); setCurrentPage(1); }}
          >
            All <span className="filter-pill-count">{allCount}</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${selectedFilter === 'due' ? 'active' : ''}`}
            onClick={() => { setSelectedFilter('due'); setCurrentPage(1); }}
          >
            Due Balance <span className="filter-pill-count">{dueCount}</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${selectedFilter === 'retail' ? 'active' : ''}`}
            onClick={() => { setSelectedFilter('retail'); setCurrentPage(1); }}
          >
            Retail <span className="filter-pill-count">{retailCount}</span>
          </button>
          <button
            type="button"
            className={`filter-pill ${selectedFilter === 'wholesale' ? 'active' : ''}`}
            onClick={() => { setSelectedFilter('wholesale'); setCurrentPage(1); }}
          >
            Wholesale <span className="filter-pill-count">{wholesaleCount}</span>
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.2rem', height: '36px' }}
            placeholder="Search saved customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
          />
        </div>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div className="table-responsive" style={{ minHeight: '300px', paddingBottom: '90px', overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: '720px' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '160px', textAlign: 'left' }}>Customer Name</th>
                <th style={{ width: '110px', minWidth: '110px', textAlign: 'center' }}>Type</th>
                <th style={{ width: '130px', minWidth: '130px', textAlign: 'left' }}>Phone</th>
                <th style={{ minWidth: '150px', textAlign: 'left' }}>Address</th>
                <th style={{ textAlign: 'right', width: '110px', minWidth: '110px' }}>Credit Limit</th>
                <th style={{ textAlign: 'right', width: '125px', minWidth: '125px' }}>Current Balance</th>
                <th style={{ textAlign: 'center', width: '100px', minWidth: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem' }}>Loading customers...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No customers found.</td></tr>
              ) : (
                filteredCustomers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(c => (
                  <tr key={c.id}>
                    <td style={{ minWidth: '180px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                      {c.address && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {c.address}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${c.customer_type === 'Wholesale' ? 'badge-info' : 'badge-success'}`}>
                        {c.customer_type}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: '#334155', fontWeight: 500 }}>{c.phone || '-'}</td>
                    <td><span style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.address || '-'}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: '#64748b' }}>{c.credit_limit > 0 ? formatPKR(c.credit_limit) : 'No Limit'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {c.current_balance > 0 ? (
                        <span style={{ color: '#ef4444' }}>{formatPKR(c.current_balance)}</span>
                      ) : (
                        <span style={{ color: '#10b981' }}>₨ 0</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => openLedger(c)}
                          className="btn-table-action"
                          title="View statement & purchases"
                        >
                          <span>Details</span>
                          <ArrowUpRight size={13} />
                        </button>

                        <ActionMenu
                          title="Customer Actions"
                          items={[
                            {
                              label: 'Edit Customer',
                              icon: <Edit size={14} color="#0284c7" />,
                              onClick: () => openEditCustomer(c)
                            },
                            {
                              label: 'View Statement',
                              icon: <FileText size={14} color="#6366f1" />,
                              onClick: () => openLedger(c)
                            },
                            c.current_balance > 0 && {
                              label: 'Receive Payment',
                              icon: <DollarSign size={14} color="#15803d" />,
                              onClick: () => openPaymentModal(c)
                            },
                            isAdmin && { divider: true },
                            isAdmin && (c.id === 1 ? {
                              label: 'Walk-in (Protected)',
                              icon: <Trash2 size={14} color="#cbd5e1" />,
                              disabled: true
                            } : {
                              label: 'Delete Customer',
                              icon: <Trash2 size={14} color="#dc2626" />,
                              danger: true,
                              onClick: () => {
                                setCustomerToDelete(c);
                                setShowDeleteModal(true);
                              }
                            })
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
          totalItems={filteredCustomers.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ADD CUSTOMER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Add New Customer</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Create a new retail or wholesale customer account.
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
            <form onSubmit={handleAddCustomer}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Customer / Business Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Al-Madina Fast Food & Cafe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Customer Type</label>
                    <select
                      className="form-control"
                      value={formData.customer_type}
                      onChange={(e) => setFormData({ ...formData, customer_type: e.target.value })}
                    >
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="0300-1234567"
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
                    placeholder="Shop address / delivery area"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Opening Balance (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0"
                      value={formData.opening_balance}
                      onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Credit Limit (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0 for unlimited"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER LEDGER / STATEMENT MODAL */}
      {/* CUSTOMER LEDGER / STATEMENT MODAL */}
      {showLedgerModal && ledgerData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '980px', width: '96%', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            {/* MODAL HEADER: TWO ROWS PREVENTING ANY BUTTON COLLISION */}
            <div className="modal-header" style={{
              padding: '16px 22px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#FFFFFF'
            }}>
              {/* Row 1: Identity & Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: '#0F766E',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {(ledgerData.customer.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '19px', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
                      {ledgerData.customer.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
                      {ledgerData.customer.customer_type ? `${ledgerData.customer.customer_type} Customer` : 'Retail Customer'}
                      {ledgerData.customer.phone && ledgerData.customer.phone !== 'None' && (
                        <span> • 📞 {ledgerData.customer.phone}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Top-Right Action Controls: Dedicated container with zero collision */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      background: '#FFFFFF',
                      border: '1px solid #D1D5DB',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#374151',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Print customer ledger statement"
                  >
                    <Printer size={15} />
                    <span>Print Statement</span>
                  </button>

                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setShowLedgerModal(false)}
                    aria-label="Close"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid #D1D5DB',
                      background: '#F3F4F6',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#4B5563',
                      fontSize: '16px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                    title="Close ledger"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Row 2: Customer Status Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ background: '#F3F4F6', color: '#374151', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>📅</span> Customer since: {ledgerData.customer.created_at ? formatDate(ledgerData.customer.created_at) : 'Active'}
                </div>
                <div style={{ background: '#F3F4F6', color: '#374151', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>💰</span> Total Purchases: {formatPKR(ledgerData.summary.total_purchased || ledgerData.summary.total_debit || 0)}
                </div>
                {Number(ledgerData.summary.closing_balance || 0) <= 0 ? (
                  <div style={{ background: '#D1FAE5', color: '#065F46', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ✓ Fully Settled (No Pending Udhaar)
                  </div>
                ) : (
                  <div style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ Total Pending Udhaar: {formatPKR(ledgerData.summary.closing_balance)}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-body" style={{ padding: '18px 22px' }}>
              {/* DATE FILTER BAR */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>Filter by date:</span>
                  <input
                    type="date"
                    style={{
                      height: '34px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '7px',
                      padding: '0 10px',
                      fontSize: '13px',
                      color: '#111827',
                      background: '#FFFFFF'
                    }}
                    value={ledgerStartDate}
                    onChange={(e) => setLedgerStartDate(e.target.value)}
                  />
                  <input
                    type="date"
                    style={{
                      height: '34px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '7px',
                      padding: '0 10px',
                      fontSize: '13px',
                      color: '#111827',
                      background: '#FFFFFF'
                    }}
                    value={ledgerEndDate}
                    onChange={(e) => setLedgerEndDate(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => openLedger(selectedCust, ledgerStartDate, ledgerEndDate)}
                    style={{
                      height: '34px',
                      padding: '0 14px',
                      background: '#0F766E',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '7px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    Apply Filter →
                  </button>
                  {(ledgerStartDate || ledgerEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLedgerStartDate('');
                        setLedgerEndDate('');
                        openLedger(selectedCust, '', '');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6B7280',
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '0 8px',
                        textDecoration: 'underline'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div style={{ fontSize: '11px', color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                  ⚡ Sorted: Newest Invoices First
                </div>
              </div>

              {/* DUAL-BALANCE LEDGER TABLE */}
              <div className="table-responsive" style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '10px' }}>
                <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E5E7EB' }}>
                      <th style={{ width: '95px', padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ width: '135px', padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Invoice #</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Description</th>
                      <th style={{ width: '105px', padding: '10px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Bill Total</th>
                      <th style={{ width: '105px', padding: '10px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Paid</th>
                      <th style={{ width: '115px', padding: '10px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#DC2626', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Bill Due</th>
                      <th style={{ width: '125px', padding: '10px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#0F766E', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Account Balance</th>
                      <th style={{ width: '75px', padding: '10px 14px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.ledger.map((row, idx) => {
                      const isOpening = row.type === 'OPENING' || row.ref_no === 'OPN-BAL';
                      const isSale = row.ref_no && row.ref_no.startsWith('INV-');

                      let dot = '•';
                      let descText = row.notes || 'Transaction';
                      let descColor = '#374151';

                      if (isOpening) {
                        dot = '⚫';
                        descText = 'Account Opening Balance';
                        descColor = '#6B7280';
                      } else if (row.type === 'PAYMENT_RECEIPT' || row.type === 'RECEIPT' || (!row.bill_amount && row.paid_amount > 0)) {
                        dot = '🔵';
                        const isBank = (row.notes && row.notes.toLowerCase().includes('bank')) || row.payment_method === 'Bank Transfer';
                        descText = isBank ? 'Payment Received — Bank' : 'Payment Received';
                        descColor = '#0F766E';
                      } else if (row.bill_amount > 0) {
                        if (row.paid_amount >= row.bill_amount) {
                          const isBank = (row.notes && row.notes.toLowerCase().includes('bank'));
                          dot = '🟢';
                          descText = isBank ? 'Paid in Full — Bank' : 'Paid in Full — Cash';
                          descColor = '#16A34A';
                        } else if (row.paid_amount > 0) {
                          dot = '🟡';
                          descText = 'Partial Payment';
                          descColor = '#D97706';
                        } else {
                          dot = '🔴';
                          descText = 'Credit Sale';
                          descColor = '#DC2626';
                        }
                      }

                      if (isOpening) {
                        return (
                          <tr
                            key={idx}
                            style={{
                              height: '48px',
                              background: '#FFFBEB',
                              borderBottom: '1px solid #F3F4F6',
                              verticalAlign: 'middle'
                            }}
                          >
                            <td style={{ padding: '0 14px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                              {formatDate(row.date)}
                            </td>
                            <td style={{ padding: '0 14px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                background: '#E5E7EB',
                                color: '#374151',
                                borderRadius: '12px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.5px'
                              }}>
                                OPENING
                              </span>
                            </td>
                            <td style={{ padding: '0 14px', fontSize: '13px', color: '#6B7280' }}>
                              <span style={{ marginRight: '6px' }}>⚫</span>
                              <span>Account Opening Balance</span>
                            </td>
                            <td style={{ padding: '0 14px', textAlign: 'right', fontSize: '13px', color: '#9CA3AF' }}>—</td>
                            <td style={{ padding: '0 14px', textAlign: 'right', fontSize: '13px', color: '#9CA3AF' }}>—</td>
                            <td style={{ padding: '0 14px', textAlign: 'right', fontSize: '13px', color: '#9CA3AF' }}>—</td>
                            <td style={{ padding: '0 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <span style={{
                                background: row.balance > 0 ? '#FEE2E2' : '#D1FAE5',
                                color: row.balance > 0 ? '#991B1B' : '#065F46',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontWeight: 700,
                                fontSize: '12px',
                                display: 'inline-block'
                              }}>
                                {row.balance > 0 ? formatPKR(row.balance) : 'Rs 0 ✓'}
                              </span>
                            </td>
                            <td style={{ padding: '0 14px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>—</td>
                          </tr>
                        );
                      }

                      const dueAmount = row.invoice_due !== undefined ? Number(row.invoice_due) : Math.max(0, Number(row.bill_amount || 0) - Number(row.paid_amount || 0));

                      return (
                        <tr
                          key={idx}
                          style={{
                            height: '50px',
                            borderBottom: '1px solid #F3F4F6',
                            verticalAlign: 'middle',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                        >
                          <td style={{ padding: '0 14px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {formatDate(row.date)}
                          </td>
                          <td style={{ padding: '0 14px', whiteSpace: 'nowrap' }}>
                            {isSale ? (
                              <button
                                type="button"
                                onClick={() => handleViewInvoiceDetails(row.ref_no)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0F766E',
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0,
                                  textDecoration: 'none',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Click to view itemized invoice slip"
                              >
                                {row.ref_no}
                              </button>
                            ) : (
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4B5563', whiteSpace: 'nowrap' }}>
                                {row.ref_no || '—'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0 14px', fontSize: '13px', color: descColor, whiteSpace: 'nowrap' }}>
                            <span style={{ marginRight: '6px' }}>{dot}</span>
                            <span style={{ fontWeight: 500 }}>{descText}</span>
                          </td>
                          <td style={{ padding: '0 14px', textAlign: 'right', fontWeight: 600, fontSize: '13px', color: '#111827', whiteSpace: 'nowrap' }}>
                            {row.bill_amount > 0 ? formatPKR(row.bill_amount) : <span style={{ color: '#9CA3AF' }}>—</span>}
                          </td>
                          <td style={{ padding: '0 14px', textAlign: 'right', fontWeight: 600, fontSize: '13px', color: '#16A34A', whiteSpace: 'nowrap' }}>
                            {row.paid_amount > 0 ? formatPKR(row.paid_amount) : <span style={{ color: '#9CA3AF' }}>—</span>}
                          </td>
                          {/* INVOICE DUE (SPECIFIC BILL OUTSTANDING) */}
                          <td style={{ padding: '0 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {row.bill_amount > 0 ? (
                              dueAmount > 0 ? (
                                <span style={{
                                  background: '#FEE2E2',
                                  color: '#991B1B',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  display: 'inline-block'
                                }}>
                                  ⚠️ {formatPKR(dueAmount)}
                                </span>
                              ) : (
                                <span style={{
                                  background: '#D1FAE5',
                                  color: '#065F46',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  display: 'inline-block'
                                }}>
                                  Rs 0 ✓ Paid
                                </span>
                              )
                            ) : (
                              <span style={{ color: '#9CA3AF' }}>—</span>
                            )}
                          </td>
                          {/* ACCOUNT BALANCE (RUNNING TOTAL AT THIS POINT) */}
                          <td style={{ padding: '0 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{
                              fontWeight: 700,
                              fontSize: '13px',
                              color: row.balance > 0 ? '#991B1B' : '#065F46'
                            }}>
                              {row.balance > 0 ? formatPKR(row.balance) : 'Rs 0'}
                            </span>
                          </td>
                          <td style={{ padding: '0 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isSale ? (
                              <button
                                type="button"
                                onClick={() => handleViewInvoiceDetails(row.ref_no)}
                                style={{
                                  height: '28px',
                                  padding: '0 10px',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  color: '#374151',
                                  background: '#FFFFFF',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = '#0F766E';
                                  e.currentTarget.style.color = '#0F766E';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = '#E5E7EB';
                                  e.currentTarget.style.color = '#374151';
                                }}
                              >
                                View →
                              </button>
                            ) : (
                              <span style={{ color: '#9CA3AF', fontSize: '13px' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div style={{
              borderTop: '1px solid #F3F4F6',
              padding: '14px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              background: '#FFFFFF'
            }}>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                {ledgerData.ledger.length} transactions  •  Total Billed: <strong style={{ color: '#111827' }}>{formatPKR(ledgerData.summary.total_purchased || ledgerData.summary.total_debit || 0)}</strong>  •  Total Paid: <strong style={{ color: '#16A34A' }}>{formatPKR(ledgerData.summary.total_paid || ledgerData.summary.total_credit || 0)}</strong>  •  Total Pending Udhaar: <strong style={{ color: ledgerData.summary.closing_balance > 0 ? '#DC2626' : '#16A34A' }}>{formatPKR(ledgerData.summary.closing_balance)}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => window.print()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Printer size={14} />
                  <span>Print Statement</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowLedgerModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE PAYMENT MODAL */}
      {showPayModal && selectedCust && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Receive Payment
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Customer: <strong>{selectedCust.name}</strong>
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
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.75rem 1rem', borderRadius: '6px', color: '#991b1b', fontWeight: 600, fontSize: '0.85rem' }}>
                  Current Outstanding Udhaar: <strong>{formatPKR(selectedCust.current_balance)}</strong>
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
                  <label className="form-label">Notes / Reference</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Weekly settlement cheque / cash deposit"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '120px' }}>Record Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {showEditModal && editFormData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Edit Customer Account</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Update contact information, account type, and credit limits.
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
            <form onSubmit={handleUpdateCustomer}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Customer / Business Name *</label>
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
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Account Type</label>
                    <select
                      className="form-control"
                      value={editFormData.customer_type}
                      onChange={(e) => setEditFormData({ ...editFormData, customer_type: e.target.value })}
                    >
                      <option value="Retail">Retail Walk-in</option>
                      <option value="Wholesale">Wholesale Bulk Buyer</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Address / Shop Location</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Credit Limit (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={editFormData.credit_limit}
                      onChange={(e) => setEditFormData({ ...editFormData, credit_limit: e.target.value })}
                    />
                  </div>
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
                  {isAdmin && selectedCust?.id !== 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => {
                        setShowEditModal(false);
                        setCustomerToDelete(selectedCust);
                        setShowDeleteModal(true);
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete Customer</span>
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Update Customer</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CUSTOMER MODAL */}
      {showDeleteModal && customerToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px', width: '96%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} color="#dc2626" />
                <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.05rem', fontWeight: 700 }}>Confirm Delete Customer</h3>
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
              Are you sure you want to permanently delete customer <strong>"{customerToDelete.name}"</strong>?
              {customerToDelete.current_balance > 0 ? (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontWeight: 600, fontSize: '0.8rem' }}>
                  ⚠️ This customer has an active outstanding balance of {formatPKR(customerToDelete.current_balance)}. Please settle this balance before deleting.
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  This action will remove the customer profile from your customer directory. Past sales records will be preserved for financial auditing.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteCustomer}
                disabled={customerToDelete.current_balance > 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={13} />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW BILL / INVOICE MODAL FROM CUSTOMER RECORD */}
      {viewingSale && (
        <PrintInvoiceModal
          sale={viewingSale.sale || viewingSale.data || viewingSale}
          items={viewingSale.items || viewingSale.data?.items || []}
          settings={viewingSale.settings || viewingSale.data?.settings || {}}
          onClose={() => setViewingSale(null)}
        />
      )}
    </div>
  );
}
