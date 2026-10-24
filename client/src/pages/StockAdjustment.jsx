import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  AlertTriangle,
  CheckCircle,
  Package,
  History,
  Search,
  ArrowRight,
  Plus,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  ChevronDown,
  X,
  Home,
  Check,
  Copy,
  Info
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import StatCard from '../components/common/StatCard';
import Pagination from '../components/common/Pagination';
import ActionMenu from '../components/common/ActionMenu';

export default function StockAdjustment({ setTab }) {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('DAMAGE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // History & Table State
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterAuditor, setFilterAuditor] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [copiedRef, setCopiedRef] = useState('');

  const datePickerRef = useRef(null);
  const moreFiltersRef = useRef(null);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/products/adjust/history');
      if (res.success) setHistory(res.adjustments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await api.get('/products');
        if (res.success) setProducts(res.products || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadProducts();
    loadHistory();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setDatePickerOpen(false);
      }
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target)) {
        setMoreFiltersOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleProductChange = async (prodId) => {
    setSelectedProduct(prodId);
    setSelectedBatch('');
    if (!prodId) {
      setBatches([]);
      return;
    }

    try {
      const res = await api.get(`/products/${prodId}`);
      if (res.success) {
        setBatches(res.batches || []);
        if (res.batches && res.batches.length > 0) {
          setSelectedBatch(res.batches[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProduct || !quantity || !reason) {
      setErrorMsg('Product, quantity, and reason are required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/products/adjust', {
        product_id: Number(selectedProduct),
        batch_id: selectedBatch ? Number(selectedBatch) : null,
        type: adjustmentType,
        quantity: Number(quantity),
        reason: reason.trim()
      });

      if (res.success) {
        setSuccessMsg(`Adjustment recorded! Ref: ${res.data.adjustment_no}, New Available Stock: ${res.data.new_stock}`);
        setQuantity('');
        setReason('');
        setSelectedProduct('');
        setSelectedBatch('');
        setShowNewModal(false);
        loadHistory();
        setTimeout(() => setSuccessMsg(''), 6000);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV('Stock_Adjustments_Log', history, [
      { key: 'created_at', label: 'Date & Time' },
      { key: 'adjustment_no', label: 'Ref #' },
      { key: 'product_name', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'batch_no', label: 'Batch Lot' },
      { key: 'type', label: 'Adjustment Type' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unit', label: 'Unit' },
      { key: 'reason', label: 'Reason' },
      { key: 'user_name', label: 'Audited By' }
    ]);
  };

  const copyRefToClipboard = (refNo) => {
    if (!refNo) return;
    navigator.clipboard.writeText(refNo);
    setCopiedRef(refNo);
    setTimeout(() => setCopiedRef(''), 2500);
  };

  // Helper for reduction types
  const isRedType = (t) => ['DAMAGE', 'EXPIRED', 'MELTED', 'SAMPLE', 'LOST', 'COUNT_REDUCE'].includes(t);

  // Stats Card Calculations
  const totalAdjustments = history.length;
  const stockReduced = history
    .filter(h => isRedType(h.type))
    .reduce((acc, cur) => acc + Number(cur.quantity || 0), 0);

  const stockAdded = history
    .filter(h => !isRedType(h.type))
    .reduce((acc, cur) => acc + Number(cur.quantity || 0), 0);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const adjustmentsThisMonth = history.filter(h => new Date(h.created_at) >= thirtyDaysAgo).length;

  // Selected product object
  const currentProd = products.find(p => p.id === Number(selectedProduct));

  // Filter history
  const filteredHistory = history.filter(row => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        row.product_name?.toLowerCase().includes(q) ||
        row.sku?.toLowerCase().includes(q) ||
        row.adjustment_no?.toLowerCase().includes(q) ||
        row.batch_no?.toLowerCase().includes(q) ||
        row.reason?.toLowerCase().includes(q) ||
        row.user_name?.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Type filter
    if (selectedType && row.type !== selectedType) {
      return false;
    }

    // Auditor filter
    if (filterAuditor && !row.user_name?.toLowerCase().includes(filterAuditor.toLowerCase())) {
      return false;
    }

    // Date range filter
    if (startDate || endDate) {
      const rowDate = new Date(row.created_at).setHours(0, 0, 0, 0);
      if (startDate) {
        const start = new Date(startDate).setHours(0, 0, 0, 0);
        if (rowDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate).setHours(23, 59, 59, 999);
        if (rowDate > end) return false;
      }
    }

    return true;
  });

  const isFilterActive = Boolean(searchQuery || selectedType || startDate || endDate || filterAuditor);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedType('');
    setStartDate('');
    setEndDate('');
    setFilterAuditor('');
    setCurrentPage(1);
  };

  // Pagination
  const totalEntries = filteredHistory.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const splitDateTime = (dateString) => {
    const full = formatDateTime(dateString);
    if (!full || !full.includes(',')) return { date: full || '-', time: '' };
    const [date, time] = full.split(',').map(s => s.trim());
    return { date, time };
  };

  // Type Badge Pill Component
  const renderTypeBadge = (type) => {
    switch (type) {
      case 'DAMAGE':
      case 'MELTED':
      case 'LOST':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#FEE2E2',
            color: '#991B1B',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626' }} />
            <span>{type === 'DAMAGE' ? 'Damaged / Defective' : type === 'MELTED' ? 'Melted / Thawed' : 'Lost / Missing'}</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#FEF3C7',
            color: '#92400E',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }} />
            <span>Expired</span>
          </span>
        );
      case 'FOUND':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#D1FAE5',
            color: '#065F46',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
            <span>Found / Returned</span>
          </span>
        );
      case 'COUNT_DIFF':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#DBEAFE',
            color: '#1E40AF',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6' }} />
            <span>Manual Correction</span>
          </span>
        );
      case 'RESTOCK':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#D1FAE5',
            color: '#065F46',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
            <span>Restock Added</span>
          </span>
        );
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#F3F4F6',
            color: '#374151',
            whiteSpace: 'nowrap'
          }}>
            <span>{type}</span>
          </span>
        );
    }
  };

  return (
    <div className="sadax-page-layout" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* SUCCESS / ERROR NOTIFICATIONS */}
      {successMsg && (
        <div style={{
          padding: '0.85rem 1.15rem',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
        }}>
          <CheckCircle size={18} color="#10b981" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{
          padding: '0.85rem 1.15rem',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
        }}>
          <AlertTriangle size={18} color="#ef4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SECTION A — PAGE HEADER (SadaxCart Style) */}
      <div className="page-header-container">
        <div>
          <nav className="header-breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setTab && setTab('dashboard')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                color: '#00a389'
              }}
              title="Go to Dashboard"
            >
              <Home size={15} color="#00a389" />
            </button>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>/</span>
            <button
              type="button"
              onClick={() => setTab && setTab('inventory')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                color: '#00a389',
                fontSize: '0.8125rem',
                fontWeight: 600
              }}
              title="Go to Products"
            >
              Inventory
            </button>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: '#00a389', fontWeight: 600 }}>Adjustments</span>
          </nav>
          <h1 className="page-header-title" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-title)', margin: '0 0 4px 0' }}>
            Stock Adjustments
          </h1>
          <p className="page-header-subtitle" style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Log damaged, melted, expired or lost stock with audit trail
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* + New Adjustment Button (Opens Pop-up Modal) */}
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setShowNewModal(true);
            }}
            className="btn-sadax-teal"
            title="Log a new stock adjustment"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            <Plus size={16} />
            <span>New Adjustment</span>
          </button>

          {/* Export Log Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-sadax-white"
            title="Export audit log to CSV"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            <Download size={15} color="#4b5563" />
            <span>Export Log</span>
          </button>
        </div>
      </div>

      {/* SECTION B — STATS CARDS ROW (4 Cards matching Orders & Products pages) */}
      <div className="sadax-stat-card-row">
        <StatCard
          label="Total Adjustments"
          value={totalAdjustments.toLocaleString()}
          trend="neutral"
          subtitle="All time adjustment events"
        />
        <StatCard
          label="Stock Reduced"
          value={stockReduced.toLocaleString()}
          trend="down"
          subtitle="Total units written off"
        />
        <StatCard
          label="Stock Added"
          value={stockAdded.toLocaleString()}
          trend="up"
          subtitle="Total units added back"
        />
        <StatCard
          label="This Month"
          value={adjustmentsThisMonth.toLocaleString()}
          trend="neutral"
          subtitle="Adjustments last 30 days"
        />
      </div>

      {/* SECTION C — FULL WIDTH AUDIT LOG TABLE CARD */}
      <div className="sadax-table-card" style={{ width: '100%' }}>
        {/* SECTION D — FILTER BAR */}
        <div className="sadax-toolbar-row">
          {/* Search input (height 40px, left search icon) */}
          <div className="sadax-search-box">
            <Search size={15} className="sadax-search-icon" />
            <input
              type="text"
              placeholder="Search by product, ref number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="sadax-search-input"
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* All Types Dropdown */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(1);
                }}
                className="sadax-select-control"
                title="Filter by adjustment type"
              >
                <option value="">All Types</option>
                <option value="DAMAGE">Damaged / Defective</option>
                <option value="EXPIRED">Expired Shelf-Life</option>
                <option value="LOST">Lost / Missing</option>
                <option value="MELTED">Melted / Thawed</option>
                <option value="SAMPLE">Free Sample</option>
                <option value="FOUND">Found / Returned</option>
                <option value="COUNT_DIFF">Manual Correction</option>
                <option value="RESTOCK">Restock Added</option>
              </select>
            </div>

            {/* Date Range Picker */}
            <div className="action-menu-container" ref={datePickerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDatePickerOpen(!datePickerOpen);
                }}
                className={`sadax-filter-btn ${(startDate || endDate) ? 'active' : ''}`}
                title="Select Date Range"
              >
                <Calendar size={14} color={(startDate || endDate) ? '#10b981' : '#6b7280'} />
                <span>
                  {startDate && endDate
                    ? `${formatDate(startDate)} to ${formatDate(endDate)}`
                    : startDate
                      ? `From ${formatDate(startDate)}`
                      : '01 Jan, 2024 to 31 Dec, 2024'}
                </span>
                <ChevronDown size={13} color="#9ca3af" />
              </button>

              {datePickerOpen && (
                <div
                  className="dropdown-menu"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '6px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                    zIndex: 200,
                    width: '280px',
                    padding: '1rem'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-title)' }}>
                    Filter by Date Range
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="form-control"
                        style={{ height: '32px', fontSize: '0.785rem' }}
                        title="Start Date"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '3px' }}>End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="form-control"
                        style={{ height: '32px', fontSize: '0.785rem' }}
                        title="End Date"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '0.65rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setDatePickerOpen(false);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePickerOpen(false)}
                      className="btn btn-sm"
                      style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', height: '28px' }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* More Filter Button */}
            <div className="action-menu-container" ref={moreFiltersRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoreFiltersOpen(!moreFiltersOpen);
                }}
                className={`sadax-filter-btn ${filterAuditor ? 'active' : ''}`}
                title="More Filters"
              >
                <Filter size={14} color={filterAuditor ? '#10b981' : '#6b7280'} />
                <span>More Filter</span>
                <ChevronDown size={13} color="#9ca3af" />
              </button>

              {moreFiltersOpen && (
                <div
                  className="dropdown-menu"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '6px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                    zIndex: 200,
                    width: '260px',
                    padding: '1rem'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-title)' }}>
                    Additional Filters
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                      Audited By (Staff)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mudassir"
                      value={filterAuditor}
                      onChange={(e) => {
                        setFilterAuditor(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="form-control"
                      style={{ height: '32px', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterAuditor('');
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', flex: 1 }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoreFiltersOpen(false)}
                      className="btn btn-sm"
                      style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', flex: 1 }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Clear Filter button */}
            {isFilterActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="btn btn-secondary btn-sm"
                style={{ height: '40px', padding: '0 0.85rem', borderRadius: '8px', color: '#dc2626' }}
                title="Clear all filters"
              >
                Clear
              </button>
            )}

            {/* Refresh Icon Button */}
            <button
              type="button"
              onClick={loadHistory}
              className="sadax-icon-btn"
              title="Refresh Audit Log"
            >
              <RefreshCw size={15} className={loadingHistory ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* SECTION E — AUDIT LOG TABLE */}
        <div className="table-responsive" style={{ margin: 0, border: 'none' }}>
          <table className="sadax-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: '135px' }}>Date & Time</th>
                <th style={{ minWidth: '120px' }}>Ref #</th>
                <th style={{ minWidth: '220px' }}>Product</th>
                <th style={{ minWidth: '140px' }}>Type</th>
                <th style={{ minWidth: '90px', textAlign: 'center' }}>Qty</th>
                <th style={{ minWidth: '180px' }}>Reason</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.875rem' }}>
                      <RefreshCw size={18} className="spin" color="#10b981" />
                      <span>Loading audit trail events...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                /* EMPTY STATE (clean, centered with green checkmark) */
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: '#ecfdf5',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 0.75rem'
                    }}>
                      <CheckCircle size={26} />
                    </div>
                    <strong style={{ fontSize: '15px', color: '#374151', display: 'block' }}>
                      No stock adjustment events recorded
                    </strong>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 1.25rem 0' }}>
                      Cold storage adjustments and shrinkages will appear in this audit log
                    </p>
                    {isFilterActive ? (
                      <button onClick={handleClearFilters} className="btn btn-secondary btn-sm">
                        Clear All Filters
                      </button>
                    ) : (
                      <button onClick={() => setShowNewModal(true)} className="btn-sadax-teal btn-sm" style={{ height: '32px' }}>
                        + New Adjustment
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((row) => {
                  const dt = splitDateTime(row.created_at);
                  const isReduction = isRedType(row.type);

                  return (
                    <tr
                      key={row.id}
                      style={{
                        height: '72px',
                        borderBottom: '1px solid var(--border)',
                        transition: 'background-color 0.1s ease'
                      }}
                    >
                      {/* COLUMN 1: Date & Time */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-title)' }}>
                          {dt.date}
                        </div>
                        {dt.time && (
                          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                            {dt.time}
                          </div>
                        )}
                      </td>

                      {/* COLUMN 2: Ref # */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '13px',
                            color: '#0F766E',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={() => copyRefToClipboard(row.adjustment_no)}
                          title="Click to copy reference #"
                        >
                          <span>#{row.adjustment_no}</span>
                          {copiedRef === row.adjustment_no && (
                            <Check size={12} color="#10b981" />
                          )}
                        </span>
                        {row.batch_no && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Lot #{row.batch_no}
                          </div>
                        )}
                      </td>

                      {/* COLUMN 3: Product */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            background: 'var(--hover-bg)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Package size={16} color="var(--primary)" />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600,
                              fontSize: '14px',
                              color: 'var(--text-title)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '220px'
                            }} title={row.product_name}>
                              {row.product_name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                              #{row.sku || `ITM-${row.product_id}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* COLUMN 4: Type (Pill Badges) */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        {renderTypeBadge(row.type)}
                      </td>

                      {/* COLUMN 5: Qty */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{
                          fontWeight: 700,
                          fontSize: '15px',
                          color: isReduction ? '#DC2626' : '#16A34A'
                        }}>
                          {isReduction ? `-${row.quantity}` : `+${row.quantity}`}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>
                          {row.unit || 'pkt'}
                        </div>
                      </td>

                      {/* COLUMN 6: Reason */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div
                          style={{
                            fontSize: '13px',
                            color: '#374151',
                            maxWidth: '240px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer'
                          }}
                          title={row.reason}
                          onClick={() => setSelectedAdjustment(row)}
                        >
                          {row.reason ? (row.reason.length > 40 ? `${row.reason.slice(0, 40)}...` : row.reason) : '-'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          By {row.user_name || 'Staff'}
                        </div>
                      </td>

                      {/* COLUMN 7: Action */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedAdjustment(row)}
                            className="sadax-action-details"
                            title="View event details"
                          >
                            Details
                          </button>

                          <ActionMenu
                            title="Adjustment Actions"
                            items={[
                              {
                                label: 'View Details',
                                icon: <Info size={14} color="#0284c7" />,
                                onClick: () => setSelectedAdjustment(row)
                              },
                              {
                                label: 'Copy Reference #',
                                icon: <Copy size={14} color="#6366f1" />,
                                onClick: () => copyRefToClipboard(row.adjustment_no)
                              }
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* TABLE FOOTER / PAGINATION */}
        <Pagination
          currentPage={currentPage}
          totalItems={totalEntries}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
          pageSizeOptions={[10, 15, 25, 50]}
          onPageSizeChange={(newSize) => {
            setItemsPerPage(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* NEW ADJUSTMENT POP-UP MODAL (Clean Centered Dialog) */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '540px', width: '96%', borderRadius: '14px', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                  New Stock Adjustment
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                  Log a stock change with mandatory audit reason
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowNewModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* MODAL BODY */}
            <form onSubmit={handleAdjust}>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(80vh - 130px)', overflowY: 'auto' }}>
                {/* Field 1 — Select Product */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                    Frozen Product *
                  </label>
                  <select
                    className="form-control"
                    value={selectedProduct}
                    onChange={(e) => handleProductChange(e.target.value)}
                    required
                    style={{ height: '40px', borderRadius: '8px', fontSize: '13px', border: '1px solid #D1D5DB' }}
                  >
                    <option value="">-- Choose Frozen Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Current Stock: {p.current_stock} {p.unit || 'pkt'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Optional Batch Selection */}
                {batches.length > 0 && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                      Target Batch / Lot Lot
                    </label>
                    <select
                      className="form-control"
                      value={selectedBatch}
                      onChange={(e) => setSelectedBatch(e.target.value)}
                      style={{ height: '40px', borderRadius: '8px', fontSize: '13px', border: '1px solid #D1D5DB' }}
                    >
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>
                          Lot #{b.batch_no} • Available: {b.quantity} {currentProd?.unit || 'pkt'} • Exp: {formatDate(b.expiry_date)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Field 2 — Adjustment Type */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                    Adjustment Type *
                  </label>
                  <select
                    className="form-control"
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    style={{ height: '40px', borderRadius: '8px', fontSize: '13px', border: '1px solid #D1D5DB' }}
                  >
                    <option value="DAMAGE">🔴 Damaged / Defective (Reduce)</option>
                    <option value="EXPIRED">🟠 Expired / Near Expiry (Reduce)</option>
                    <option value="LOST">🔴 Lost / Missing (Reduce)</option>
                    <option value="MELTED">🔴 Melted / Thawed (Reduce)</option>
                    <option value="SAMPLE">🟣 Free Sample / Tasting (Reduce)</option>
                    <option value="FOUND">🟢 Found / Returned (Add)</option>
                    <option value="COUNT_DIFF">🔵 Manual Correction (Add)</option>
                    <option value="RESTOCK">🟢 Restock Added (Add)</option>
                  </select>
                </div>

                {/* Field 3 — Quantity */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                    Quantity ({currentProd?.unit || 'Units'}) *
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="0.00"
                    min="0.01"
                    step="any"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    style={{ height: '40px', borderRadius: '8px', fontSize: '13px', border: '1px solid #D1D5DB' }}
                  />
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                    Current stock: {currentProd ? `${currentProd.current_stock} ${currentProd.unit || 'pkt'}` : 'Select a product first'}
                  </div>
                </div>

                {/* Field 4 — Reason / Audit Justification */}
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', color: '#374151', margin: 0 }}>
                      Mandatory Reason *
                    </label>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      {reason.length} / 500
                    </span>
                  </div>
                  <textarea
                    className="form-control"
                    rows="4"
                    maxLength={500}
                    placeholder="e.g. Compressor failure in Freezer #2 thawed 3 packets; or supplier carton arrived punctured."
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ borderRadius: '8px', fontSize: '13px', border: '1px solid #D1D5DB', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer" style={{
                padding: '14px 20px',
                borderTop: '1px solid #E5E7EB',
                background: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px'
              }}>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-sadax-teal"
                  style={{
                    height: '38px',
                    padding: '0 20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px'
                  }}
                >
                  <span>{submitting ? 'Applying...' : 'Apply Adjustment'}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS VIEW MODAL (When clicking Details on an audit log item) */}
      {selectedAdjustment && (
        <div className="modal-overlay" onClick={() => setSelectedAdjustment(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '520px', width: '96%', borderRadius: '14px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
                  Adjustment Audit Details
                </h3>
                <span className="mono" style={{ fontSize: '13px', color: '#0F766E', fontWeight: 700 }}>
                  #{selectedAdjustment.adjustment_no}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedAdjustment(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Product Info Box */}
              <div style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '6px',
                  background: 'var(--hover-bg)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Package size={20} color="var(--primary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-title)' }}>
                    {selectedAdjustment.product_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    SKU: #{selectedAdjustment.sku || `ITM-${selectedAdjustment.product_id}`}
                    {selectedAdjustment.batch_no && ` • Batch: Lot #${selectedAdjustment.batch_no}`}
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div style={{ background: 'var(--hover-bg)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Adjustment Type</div>
                  <div style={{ marginTop: '4px' }}>
                    {renderTypeBadge(selectedAdjustment.type)}
                  </div>
                </div>

                <div style={{ background: 'var(--hover-bg)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Quantity Adjusted</div>
                  <div style={{
                    marginTop: '4px',
                    fontWeight: 700,
                    fontSize: '15px',
                    color: isRedType(selectedAdjustment.type) ? '#DC2626' : '#16A34A'
                  }}>
                    {isRedType(selectedAdjustment.type) ? `-${selectedAdjustment.quantity}` : `+${selectedAdjustment.quantity}`} {selectedAdjustment.unit || 'pkt'}
                  </div>
                </div>

                <div style={{ background: 'var(--hover-bg)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Event Timestamp</div>
                  <div style={{ marginTop: '4px', fontWeight: 600, color: 'var(--text-title)' }}>
                    {formatDateTime(selectedAdjustment.created_at)}
                  </div>
                </div>

                <div style={{ background: 'var(--hover-bg)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Audited By</div>
                  <div style={{ marginTop: '4px', fontWeight: 600, color: 'var(--text-title)' }}>
                    {selectedAdjustment.user_name || 'Staff Member'}
                  </div>
                </div>
              </div>

              {/* Reason / Justification */}
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                  Audit Justification / Mandatory Reason:
                </div>
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#fbbf24',
                  lineHeight: 1.5
                }}>
                  {selectedAdjustment.reason || 'No justification specified.'}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => copyRefToClipboard(selectedAdjustment.adjustment_no)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Copy size={13} />
                <span>{copiedRef === selectedAdjustment.adjustment_no ? 'Copied!' : 'Copy Ref #'}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedAdjustment(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
