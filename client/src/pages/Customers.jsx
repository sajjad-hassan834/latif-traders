import React, { useState, useEffect } from 'react';
import { Users, Plus, FileText, DollarSign, Printer, Search } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCust, setSelectedCust] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);

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

  const openLedger = async (cust) => {
    try {
      setSelectedCust(cust);
      const res = await api.get(`/parties/customers/${cust.id}/ledger`);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search customers by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadCustomers()}
          />
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Address</th>
                <th style={{ textAlign: 'right' }}>Credit Limit</th>
                <th style={{ textAlign: 'right' }}>Current Balance</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Loading customers...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No customers found.</td></tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <span className={`badge ${c.customer_type === 'Wholesale' ? 'badge-info' : 'badge-success'}`}>
                        {c.customer_type}
                      </span>
                    </td>
                    <td>{c.phone || '-'}</td>
                    <td><span style={{ fontSize: '0.85rem', color: '#64748b' }}>{c.address || '-'}</span></td>
                    <td style={{ textAlign: 'right' }}>{c.credit_limit > 0 ? formatPKR(c.credit_limit) : 'No Limit'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {c.current_balance > 0 ? (
                        <span style={{ color: '#ef4444' }}>{formatPKR(c.current_balance)}</span>
                      ) : (
                        <span style={{ color: '#10b981' }}>₨ 0</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => openLedger(c)}
                          className="btn btn-secondary btn-sm"
                          title="Customer Statement / Ledger"
                        >
                          <FileText size={15} />
                          <span>Ledger</span>
                        </button>
                        {c.current_balance > 0 && (
                          <button
                            onClick={() => openPaymentModal(c)}
                            className="btn btn-primary btn-sm"
                            title="Receive Payment"
                          >
                            <DollarSign size={15} />
                            <span>Receive</span>
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

      {/* ADD CUSTOMER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New Customer</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
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
                  <div className="form-group">
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

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Shop address / delivery area"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Opening Balance (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0"
                      value={formData.opening_balance}
                      onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER LEDGER / STATEMENT MODAL */}
      {showLedgerModal && ledgerData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <h3>Customer Ledger: {ledgerData.customer.name}</h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Type: {ledgerData.customer.customer_type} • Phone: {ledgerData.customer.phone || '-'}
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
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref #</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Debit (Invoice)</th>
                      <th style={{ textAlign: 'right' }}>Credit (Paid)</th>
                      <th style={{ textAlign: 'right' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.ledger.map((row, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(row.date)}</td>
                        <td className="mono">{row.ref_no}</td>
                        <td style={{ fontSize: '0.85rem' }}>{row.notes}</td>
                        <td style={{ textAlign: 'right', color: row.debit > 0 ? '#ef4444' : '#64748b' }}>
                          {row.debit > 0 ? formatPKR(row.debit) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', color: row.credit > 0 ? '#10b981' : '#64748b' }}>
                          {row.credit > 0 ? formatPKR(row.credit) : '-'}
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
                    <span>Total Billed (Debit):</span>
                    <strong>{formatPKR(ledgerData.summary.total_debit)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>Total Received (Credit):</span>
                    <strong style={{ color: '#10b981' }}>{formatPKR(ledgerData.summary.total_credit)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, marginTop: '0.5rem', borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', color: '#ef4444' }}>
                    <span>Closing Receivable:</span>
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

      {/* RECEIVE PAYMENT MODAL */}
      {showPayModal && selectedCust && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Receive Payment from {selectedCust.name}</h3>
              <button onClick={() => setShowPayModal(false)}>✕</button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#fee2e2', padding: '0.75rem 1rem', borderRadius: '8px', color: '#991b1b', fontWeight: 600 }}>
                  Current Outstanding Udhaar: {formatPKR(selectedCust.current_balance)}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
