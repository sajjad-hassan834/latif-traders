import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Printer, FileText, Eye, CheckCircle, Filter, Trash2, X, Search } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { BRAND_NAME } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import ReportPrintHeader from '../components/common/ReportPrintHeader';
import Pagination from '../components/common/Pagination';
import ReportPrintFooter from '../components/common/ReportPrintFooter';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import CustomDatePicker from '../components/common/CustomDatePicker';

export default function CashFlow() {
  const { user, isAdmin, tenant } = useAuth();
  const [cashbook, setCashbook] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Search & Type Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [flowFilter, setFlowFilter] = useState('all');

  // Receipt & Invoice viewing states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [genericReceipt, setGenericReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [activeDateFilter, setActiveDateFilter] = useState('today');

  const [settings, setSettings] = useState(() => ({
    shop_name: tenant?.business_name || BRAND_NAME,
    tagline: '',
    phone: '',
    address: '',
    email: ''
  }));

  useEffect(() => {
    api.get('/settings').then(res => {
      if (res && res.success && res.settings) {
        setSettings(res.settings);
        // Saved in state only
      }
    }).catch(() => {});
  }, []);

  const loadCashbook = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/payments/cashbook?start_date=${startDate}&end_date=${endDate}`);
      if (res.success) setCashbook(res);
    } catch (err) {
      console.error('Failed to load cashbook:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashbook();
  }, [startDate, endDate]);

  const setQuickDate = (type) => {
    setActiveDateFilter(type);
    const now = new Date();
    const toDateStr = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (type === 'today') {
      const todayStr = toDateStr(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (type === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = toDateStr(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (type === 'this_week') {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      setStartDate(toDateStr(monday));
      setEndDate(toDateStr(new Date()));
    } else if (type === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toDateStr(firstDay));
      setEndDate(toDateStr(new Date()));
    }
  };

  const handleViewReceipt = async (entry) => {
    try {
      setReceiptLoading(true);
      if (entry.source_type === 'SALE' || (entry.ref_no && entry.ref_no.startsWith('INV-'))) {
        const res = await api.get(`/sales/${entry.ref_no}`);
        if (res.success && res.sale) {
          setSelectedInvoice(res);
          return;
        }
      }
      setGenericReceipt(entry);
    } catch (err) {
      setGenericReceipt(entry);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleDeletePayment = async (entryId, refNo) => {
    if (!window.confirm(`Are you sure you want to delete payment record "${refNo || entryId}"? This will automatically revert the customer/supplier balance adjustment.`)) {
      return;
    }
    try {
      const res = await api.delete(`/payments/${entryId}`);
      if (res.success) {
        loadCashbook();
      } else {
        alert(res.message || 'Failed to delete payment');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete payment');
    }
  };

  const dateRangeText = startDate === endDate
    ? `Date: ${formatDate(startDate)}`
    : `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`;

  const docRef = `CBK-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`;

  const getTypeBadge = (entry) => {
    const t = (entry.title || entry.type || '').toLowerCase();
    if (t.includes('sale') || entry.source_type === 'SALE') {
      return { label: 'Cash Sale (POS)', bg: '#D1FAE5', color: '#065F46' };
    }
    if (t.includes('purchase') || entry.source_type === 'PURCHASE') {
      return { label: 'Cash Purchase', bg: '#FEE2E2', color: '#991B1B' };
    }
    if (t.includes('receipt') || t.includes('recovery') || (entry.party_type === 'CUSTOMER' && entry.flow === 'IN')) {
      return { label: 'Customer Receipt', bg: '#DBEAFE', color: '#1E40AF' };
    }
    if (t.includes('supplier') || (entry.party_type === 'SUPPLIER' && entry.flow === 'OUT')) {
      return { label: 'Supplier Payment', bg: '#FEF3C7', color: '#92400E' };
    }
    if (t.includes('expense') || entry.source_type === 'EXPENSE') {
      return { label: 'Expense', bg: '#EDE9FE', color: '#5B21B6' };
    }
    return { label: entry.title || 'Transaction', bg: '#F3F4F6', color: '#374151' };
  };

  const filteredEntries = useMemo(() => {
    let list = cashbook?.entries || [];
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(e =>
        (e.ref_no && e.ref_no.toLowerCase().includes(q)) ||
        (e.party_name && e.party_name.toLowerCase().includes(q)) ||
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    }
    if (typeFilter && typeFilter !== 'all') {
      list = list.filter(e => {
        if (typeFilter === 'SALE') return e.source_type === 'SALE' || (e.ref_no && e.ref_no.startsWith('INV-'));
        if (typeFilter === 'CUSTOMER_RECEIPT') return e.source_type === 'CUSTOMER_RECEIPT' || (e.flow === 'IN' && (e.party_type === 'CUSTOMER' || (e.title || '').toLowerCase().includes('receipt')));
        if (typeFilter === 'PURCHASE') return e.source_type === 'PURCHASE' || (e.ref_no && e.ref_no.startsWith('PUR-'));
        if (typeFilter === 'SUPPLIER_PAYMENT') return e.source_type === 'SUPPLIER_PAYMENT' || (e.flow === 'OUT' && (e.party_type === 'SUPPLIER' || (e.title || '').toLowerCase().includes('supplier')));
        if (typeFilter === 'EXPENSE') return e.source_type === 'EXPENSE' || (e.ref_no && e.ref_no.startsWith('EXP-'));
        return true;
      });
    }
    if (flowFilter && flowFilter !== 'all') {
      list = list.filter(e => e.flow === flowFilter);
    }
    return list;
  }, [cashbook?.entries, searchTerm, typeFilter, flowFilter]);

  const isFiltered = Boolean(searchTerm || (typeFilter && typeFilter !== 'all') || (flowFilter && flowFilter !== 'all'));

  const handleClearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setFlowFilter('all');
    setCurrentPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* STATEMENT HEADER BLOCK */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-title)', margin: 0, letterSpacing: '-0.02em' }}>
            Daily Cashbook & Cash Flow
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 10px 0' }}>
            Daily cash collections, customer recoveries, supplier disbursements and net cash balance
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 500 }}>
              📅 Date: {startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} - ${formatDate(endDate)}`}
            </span>
            <span style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 500 }}>
              👤 {user?.full_name || 'Staff'}
            </span>
            <span style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 500 }}>
              🔖 Ref: {docRef}
            </span>
          </div>
        </div>

        {/* Top Right Action: Print Cashbook */}
        <div>
          <button
            onClick={() => window.print()}
            style={{
              height: '38px',
              padding: '0 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-value)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={15} />
            <span>Print Cashbook</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="card no-print" style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search invoice #, party name, notes..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 32px 0 36px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--input-bg)',
                color: 'var(--text-title)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--input-bg)',
                color: 'var(--text-title)',
                fontSize: '13px',
                outline: 'none'
              }}
            >
              <option value="all">All Types</option>
              <option value="SALE">Cash Sales (POS)</option>
              <option value="CUSTOMER_RECEIPT">Customer Receipts</option>
              <option value="PURCHASE">Cash Purchases</option>
              <option value="SUPPLIER_PAYMENT">Supplier Payments</option>
              <option value="EXPENSE">Expenses</option>
            </select>
          </div>

          {/* Flow Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              value={flowFilter}
              onChange={(e) => { setFlowFilter(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--input-bg)',
                color: 'var(--text-title)',
                fontSize: '13px',
                outline: 'none'
              }}
            >
              <option value="all">All Flows (In & Out)</option>
              <option value="IN">Cash In (Collections)</option>
              <option value="OUT">Cash Out (Disbursements)</option>
            </select>
          </div>
        </div>

        {/* Date presets and CustomDatePicker */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>Date:</span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ].map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setQuickDate(chip.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: activeDateFilter === chip.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: activeDateFilter === chip.id ? 'var(--primary)' : 'var(--bg-card)',
                  color: activeDateFilter === chip.id ? '#FFFFFF' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ width: '145px' }}>
              <CustomDatePicker
                value={startDate}
                onChange={(d) => { setStartDate(d); setActiveDateFilter('custom'); }}
                placeholder="From date"
                allowClear
              />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
            <div style={{ width: '145px' }}>
              <CustomDatePicker
                value={endDate}
                onChange={(d) => { setEndDate(d); setActiveDateFilter('custom'); }}
                placeholder="To date"
                allowClear
              />
            </div>
            <button
              onClick={loadCashbook}
              style={{
                height: '36px',
                padding: '0 14px',
                background: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Filter size={13} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips & Results Count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text-title)' }}>{filteredEntries.length}</strong> of <strong style={{ color: 'var(--text-title)' }}>{cashbook?.entries?.length || 0}</strong> transactions
            </span>

            {searchTerm && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-value)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                Search: "{searchTerm}"
                <button type="button" onClick={() => { setSearchTerm(''); setCurrentPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>✕</button>
              </span>
            )}

            {typeFilter !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-value)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                Type: {typeFilter}
                <button type="button" onClick={() => { setTypeFilter('all'); setCurrentPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>✕</button>
              </span>
            )}

            {flowFilter !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-value)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                Flow: {flowFilter === 'IN' ? 'Cash In' : 'Cash Out'}
                <button type="button" onClick={() => { setFlowFilter('all'); setCurrentPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>✕</button>
              </span>
            )}
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 6px'
              }}
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* STAT CARDS WITH BORDER ACCENT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* TOTAL CASH IN */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #16A34A',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TOTAL CASH IN
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16A34A', marginTop: '6px', lineHeight: 1 }}>
                {formatPKR(cashbook?.total_in || 0)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Sales & collections</div>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(22, 163, 74, 0.15)', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownLeft size={18} />
            </div>
          </div>
        </div>

        {/* TOTAL CASH OUT */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #DC2626',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TOTAL CASH OUT
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginTop: '6px', lineHeight: 1 }}>
                {formatPKR(cashbook?.total_out || 0)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Expenses & purchases</div>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(220, 38, 38, 0.15)', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={18} />
            </div>
          </div>
        </div>

        {/* NET CASH FLOW */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          borderLeft: '4px solid #2563EB',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                NET CASH FLOW
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 800,
                color: (cashbook?.net_cash_flow || 0) >= 0 ? '#38BDF8' : '#DC2626',
                marginTop: '6px',
                lineHeight: 1
              }}>
                {(cashbook?.net_cash_flow || 0) < 0 && <span style={{ marginRight: '4px' }}>⚠️</span>}
                {formatPKR(cashbook?.net_cash_flow || 0)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Net balance today</div>
            </div>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.15)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* 6-COLUMN TABLE WITHOUT REDUNDANT NOTES */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '830px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-head)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ width: '100px', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Date</th>
                <th style={{ width: '150px', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Invoice #</th>
                <th style={{ width: '130px', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Type</th>
                <th style={{ width: '160px', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Party</th>
                <th style={{ width: '110px', padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Cash In</th>
                <th style={{ width: '110px', padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Cash Out</th>
                <th className="no-print" style={{ width: '70px', padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span>Loading cashbook records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {isFiltered ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Search size={20} />
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--text-title)' }}>No cash records match your search or filters</div>
                        <div style={{ fontSize: '12px' }}>Try searching with different terms or reset your filters.</div>
                        <button type="button" onClick={handleClearFilters} className="btn btn-secondary btn-sm" style={{ marginTop: '4px' }}>Clear Filters</button>
                      </div>
                    ) : (
                      'No cash transactions recorded for this period.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredEntries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((entry, idx) => {
                  const badge = getTypeBadge(entry);
                  const isPos = entry.source_type === 'SALE' || (entry.ref_no && entry.ref_no.startsWith('INV-'));

                  return (
                    <tr
                      key={idx}
                      style={{
                        height: '52px',
                        borderBottom: '1px solid var(--border)',
                        verticalAlign: 'middle',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* 1. Date */}
                      <td style={{ padding: '0 16px', fontSize: '13px', color: 'var(--text-table)', whiteSpace: 'nowrap' }}>
                        {formatDate(entry.date)}
                      </td>

                      {/* 2. Invoice # (nowrap, monospace, teal link) */}
                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleViewReceipt(entry)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'none',
                            whiteSpace: 'nowrap'
                          }}
                          title="Click to view full receipt voucher"
                        >
                          {entry.ref_no}
                        </button>
                      </td>

                      {/* 3. Transaction Type (colored pill badge) */}
                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          background: badge.bg,
                          color: badge.color,
                          borderRadius: '20px',
                          padding: '3px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}>
                          {badge.label}
                        </span>
                      </td>

                      {/* 4. Party (truncated with tooltip) */}
                      <td
                        style={{
                          padding: '0 16px',
                          fontSize: '13px',
                          color: 'var(--text-table)',
                          maxWidth: '160px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={entry.party_name || 'Counter Customer'}
                      >
                        {entry.party_name || 'Walk-in Customer'}
                      </td>

                      {/* 5. Cash In (empty if zero/out) */}
                      <td style={{ padding: '0 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {entry.flow === 'IN' ? (
                          <span style={{ fontWeight: 600, color: '#16A34A', fontSize: '14px' }}>
                            {formatPKR(entry.amount)}
                          </span>
                        ) : null}
                      </td>

                      {/* 6. Cash Out (empty if zero/in) */}
                      <td style={{ padding: '0 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {entry.flow === 'OUT' ? (
                          <span style={{ fontWeight: 600, color: '#DC2626', fontSize: '14px' }}>
                            {formatPKR(entry.amount)}
                          </span>
                        ) : null}
                      </td>

                      {/* 7. Action Button */}
                      <td className="no-print" style={{ padding: '0 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(entry)}
                            style={{
                              height: '28px',
                              padding: '0 12px',
                              border: '1px solid #E5E7EB',
                              borderRadius: '6px',
                              fontSize: '12px',
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
                          {isAdmin && entry.id && entry.source_type !== 'SALE' && entry.source_type !== 'PURCHASE' && entry.source_type !== 'EXPENSE' && (
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(entry.id, entry.ref_no)}
                              style={{
                                height: '28px',
                                padding: '0 6px',
                                border: '1px solid #FECACA',
                                borderRadius: '6px',
                                color: '#EF4444',
                                background: '#FFFFFF',
                                cursor: 'pointer'
                              }}
                              title="Delete Payment Record"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* FIX 10: PROMINENT TOTALS ROW & NET BALANCE BAR */}
            {cashbook?.entries?.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-table-head)', borderTop: '2px solid var(--border)', height: '48px', fontWeight: 700 }}>
                  <td colSpan="4" style={{ padding: '0 16px', textAlign: 'right', fontSize: '13px', color: 'var(--text-title)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    TOTALS:
                  </td>
                  <td style={{ padding: '0 16px', textAlign: 'right', fontWeight: 700, color: '#16A34A', fontSize: '14px', whiteSpace: 'nowrap' }}>
                    {formatPKR(cashbook?.total_in || 0)}
                  </td>
                  <td style={{ padding: '0 16px', textAlign: 'right', fontWeight: 700, color: '#DC2626', fontSize: '14px', whiteSpace: 'nowrap' }}>
                    {formatPKR(cashbook?.total_out || 0)}
                  </td>
                  <td className="no-print"></td>
                </tr>
                <tr style={{ background: '#EFF6FF', height: '52px', fontWeight: 800 }}>
                  <td colSpan="4" style={{ padding: '0 16px', textAlign: 'right', fontSize: '14px', color: '#1E3A8A' }}>
                    NET CASH BALANCE:
                  </td>
                  <td colSpan="2" style={{
                    padding: '0 16px',
                    textAlign: 'right',
                    fontSize: '18px',
                    color: (cashbook?.net_cash_flow || 0) >= 0 ? '#2563EB' : '#DC2626',
                    fontWeight: 800,
                    whiteSpace: 'nowrap'
                  }}>
                    {formatPKR(cashbook?.net_cash_flow || 0)}
                  </td>
                  <td className="no-print"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PAGINATION WITH PAGE INFO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', borderTop: '1px solid var(--border)' }} className="no-print">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Page {currentPage} of {Math.max(1, Math.ceil(filteredEntries.length / ITEMS_PER_PAGE))}  •  {filteredEntries.length} entries
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredEntries.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* SALE INVOICE PRINT MODAL */}
      {selectedInvoice && (
        <PrintInvoiceModal
          sale={selectedInvoice.sale}
          items={selectedInvoice.items}
          settings={selectedInvoice.settings}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {/* GENERIC CASH TRANSACTION VOUCHER MODAL */}
      {genericReceipt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>Cash Transaction Voucher</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receipt details & print voucher</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setGenericReceipt(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: '0.75rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-title)' }}>{settings.shop_name}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{settings.tagline}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', marginTop: '4px' }}>
                  {genericReceipt.title}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Voucher #:</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{genericReceipt.ref_no}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Date:</span>
                  <span>{formatDate(genericReceipt.date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Account:</span>
                  <span style={{ fontWeight: 600 }}>{genericReceipt.party_name || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Cash</span>
                </div>
                {genericReceipt.notes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Notes:</span>
                    <span style={{ maxWidth: '220px', textAlign: 'right' }}>{genericReceipt.notes}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  marginTop: '0.4rem'
                }}>
                  <span style={{ fontWeight: 700 }}>Amount:</span>
                  <span style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: genericReceipt.flow === 'IN' ? '#10b981' : '#ef4444'
                  }}>
                    {genericReceipt.flow === 'IN' ? '+' : '-'}{formatPKR(genericReceipt.amount)}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGenericReceipt(null)}>Close</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Printer size={13} />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
