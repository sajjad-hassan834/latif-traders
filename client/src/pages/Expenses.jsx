import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Trash2,
  Calendar,
  Tag,
  Search,
  Download,
  Edit2,
  X,
  Filter,
  ArrowUpRight,
  TrendingDown,
  Layers,
  CreditCard,
  Banknote,
  RotateCcw,
  Check,
  Paperclip,
  Eye,
  FileText,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { api, API_ORIGIN } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/common/Pagination';
import ActionMenu from '../components/common/ActionMenu';
import ErrorBoundary from '../components/common/ErrorBoundary';

function ExpensesContent() {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [datePreset, setDatePreset] = useState('all'); // 'today', 'this_month', 'last_30', 'all', 'custom'
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);

  // Add Expense Form
  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    amount: '',
    payment_method: 'Cash',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    receipt_base64: '',
    receipt_name: ''
  });

  const getFileUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const rawBase = API_ORIGIN;
    return rawBase ? `${rawBase.replace(/\/$/, '')}${path}` : path;
  };

  const handleReceiptFileChange = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Attachment exceeds 8MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const base64 = loadEvt.target.result;
      if (isEdit) {
        setEditingExpense(prev => ({
          ...prev,
          receipt_base64: base64,
          receipt_name: file.name
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          receipt_base64: base64,
          receipt_name: file.name
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const [newCatName, setNewCatName] = useState('');

  const loadExpenses = async () => {
    try {
      setLoading(true);
      let query = `/expenses?`;
      if (startDate) query += `start_date=${startDate}&`;
      if (endDate) query += `end_date=${endDate}&`;
      if (selectedCat) query += `category_id=${selectedCat}&`;
      if (selectedMethod) query += `payment_method=${encodeURIComponent(selectedMethod)}&`;
      if (search.trim()) query += `search=${encodeURIComponent(search.trim())}&`;

      const [eRes, cRes] = await Promise.all([
        api.get(query),
        api.get('/expenses/categories')
      ]);

      if (eRes && eRes.success) {
        setExpenses(eRes.expenses || []);
        setTotalAmount(eRes.total_amount || 0);
      }
      if (cRes && cRes.success) setCategories(cRes.categories || []);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [startDate, endDate, selectedCat, selectedMethod]);

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') {
      loadExpenses();
    }
  };

  // Quick Date Preset Handler
  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'last_30') {
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      setStartDate(d30);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleCustomDateChange = (start, end) => {
    setDatePreset('custom');
    if (start !== undefined) setStartDate(start);
    if (end !== undefined) setEndDate(end);
  };

  const clearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setSelectedCat('');
    setSelectedMethod('');
    setDatePreset('all');
  };

  const activeFiltersCount = (search ? 1 : 0) + (selectedCat ? 1 : 0) + (selectedMethod ? 1 : 0) + (startDate || endDate ? 1 : 0);

  const handleExportCSV = () => {
    if (!expenses.length) return;
    exportToCSV(`Operating_Expenses_${startDate || 'all'}_${endDate || 'all'}`, expenses, [
      { label: 'Date', key: 'expense_date' },
      { label: 'Expense Title', key: 'title' },
      { label: 'Category', key: 'category_name', format: v => v || 'General' },
      { label: 'Payment Method', key: 'payment_method' },
      { label: 'Amount (PKR)', key: 'amount' },
      { label: 'Notes / Description', key: 'description' },
      { label: 'Logged By', key: 'user_name' }
    ]);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/expenses', formData);
      if (res && res.success) {
        setShowAddModal(false);
        setFormData({
          title: '',
          category_id: '',
          amount: '',
          payment_method: 'Cash',
          expense_date: new Date().toISOString().split('T')[0],
          description: '',
          receipt_base64: '',
          receipt_name: ''
        });
        loadExpenses();
      }
    } catch (err) {
      alert(err.message || 'Failed to record expense');
    }
  };

  const handleStartEdit = (exp) => {
    setEditingExpense({
      id: exp.id,
      title: exp.title,
      category_id: exp.category_id || '',
      amount: exp.amount,
      payment_method: exp.payment_method || 'Cash',
      expense_date: exp.expense_date,
      description: exp.description || '',
      receipt_path: exp.receipt_path || null,
      receipt_base64: '',
      receipt_name: ''
    });
    setShowEditModal(true);
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/expenses/${editingExpense.id}`, editingExpense);
      if (res && res.success) {
        setShowEditModal(false);
        setEditingExpense(null);
        loadExpenses();
      }
    } catch (err) {
      alert(err.message || 'Failed to update expense');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await api.post('/expenses/categories', { name: newCatName.trim() });
      if (res && res.success) {
        setNewCatName('');
        setShowCatModal(false);
        loadExpenses();
      }
    } catch (err) {
      alert(err.message || 'Failed to create category');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      const res = await api.delete(`/expenses/${id}`);
      if (res && res.success) loadExpenses();
    } catch (err) {
      alert('Failed to delete expense');
    }
  };

  // Payment method totals
  const cashTotal = expenses.filter(e => e.payment_method === 'Cash').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const bankTotal = expenses.filter(e => e.payment_method !== 'Cash').reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 1. CLEAN PAGE HEADER */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>Operating Expenses Ledger</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Track business overheads, shop electricity, freezer maintenance, fuel, and daily payouts
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary btn-sm"
            style={{ height: '34px', fontSize: '0.8rem', padding: '0 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            title="Download CSV / Excel"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCatModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ height: '34px', fontSize: '0.8rem', padding: '0 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              title="Create New Expense Category"
            >
              <Tag size={14} />
              <span>+ Category</span>
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
            style={{ height: '34px', fontSize: '0.8rem', fontWeight: 600, padding: '0 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* 2. THREE UNIFORM KPI SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
        {/* TOTAL EXPENSES */}
        <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Expenses
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-title)', marginTop: '0.35rem', lineHeight: 1.1 }}>
              {formatPKR(totalAmount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {expenses.length} voucher{expenses.length !== 1 ? 's' : ''} recorded • Deducted from P&L
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={20} />
          </div>
        </div>

        {/* CASH PAYMENTS */}
        <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Cash Drawer
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#059669', marginTop: '0.35rem', lineHeight: 1.1 }}>
              {formatPKR(cashTotal)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Paid directly from shop cash register
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Banknote size={20} />
          </div>
        </div>

        {/* BANK & DIGITAL PAYMENTS */}
        <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Bank & Online
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#A78BFA', marginTop: '0.35rem', lineHeight: 1.1 }}>
              {formatPKR(bankTotal)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Online transfers, cheques & digital pay
            </div>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.15)', color: '#A78BFA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CreditCard size={20} />
          </div>
        </div>
      </div>

      {/* 3. STREAMLINED TOOLBAR: PRESET PILLS + FILTERS + SEARCH */}
      <div className="card" style={{ padding: '0.85rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* ROW 1: PRESET PILLS & CATEGORY QUICK FILTERS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => applyDatePreset('all')}
              className={`filter-pill ${datePreset === 'all' && !startDate && !endDate ? 'active' : ''}`}
            >
              <span>All Time</span>
              <span className="count-badge">{expenses.length}</span>
            </button>
            <button
              onClick={() => applyDatePreset('today')}
              className={`filter-pill ${datePreset === 'today' ? 'active' : ''}`}
            >
              <span>Today</span>
            </button>
            <button
              onClick={() => applyDatePreset('this_month')}
              className={`filter-pill ${datePreset === 'this_month' ? 'active' : ''}`}
            >
              <span>This Month</span>
            </button>
            <button
              onClick={() => applyDatePreset('last_30')}
              className={`filter-pill ${datePreset === 'last_30' ? 'active' : ''}`}
            >
              <span>Last 30 Days</span>
            </button>

          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              style={{
                height: '28px',
                padding: '0 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#dc2626',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title="Clear all active filters"
            >
              <RotateCcw size={12} />
              <span>Reset ({activeFiltersCount})</span>
            </button>
          )}
        </div>

        {/* ROW 2: CONTROLS & SEARCH */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.65rem',
          paddingTop: '0.65rem',
          borderTop: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: '1 1 auto' }}>
            {/* CATEGORY SELECT */}
            <select
              className="form-control"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px', width: 'auto', minWidth: '145px' }}
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* PAYMENT METHOD SELECT */}
            <select
              className="form-control"
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px', width: 'auto', minWidth: '135px' }}
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash Only</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>

            {/* DATE RANGE INPUTS */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'var(--input-bg, #ffffff)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: '6px',
              padding: '2px 8px',
              height: '32px'
            }}>
              <Calendar size={13} color="var(--text-muted, #64748b)" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleCustomDateChange(e.target.value, undefined)}
                style={{
                  height: '24px',
                  fontSize: '0.75rem',
                  border: 'none',
                  background: 'transparent',
                  padding: '0 2px',
                  color: 'var(--text-value, #0f172a)'
                }}
              />
              <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleCustomDateChange(undefined, e.target.value)}
                style={{
                  height: '24px',
                  fontSize: '0.75rem',
                  border: 'none',
                  background: 'transparent',
                  padding: '0 2px',
                  color: 'var(--text-value, #0f172a)'
                }}
              />
            </div>
          </div>

          {/* SEARCH INPUT */}
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px', maxWidth: '340px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted, #94a3b8)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.8rem', borderRadius: '6px' }}
              placeholder="Search expenses, notes... (Press Enter)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchSubmit}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); loadExpenses(); }}
                style={{ position: 'absolute', right: '8px', top: '7px', color: 'var(--text-muted, #94a3b8)', background: 'none', border: 'none', cursor: 'pointer' }}
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. EXPENSES DATA TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '1rem 1.35rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>Expense Ledger</h3>
            <span className="badge badge-stage" style={{ fontSize: '0.75rem' }}>
              {expenses.length} Records
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Filtered Total: <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>{formatPKR(totalAmount)}</strong>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ minWidth: '720px' }}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Date</th>
                <th>Expense Title</th>
                <th style={{ width: '150px' }}>Category</th>
                <th style={{ width: '110px' }}>Method</th>
                <th>Description</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Receipt</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Amount (PKR)</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted, #64748b)' }}>
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted, #94a3b8)' }}>
                    No expenses found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                expenses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
                      {formatDate(e.expense_date)}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-title, #0f172a)' }}>
                      {e.title}
                    </td>
                    <td>
                      <span className="badge badge-stage">
                        {e.category_name || 'General'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${e.payment_method === 'Cash' ? 'badge-success' : 'badge-stage'}`}>
                        {e.payment_method}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
                      {e.description || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {e.receipt_path ? (
                        <button
                          type="button"
                          onClick={() => setPreviewReceiptUrl(getFileUrl(e.receipt_path))}
                          className="btn-table-action"
                          title="View Receipt / Bill"
                        >
                          <span>Receipt</span>
                          <ArrowUpRight size={13} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444', fontSize: '0.9rem' }}>
                      {formatPKR(e.amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(e)}
                          className="btn-table-action"
                          title="Edit & View Expense"
                        >
                          <span>Edit</span>
                          <ArrowUpRight size={13} />
                        </button>

                        <ActionMenu
                          title="Expense Actions"
                          items={[
                            {
                              label: 'Edit Expense',
                              icon: <Edit2 size={14} color="#0284c7" />,
                              onClick: () => handleStartEdit(e)
                            },
                            e.receipt_path && {
                              label: 'View Receipt',
                              icon: <Paperclip size={14} color="#64748b" />,
                              onClick: () => setPreviewReceiptUrl(getFileUrl(e.receipt_path))
                            },
                            isAdmin && { divider: true },
                            isAdmin && {
                              label: 'Delete Expense',
                              icon: <Trash2 size={14} color="#dc2626" />,
                              danger: true,
                              onClick: () => handleDeleteExpense(e.id)
                            }
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-table-head, #f8fafc)', fontWeight: 800 }}>
                  <td colSpan="6" style={{ textAlign: 'right', padding: '0.65rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted, #475569)' }}>
                    Total ({expenses.length} Records):
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.65rem 1rem', color: '#ef4444', fontSize: '0.95rem' }}>
                    {formatPKR(totalAmount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={expenses.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* 4. ADD EXPENSE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title, #0f172a)' }}>Record Expense</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  Log an operational expenditure or utility payment.
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
            <form onSubmit={handleAddExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Expense Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Commercial Freezer Electricity Bill"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Category</label>
                    <select
                      className="form-control"
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Amount (PKR) *</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      min="1"
                      placeholder="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Expense Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.expense_date}
                      onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="e.g. Paid LESCO electricity bill for Sept 2026"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0, background: 'var(--hover-bg, #f8fafc)', border: '1px dashed var(--border, #cbd5e1)', borderRadius: '6px', padding: '0.75rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                    <Paperclip size={13} color="var(--primary, #0284c7)" />
                    <span>Receipt (Optional)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleReceiptFileChange(e, false)}
                    style={{ fontSize: '0.75rem', width: '100%' }}
                  />
                  {formData.receipt_name && (
                    <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                      ✓ Attached: {formData.receipt_name}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. EDIT EXPENSE MODAL */}
      {showEditModal && editingExpense && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title, #0f172a)' }}>Edit Expense</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  Modify recorded expenditure information or attachment.
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
            <form onSubmit={handleUpdateExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Expense Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={editingExpense.title}
                    onChange={(e) => setEditingExpense({ ...editingExpense, title: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Category</label>
                    <select
                      className="form-control"
                      value={editingExpense.category_id}
                      onChange={(e) => setEditingExpense({ ...editingExpense, category_id: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Amount (PKR) *</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      min="1"
                      value={editingExpense.amount}
                      onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Expense Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editingExpense.expense_date}
                      onChange={(e) => setEditingExpense({ ...editingExpense, expense_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={editingExpense.payment_method}
                      onChange={(e) => setEditingExpense({ ...editingExpense, payment_method: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={editingExpense.description}
                    onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0, background: 'var(--hover-bg, #f8fafc)', border: '1px dashed var(--border, #cbd5e1)', borderRadius: '6px', padding: '0.75rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                    <Paperclip size={13} color="var(--primary, #0284c7)" />
                    <span>Receipt (Optional)</span>
                  </label>
                  {editingExpense.receipt_path && !editingExpense.receipt_name && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', background: 'var(--hover-bg)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-title)', fontWeight: 600 }}>Current Receipt Attached</span>
                      <button
                        type="button"
                        onClick={() => setPreviewReceiptUrl(getFileUrl(editingExpense.receipt_path))}
                        style={{ background: 'none', border: 'none', color: 'var(--primary, #0284c7)', fontSize: '0.725rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        View
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleReceiptFileChange(e, true)}
                    style={{ fontSize: '0.75rem', width: '100%' }}
                  />
                  {editingExpense.receipt_name && (
                    <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                      ✓ New File Selected: {editingExpense.receipt_name}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Update Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. CREATE CATEGORY MODAL */}
      {showCatModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title, #0f172a)' }}>Add Expense Category</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  Create an expenditure category group.
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCatModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="modal-body">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Delivery Van Maintenance"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCatModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '90px' }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 7. PREVIEW RECEIPT MODAL */}
      {previewReceiptUrl && (
        <div className="modal-overlay" onClick={() => setPreviewReceiptUrl(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '650px', width: '96%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title, #0f172a)' }}>Expense Receipt</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>Attached payment proof document</div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewReceiptUrl(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
              <img
                src={previewReceiptUrl}
                alt="Expense Receipt"
                style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: '6px', objectFit: 'contain', border: '1px solid #e2e8f0' }}
                onError={(err) => {
                  err.target.style.display = 'none';
                  err.target.parentElement.innerHTML = `<div style="padding: 2rem; text-align: center; color: #64748b;">
                    <p style="font-weight: 600; margin-bottom: 0.5rem;">Document Preview</p>
                    <a href="${previewReceiptUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary" style="display: inline-flex; align-items: center; gap: 4px;">
                      Open Receipt in New Tab ↗
                    </a>
                  </div>`;
                }}
              />
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <a
                href={previewReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ExternalLink size={13} />
                <span>Open in New Tab</span>
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewReceiptUrl(null)}
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

export default function Expenses() {
  return (
    <ErrorBoundary fallbackTitle="Expenses Module Error">
      <ExpensesContent />
    </ErrorBoundary>
  );
}
