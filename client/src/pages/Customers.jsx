import React, { useState, useEffect } from 'react';
import { Users, Plus, FileText, DollarSign, Printer, Search, Edit, ChevronDown, Trash2, ArrowUpRight } from 'lucide-react';
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
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Add New Customer</span>
        </button>
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
      {showLedgerModal && ledgerData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '920px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Customer Account Record: {ledgerData.customer.name}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Customer Type: <strong>{ledgerData.customer.customer_type}</strong> • Phone: <strong>{ledgerData.customer.phone || 'None'}</strong>
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
              {/* 3 HIGHLIGHT CARDS: PURCHASES, PAYMENTS, DEBT LEFT */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Total Bought (Kul Kharidari)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7', marginTop: '3px' }}>
                    {formatPKR(ledgerData.summary.total_purchased || ledgerData.summary.total_debit)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Total cost of all products bought</div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Total Cash Paid (Kul Adaigi)</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a', marginTop: '3px' }}>
                    {formatPKR(ledgerData.summary.total_paid || ledgerData.summary.total_credit)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Total payments received to date</div>
                </div>

                <div style={{
                  background: ledgerData.summary.closing_balance > 0 ? '#fef2f2' : '#f0fdf4',
                  border: `1px solid ${ledgerData.summary.closing_balance > 0 ? '#fecaca' : '#bbf7d0'}`,
                  borderRadius: '8px', padding: '0.85rem 1rem'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: ledgerData.summary.closing_balance > 0 ? '#b91c1c' : '#15803d', textTransform: 'uppercase' }}>
                    Debt Left (Baqaya Udhaar)
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: ledgerData.summary.closing_balance > 0 ? '#dc2626' : '#16a34a', marginTop: '3px' }}>
                    {formatPKR(ledgerData.summary.closing_balance)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    {ledgerData.summary.closing_balance > 0 ? 'Pending amount to collect' : 'All cleared (No balance left)'}
                  </div>
                </div>
              </div>

              {/* DATE FILTERS */}
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
                  onClick={() => openLedger(selectedCust, ledgerStartDate, ledgerEndDate)}
                >
                  Filter
                </button>
                {(ledgerStartDate || ledgerEndDate) && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setLedgerStartDate('');
                      setLedgerEndDate('');
                      openLedger(selectedCust, '', '');
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* STATEMENT TABLE WITH CLEAR EASY WORDING */}
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', minWidth: '650px', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                      <th style={{ padding: '8px 10px' }}>Bill / Ref #</th>
                      <th style={{ padding: '8px 10px' }}>Transaction Details</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Bill Amount (Kharidari)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cash Paid (Wusooli)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Debt Left (Baqaya Udhaar)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.ledger.map((row, idx) => {
                      const isSale = row.ref_no && row.ref_no.startsWith('INV-');

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatDate(row.date)}</td>
                          <td className="mono" style={{ padding: '8px 10px' }}>
                            {isSale ? (
                              <button
                                type="button"
                                onClick={() => handleViewInvoiceDetails(row.ref_no)}
                                style={{
                                  background: 'none', border: 'none', color: '#0284c7',
                                  fontWeight: 700, cursor: 'pointer', padding: 0,
                                  textDecoration: 'underline', fontSize: '0.85rem'
                                }}
                                title="Click to view full bill slip"
                              >
                                {row.ref_no}
                              </button>
                            ) : (
                              <span>{row.ref_no}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 600 }}>{row.notes}</div>
                            {isSale && (
                              <div style={{ fontSize: '0.72rem', color: '#0284c7' }}>
                                📄 Click bill # to view itemized slip
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: row.bill_amount > 0 ? '#0f172a' : '#94a3b8' }}>
                            {row.bill_amount > 0 ? formatPKR(row.bill_amount) : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: row.paid_amount > 0 ? '#16a34a' : '#94a3b8' }}>
                            {row.paid_amount > 0 ? formatPKR(row.paid_amount) : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: row.balance > 0 ? '#dc2626' : '#16a34a' }}>
                            {formatPKR(row.balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* CLOSING TOTALS SUMMARY */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '380px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Total Products Bought:</span>
                    <strong>{formatPKR(ledgerData.summary.total_purchased || ledgerData.summary.total_debit)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span>Total Cash Paid:</span>
                    <strong style={{ color: '#16a34a' }}>{formatPKR(ledgerData.summary.total_paid || ledgerData.summary.total_credit)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, borderTop: '1px solid #cbd5e1', paddingTop: '6px', color: ledgerData.summary.closing_balance > 0 ? '#dc2626' : '#16a34a' }}>
                    <span>Remaining Debt Left:</span>
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
          sale={viewingSale.sale}
          items={viewingSale.items}
          settings={viewingSale.settings}
          onClose={() => setViewingSale(null)}
        />
      )}
    </div>
  );
}
