import React, { useState, useEffect } from 'react';
import { Users, Plus, FileText, DollarSign, Printer, Search, Edit, ChevronDown, Trash2, ArrowUpRight, RefreshCw, MessageCircle, Eye, CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/common/Pagination';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import ReceiptVoucherModal from '../components/invoices/ReceiptVoucherModal';
import ActionMenu from '../components/common/ActionMenu';
import WhatsAppKhataModal from '../components/common/WhatsAppKhataModal';
import CustomDatePicker from '../components/common/CustomDatePicker';

export default function Customers() {
  const { user, isAdmin: authIsAdmin, tenant } = useAuth();
  const [tenantSettings, setTenantSettings] = useState(null);
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
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [selectedCust, setSelectedCust] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [viewingSale, setViewingSale] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [whatsAppModalCustomer, setWhatsAppModalCustomer] = useState(null);

  // In-modal ledger filters
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('ALL');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState('all'); // 'all' | '25' | '50' | '100'


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
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showLedgerModal) setShowLedgerModal(false);
        if (showAuditModal) setShowAuditModal(false);
        if (viewingReceipt) setViewingReceipt(null);
        if (showAddModal) setShowAddModal(false);
        if (showEditModal) setShowEditModal(false);
        if (showPayModal) setShowPayModal(false);
        if (showDeleteModal) setShowDeleteModal(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLedgerModal, showAuditModal, viewingReceipt, showAddModal, showEditModal, showPayModal, showDeleteModal]);


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
    api.get('/settings').then(res => {
      if (res && res.success && res.settings) setTenantSettings(res.settings);
    }).catch(() => {});
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
      opening_balance: cust.opening_balance || 0,
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

  const handlePrintStatement = () => {
    if (!ledgerData) return;
    try {
      const cust = ledgerData.customer || {};
      const summary = ledgerData.summary || {};
      // For formal statement print, chronological order (oldest to newest) is preferred
      const rawEntries = ledgerData.chronological_ledger || (ledgerData.ledger ? [...ledgerData.ledger].reverse() : []);
      const shopName = tenant?.business_name || user?.business_name || 'Store Account';
      const shopPhone = tenant?.phone || '';
      const shopAddress = tenant?.address || '';

      let iframe = document.getElementById('ledger-print-frame');
      if (iframe) iframe.remove();

      iframe = document.createElement('iframe');
      iframe.id = 'ledger-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '210mm';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const rowsHtml = rawEntries.map((r, i) => {
        const isDebit = (r.debit || r.bill_amount || 0) > 0;
        const isCredit = (r.credit || r.received_amount || 0) > 0;
        const billStr = isDebit ? `Rs. ${Number(r.debit || r.bill_amount).toLocaleString('en-PK')}` : '—';
        const recStr = isCredit ? `Rs. ${Number(r.credit || r.received_amount).toLocaleString('en-PK')}` : '—';
        const balStr = `Rs. ${Number(r.running_balance || 0).toLocaleString('en-PK')}`;
        const desc = r.notes || (r.type === 'SALE_INVOICE' ? 'Sale Invoice' : r.type === 'OPENING' ? 'Opening Balance' : 'Payment');
        return `
          <tr style="border-bottom: 1px solid #E2E8F0; background: ${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
            <td style="padding: 7px 10px; font-size: 11px; white-space: nowrap;">${formatDate(r.date)}</td>
            <td style="padding: 7px 10px; font-size: 11px; font-weight: 600; white-space: nowrap;">${r.ref_no || '—'}</td>
            <td style="padding: 7px 10px; font-size: 11px;">${desc}</td>
            <td style="padding: 7px 10px; font-size: 11px; text-align: right; font-weight: ${isDebit ? '600' : 'normal'};">${billStr}</td>
            <td style="padding: 7px 10px; font-size: 11px; text-align: right; color: #16A34A; font-weight: ${isCredit ? '600' : 'normal'};">${recStr}</td>
            <td style="padding: 7px 10px; font-size: 11px; text-align: right; font-weight: 700; color: ${(r.running_balance || 0) > 0 ? '#DC2626' : '#16A34A'};">${balStr}</td>
          </tr>
        `;
      }).join('');

      const statementDate = new Date().toLocaleDateString('en-GB');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Customer Statement - ${cust.name || 'Account'}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #0F172A; font-size: 12px; background: #FFFFFF; }
            .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #0F766E; margin-bottom: 14px; }
            .shop-title { font-size: 20px; font-weight: 800; color: #0F766E; margin: 0; }
            .doc-title { font-size: 15px; font-weight: 700; color: #0F172A; text-align: right; margin: 0; }
            .cust-box { display: flex; justify-content: space-between; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
            .cust-name { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
            .balance-chip { text-align: right; }
            .bal-label { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; }
            .bal-amount { font-size: 18px; font-weight: 800; color: ${(summary.closing_balance || 0) > 0 ? '#DC2626' : '#16A34A'}; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #0F766E; color: #FFFFFF; padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: left; }
            th.right { text-align: right; }
            .summary-box { display: flex; justify-content: flex-end; margin-bottom: 24px; }
            .summary-table { width: 280px; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; }
            .summary-table td { padding: 6px 12px; font-size: 11px; }
            .footer-sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 15px; border-top: 1px solid #CBD5E1; font-size: 10px; color: #64748B; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1 class="shop-title">${shopName}</h1>
              ${shopAddress ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${shopAddress}</div>` : ''}
              ${shopPhone ? `<div style="font-size: 11px; color: #475569;">Tel: ${shopPhone}</div>` : ''}
            </div>
            <div style="text-align: right;">
              <h2 class="doc-title">CUSTOMER KHATA STATEMENT</h2>
              <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Date: ${statementDate}</div>
              <div style="font-size: 10px; color: #94A3B8;">Transactions: ${rawEntries.length}</div>
            </div>
          </div>

          <div class="cust-box">
            <div>
              <div class="cust-name">${cust.name || 'Customer'}</div>
              <div style="font-size: 11px; color: #475569;">${cust.customer_type ? `${cust.customer_type} Customer` : 'Retail Customer'}${cust.phone ? ` • Tel: ${cust.phone}` : ''}</div>
              ${cust.address ? `<div style="font-size: 11px; color: #64748B;">Address: ${cust.address}</div>` : ''}
            </div>
            <div class="balance-chip">
              <div class="bal-label">Outstanding Balance</div>
              <div class="bal-amount">Rs. ${Number(summary.closing_balance || 0).toLocaleString('en-PK')}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 85px;">Date</th>
                <th style="width: 120px;">Reference</th>
                <th>Description</th>
                <th class="right" style="width: 100px;">Bill (Dr)</th>
                <th class="right" style="width: 100px;">Received (Cr)</th>
                <th class="right" style="width: 110px;">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary-box">
            <table class="summary-table">
              <tr style="background: #F8FAFC;">
                <td style="color: #475569;">Total Billed:</td>
                <td style="text-align: right; font-weight: 600;">Rs. ${Number(summary.total_billed || 0).toLocaleString('en-PK')}</td>
              </tr>
              <tr style="background: #FFFFFF;">
                <td style="color: #475569;">Total Received:</td>
                <td style="text-align: right; font-weight: 600; color: #16A34A;">Rs. ${Number(summary.total_received || 0).toLocaleString('en-PK')}</td>
              </tr>
              <tr style="background: #0F766E; color: #FFFFFF;">
                <td style="font-weight: 700;">Net Balance Due:</td>
                <td style="text-align: right; font-weight: 800;">Rs. ${Number(summary.closing_balance || 0).toLocaleString('en-PK')}</td>
              </tr>
            </table>
          </div>

          <div class="footer-sign">
            <div>This is a verified computer-generated statement issued by ${shopName}.</div>
            <div style="text-align: center; border-top: 1px dashed #64748B; width: 180px; padding-top: 4px;">Authorized Signature / Stamp</div>
          </div>
        </body>
        </html>
      `;

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 250);
    } catch (err) {
      console.error('Print statement error:', err);
      window.print();
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

  const handleOpenAuditModal = async () => {
    try {
      setAuditing(true);
      const res = await api.get('/parties/customers/audit-balances');
      if (res.success) {
        setAuditData(res);
        setShowAuditModal(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to audit customer balances.');
    } finally {
      setAuditing(false);
    }
  };

  const handleConfirmSync = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/parties/customers/sync-balances', {});
      if (res.success) {
        alert(res.message);
        setShowAuditModal(false);
        setAuditData(null);
        loadCustomers();
      }
    } catch (err) {
      alert(err.message || 'Failed to synchronize customer balances.');
    } finally {
      setSyncing(false);
    }
  };

  const sendWhatsAppReminder = (customer, balance) => {
    const phone = customer?.phone || '';
    if (!phone || phone === 'None' || phone.trim().length < 6) {
      alert('This customer does not have a valid phone number recorded.');
      return;
    }
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('03')) clean = '92' + clean.slice(1);
    else if (!clean.startsWith('92')) clean = '92' + clean;

    const msg = `Assalam-o-Alaikum ${customer.name},\nThis is a friendly reminder that your outstanding udhaar balance with ${tenant?.business_name || 'our shop'} is ${formatPKR(balance)}.\nKindly settle your pending dues at your earliest convenience.\nThank you!`;
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const applyDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'THIS_MONTH') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      setLedgerStartDate(first);
      setLedgerEndDate(today);
      openLedger(selectedCust, first, today);
    } else if (preset === 'LAST_3_MONTHS') {
      const threeAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      setLedgerStartDate(threeAgo);
      setLedgerEndDate(today);
      openLedger(selectedCust, threeAgo, today);
    } else if (preset === 'ALL') {
      setLedgerStartDate('');
      setLedgerEndDate('');
      openLedger(selectedCust, '', '');
    }
  };


  const isWalkIn = (c) => {
    const n = (c?.name || '').toLowerCase();
    return n.includes('walk-in') || n.includes('counter');
  };
  const regularCustomers = customers.filter(c => !isWalkIn(c));
  const allCount = regularCustomers.length;
  const dueCount = regularCustomers.filter(c => Number(c.current_balance) > 0).length;
  const retailCount = regularCustomers.filter(c => c.customer_type === 'Retail').length;
  const wholesaleCount = regularCustomers.filter(c => c.customer_type === 'Wholesale').length;

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
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-title)', margin: 0, letterSpacing: '-0.02em' }}>Customers</h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            {allCount} total customers · {dueCount} with outstanding balance
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAuditModal}
              disabled={auditing}
              className="btn btn-secondary btn-sm"
              title="Audit and review discrepancies between stored balances and verified invoices & receipts"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px' }}
            >
              <RefreshCw size={14} className={auditing ? 'spin' : ''} />
              <span>{auditing ? 'Auditing...' : 'Audit Balances'}</span>
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ height: '36px' }}>
            <Plus size={16} />
            <span>+ Add Customer</span>
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
            placeholder="Search customers..."
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
                <th style={{ minWidth: '160px', textAlign: 'left' }}>Name</th>
                <th style={{ width: '110px', minWidth: '110px', textAlign: 'center' }}>Type</th>
                <th style={{ width: '130px', minWidth: '130px', textAlign: 'left' }}>Phone</th>
                <th style={{ minWidth: '150px', textAlign: 'left' }}>Address</th>
                <th style={{ textAlign: 'right', width: '110px', minWidth: '110px' }}>Limit</th>
                <th style={{ textAlign: 'right', width: '125px', minWidth: '125px' }}>Balance</th>
                <th style={{ textAlign: 'center', width: '100px', minWidth: '100px' }}>Action</th>
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
                      <div style={{ fontWeight: 600, color: 'var(--text-title)' }}>{c.name}</div>
                      {c.address && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {c.address}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${c.customer_type === 'Wholesale' ? 'badge-info' : 'badge-success'}`}>
                        {c.customer_type}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-table)', fontWeight: 500 }}>{c.phone || '-'}</td>
                    <td><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.address || '-'}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{c.credit_limit > 0 ? formatPKR(c.credit_limit) : 'No Limit'}</td>
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
                              label: 'Edit',
                              icon: <Edit size={14} color="#0284c7" />,
                              onClick: () => openEditCustomer(c)
                            },
                            {
                              label: 'Statement',
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
                              label: 'Protected',
                              icon: <Trash2 size={14} color="#cbd5e1" />,
                              disabled: true
                            } : {
                              label: 'Delete',
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>New Customer</h3>
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
                  <label className="form-label">Name *</label>
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
                    <label className="form-label">Type</label>
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
                    <label className="form-label">Phone</label>
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
                    <label className="form-label">Opening (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0"
                      value={formData.opening_balance}
                      onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Limit (PKR)</label>
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
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER LEDGER / STATEMENT MODAL */}
      {showLedgerModal && ledgerData && (() => {
        // Apply client-side in-modal filters
        const rawList = ledgerData.ledger || [];
        const filteredEntries = rawList.filter(item => {
          // Search box filter
          if (ledgerSearch.trim()) {
            const q = ledgerSearch.toLowerCase().trim();
            const ref = (item.ref_no || '').toLowerCase();
            const desc = (item.notes || '').toLowerCase();
            if (!ref.includes(q) && !desc.includes(q)) return false;
          }
          // Type filter
          if (ledgerTypeFilter === 'INVOICES' && item.type !== 'SALE_INVOICE') return false;
          if (ledgerTypeFilter === 'PAYMENTS' && item.type !== 'PAYMENT_RECEIPT' && item.type !== 'CUSTOMER_REFUND' && item.type !== 'SALE_RETURN') return false;
          // Status filter
          if (ledgerStatusFilter === 'PAID') {
            if (item.type === 'SALE_INVOICE' && item.status_chip !== 'PAID') return false;
            if (item.type !== 'SALE_INVOICE') return false;
          } else if (ledgerStatusFilter === 'PARTIAL') {
            if (item.type === 'SALE_INVOICE' && item.status_chip !== 'PARTIAL') return false;
            if (item.type !== 'SALE_INVOICE') return false;
          } else if (ledgerStatusFilter === 'UNPAID') {
            if (item.type === 'SALE_INVOICE' && item.status_chip !== 'UNPAID') return false;
            if (item.type !== 'SALE_INVOICE') return false;
          }
          return true;
        });

        const totalFiltered = filteredEntries.length;
        const pageSizeNum = ledgerPageSize === 'all' ? (totalFiltered || 1) : parseInt(ledgerPageSize, 10);
        const totalPages = Math.ceil(totalFiltered / pageSizeNum) || 1;
        const safePage = Math.min(Math.max(1, ledgerPage), totalPages);
        const startIndex = ledgerPageSize === 'all' ? 0 : (safePage - 1) * pageSizeNum;
        const endIndex = ledgerPageSize === 'all' ? totalFiltered : Math.min(startIndex + pageSizeNum, totalFiltered);
        const paginatedEntries = filteredEntries.slice(startIndex, endIndex);

        // Older entries not visible on this page (for brought forward balance)
        const olderEntries = filteredEntries.slice(endIndex);
        const broughtForwardBalance = olderEntries.length > 0 ? (olderEntries[0].running_balance || 0) : null;

        const hasValidPhone = ledgerData.customer.phone && ledgerData.customer.phone !== 'None' && ledgerData.customer.phone.trim().length >= 7;

        return (
          <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowLedgerModal(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '1060px',
                width: '96%',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
                overflow: 'hidden',
                background: 'var(--bg-card, #FFFFFF)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border)'
              }}
            >
              {/* MODAL HEADER: Clean layout, avatar, identity, status chips, dedicated close button */}
              <div
                className="modal-header"
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-card, #FFFFFF)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'var(--primary, #0F766E)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {(ledgerData.customer.name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-title)', lineHeight: 1.2 }}>
                        {ledgerData.customer.name}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{ledgerData.customer.customer_type ? `${ledgerData.customer.customer_type} Customer` : 'Retail Customer'}</span>
                        {hasValidPhone && (
                          <span>• 📞 {ledgerData.customer.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top-Right: Sole Close Button with proper touch area & no overlapping controls */}
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setShowLedgerModal(false)}
                    aria-label="Close"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, #D1D5DB)',
                      background: 'var(--bg-hover, #F3F4F6)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--text-title, #374151)',
                      fontSize: '16px',
                      fontWeight: 700,
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    title="Close ledger (Esc)"
                  >
                    ✕
                  </button>
                </div>

                {/* Status Chips Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'var(--bg-hover, #F3F4F6)', color: 'var(--text-title)', fontSize: '12px', padding: '4px 12px', borderRadius: '20px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border)' }}>
                    <span>📅</span> Since: {ledgerData.customer.created_at ? formatDate(ledgerData.customer.created_at) : 'Active'}
                  </div>
                  <div style={{ background: 'var(--bg-hover, #F3F4F6)', color: 'var(--text-title)', fontSize: '12px', padding: '4px 12px', borderRadius: '20px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border)' }}>
                    <span>💰</span> Total Purchases: {formatPKR(ledgerData.summary.total_billed)}
                  </div>
                  {Number(ledgerData.summary.closing_balance || 0) <= 0 ? (
                    <div style={{ background: '#D1FAE5', color: '#065F46', fontSize: '12px', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #A7F3D0' }}>
                      <CheckCircle2 size={13} />
                      <span>Settled (Zero Balance)</span>
                    </div>
                  ) : (
                    <div style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '12px', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #FECACA' }}>
                      <AlertCircle size={13} />
                      <span>Total Balance: {formatPKR(ledgerData.summary.closing_balance)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* FILTER CONTROLS BAR: Date presets, custom dd/mm/yyyy pickers, search box, type & status filters */}
              <div
                style={{
                  padding: '12px 24px',
                  background: 'var(--bg-hover, #F9FAFB)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* Row 1: Date Range & Presets */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Date Range:</span>
                    <CustomDatePicker
                      value={ledgerStartDate}
                      onChange={(v) => { setLedgerStartDate(v); openLedger(selectedCust, v, ledgerEndDate); }}
                      placeholder="From (dd/mm/yyyy)"
                    />
                    <span style={{ color: 'var(--text-muted)' }}>–</span>
                    <CustomDatePicker
                      value={ledgerEndDate}
                      onChange={(v) => { setLedgerEndDate(v); openLedger(selectedCust, ledgerStartDate, v); }}
                      placeholder="To (dd/mm/yyyy)"
                    />
                    {(ledgerStartDate || ledgerEndDate) && (
                      <button
                        type="button"
                        onClick={() => applyDatePreset('ALL')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', padding: '0 4px' }}
                      >
                        Reset Dates
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('THIS_MONTH')}
                      className="btn btn-secondary btn-sm"
                      style={{ height: '30px', fontSize: '12px', padding: '0 10px' }}
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('LAST_3_MONTHS')}
                      className="btn btn-secondary btn-sm"
                      style={{ height: '30px', fontSize: '12px', padding: '0 10px' }}
                    >
                      Last 3 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('ALL')}
                      className="btn btn-secondary btn-sm"
                      style={{ height: '30px', fontSize: '12px', padding: '0 10px' }}
                    >
                      All Time
                    </button>
                  </div>
                </div>

                {/* Row 2: Search Box, Type Filter, Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '360px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search invoice #, description..."
                      value={ledgerSearch}
                      onChange={(e) => { setLedgerSearch(e.target.value); setLedgerPage(1); }}
                      style={{ height: '32px', paddingLeft: '32px', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <select
                      className="form-control"
                      value={ledgerTypeFilter}
                      onChange={(e) => { setLedgerTypeFilter(e.target.value); setLedgerPage(1); }}
                      style={{ height: '32px', fontSize: '12px', padding: '0 10px', width: 'auto', minWidth: '125px' }}
                    >
                      <option value="ALL">All Types</option>
                      <option value="INVOICES">Invoices Only</option>
                      <option value="PAYMENTS">Payments Only</option>
                    </select>

                    <select
                      className="form-control"
                      value={ledgerStatusFilter}
                      onChange={(e) => { setLedgerStatusFilter(e.target.value); setLedgerPage(1); }}
                      style={{ height: '32px', fontSize: '12px', padding: '0 10px', width: 'auto', minWidth: '125px' }}
                    >
                      <option value="ALL">All Status</option>
                      <option value="UNPAID">Unpaid (Credit)</option>
                      <option value="PARTIAL">Partial Dues</option>
                      <option value="PAID">Fully Paid</option>
                    </select>

                    {(ledgerSearch || ledgerTypeFilter !== 'ALL' || ledgerStatusFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => { setLedgerSearch(''); setLedgerTypeFilter('ALL'); setLedgerStatusFilter('ALL'); setLedgerPage(1); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', padding: '0 4px' }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* TABLE CONTAINER: Sticky Header, 7 Clean Columns, No Confusing Double Balances */}
              <div style={{ flex: '1', overflowY: 'auto', maxHeight: '52vh', position: 'relative' }}>
                <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-card, #FFFFFF)' }}>
                    <tr style={{ background: 'var(--bg-hover, #F8FAFC)', borderBottom: '2px solid var(--border)' }}>
                      <th style={{ width: '100px', padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ width: '140px', padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Reference</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Description</th>
                      <th style={{ width: '120px', padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Bill</th>
                      <th style={{ width: '120px', padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#16A34A', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Received</th>
                      <th style={{ width: '140px', padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--text-title)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Running Balance</th>
                      <th style={{ width: '85px', padding: '10px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No ledger transactions match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedEntries.map((row, idx) => {
                        const isOpening = row.type === 'OPENING' || row.ref_no === 'OPN-BAL';
                        const isSale = row.type === 'SALE_INVOICE';
                        const isPayment = row.type === 'PAYMENT_RECEIPT';
                        const isReturn = row.type === 'SALE_RETURN';
                        const isRefund = row.type === 'CUSTOMER_REFUND';

                        // Status chip for invoice
                        let chip = null;
                        if (isSale) {
                          if (row.status_chip === 'PAID') {
                            chip = (
                              <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid #A7F3D0' }}>
                                ✓ Paid in Full
                              </span>
                            );
                          } else if (row.status_chip === 'PARTIAL') {
                            chip = (
                              <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid #FDE68A' }}>
                                Partial (₨ {(row.invoice_due || 0).toLocaleString()} due)
                              </span>
                            );
                          } else if (row.status_chip === 'UNPAID') {
                            chip = (
                              <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid #FECACA' }}>
                                Credit Sale (₨ {(row.invoice_due || 0).toLocaleString()} due)
                              </span>
                            );
                          } else if (row.status_chip === 'OVERPAID') {
                            chip = (
                              <span style={{ background: '#DBEAFE', color: '#1E40AF', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid #BFDBFE' }}>
                                Overpaid (Credit)
                              </span>
                            );
                          }
                        }

                        // Extra payment badge if overpayment was applied to account
                        let extraBadge = null;
                        if (isPayment && row.is_extra_payment && row.extra_amount > 0) {
                          extraBadge = (
                            <span style={{ background: '#EDE9FE', color: '#5B21B6', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid #DDD6FE' }}>
                              +₨ {row.extra_amount.toLocaleString()} extra applied to account
                            </span>
                          );
                        }

                        return (
                          <tr
                            key={row.id || idx}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              height: '46px',
                              background: isOpening ? 'rgba(254, 243, 199, 0.25)' : 'transparent',
                              transition: 'background 0.12s ease'
                            }}
                          >
                            <td style={{ padding: '0 16px', color: 'var(--text-title)', whiteSpace: 'nowrap' }}>
                              {formatDate(row.date)}
                            </td>
                            <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                              {isSale ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewInvoiceDetails(row.ref_no)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary, #0F766E)',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                  title="Click to view full sale invoice"
                                >
                                  {row.ref_no}
                                </button>
                              ) : isPayment ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingReceipt(row)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#2563EB',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                  title="Click to view payment receipt details"
                                >
                                  {row.ref_no || 'RECEIPT'}
                                </button>
                              ) : (
                                <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                  {row.ref_no || '—'}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-title)' }}>
                                  {isOpening ? 'Account Opening Balance' : row.notes}
                                </span>
                                {chip}
                                {extraBadge}
                              </div>
                            </td>
                            <td style={{ padding: '0 16px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--text-title)' }}>
                              {row.bill_amount > 0 ? formatPKR(row.bill_amount) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                            </td>
                            <td style={{ padding: '0 16px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: '#16A34A' }}>
                              {row.received_amount > 0 ? formatPKR(row.received_amount) : (row.credit > 0 && isReturn ? formatPKR(row.credit) : <span style={{ color: 'var(--text-muted)' }}>—</span>)}
                            </td>
                            <td style={{ padding: '0 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <span style={{
                                fontWeight: 700,
                                color: (row.running_balance || 0) > 0 ? '#DC2626' : '#16A34A'
                              }}>
                                {formatPKR(row.running_balance || 0)}
                              </span>
                            </td>
                            <td style={{ padding: '0 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {isSale ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewInvoiceDetails(row.ref_no)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ height: '26px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="View invoice"
                                >
                                  <Eye size={12} />
                                  <span>View</span>
                                </button>
                              ) : isPayment ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingReceipt(row)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ height: '26px', padding: '0 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="View receipt"
                                >
                                  <Eye size={12} />
                                  <span>View</span>
                                </button>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {broughtForwardBalance !== null && (
                      <tr style={{ background: 'var(--bg-hover, #F8FAFC)', borderTop: '2px dashed var(--border)' }}>
                        <td colSpan={3} style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          ↳ Earlier Balance Brought Forward (from {olderEntries.length} older transaction{olderEntries.length > 1 ? 's' : ''} on next page)
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>—</td>
                        <td style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>—</td>
                        <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, color: broughtForwardBalance > 0 ? '#DC2626' : '#16A34A', fontSize: '12px' }}>
                          {formatPKR(broughtForwardBalance)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* TRANSACTION COUNTER & PAGINATION TOOLBAR */}
              <div
                style={{
                  padding: '8px 24px',
                  background: 'var(--bg-hover, #F9FAFB)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span>
                    {ledgerPageSize === 'all'
                      ? `Showing all ${totalFiltered} transaction${totalFiltered !== 1 ? 's' : ''}`
                      : `Showing ${startIndex + 1}–${endIndex} of ${totalFiltered} transactions`}
                  </span>
                  <span style={{ color: 'var(--border)' }}>•</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>View:</span>
                    {['all', '25', '50', '100'].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setLedgerPageSize(size);
                          setLedgerPage(1);
                        }}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: ledgerPageSize === size ? '1px solid var(--primary, #0F766E)' : '1px solid var(--border)',
                          background: ledgerPageSize === size ? 'var(--primary, #0F766E)' : '#FFFFFF',
                          color: ledgerPageSize === size ? '#FFFFFF' : 'var(--text-main)',
                          fontSize: '11px',
                          fontWeight: ledgerPageSize === size ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {size === 'all' ? 'All' : size}
                      </button>
                    ))}
                  </div>
                </div>

                {totalPages > 1 && ledgerPageSize !== 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: safePage <= 1 ? 'var(--bg-hover, #F1F5F9)' : '#FFFFFF',
                        color: safePage <= 1 ? 'var(--text-muted, #94A3B8)' : 'var(--text-main, #334155)',
                        cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    >
                      ‹ Previous
                    </button>
                    <span style={{ fontWeight: 600 }}>Page {safePage} of {totalPages}</span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '4px',
                        border: '1px solid var(--border)',
                        background: safePage >= totalPages ? 'var(--bg-hover, #F1F5F9)' : '#FFFFFF',
                        color: safePage >= totalPages ? 'var(--text-muted, #94A3B8)' : 'var(--text-main, #334155)',
                        cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 600
                      }}
                    >
                      Next ›
                    </button>
                  </div>
                )}
              </div>

              {/* MODAL FOOTER: Sticky summary totals and distinct single actions */}
              <div
                style={{
                  padding: '14px 24px',
                  background: 'var(--bg-card, #FFFFFF)',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}
              >
                {/* Synchronized Totals Bar */}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span>
                    Total Billed: <strong style={{ color: 'var(--text-title)' }}>{formatPKR(ledgerData.summary.total_billed)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Total Received: <strong style={{ color: '#16A34A' }}>{formatPKR(ledgerData.summary.total_received)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Returns: <strong style={{ color: 'var(--text-title)' }}>{formatPKR(ledgerData.summary.total_returns || 0)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Balance: <strong style={{ color: (ledgerData.summary.closing_balance || 0) > 0 ? '#DC2626' : '#16A34A' }}>{formatPKR(ledgerData.summary.closing_balance)}</strong>
                  </span>
                </div>

                {/* Footer Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLedgerModal(false);
                      openPaymentModal(ledgerData.customer);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px' }}
                  >
                    <DollarSign size={14} />
                    <span>Receive Payment</span>
                  </button>

                  {hasValidPhone && (
                    <button
                      type="button"
                      onClick={() => setWhatsAppModalCustomer(ledgerData.customer)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', color: '#16A34A', borderColor: '#86EFAC' }}
                      title="Send WhatsApp payment reminder with balance"
                    >
                      <MessageCircle size={14} />
                      <span>WhatsApp Reminder</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handlePrintStatement}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px' }}
                    title="Print verified customer ledger statement"
                  >
                    <Printer size={14} />
                    <span>Print Statement</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLedgerModal(false)}
                    className="btn btn-secondary btn-sm"
                    style={{ height: '34px' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* AUDIT & SYNC BALANCES BEFORE/AFTER DIFF MODAL */}
      {showAuditModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowAuditModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '780px', width: '96%', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
          >
            <div className="modal-header" style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={20} style={{ color: auditData?.discrepancies_count > 0 ? '#DC2626' : '#16A34A' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-title)' }}>
                    Audit
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Verified double-entry ledger calculation against stored database balances
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAuditModal(false)}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-hover)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 22px', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '160px', padding: '12px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Customers Audited</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-title)', marginTop: '2px' }}>{auditData?.total_checked || 0}</div>
                </div>
                <div style={{ flex: '1', minWidth: '160px', padding: '12px', borderRadius: '8px', background: auditData?.discrepancies_count > 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${auditData?.discrepancies_count > 0 ? '#FECACA' : '#BBF7D0'}` }}>
                  <div style={{ fontSize: '11px', color: auditData?.discrepancies_count > 0 ? '#991B1B' : '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Discrepancies Found</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: auditData?.discrepancies_count > 0 ? '#DC2626' : '#16A34A', marginTop: '2px' }}>{auditData?.discrepancies_count || 0}</div>
                </div>
              </div>

              {auditData?.discrepancies_count === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                  <CheckCircle2 size={36} style={{ color: '#16A34A', margin: '0 auto 10px auto' }} />
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#166534' }}>All Balances 100% Synchronized!</div>
                  <div style={{ fontSize: '13px', color: '#15803D', marginTop: '4px' }}>
                    Every customer's stored balance perfectly matches the verified sum of their invoices, receipts, and returns.
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-title)', fontWeight: 600, marginBottom: '10px' }}>
                    Discrepancy Preview (Before vs After):
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Customer</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Stored Balance</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#16A34A' }}>Verified True Balance</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#DC2626' }}>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditData?.discrepancies.map((d) => (
                          <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px' }}>
                              <strong style={{ color: 'var(--text-title)' }}>{d.name}</strong>
                              {d.phone && d.phone !== 'None' && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📞 {d.phone}</div>}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {formatPKR(d.stored_balance)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16A34A' }}>
                              {formatPKR(d.calculated_balance)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: d.diff > 0 ? '#DC2626' : '#2563EB' }}>
                              {d.diff > 0 ? `+${formatPKR(d.diff)}` : formatPKR(d.diff)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
              {auditData?.discrepancies_count > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmSync}
                  disabled={syncing}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                  <span>{syncing ? 'Synchronizing...' : 'Confirm & Synchronize Balances'}</span>
                </button>
              )}
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>Payment</h3>
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
                  Balance: <strong>{formatPKR(selectedCust.current_balance)}</strong>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Amount (PKR) *</label>
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
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Method</label>
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
                  <label className="form-label">Notes</label>
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
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '120px' }}>Save</button>
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>Edit Customer</h3>
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
                  <label className="form-label">Name *</label>
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
                    <label className="form-label">Type</label>
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
                    <label className="form-label">Location</label>
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
                  <label className="form-label">Opening (PKR)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editFormData.opening_balance}
                    onChange={(e) => setEditFormData({ ...editFormData, opening_balance: e.target.value })}
                    placeholder="0"
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #6B7280)', marginTop: '3px' }}>
                    Initial starting balance before any sales invoices or store receipts.
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
                      <span>Delete</span>
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save Changes</button>
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
                <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.05rem', fontWeight: 700 }}>Delete</h3>
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

      {/* VIEW PAYMENT RECEIPT VOUCHER */}
      {viewingReceipt && (
        <ReceiptVoucherModal
          receipt={viewingReceipt}
          party={selectedCust || { name: viewingReceipt.customer_name || 'Customer' }}
          tenantSettings={tenantSettings || {
            shop_name: tenant?.business_name || '',
            tagline: '',
            phone: '',
            address: ''
          }}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      {/* SMART WHATSAPP KHATA / REMINDER MODAL */}
      <WhatsAppKhataModal
        isOpen={Boolean(whatsAppModalCustomer)}
        customer={whatsAppModalCustomer}
        tenantName={tenantSettings?.shop_name || tenant?.business_name || 'Our Store'}
        onClose={() => setWhatsAppModalCustomer(null)}
      />
    </div>
  );
}
