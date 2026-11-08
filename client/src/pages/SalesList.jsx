import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Plus,
  Eye,
  Calendar,
  Download,
  ChevronDown,
  Trash2,
  Edit3,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  X,
  Check,
  MoreHorizontal,
  Printer,
  Banknote,
  CreditCard,
  RotateCcw,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  User,
  ShoppingBag,
  Home,
  Sliders,
  DollarSign,
  AlertTriangle,
  FileSpreadsheet,
  Package
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate, formatDateTime } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/common/Pagination';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import ActionMenu from '../components/common/ActionMenu';

const ORDER_STATUS_CONFIG = {
  New: { label: 'New', color: 'status-new', dotColor: '#0284c7' },
  Pending: { label: 'Pending', color: 'status-pending', dotColor: '#f59e0b' },
  Confirmed: { label: 'Confirmed', color: 'status-confirmed', dotColor: '#6366f1' },
  Processing: { label: 'Processing', color: 'status-processing', dotColor: '#a855f7' },
  'Ready for Delivery': { label: 'Ready for Delivery', color: 'status-ready', dotColor: '#06b6d4' },
  Delivered: { label: 'Delivered', color: 'status-delivered', dotColor: '#14b8a6' },
  Completed: { label: 'Completed', color: 'status-completed', dotColor: '#10b981' },
  Cancelled: { label: 'Cancelled', color: 'status-cancelled', dotColor: '#ef4444' }
};

export default function SalesList({ setTab }) {
  const { isAdmin, canSell } = useAuth();
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState({
    total_orders: 0,
    new_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    total_revenue: 0,
    total_balance_due: 0
  });

  const displayStats = useMemo(() => {
    const list = sales || [];
    let newOrd = 0;
    let compOrd = 0;
    let cancOrd = 0;
    for (const s of list) {
      const st = String(s.order_status || 'Completed').trim().toLowerCase();
      if (st === 'new' || st === 'pending') newOrd++;
      else if (st === 'cancelled' || st === 'void') cancOrd++;
      else compOrd++;
    }
    const hasServerStats = stats && Number(stats.total_orders) > 0;
    return {
      total_orders: hasServerStats ? stats.total_orders : list.length,
      new_orders: hasServerStats ? stats.new_orders : newOrd,
      completed_orders: hasServerStats ? stats.completed_orders : compOrd,
      cancelled_orders: hasServerStats ? stats.cancelled_orders : cancOrd
    };
  }, [sales, stats]);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Selection & Dropdowns
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [printInvoiceData, setPrintInvoiceData] = useState(null);

  // Modals
  const [selectedSale, setSelectedSale] = useState(null); // View Details Drawer/Modal
  const [statusModalOrder, setStatusModalOrder] = useState(null);
  const [newStatusValue, setNewStatusValue] = useState('Completed');
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const [bulkStatusModalOpen, setBulkStatusModalOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('Completed');
  const [bulkStatusSubmitting, setBulkStatusSubmitting] = useState(false);

  // Edit Sale Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSale, setEditSale] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editPaidAmount, setEditPaidAmount] = useState(0);
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete / Reversal Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSaleId, setDeleteSaleId] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const moreFiltersRef = useRef(null);
  const moreActionsRef = useRef(null);
  const dateRangeRef = useRef(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target)) {
        setMoreFiltersOpen(false);
      }
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target)) {
        setMoreActionsOpen(false);
      }
      if (dateRangeRef.current && !dateRangeRef.current.contains(e.target)) {
        setDatePickerOpen(false);
      }
      if (!e.target.closest('.action-menu-container')) {
        setActionMenuId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadSales = async () => {
    try {
      setLoading(true);
      let query = `/sales?`;
      if (startDate) query += `start_date=${startDate}&`;
      if (endDate) query += `end_date=${endDate}&`;
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (orderStatusFilter !== 'all') query += `order_status=${encodeURIComponent(orderStatusFilter)}&`;
      if (paymentStatusFilter !== 'all') query += `payment_status=${encodeURIComponent(paymentStatusFilter)}&`;
      if (paymentMethodFilter !== 'all') query += `payment_method=${encodeURIComponent(paymentMethodFilter)}&`;

      const res = await api.get(query);
      if (res.success) {
        setSales(res.sales || []);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load orders history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [startDate, endDate, orderStatusFilter, paymentStatusFilter, paymentMethodFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSales();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleClearFilters = () => {
    setSearch('');
    setOrderStatusFilter('all');
    setPaymentStatusFilter('all');
    setPaymentMethodFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const isFilterActive = search || orderStatusFilter !== 'all' || paymentStatusFilter !== 'all' || paymentMethodFilter !== 'all' || startDate || endDate;

  // SadaxCart Date Range Label Formatter
  const getDateRangeLabel = () => {
    if (startDate && endDate) {
      return `${formatDate(startDate)} to ${formatDate(endDate)}`;
    }
    if (startDate) {
      return `From ${formatDate(startDate)}`;
    }
    if (endDate) {
      return `Until ${formatDate(endDate)}`;
    }
    return '01 Jan, 2026 to 31 Dec, 2026';
  };

  // SadaxCart Quick Date Presets
  const setDatePreset = (preset) => {
    const today = new Date();
    const formatYMD = (d) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const d = formatYMD(today);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = formatYMD(y);
      setStartDate(d);
      setEndDate(d);
    } else if (preset === '7days') {
      const s = new Date(today);
      s.setDate(s.getDate() - 7);
      setStartDate(formatYMD(s));
      setEndDate(formatYMD(today));
    } else if (preset === '30days') {
      const s = new Date(today);
      s.setDate(s.getDate() - 30);
      setStartDate(formatYMD(s));
      setEndDate(formatYMD(today));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (preset === 'thisYear') {
      setStartDate(`${today.getFullYear()}-01-01`);
      setEndDate(`${today.getFullYear()}-12-31`);
    }
    setCurrentPage(1);
    setDatePickerOpen(false);
  };

  // SadaxCart 4 Status Variants Mapper matching Image 2
  const getStatusBadgeInfo = (status) => {
    switch (status) {
      case 'Completed':
        return { label: 'Completed', className: 'status-completed-badge' };
      case 'Confirmed':
      case 'Delivered':
      case 'Processing':
      case 'Ready for Delivery':
      case 'Accepted':
        return { label: 'Accepted', className: 'status-accepted-badge' };
      case 'Cancelled':
      case 'Rejected':
        return { label: 'Rejected', className: 'status-rejected-badge' };
      case 'New':
      case 'Pending':
      default:
        return { label: 'Pending', className: 'status-pending-badge' };
    }
  };

  // Row selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedOrders(paginatedSales.map(s => s.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // View Details Modal
  const handleViewOrder = async (id) => {
    try {
      const res = await api.get(`/sales/${id}`);
      if (res.success) {
        setSelectedSale(res);
      }
    } catch (err) {
      alert('Failed to load order details');
    }
  };

  // Print Invoice
  const handlePrintOrder = async (id) => {
    try {
      const res = await api.get(`/sales/${id}`);
      if (res.success) {
        setPrintInvoiceData(res);
      }
    } catch (err) {
      alert('Failed to load invoice for printing');
    }
  };

  // Status Modal Open
  const handleOpenStatusModal = (sale) => {
    setStatusModalOrder(sale);
    setNewStatusValue(sale.order_status || 'Completed');
    setStatusReason('');
    setActionMenuId(null);
  };

  const handleSubmitStatus = async (e) => {
    e.preventDefault();
    if (!statusModalOrder) return;
    try {
      setStatusSubmitting(true);
      const res = await api.patch(`/sales/${statusModalOrder.id}/status`, {
        status: newStatusValue,
        reason: statusReason
      });
      if (res.success) {
        showToast(res.message || `Order #${statusModalOrder.invoice_no} updated!`);
        setStatusModalOrder(null);
        loadSales();
      }
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Record Payment Modal Open
  const handleOpenPaymentModal = (sale) => {
    setPaymentModalOrder(sale);
    setPaymentAmount(String(sale.balance_due || ''));
    setPaymentMethod(sale.payment_method || 'Cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setActionMenuId(null);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!paymentModalOrder) return;
    try {
      setPaymentSubmitting(true);
      const res = await api.post(`/sales/${paymentModalOrder.id}/payment`, {
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        payment_date: paymentDate,
        notes: paymentNotes
      });
      if (res.success) {
        showToast(res.message || 'Payment recorded successfully!');
        setPaymentModalOrder(null);
        loadSales();
      }
    } catch (err) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Bulk Status Update
  const handleBulkStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrders.length) return;
    try {
      setBulkStatusSubmitting(true);
      const res = await api.post('/sales/bulk-status', {
        ids: selectedOrders,
        status: bulkStatusValue
      });
      if (res.success) {
        showToast(res.message || 'Bulk status update completed!');
        setBulkStatusModalOpen(false);
        setSelectedOrders([]);
        loadSales();
      }
    } catch (err) {
      alert(err.message || 'Failed to update selected orders');
    } finally {
      setBulkStatusSubmitting(false);
    }
  };

  // Edit Order Modal
  const handleOpenEdit = async (id) => {
    try {
      const res = await api.get(`/sales/${id}`);
      if (res.success) {
        setEditSale(res.sale);
        setEditItems(res.items.map(i => ({
          id: i.id,
          product_id: i.product_id,
          batch_id: i.batch_id,
          name: i.product_name,
          brand_name: i.brand_name || i.supplier_name,
          unit: i.unit || 'pkt',
          unit_price: Number(i.unit_price) || 0,
          original_quantity: Number(i.quantity),
          quantity: Number(i.quantity),
          discount: Number(i.discount) || 0,
          total_price: Number(i.total_price) || 0
        })));
        setEditDiscount(Number(res.sale.discount) || 0);
        setEditPaidAmount(Number(res.sale.paid_amount) || 0);
        setEditReason('');
        setShowEditModal(true);
      }
    } catch (err) {
      alert('Failed to load invoice for editing');
    }
  };

  const submitEditSale = async () => {
    if (!editSale) return;
    try {
      setEditSubmitting(true);
      const payload = {
        items: editItems.map(i => ({
          id: i.id,
          product_id: i.product_id,
          batch_id: i.batch_id,
          quantity: Number(i.quantity) || 0,
          unit_price: Number(i.unit_price) || 0,
          discount: Number(i.discount) || 0
        })),
        discount: Number(editDiscount) || 0,
        paid_amount: Number(editPaidAmount) || 0,
        reason: editReason
      };

      const res = await api.put(`/sales/${editSale.id}`, payload);
      if (res.success) {
        showToast(`Order ${editSale.invoice_no} updated! Stock & balance updated successfully.`);
        setShowEditModal(false);
        setEditSale(null);
        loadSales();
      }
    } catch (err) {
      alert(err.message || 'Failed to update order');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Cancel / Delete Order
  const handleDeleteSale = async () => {
    if (!deleteSaleId) return;
    try {
      setDeleteSubmitting(true);
      const res = await api.delete(`/sales/${deleteSaleId}`, {
        data: { reason: deleteReason }
      });
      if (res.success) {
        showToast(res.message || 'Order reversed and deleted successfully.');
        setShowDeleteModal(false);
        setDeleteSaleId(null);
        loadSales();
      }
    } catch (err) {
      alert(err.message || 'Failed to cancel/delete order');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const listToExport = selectedOrders.length
      ? sales.filter(s => selectedOrders.includes(s.id))
      : sales;

    if (!listToExport.length) {
      alert('No orders available to export.');
      return;
    }

    exportToCSV('Orders_Management', listToExport, [
      { label: 'Order ID', key: 'invoice_no' },
      { label: 'Order Date', key: 'sale_date' },
      { label: 'Customer', key: 'customer_name', format: (v) => v || 'Counter Walk-in' },
      { label: 'Customer Phone', key: 'customer_phone', format: (v) => v || '-' },
      { label: 'Items Summary', key: 'product_summary', format: (v, r) => v ? `${v} (${r.item_count || 1} items)` : 'Items' },
      { label: 'Sale Type', key: 'sale_type' },
      { label: 'Grand Total (PKR)', key: 'grand_total' },
      { label: 'Paid Amount (PKR)', key: 'paid_amount' },
      { label: 'Balance Due (PKR)', key: 'balance_due' },
      { label: 'Payment Method', key: 'payment_method' },
      { label: 'Payment Status', key: 'calculated_payment_status' },
      { label: 'Order Status', key: 'order_status' },
      { label: 'Cashier / User', key: 'user_name' }
    ]);
  };

  // Print Report of Table
  const handlePrintReport = () => {
    window.print();
  };

  // Pagination slicing
  const totalItems = sales.length;
  const paginatedSales = sales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="orders-page-container" style={{ padding: '0.5rem 0' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0f172a',
          color: '#38bdf8',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 9999,
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. PAGE HEADER (SadaxCart SaaS Design) */}
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
            <span style={{ fontSize: '0.8125rem', color: '#00a389', fontWeight: 600 }}>Orders List</span>
          </nav>
          <h1 className="page-header-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-title)', margin: '0 0 2px 0' }}>
            Orders List
          </h1>
          <p className="page-header-subtitle" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
            Here you can find all of your Orders
          </p>
        </div>

        <div className="page-header-actions">
          {/* + Add Order Button (Solid Teal) */}
          <button
            type="button"
            onClick={() => setTab ? setTab('pos') : null}
            className="btn-sadax-teal"
            title="Create new sales order"
          >
            <Plus size={16} />
            <span>Add Order</span>
          </button>

          {/* More Actions Dropdown */}
          <div className="action-menu-container" ref={moreActionsRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMoreActionsOpen(!moreActionsOpen);
              }}
              className="btn-sadax-white"
            >
              <span>More Actions</span>
              <MoreHorizontal size={15} color="#64748b" />
            </button>

            {moreActionsOpen && (
              <div
                className="dropdown-menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  zIndex: 200,
                  width: '210px',
                  padding: '6px'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    handleExportCSV();
                    setMoreActionsOpen(false);
                  }}
                  className="dropdown-item"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px' }}
                >
                  <FileSpreadsheet size={15} color="#059669" />
                  <span>Export to CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handlePrintReport();
                    setMoreActionsOpen(false);
                  }}
                  className="dropdown-item"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px' }}
                >
                  <Printer size={15} color="#0284c7" />
                  <span>Print Orders Report</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    loadSales();
                    setMoreActionsOpen(false);
                  }}
                  className="dropdown-item"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px' }}
                >
                  <RefreshCw size={15} color="#64748b" />
                  <span>Refresh Orders</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. STATS CARDS ROW (SadaxCart style) */}
      <div className="sadax-stat-card-row">
        <StatCard
          label="Total Orders"
          value={displayStats.total_orders.toLocaleString()}
          trend="up"
          subtitle="Orders in view"
        />
        <StatCard
          label="New Orders"
          value={displayStats.new_orders.toLocaleString()}
          trend="neutral"
          subtitle="New / Pending"
        />
        <StatCard
          label="Completed Orders"
          value={displayStats.completed_orders.toLocaleString()}
          trend="up"
          subtitle="Completed / Settled"
        />
        <StatCard
          label="Cancelled Orders"
          value={displayStats.cancelled_orders.toLocaleString()}
          trend="down"
          subtitle="Cancelled orders"
        />
      </div>

      {/* 3. TABLE CARD WITH SEARCH, FILTERS & CONTROLS */}
      <div className="sadax-table-card">
        {/* Toolbar Row */}
        <div className="sadax-toolbar-row">
          {/* Search Box */}
          <div className="sadax-search-box">
            <Search size={15} className="sadax-search-icon" />
            <input
              type="text"
              placeholder="Search by name, Order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sadax-search-input"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Controls Right */}
          <div className="sadax-toolbar-controls">
            {/* Status Dropdown */}
            <select
              value={orderStatusFilter}
              onChange={(e) => {
                setOrderStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="sadax-select-control"
            >
              <option value="all">All Status</option>
              <option value="New">New</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Processing">Processing</option>
              <option value="Ready for Delivery">Ready for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {/* Unified Date Range Button & Popover */}
            <div className="action-menu-container" ref={dateRangeRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDatePickerOpen(!datePickerOpen);
                }}
                className={`sadax-filter-btn ${(startDate || endDate) ? 'active' : ''}`}
                title="Select date range"
              >
                <Calendar size={14} color={(startDate || endDate) ? '#10b981' : '#6b7280'} />
                <span>{getDateRangeLabel()}</span>
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
                    zIndex: 220,
                    width: '280px',
                    padding: '0.85rem'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.65rem', color: 'var(--text-title)' }}>
                    Date Filter Presets
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '0.85rem' }}>
                    <button
                      type="button"
                      onClick={() => setDatePreset('all')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                    >
                      All Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('today')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('yesterday')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('7days')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('30days')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatePreset('thisMonth')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', height: '28px' }}
                    >
                      This Month
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
                      Custom Date Range
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="form-control"
                        style={{ height: '32px', fontSize: '0.785rem' }}
                        title="Start Date"
                      />
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

            {/* More Filters Toggle */}
            <div className="action-menu-container" ref={moreFiltersRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoreFiltersOpen(!moreFiltersOpen);
                }}
                className={`sadax-filter-btn ${(paymentStatusFilter !== 'all' || paymentMethodFilter !== 'all') ? 'active' : ''}`}
              >
                <Filter size={14} color={(paymentStatusFilter !== 'all' || paymentMethodFilter !== 'all') ? '#10b981' : '#6b7280'} />
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
                      Payment Status
                    </label>
                    <select
                      value={paymentStatusFilter}
                      onChange={(e) => setPaymentStatusFilter(e.target.value)}
                      className="form-control"
                      style={{ height: '32px', fontSize: '0.8rem' }}
                    >
                      <option value="all">All Payment Statuses</option>
                      <option value="Paid">Paid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>
                      Payment Method
                    </label>
                    <select
                      value={paymentMethodFilter}
                      onChange={(e) => setPaymentMethodFilter(e.target.value)}
                      className="form-control"
                      style={{ height: '32px', fontSize: '0.8rem' }}
                    >
                      <option value="all">All Methods</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Online">Online / Digital</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentStatusFilter('all');
                        setPaymentMethodFilter('all');
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

            {/* Clear Filters */}
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

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadSales}
              className="sadax-icon-btn"
              title="Refresh order records"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* 4. ORDERS DATA TABLE (EXACT 6 COLUMNS - NO CHECKBOXES) */}
        <div className="table-responsive" style={{ margin: 0, border: 'none' }}>
          <table className="sadax-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: '240px' }}>Product Name</th>
                <th style={{ minWidth: '200px' }}>Customer Name</th>
                <th style={{ minWidth: '150px' }}>Order Id</th>
                <th style={{ minWidth: '140px' }}>Amount</th>
                <th style={{ minWidth: '130px' }}>Status</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.875rem' }}>
                      <RefreshCw size={18} className="spin" color="#00a389" />
                      <span>Loading orders catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                      <ShoppingBag size={24} />
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>No matching orders found</strong>
                    <p style={{ fontSize: '0.785rem', color: '#64748b', margin: '4px 0 1rem 0' }}>
                      {isFilterActive ? 'Try adjusting your search query, status filters, or date range.' : 'Create your first customer sale order to see it listed here.'}
                    </p>
                    {isFilterActive ? (
                      <button onClick={handleClearFilters} className="btn btn-secondary btn-sm">
                        Clear All Filters
                      </button>
                    ) : (
                      <button onClick={() => setTab && setTab('pos')} className="btn-sadax-teal btn-sm" style={{ height: '32px' }}>
                        + Add Order
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedSales.map((sale) => {
                  const statusInfo = getStatusBadgeInfo(sale.order_status);
                  const customerInitial = (sale.customer_name || 'Walk-in').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={sale.id}
                      style={{
                        height: '72px',
                        borderBottom: '1px solid var(--border)',
                        transition: 'background-color 0.1s ease'
                      }}
                    >
                      {/* Column 1: Product Name */}
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
                            <Package size={16} color="var(--text-muted)" />
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
                            }} title={sale.product_summary || 'Frozen Food Item'}>
                              {sale.product_summary || 'Frozen Food Item(s)'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                              {sale.category_name || (sale.item_count ? `${sale.item_count} Items • General Product` : 'General Product')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Customer Name */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'rgba(5, 150, 105, 0.15)',
                            color: '#34d399',
                            fontSize: '13px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {customerInitial}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sale.customer_name || 'Counter Walk-in'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {sale.customer_phone || (sale.customer_id ? 'Registered Client' : 'Walk-in Retail')}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Order Id */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-title)' }}>
                          #{sale.invoice_no}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {formatDate(sale.sale_date)}
                        </div>
                      </td>

                      {/* Column 4: Amount */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-title)' }}>
                          {formatPKR(sale.grand_total)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: Number(sale.balance_due) > 0 ? '#ef4444' : 'var(--text-muted)',
                          marginTop: '2px',
                          fontWeight: Number(sale.balance_due) > 0 ? 600 : 400
                        }}>
                          {Number(sale.balance_due) > 0
                            ? `Due: ${formatPKR(sale.balance_due)}`
                            : `Paid by ${sale.payment_method || 'Cash'}`}
                        </div>
                      </td>

                      {/* Column 5: Status Badge */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <StatusBadge status={sale.order_status || 'Completed'} />
                      </td>

                      {/* Column 6: Action */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {/* Direct Details Button */}
                          <button
                            type="button"
                            onClick={() => handleViewOrder(sale.id)}
                            className="sadax-action-details"
                            title="View Order Details"
                          >
                            Details
                          </button>

                          {/* Action Dropdown Menu (Portal-based, immune to clipping) */}
                          <ActionMenu
                            title="Order Actions"
                            items={[
                              {
                                label: 'View Details',
                                icon: <Eye size={14} color="#00a389" />,
                                onClick: () => handleViewOrder(sale.id)
                              },
                              {
                                label: 'Update Status',
                                icon: <CheckCircle2 size={14} color="#10b981" />,
                                onClick: () => handleOpenStatusModal(sale)
                              },
                              Number(sale.balance_due) > 0 && {
                                label: 'Record Payment',
                                icon: <CreditCard size={14} color="#059669" />,
                                onClick: () => handleOpenPaymentModal(sale)
                              },
                              {
                                label: 'Print Invoice',
                                icon: <Printer size={14} color="#475569" />,
                                onClick: () => handlePrintOrder(sale.id)
                              },
                              isAdmin && sale.order_status !== 'Cancelled' && {
                                label: 'Edit Order',
                                icon: <Edit3 size={14} color="#f59e0b" />,
                                onClick: () => handleOpenEdit(sale.id)
                              },
                              isAdmin && { divider: true },
                              isAdmin && {
                                label: 'Cancel / Reverse',
                                icon: <Trash2 size={14} color="#dc2626" />,
                                danger: true,
                                onClick: () => {
                                  setDeleteSaleId(sale.id);
                                  setDeleteReason('');
                                  setShowDeleteModal(true);
                                }
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

        {/* 5. PAGINATION CONTROLS (SadaxCart Numbered Pagination) */}
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={(page) => setCurrentPage(page)}
          pageSizeOptions={[10, 15, 25, 50]}
          onPageSizeChange={(newSize) => {
            setItemsPerPage(newSize);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* MODAL 1: VIEW ORDER DETAILS (DRAWER / MODAL) */}
      {selectedSale && (
        <div className="modal-overlay" onClick={() => setSelectedSale(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '640px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0 }}>Order #{selectedSale.sale.invoice_no}</h3>
                  <span className={`status-badge-dot ${ORDER_STATUS_CONFIG[selectedSale.sale.order_status]?.color || 'status-completed'}`}>
                    {selectedSale.sale.order_status || 'Completed'}
                  </span>
                </div>
                <p className="modal-subtitle">
                  Created on {formatDate(selectedSale.sale.sale_date)} • {selectedSale.sale.sale_type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="modal-close-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Customer & Payment Meta Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOMER</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-title)' }}>
                    {selectedSale.sale.customer_name || 'Counter Walk-in Retail'}
                  </div>
                  {selectedSale.sale.customer_phone && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Phone: {selectedSale.sale.customer_phone}
                    </div>
                  )}
                  {selectedSale.sale.customer_address && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Address: {selectedSale.sale.customer_address}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 600 }}>PAYMENT DETAILS</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-title)' }}>
                    Method: {selectedSale.sale.payment_method || 'Cash'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: selectedSale.sale.balance_due > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                    Status: {selectedSale.sale.balance_due > 0 ? `Unpaid Due (₨ ${selectedSale.sale.balance_due})` : 'Settled in Full'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Cashier: {selectedSale.sale.user_name || 'Staff User'}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-title)' }}>
                Ordered Products ({selectedSale.items?.length || 0})
              </div>

              <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-table-head)' }}>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Product</th>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>Qty</th>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>Price</th>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-title)' }}>{it.product_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {it.brand_name || it.supplier_name ? `${it.brand_name || it.supplier_name} • ` : ''}SKU: {it.sku || it.product_id}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-value)' }}>
                          {it.quantity} {it.unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-value)' }}>
                          {formatPKR(it.unit_price)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-title)' }}>
                          {formatPKR(it.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '0.75rem', background: 'var(--hover-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <span>Subtotal:</span>
                  <span style={{ color: 'var(--text-value)' }}>{formatPKR(selectedSale.sale.subtotal)}</span>
                </div>
                {Number(selectedSale.sale.discount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#ef4444' }}>
                    <span>Discount:</span>
                    <span>-{formatPKR(selectedSale.sale.discount)}</span>
                  </div>
                )}
                {Number(selectedSale.sale.tax) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    <span>Tax:</span>
                    <span style={{ color: 'var(--text-value)' }}>+{formatPKR(selectedSale.sale.tax)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-title)', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '3px' }}>
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--primary)' }}>{formatPKR(selectedSale.sale.grand_total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#10b981', fontWeight: 600 }}>
                  <span>Paid Amount:</span>
                  <span>{formatPKR(selectedSale.sale.paid_amount)}</span>
                </div>
                {Number(selectedSale.sale.balance_due) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444', fontWeight: 700 }}>
                    <span>Outstanding Due:</span>
                    <span>{formatPKR(selectedSale.sale.balance_due)}</span>
                  </div>
                )}
              </div>

              {selectedSale.sale.notes && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.785rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Notes: {selectedSale.sale.notes}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => {
                  setPrintInvoiceData(selectedSale);
                  setSelectedSale(null);
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={14} />
                <span>Print Invoice</span>
              </button>

              <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenStatusModal(selectedSale.sale);
                    setSelectedSale(null);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Update Status
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSale(null)}
                  className="btn btn-primary btn-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: UPDATE ORDER STATUS */}
      {statusModalOrder && (
        <div className="modal-overlay" onClick={() => setStatusModalOrder(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitStatus}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>Update Status</h3>
                  <p className="modal-subtitle">Order #{statusModalOrder.invoice_no}</p>
                </div>
                <button type="button" onClick={() => setStatusModalOrder(null)} className="modal-close-btn">
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Status
                  </label>
                  <select
                    value={newStatusValue}
                    onChange={(e) => setNewStatusValue(e.target.value)}
                    className="form-control"
                    style={{ height: '38px', fontSize: '0.85rem' }}
                  >
                    <option value="New">New (Awaiting)</option>
                    <option value="Pending">Pending (On Hold)</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Processing">Processing</option>
                    <option value="Ready for Delivery">Ready for Delivery</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Completed">Completed (Fulfilled)</option>
                    <option value="Cancelled">Cancelled (Revert Stock & Balance)</option>
                  </select>
                </div>

                {newStatusValue === 'Cancelled' && (
                  <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.75rem', color: '#b91c1c' }}>
                    <strong>Warning:</strong> Changing status to Cancelled will automatically return all ordered quantities back to active inventory batches and reverse customer credit balances.
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dispatched via delivery van #2"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setStatusModalOrder(null)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={statusSubmitting} className="btn btn-primary btn-sm">
                  {statusSubmitting ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD PAYMENT */}
      {paymentModalOrder && (
        <div className="modal-overlay" onClick={() => setPaymentModalOrder(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitPayment}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>Record Order Payment</h3>
                  <p className="modal-subtitle">Order #{paymentModalOrder.invoice_no}</p>
                </div>
                <button type="button" onClick={() => setPaymentModalOrder(null)} className="modal-close-btn">
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <div style={{ padding: '0.75rem', background: '#eff6ff', border: '1px solid #bae6fd', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 600 }}>OUTSTANDING DUE</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7' }}>
                      {formatPKR(paymentModalOrder.balance_due)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                    Total: {formatPKR(paymentModalOrder.grand_total)}<br />
                    Paid: {formatPKR(paymentModalOrder.paid_amount)}
                  </div>
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Payment Amount (PKR) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    max={paymentModalOrder.balance_due}
                    min="1"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="form-control"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online / Digital</option>
                  </select>
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="form-control"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Note / Ref No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Received counter cash from customer"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setPaymentModalOrder(null)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={paymentSubmitting} className="btn btn-primary btn-sm">
                  {paymentSubmitting ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: BULK STATUS UPDATE */}
      {bulkStatusModalOpen && (
        <div className="modal-overlay" onClick={() => setBulkStatusModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleBulkStatusSubmit}>
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>Update Status</h3>
                  <p className="modal-subtitle">Applying to {selectedOrders.length} selected orders</p>
                </div>
                <button type="button" onClick={() => setBulkStatusModalOpen(false)} className="modal-close-btn">
                  <X size={16} />
                </button>
              </div>

              <div className="modal-body">
                <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Status
                </label>
                <select
                  value={bulkStatusValue}
                  onChange={(e) => setBulkStatusValue(e.target.value)}
                  className="form-control"
                  style={{ height: '38px', fontSize: '0.85rem' }}
                >
                  <option value="Confirmed">Confirmed</option>
                  <option value="Processing">Processing</option>
                  <option value="Ready for Delivery">Ready for Delivery</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setBulkStatusModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={bulkStatusSubmitting} className="btn btn-primary btn-sm">
                  {bulkStatusSubmitting ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE / CANCEL ORDER CONFIRMATION */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={18} />
                <span>Confirm Order Cancellation</span>
              </h3>
              <button type="button" onClick={() => setShowDeleteModal(false)} className="modal-close-btn">
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.45, margin: '0 0 1rem 0' }}>
                Are you sure you want to cancel and reverse this sale order? All item quantities will be restored to their original warehouse batches, payments will be unlinked, and any credit customer balance will be adjusted.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Cancellation Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer cancelled order / Wrong entry"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="btn btn-secondary btn-sm">
                Go Back
              </button>
              <button
                type="button"
                disabled={deleteSubmitting || !deleteReason.trim()}
                onClick={handleDeleteSale}
                className="btn btn-danger btn-sm"
              >
                {deleteSubmitting ? 'Reversing...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: EDIT SALE ORDER (ADMIN ONLY) */}
      {showEditModal && editSale && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Edit Order #{editSale.invoice_no}</h3>
                <p className="modal-subtitle">Update line quantities, rates, and discounts</p>
              </div>
              <button type="button" onClick={() => setShowEditModal(false)} className="modal-close-btn">
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '1rem' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-table-head)' }}>
                      <th style={{ padding: '8px', color: 'var(--text-muted)' }}>Product</th>
                      <th style={{ padding: '8px', width: '90px', color: 'var(--text-muted)' }}>Quantity</th>
                      <th style={{ padding: '8px', width: '100px', color: 'var(--text-muted)' }}>Rate</th>
                      <th style={{ padding: '8px', width: '90px', color: 'var(--text-muted)' }}>Disc</th>
                      <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '8px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{item.name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Orig: {item.original_quantity} {item.unit}</div>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setEditItems(editItems.map((it, i) => i === idx ? {
                                ...it,
                                quantity: val,
                                total_price: Math.max(0, (val * it.unit_price) - it.discount)
                              } : it));
                            }}
                            className="form-control"
                            style={{ height: '30px', padding: '2px 6px', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="number"
                            step="any"
                            value={item.unit_price}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setEditItems(editItems.map((it, i) => i === idx ? {
                                ...it,
                                unit_price: val,
                                total_price: Math.max(0, (it.quantity * val) - it.discount)
                              } : it));
                            }}
                            className="form-control"
                            style={{ height: '30px', padding: '2px 6px', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="number"
                            step="any"
                            value={item.discount}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setEditItems(editItems.map((it, i) => i === idx ? {
                                ...it,
                                discount: val,
                                total_price: Math.max(0, (it.quantity * it.unit_price) - val)
                              } : it));
                            }}
                            className="form-control"
                            style={{ height: '30px', padding: '2px 6px', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem' }}>
                          {formatPKR(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Order Discount (PKR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Paid Amount (PKR)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.785rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Edit Audit Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corrected weight after customer confirmation"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={editSubmitting || !editReason.trim()}
                onClick={submitEditSale}
                className="btn btn-primary btn-sm"
              >
                {editSubmitting ? 'Saving Changes...' : 'Save Order Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT INVOICE MODAL */}
      {printInvoiceData && (
        <PrintInvoiceModal
          sale={printInvoiceData.sale || printInvoiceData}
          items={printInvoiceData.items || []}
          settings={printInvoiceData.settings || {}}
          onClose={() => setPrintInvoiceData(null)}
        />
      )}
    </div>
  );
}
