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
  Check
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import { useAuth } from '../context/AuthContext';
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

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Add Expense Form
  const [formData, setFormData] = useState({
    title: '',
    category_id: '',
    amount: '',
    payment_method: 'Cash',
    expense_date: new Date().toISOString().split('T')[0],
    description: ''
  });

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
          description: ''
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
      description: exp.description || ''
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
      {/* 1. TOP SUMMARY METRIC CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {/* TOTAL AMOUNT CARD */}
        <div className="card" style={{ background: '#0f172a', color: '#fff', padding: '1rem 1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.725rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Operating Expenses
            </span>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '6px', borderRadius: '8px' }}>
              <Wallet size={16} color="#38bdf8" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            {formatPKR(totalAmount)}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            {expenses.length} voucher{expenses.length !== 1 ? 's' : ''} recorded • Deducted from P&L Gross Profit
          </p>
        </div>

        {/* PAYMENT METHOD SPLIT */}
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Payment Channels
            </span>
            <CreditCard size={15} color="#0284c7" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#166534', fontWeight: 600 }}>
                <Banknote size={12} />
                <span>Cash Drawer</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                {formatPKR(cashTotal)}
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem 0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                <CreditCard size={12} />
                <span>Bank / Online</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {formatPKR(bankTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* TOP EXPENSE CATEGORIES SUMMARY */}
        <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Top Categories (Click to Filter)
            </span>
            <Layers size={15} color="#0284c7" />
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {categories.slice(0, 4).map(c => {
              const catTotal = expenses.filter(e => e.category_id === c.id).reduce((sum, i) => sum + i.amount, 0);
              const isSelected = selectedCat === String(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCat(isSelected ? '' : String(c.id))}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    border: isSelected ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                    background: isSelected ? '#e0f2fe' : '#f8fafc',
                    color: isSelected ? '#0369a1' : '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  title={`Filter by ${c.name}`}
                >
                  {isSelected && <Check size={11} color="#0284c7" />}
                  <span>{c.name}:</span>
                  <strong>{formatPKR(catTotal)}</strong>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. STRUCTURED FILTER & ACTION TOOLBAR (PERFECT ARRANGEMENT) */}
      <div className="card" style={{ padding: '0.85rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* ROW 1: SEARCH & ACTION BUTTONS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* SEARCH INPUT */}
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.8rem', borderRadius: '6px' }}
              placeholder="Search expenses, bills, notes... (Press Enter)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchSubmit}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); loadExpenses(); }}
                style={{ position: 'absolute', right: '8px', top: '7px', color: '#94a3b8' }}
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* ACTION BUTTONS GROUP */}
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportCSV}
              className="btn btn-secondary btn-sm"
              style={{ height: '32px', fontSize: '0.775rem', padding: '0 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              title="Download Excel / CSV file"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowCatModal(true)}
                className="btn btn-secondary btn-sm"
                style={{ height: '32px', fontSize: '0.775rem', padding: '0 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Create New Expense Category"
              >
                <Tag size={13} />
                <span>+ Category</span>
              </button>
            )}

            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm"
              style={{ height: '32px', fontSize: '0.8rem', fontWeight: 600, padding: '0 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={15} />
              <span>Record Expense</span>
            </button>
          </div>
        </div>

        {/* ROW 2: FILTERS & DATE PRESETS BAR */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.65rem',
          paddingTop: '0.65rem',
          borderTop: '1px solid #f1f5f9'
        }}>
          {/* LEFT: DROPDOWNS & DATE RANGE */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* CATEGORY SELECT */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Category:</span>
              <select
                className="form-control"
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                style={{ height: '30px', fontSize: '0.775rem', padding: '2px 8px', width: '150px' }}
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* PAYMENT METHOD SELECT */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Method:</span>
              <select
                className="form-control"
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                style={{ height: '30px', fontSize: '0.775rem', padding: '2px 8px', width: '130px' }}
              >
                <option value="">All Methods</option>
                <option value="Cash">Cash Only</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            {/* DATE RANGE INPUTS */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '2px 6px'
            }}>
              <Calendar size={13} color="#64748b" />
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
                  color: '#0f172a'
                }}
              />
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>to</span>
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
                  color: '#0f172a'
                }}
              />
            </div>
          </div>

          {/* RIGHT: QUICK DATE PRESETS & RESET */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginRight: '2px' }}>
              Presets:
            </span>
            <button
              onClick={() => applyDatePreset('today')}
              className={`btn btn-sm ${datePreset === 'today' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ height: '26px', fontSize: '0.725rem', padding: '0 0.5rem' }}
            >
              Today
            </button>
            <button
              onClick={() => applyDatePreset('this_month')}
              className={`btn btn-sm ${datePreset === 'this_month' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ height: '26px', fontSize: '0.725rem', padding: '0 0.5rem' }}
            >
              This Month
            </button>
            <button
              onClick={() => applyDatePreset('last_30')}
              className={`btn btn-sm ${datePreset === 'last_30' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ height: '26px', fontSize: '0.725rem', padding: '0 0.5rem' }}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => applyDatePreset('all')}
              className={`btn btn-sm ${datePreset === 'all' && !startDate && !endDate ? 'btn-primary' : 'btn-secondary'}`}
              style={{ height: '26px', fontSize: '0.725rem', padding: '0 0.5rem' }}
            >
              All Time
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                style={{
                  height: '26px',
                  padding: '0 0.6rem',
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginLeft: '4px'
                }}
                title="Clear all active filters"
              >
                <RotateCcw size={11} />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. EXPENSES DATA TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '0.75rem 1.15rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fafafa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: '#0f172a' }}>Expense Vouchers Ledger</h3>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {expenses.length} Records
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Filtered Total: <strong style={{ color: '#0284c7', fontSize: '0.9rem' }}>{formatPKR(totalAmount)}</strong>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Date</th>
                <th>Expense Title</th>
                <th style={{ width: '160px' }}>Category</th>
                <th style={{ width: '120px' }}>Method</th>
                <th>Notes / Description</th>
                <th style={{ textAlign: 'right', width: '140px' }}>Amount (PKR)</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                    No expenses found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                expenses.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600, fontSize: '0.775rem', color: '#334155' }}>
                      {formatDate(e.expense_date)}
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>
                      {e.title}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.725rem', fontWeight: 600 }}>
                        {e.category_name || 'General'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 7px',
                        background: e.payment_method === 'Cash' ? '#f0fdf4' : '#f0f9ff',
                        border: `1px solid ${e.payment_method === 'Cash' ? '#bbf7d0' : '#bae6fd'}`,
                        borderRadius: '4px',
                        color: e.payment_method === 'Cash' ? '#166534' : '#0369a1',
                        fontSize: '0.7rem',
                        fontWeight: 700
                      }}>
                        {e.payment_method}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.775rem', color: '#64748b' }}>
                      {e.description || '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#ef4444', fontSize: '0.9rem' }}>
                      {formatPKR(e.amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          onClick={() => handleStartEdit(e)}
                          style={{
                            color: '#0284c7',
                            padding: '4px',
                            borderRadius: '4px',
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd'
                          }}
                          title="Edit Expense"
                        >
                          <Edit2 size={13} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteExpense(e.id)}
                            style={{
                              color: '#ef4444',
                              padding: '4px',
                              borderRadius: '4px',
                              background: '#fef2f2',
                              border: '1px solid #fecaca'
                            }}
                            title="Delete Expense"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                  <td colSpan="5" style={{ textAlign: 'right', padding: '0.65rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
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
      </div>

      {/* 4. ADD EXPENSE MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wallet size={16} color="var(--primary)" />
                <h3 style={{ fontSize: '1rem' }}>Record Operating Expense</h3>
              </div>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
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
                  <div className="form-group">
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Expense Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.expense_date}
                      onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
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

                <div className="form-group">
                  <label className="form-label">Description / Reference Note</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="e.g. Paid LESCO electricity bill for Sept 2026"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. EDIT EXPENSE MODAL */}
      {showEditModal && editingExpense && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Edit2 size={16} color="var(--primary)" />
                <h3 style={{ fontSize: '1rem' }}>Edit Expense Record</h3>
              </div>
              <button onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdateExpense}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Expense Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={editingExpense.title}
                    onChange={(e) => setEditingExpense({ ...editingExpense, title: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
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
                  <div className="form-group">
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Expense Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editingExpense.expense_date}
                      onChange={(e) => setEditingExpense({ ...editingExpense, expense_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
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

                <div className="form-group">
                  <label className="form-label">Description / Reference Note</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={editingExpense.description}
                    onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Update Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. CREATE CATEGORY MODAL */}
      {showCatModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag size={15} color="var(--primary)" />
                <h3 style={{ fontSize: '0.95rem' }}>Add Expense Category</h3>
              </div>
              <button onClick={() => setShowCatModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="modal-body">
                <div className="form-group">
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
                <button type="submit" className="btn btn-primary btn-sm">Create</button>
              </div>
            </form>
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
