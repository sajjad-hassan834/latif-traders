import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Eye, ArrowDownToLine, Trash2, RotateCcw, Printer, Download, Package, Edit, ChevronDown, FileText, ArrowUpRight, X, Filter, Calendar, CheckCircle2 } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/common/SearchableSelect';
import Pagination from '../components/common/Pagination';
import ActionMenu from '../components/common/ActionMenu';
import CustomDatePicker from '../components/common/CustomDatePicker';

const getDateRangeForPreset = (preset) => {
  const now = new Date();
  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (preset === 'today') {
    const today = toYMD(now);
    return { date_from: today, date_to: today };
  } else if (preset === 'this_week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return { date_from: toYMD(monday), date_to: toYMD(now) };
  } else if (preset === 'this_month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { date_from: toYMD(firstDay), date_to: toYMD(now) };
  }
  return { date_from: '', date_to: '' };
};

export default function Purchases() {
  const { canManageInventory } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const ITEMS_PER_PAGE = 15;

  // Initial params parsed from URL query
  const initialParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      search: params.get('search') || '',
      supplier_id: params.get('supplier_id') || 'all',
      date_preset: params.get('date_preset') || 'all',
      date_from: params.get('date_from') || '',
      date_to: params.get('date_to') || '',
      payment_status: params.get('payment_status') || 'all',
      page: parseInt(params.get('page') || '1', 10) || 1
    };
  }, []);

  // Filter & Search states (persisted in URL)
  const [searchTerm, setSearchTerm] = useState(initialParams.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialParams.search);
  const [filterSupplier, setFilterSupplier] = useState(initialParams.supplier_id);
  const [datePreset, setDatePreset] = useState(initialParams.date_preset);
  const [dateFrom, setDateFrom] = useState(initialParams.date_from);
  const [dateTo, setDateTo] = useState(initialParams.date_to);
  const [paymentStatus, setPaymentStatus] = useState(initialParams.payment_status);
  const [currentPage, setCurrentPage] = useState(initialParams.page);
  const [totalPurchases, setTotalPurchases] = useState(0);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Edit Purchase Form
  const [editForm, setEditForm] = useState(null);

  // New Purchase Form
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [brands, setBrands] = useState([]);
  const [activeStockPreview, setActiveStockPreview] = useState(null);

  // Staging product configuration
  const [stagedProductId, setStagedProductId] = useState('');
  const [stageQty, setStageQty] = useState('10');
  const [stagePurchasePrice, setStagePurchasePrice] = useState('');
  const [stageSalePrice, setStageSalePrice] = useState('');
  const [stageWholesalePrice, setStageWholesalePrice] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(true);
  const [lastAddedItemName, setLastAddedItemName] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Synchronize state to URL query string
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filterSupplier && filterSupplier !== 'all') params.set('supplier_id', filterSupplier);
    if (datePreset && datePreset !== 'all') params.set('date_preset', datePreset);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (paymentStatus && paymentStatus !== 'all') params.set('payment_status', paymentStatus);
    if (currentPage > 1) params.set('page', String(currentPage));

    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [debouncedSearch, filterSupplier, datePreset, dateFrom, dateTo, paymentStatus, currentPage]);

  const generateAutoBillNo = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `BILL-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}-${Date.now().toString().slice(-3)}`;
  };

  const openNewPurchaseModal = () => {
    setSupplierInvoiceNo(generateAutoBillNo());
    setSupplierId('');
    setItems([]);
    setPaidAmount('');
    setNotes('');
    setErrorMsg('');
    setActiveStockPreview(null);
    setStagedProductId('');
    setLastAddedItemName('');
    setShowNewModal(true);
  };

  const loadSuppliersAndProducts = async () => {
    try {
      const [supRes, prodRes, brandRes] = await Promise.all([
        api.get('/parties/suppliers'),
        api.get('/products'),
        api.get('/products/meta/brands').catch(() => ({ success: false, brands: [] }))
      ]);

      if (supRes.success) setSuppliers(supRes.suppliers);
      if (prodRes.success) setProducts(prodRes.products);
      if (brandRes?.success) setBrands(brandRes.brands);
    } catch (err) {
      console.error('Failed to load suppliers/products:', err);
    }
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (debouncedSearch) queryParams.set('search', debouncedSearch);
      if (filterSupplier && filterSupplier !== 'all') queryParams.set('supplier_id', filterSupplier);
      if (dateFrom) queryParams.set('date_from', dateFrom);
      if (dateTo) queryParams.set('date_to', dateTo);
      if (paymentStatus && paymentStatus !== 'all') queryParams.set('payment_status', paymentStatus);
      queryParams.set('page', String(currentPage));
      queryParams.set('limit', String(ITEMS_PER_PAGE));

      const res = await api.get(`/purchases?${queryParams.toString()}`);
      if (res.success) {
        setPurchases(res.purchases || []);
        setTotalPurchases(res.total !== undefined ? res.total : (res.purchases?.length || 0));
      }
    } catch (err) {
      console.error('Failed to fetch purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadData = () => {
    loadSuppliersAndProducts();
    fetchPurchases();
  };

  useEffect(() => {
    loadSuppliersAndProducts();
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [debouncedSearch, filterSupplier, dateFrom, dateTo, paymentStatus, currentPage]);

  const handleDatePresetClick = (preset) => {
    setDatePreset(preset);
    setCurrentPage(1);
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else {
      const { date_from, date_to } = getDateRangeForPreset(preset);
      setDateFrom(date_from);
      setDateTo(date_to);
    }
  };

  const isFiltered = Boolean(
    debouncedSearch ||
    (filterSupplier && filterSupplier !== 'all') ||
    (datePreset && datePreset !== 'all') ||
    dateFrom ||
    dateTo ||
    (paymentStatus && paymentStatus !== 'all')
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setFilterSupplier('all');
    setDatePreset('all');
    setDateFrom('');
    setDateTo('');
    setPaymentStatus('all');
    setCurrentPage(1);
  };

  const loadStockPreview = async (productId) => {
    try {
      const res = await api.get(`/purchases/product-stock-preview/${productId}`);
      if (res.success) {
        setActiveStockPreview(res);
      }
    } catch (err) {
      console.error('Failed to load stock preview:', err);
    }
  };

  const handleSelectProduct = (productId) => {
    setStagedProductId(productId);
    const prod = products.find(p => p.id === Number(productId));
    if (prod) {
      setStageQty('10');
      setStagePurchasePrice(prod.purchase_price !== undefined && prod.purchase_price !== null ? String(prod.purchase_price) : '0');
      setStageSalePrice(prod.sale_price !== undefined && prod.sale_price !== null ? String(prod.sale_price) : '0');
      setStageWholesalePrice(prod.wholesale_price !== undefined && prod.wholesale_price !== null ? String(prod.wholesale_price) : String(prod.sale_price || 0));
      loadStockPreview(prod.id);
    }
  };

  const handleAddStagedItem = () => {
    const prod = products.find(p => p.id === Number(stagedProductId));
    if (!prod) return;

    const qty = Number(stageQty) || 1;
    const cost = Number(stagePurchasePrice) || 0;
    const sPrice = Number(stageSalePrice) || 0;
    const wPrice = Number(stageWholesalePrice) || sPrice || 0;

    const existingIndex = items.findIndex(it => it.product_id === prod.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity = Number(updated[existingIndex].quantity) + qty;
      updated[existingIndex].unit_price = cost;
      updated[existingIndex].sale_price = sPrice;
      updated[existingIndex].wholesale_price = wPrice;
      setItems(updated);
    } else {
      setItems([...items, {
        product_id: prod.id,
        name: prod.name,
        brand: prod.brand || '',
        unit: prod.unit || 'pkt',
        batch_no: `LOT-${Date.now().toString().slice(-5)}`,
        expiry_date: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        quantity: qty,
        unit_price: cost,
        wholesale_price: wPrice,
        sale_price: sPrice,
        discount: 0
      }]);
    }

    setLastAddedItemName(prod.name);
    setStagedProductId('');
    setStageQty('10');
    setStagePurchasePrice('');
    setStageSalePrice('');
    setStageWholesalePrice('');
    setActiveStockPreview(null);
  };

  const addItemToBill = (productId) => {
    const prod = products.find(p => p.id === Number(productId));
    if (!prod) return;

    setItems([...items, {
      product_id: prod.id,
      name: prod.name,
      brand: prod.brand || '',
      unit: prod.unit || 'pkt',
      batch_no: `LOT-${Date.now().toString().slice(-5)}`,
      expiry_date: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      quantity: 10,
      unit_price: prod.purchase_price || 0,
      wholesale_price: prod.wholesale_price || 0,
      sale_price: prod.sale_price || 0,
      discount: 0
    }]);

    loadStockPreview(prod.id);
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unit_price)) - (Number(it.discount) || 0), 0);
  const grandTotal = Math.max(0, subtotal - (Number(discount) || 0));

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!supplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Please add at least one product item.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/purchases', {
        supplier_id: Number(supplierId),
        supplier_invoice_no: supplierInvoiceNo.trim(),
        purchase_date: purchaseDate,
        items,
        discount: Number(discount) || 0,
        paid_amount: paidAmount === '' ? grandTotal : Number(paidAmount),
        payment_method: paymentMethod,
        notes: notes.trim()
      });

      if (res.success) {
        setShowNewModal(false);
        setItems([]);
        setSupplierInvoiceNo('');
        setPaidAmount('');
        setNotes('');
        loadData();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  const viewPurchase = async (id) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      if (res.success) {
        setSelectedPurchase(res);
        setShowDetailModal(true);
      }
    } catch (err) {
      alert('Failed to load purchase details');
    }
  };

  const openReturnModal = async (id) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      if (res.success) {
        setReturnPurchase(res.purchase);
        setReturnItems(res.items.map(it => ({
          product_id: it.product_id,
          batch_id: it.batch_id || null,
          product_name: it.product_name,
          batch_no: it.batch_no || '-',
          purchased_qty: it.quantity,
          unit: it.unit,
          unit_price: it.unit_price,
          return_qty: 0,
          condition: 'DEFECTIVE'
        })));
        setReturnReason('');
        setShowReturnModal(true);
      }
    } catch (err) {
      alert('Failed to load purchase items for return');
    }
  };

  const handleReturnItemChange = (index, field, value) => {
    const updated = [...returnItems];
    updated[index][field] = value;
    setReturnItems(updated);
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    const activeReturns = returnItems.filter(it => Number(it.return_qty) > 0);
    if (activeReturns.length === 0) {
      alert('Please enter a return quantity greater than 0 for at least one item.');
      return;
    }

    // Validate return qty does not exceed purchased qty
    for (const it of activeReturns) {
      if (Number(it.return_qty) > it.purchased_qty) {
        alert(`Cannot return more than purchased quantity (${it.purchased_qty}) for ${it.product_name}`);
        return;
      }
    }

    try {
      setReturnSubmitting(true);
      const payload = {
        original_purchase_id: returnPurchase.id,
        reason: returnReason.trim() || 'Supplier return',
        items: activeReturns.map(it => ({
          product_id: it.product_id,
          batch_id: it.batch_id,
          quantity: Number(it.return_qty),
          unit_price: Number(it.unit_price),
          condition: it.condition
        }))
      };

      const res = await api.post('/purchases/returns', payload);
      if (res.success) {
        alert(`Purchase return recorded successfully! Ref: ${res.data.return_no}`);
        setShowReturnModal(false);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to submit purchase return');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleExportPurchases = () => {
    exportToCSV('Latif_Traders_Purchases', purchases, [
      { label: 'Invoice No', key: 'invoice_no' },
      { label: 'Supplier Bill #', key: 'supplier_invoice_no' },
      { label: 'Date', key: 'purchase_date' },
      { label: 'Supplier Name', key: 'supplier_name' },
      { label: 'Items Count', key: 'item_count' },
      { label: 'Grand Total (PKR)', key: 'grand_total' },
      { label: 'Paid (PKR)', key: 'paid_amount' },
      { label: 'Payable Due (PKR)', key: 'balance_due' },
      { label: 'Payment Method', key: 'payment_method' }
    ]);
  };

  const openEditModal = async (id) => {
    try {
      const res = await api.get(`/purchases/${id}`);
      if (res.success) {
        setEditForm({
          id: res.purchase.id,
          invoice_no: res.purchase.invoice_no,
          supplier_id: res.purchase.supplier_id,
          supplier_invoice_no: res.purchase.supplier_invoice_no || '',
          purchase_date: res.purchase.purchase_date,
          grand_total: res.purchase.grand_total,
          paid_amount: res.purchase.paid_amount,
          balance_due: res.purchase.balance_due,
          payment_method: res.purchase.payment_method || 'Cash',
          notes: res.purchase.notes || ''
        });
        setShowEditModal(true);
      }
    } catch (err) {
      alert('Failed to load purchase for editing');
    }
  };

  const handleUpdatePurchase = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/purchases/${editForm.id}`, {
        supplier_id: Number(editForm.supplier_id),
        supplier_invoice_no: editForm.supplier_invoice_no,
        purchase_date: editForm.purchase_date,
        paid_amount: Number(editForm.paid_amount) || 0,
        payment_method: editForm.payment_method,
        notes: editForm.notes
      });
      if (res.success) {
        setShowEditModal(false);
        setEditForm(null);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to update purchase');
    }
  };

  const handleDeletePurchase = async () => {
    if (!selectedPurchase) return;
    try {
      const res = await api.delete(`/purchases/${selectedPurchase.id}`);
      if (res.success) {
        setShowDeleteModal(false);
        setSelectedPurchase(null);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete purchase');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* PAGE HEADER */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-title)', margin: 0 }}>Purchases</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Manage supplier purchase bills, incoming inventory shipments, and payable settlements.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={handleExportPurchases} className="btn btn-secondary btn-sm" title="Export Purchases to CSV">
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          {canManageInventory && (
            <button onClick={openNewPurchaseModal} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>New Purchase Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search bill #, supplier, or product name/SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                onClick={() => { setSearchTerm(''); setDebouncedSearch(''); setCurrentPage(1); }}
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

          {/* Supplier Dropdown */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={filterSupplier}
              onChange={(e) => { setFilterSupplier(e.target.value); setCurrentPage(1); }}
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
              <option value="all">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Payment Status Dropdown */}
          <div style={{ minWidth: '150px' }}>
            <select
              value={paymentStatus}
              onChange={(e) => { setPaymentStatus(e.target.value); setCurrentPage(1); }}
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
              <option value="all">All Statuses</option>
              <option value="PAID">Paid / Settled</option>
              <option value="PARTIAL">Partial Due</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>
        </div>

        {/* Date Presets and Custom Range */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>Date:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'custom', label: 'Custom' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePresetClick(p.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: datePreset === p.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: datePreset === p.id ? 'var(--primary)' : 'var(--bg-card)',
                  color: datePreset === p.id ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ width: '145px' }}>
              <CustomDatePicker
                value={dateFrom}
                onChange={(d) => { setDateFrom(d); setDatePreset('custom'); setCurrentPage(1); }}
                placeholder="From date"
                allowClear
              />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
            <div style={{ width: '145px' }}>
              <CustomDatePicker
                value={dateTo}
                onChange={(d) => { setDateTo(d); setDatePreset('custom'); setCurrentPage(1); }}
                placeholder="To date"
                allowClear
              />
            </div>
          </div>
        </div>

        {/* Active Filters Bar & Count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text-title)' }}>{purchases.length}</strong> of <strong style={{ color: 'var(--text-title)' }}>{totalPurchases}</strong> purchases
            </span>

            {debouncedSearch && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-value)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                Search: "{debouncedSearch}"
                <button type="button" onClick={() => { setSearchTerm(''); setDebouncedSearch(''); setCurrentPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>✕</button>
              </span>
            )}

            {filterSupplier !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-value)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                Supplier: {suppliers.find(s => String(s.id) === String(filterSupplier))?.name || filterSupplier}
                <button type="button" onClick={() => { setFilterSupplier('all'); setCurrentPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>✕</button>
              </span>
            )}

            {paymentStatus !== 'all' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-value)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                Status: {paymentStatus}
                <button type="button" onClick={() => { setPaymentStatus('all'); setCurrentPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>✕</button>
              </span>
            )}

            {(dateFrom || dateTo || (datePreset !== 'all' && datePreset !== 'custom')) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-value)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}>
                Date: {datePreset !== 'all' && datePreset !== 'custom' ? datePreset.replace('_', ' ') : `${dateFrom || 'start'} to ${dateTo || 'now'}`}
                <button type="button" onClick={() => { setDatePreset('all'); setDateFrom(''); setDateTo(''); setCurrentPage(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>✕</button>
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

      {/* PURCHASES LIST */}
      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div className="table-responsive" style={{ paddingBottom: '110px', overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '720px' }}>
            <thead>
              <tr>
                <th>Invoice / Bill #</th>
                <th>Date</th>
                <th>Supplier Name</th>
                <th>Items</th>
                <th style={{ textAlign: 'right' }}>Grand Total</th>
                <th style={{ textAlign: 'right' }}>Paid Amount</th>
                <th style={{ textAlign: 'right' }}>Payable Due</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading purchases...</span>
                    </div>
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    {isFiltered ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <Search size={24} />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-title)' }}>No purchases match your filters</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '380px' }}>
                          Try adjusting your search terms, date range, or supplier filters.
                        </div>
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: '6px' }}
                        >
                          Clear All Filters
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <Package size={24} />
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-title)' }}>No purchases recorded yet</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '380px' }}>
                          Record your first supplier purchase bill to start tracking incoming inventory and payables.
                        </div>
                        {canManageInventory && (
                          <button
                            type="button"
                            onClick={openNewPurchaseModal}
                            className="btn btn-primary btn-sm"
                            style={{ marginTop: '6px' }}
                          >
                            <Plus size={14} />
                            <span>New Purchase Bill</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                purchases.map(p => {
                  const netTotal = p.grand_total - (p.returned_amount || 0);
                  const isFullyReturned = netTotal <= 0 && p.returned_amount > 0;
                  
                  return (
                  <tr key={p.id} style={{ opacity: isFullyReturned ? 0.6 : 1 }}>
                    <td style={{ verticalAlign: 'middle' }}>
                      <div className="mono" style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '13px' }}>
                        {p.invoice_no}
                      </div>
                      {p.supplier_invoice_no && (
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Bill: {p.supplier_invoice_no}
                        </div>
                      )}
                      {p.returned_amount > 0 && (
                        <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: '2px', fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: '4px', display: 'inline-block' }}>
                          {isFullyReturned ? 'FULLY RETURNED' : 'PARTIAL RETURN'}
                        </div>
                      )}
                    </td>
                    <td>{formatDate(p.purchase_date)}</td>
                    <td style={{ fontWeight: 600 }}>{p.supplier_name}</td>
                    <td>{p.item_count} items</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {p.returned_amount > 0 ? (
                        <>
                          <div style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.75rem' }}>{formatPKR(p.grand_total)}</div>
                          <div>{formatPKR(netTotal)}</div>
                        </>
                      ) : (
                        formatPKR(p.grand_total)
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatPKR(p.paid_amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {isFullyReturned ? (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Returned</span>
                      ) : p.balance_due > 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatPKR(p.balance_due)}</span>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Settled</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => viewPurchase(p.id)}
                          className="btn-table-action"
                          title="View Purchase Details"
                        >
                          <span>Details</span>
                          <ArrowUpRight size={13} />
                        </button>

                        <ActionMenu
                          title="Purchase Actions"
                          items={[
                            {
                              label: 'View Bill',
                              icon: <Eye size={14} color="#0284c7" />,
                              onClick: () => viewPurchase(p.id)
                            },
                            canManageInventory && !isFullyReturned && {
                              label: 'Return Goods',
                              icon: <RotateCcw size={14} color="#f59e0b" />,
                              onClick: () => openReturnModal(p.id)
                            },
                            canManageInventory && {
                              label: 'Edit Purchase',
                              icon: <Edit size={14} color="#0284c7" />,
                              onClick: () => openEditModal(p.id)
                            },
                            canManageInventory && { divider: true },
                            canManageInventory && {
                              label: 'Delete Purchase',
                              icon: <Trash2 size={14} color="#dc2626" />,
                              danger: true,
                              onClick: () => {
                                setSelectedPurchase(p);
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
        <Pagination
          currentPage={currentPage}
          totalItems={totalPurchases}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* NEW PURCHASE BILL MODAL */}
      {showNewModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '920px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>Create Purchase Shipment</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Record new incoming supplier stock, batch lots, and payable settlement.
                </div>
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

            {errorMsg && (
              <div style={{ margin: '1rem 1.5rem 0', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleSavePurchase}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Supplier *</label>
                    <SearchableSelect
                      options={suppliers.map(s => ({ value: s.id, label: `${s.name} (Payable: ₨ ${s.current_balance})` }))}
                      value={supplierId}
                      onChange={(val) => setSupplierId(val)}
                      placeholder="-- Choose Supplier --"
                    />
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="form-label" style={{ margin: 0 }}>Supplier Bill #</label>
                      <span style={{ fontSize: '0.68rem', color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        ⚡ Auto-Generated
                      </span>
                    </div>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Auto: BILL-YYYYMMDD-XXXX"
                      value={supplierInvoiceNo}
                      onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    />
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                      Auto-assigned to prevent human errors or duplicates.
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Purchase Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* ADD PRODUCT TO BILL WITH PRICING CONTROLS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--hover-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label className="form-label" style={{ fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>
                      Add Products to This Bill *
                    </label>
                    <label style={{ fontSize: '0.75rem', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={showAllProducts}
                        onChange={(e) => setShowAllProducts(e.target.checked)}
                      />
                      <span>Show all inventory products (not only supplier linked)</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 320px' }}>
                      <SearchableSelect
                        options={products
                          .filter(p => {
                            if (showAllProducts) return true;
                            return !supplierId || String(p.supplier_id) === String(supplierId) || p.supplier_id === null;
                          })
                          .sort((a, b) => {
                            const aIsSupplier = supplierId && String(a.supplier_id) === String(supplierId);
                            const bIsSupplier = supplierId && String(b.supplier_id) === String(supplierId);
                            if (aIsSupplier && !bIsSupplier) return -1;
                            if (!aIsSupplier && bIsSupplier) return 1;
                            return a.name.localeCompare(b.name);
                          })
                          .map(p => {
                            const isLinked = supplierId && String(p.supplier_id) === String(supplierId);
                            return {
                              value: p.id,
                              label: `${isLinked ? '★ ' : ''}${p.name} ${p.brand ? `[${p.brand}]` : ''}${isLinked ? ' (Supplier Linked)' : ''}`
                            };
                          })}
                        value={stagedProductId}
                        onChange={(val) => {
                          if (val) handleSelectProduct(val);
                        }}
                        placeholder="-- Choose Product to Add to Bill --"
                      />
                    </div>
                  </div>

                  {/* SUCCESS FLASH WHEN ITEM IS ADDED */}
                  {lastAddedItemName && !stagedProductId && (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>✅ Added <strong>"{lastAddedItemName}"</strong> to this bill! You can pick another product from the dropdown above to add more items.</span>
                      <button type="button" onClick={() => setLastAddedItemName('')} style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>✕</button>
                    </div>
                  )}

                  {/* STAGED PRODUCT PRICING CONFIGURATION */}
                  {stagedProductId && (() => {
                    const selectedProd = products.find(p => p.id === Number(stagedProductId));
                    return (
                      <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '8px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <strong style={{ color: '#166534', fontSize: '0.875rem' }}>
                            Configure Prices & Quantity for This Product
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
                            {selectedProd?.name} ({selectedProd?.unit || 'pkt'})
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', alignItems: 'flex-end' }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                              Quantity ({selectedProd?.unit || 'pkt'}) *
                            </label>
                            <input
                              type="number"
                              className="form-control"
                              style={{ height: '36px', fontSize: '0.85rem', fontWeight: 600 }}
                              min="0.1"
                              step="any"
                              value={stageQty}
                              onChange={(e) => setStageQty(e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', display: 'block', marginBottom: '3px' }}>
                              Purchase Cost (₨) *
                            </label>
                            <input
                              type="number"
                              className="form-control"
                              style={{ height: '36px', fontSize: '0.85rem', fontWeight: 700, borderColor: '#38bdf8' }}
                              min="0"
                              step="any"
                              value={stagePurchasePrice}
                              onChange={(e) => setStagePurchasePrice(e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', display: 'block', marginBottom: '3px' }}>
                              Retail Sale Price (₨) *
                            </label>
                            <input
                              type="number"
                              className="form-control"
                              style={{ height: '36px', fontSize: '0.85rem', fontWeight: 700, borderColor: '#4ade80' }}
                              min="0"
                              step="any"
                              value={stageSalePrice}
                              onChange={(e) => setStageSalePrice(e.target.value)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                              Wholesale Price (₨)
                            </label>
                            <input
                              type="number"
                              className="form-control"
                              style={{ height: '36px', fontSize: '0.85rem' }}
                              min="0"
                              step="any"
                              value={stageWholesalePrice}
                              onChange={(e) => setStageWholesalePrice(e.target.value)}
                            />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={handleAddStagedItem}
                              className="btn btn-primary btn-sm"
                              style={{ height: '36px', width: '100%', fontWeight: 700, background: '#16a34a', borderColor: '#15803d' }}
                            >
                              + Add to Bill
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* COMPACT STOCK PREVIEW */}
                  {activeStockPreview && (
                    <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package size={15} color="#0284c7" />
                        <span style={{ color: '#0369a1', fontWeight: 600 }}>{activeStockPreview.product?.name}</span>
                        <span style={{ color: '#64748b' }}>• Total In-Stock: <strong style={{ color: '#0284c7' }}>{activeStockPreview.current_stock} {activeStockPreview.product?.unit}</strong></span>
                      </div>
                      {activeStockPreview.batches?.length > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                          Active Batches: {activeStockPreview.batches.slice(0, 3).map(b => `${b.batch_no} (₨${b.purchase_price})`).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* LINE ITEMS TABLE HEADER & NOTIFICATION */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-title)' }}>
                      📦 Products In This Shipment ({items.length})
                    </div>
                    {items.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        Bill Total: {formatPKR(grandTotal)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                    💡 You can add multiple supplier products here into a single bill before saving
                  </div>
                </div>

                {/* LINE ITEMS TABLE */}
                <div className="table-responsive" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <table className="table" style={{ width: '100%', minWidth: '780px' }}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '150px' }}>Product</th>
                        <th style={{ minWidth: '100px' }}>Brand</th>
                        <th style={{ minWidth: '75px' }}>Unit</th>
                        <th style={{ width: '85px' }}>Quantity</th>
                        <th style={{ width: '115px', color: '#0369a1' }}>Purchase Cost (₨)</th>
                        <th style={{ width: '115px', color: '#15803d' }}>Retail Sale (₨)</th>
                        <th style={{ width: '105px', color: '#475569' }}>Wholesale (₨)</th>
                        <th>Batch / Lot #</th>
                        <th>Expiry Date</th>
                        <th style={{ textAlign: 'right' }}>Total (PKR)</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr><td colSpan="11" style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>No products added to bill yet. Select a product from the dropdown above to add multiple items to this bill.</td></tr>
                      ) : (
                        items.map((it, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>
                              <button
                                type="button"
                                onClick={() => loadStockPreview(it.product_id)}
                                style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}
                                title="Click to view existing stock & batches"
                              >
                                {it.name}
                              </button>
                            </td>
                            <td>
                              <input
                                type="text"
                                list={`brands-list-${idx}`}
                                className="form-control"
                                style={{ padding: '3px 6px', fontSize: '0.775rem' }}
                                placeholder="Brand"
                                value={it.brand || ''}
                                onChange={(e) => updateItem(idx, 'brand', e.target.value)}
                              />
                              <datalist id={`brands-list-${idx}`}>
                                {brands.map(b => (
                                  <option key={b.id} value={b.name} />
                                ))}
                              </datalist>
                            </td>
                            <td>
                              <select
                                className="form-control"
                                style={{ padding: '3px 6px', fontSize: '0.775rem' }}
                                value={it.unit || 'pkt'}
                                onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                              >
                                <option value="KG">KG</option>
                                <option value="Packet">Packet</option>
                                <option value="pkt">pkt</option>
                                <option value="box">box</option>
                                <option value="piece">piece</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.8rem', width: '75px', fontWeight: 600 }}
                                min="0.1"
                                step="any"
                                value={it.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.8rem', width: '105px', borderColor: '#38bdf8', fontWeight: 700, color: '#0369a1' }}
                                min="0"
                                value={it.unit_price}
                                onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.8rem', width: '105px', borderColor: '#4ade80', fontWeight: 700, color: '#15803d' }}
                                min="0"
                                value={it.sale_price}
                                onChange={(e) => updateItem(idx, 'sale_price', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.8rem', width: '95px' }}
                                min="0"
                                value={it.wholesale_price}
                                onChange={(e) => updateItem(idx, 'wholesale_price', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.75rem', width: '100px' }}
                                placeholder="Auto Lot"
                                value={it.batch_no}
                                onChange={(e) => updateItem(idx, 'batch_no', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="date"
                                className="form-control"
                                style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                                value={it.expiry_date}
                                onChange={(e) => updateItem(idx, 'expiry_date', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {formatPKR(Number(it.quantity) * Number(it.unit_price))}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                title="Remove item"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAYMENT & SETTLEMENT */}
                <div className="form-grid-3" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Grand Total (PKR)</label>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>
                      {formatPKR(grandTotal)}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Paid Amount (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder={String(grandTotal)}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                    />
                    <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>
                      {Number(paidAmount || 0) < grandTotal ? (
                        <span style={{ color: '#ef4444' }}>
                          Credit / Outstanding: {formatPKR(grandTotal - Number(paidAmount || 0))} (Vendor Ledger)
                        </span>
                      ) : (
                        <span style={{ color: '#10b981' }}>Full Payment (No Udhaar)</span>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewModal(false)}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary btn-sm" style={{ minWidth: '150px' }}>
                  {submitting ? 'Saving...' : 'Save & Increase Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {showDetailModal && selectedPurchase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>Purchase Bill: {selectedPurchase.purchase.invoice_no}</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Supplier: {selectedPurchase.purchase.supplier_name} • Date: {formatDate(selectedPurchase.purchase.purchase_date)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Printer size={14} />
                  <span>Print Bill</span>
                </button>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowDetailModal(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="print-header" style={{ marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>LATIF TRADERS - PURCHASE VOUCHER</h2>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Commercial Market, Lahore • Cold-chain Supply Delivery Receiving Record
                </div>
              </div>

              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Batch #</th>
                    <th>Expiry Date</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Cost Rate</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.items.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                      <td className="mono">{it.batch_no || '-'}</td>
                      <td>{formatDate(it.expiry_date)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.quantity} {it.unit}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(it.unit_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(it.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <div style={{ width: '250px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Grand Total:</span>
                    <strong>{formatPKR(selectedPurchase.purchase.grand_total)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Paid:</span>
                    <span>{formatPKR(selectedPurchase.purchase.paid_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: 700 }}>
                    <span>Payable Due:</span>
                    <span>{formatPKR(selectedPurchase.purchase.balance_due)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* PURCHASE RETURN MODAL */}
      {showReturnModal && returnPurchase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RotateCcw size={18} color="#ef4444" />
                  <span>Return Goods to Supplier</span>
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Supplier: <strong>{returnPurchase.supplier_name}</strong> • Bill: <strong>{returnPurchase.invoice_no}</strong>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowReturnModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitReturn}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', color: '#991b1b' }}>
                  Enter the quantity you wish to return. Submitting will automatically decrease inventory batches, create an audit movement, and deduct the return amount from the supplier's payable balance.
                </div>

                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Batch Lot</th>
                        <th style={{ textAlign: 'center' }}>Purchased</th>
                        <th style={{ width: '130px', textAlign: 'center' }}>Return Qty</th>
                        <th style={{ width: '160px' }}>Condition</th>
                        <th style={{ textAlign: 'right' }}>Cost Rate</th>
                        <th style={{ textAlign: 'right' }}>Total Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((it, idx) => {
                        const lineCredit = (Number(it.return_qty) || 0) * Number(it.unit_price);
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                            <td className="mono" style={{ fontSize: '0.8rem' }}>{it.batch_no}</td>
                            <td style={{ textAlign: 'center' }}>{it.purchased_qty} {it.unit}</td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ textAlign: 'center', fontWeight: 700 }}
                                min="0"
                                max={it.purchased_qty}
                                step="any"
                                value={it.return_qty}
                                onChange={(e) => handleReturnItemChange(idx, 'return_qty', e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                className="form-control form-control-sm"
                                value={it.condition}
                                onChange={(e) => handleReturnItemChange(idx, 'condition', e.target.value)}
                              >
                                <option value="DEFECTIVE">Packaging Defective</option>
                                <option value="MELTED">Melted / Thawed</option>
                                <option value="EXPIRED">Short Expiry</option>
                                <option value="RESELLABLE">Resellable Return</option>
                              </select>
                            </td>
                            <td style={{ textAlign: 'right' }}>{formatPKR(it.unit_price)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: lineCredit > 0 ? '#ef4444' : '#64748b' }}>
                              {lineCredit > 0 ? formatPKR(lineCredit) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="form-grid-2" style={{ alignItems: 'center' }}>
                  <div className="form-group">
                    <label className="form-label">Return Reason / Explanation *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 5 boxes arrived thawed / torn packaging from distributor van"
                      required
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                    />
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Deducted from Payable</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>
                      {formatPKR(returnItems.reduce((sum, it) => sum + ((Number(it.return_qty) || 0) * Number(it.unit_price)), 0))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReturnModal(false)}>Cancel</button>
                <button type="submit" disabled={returnSubmitting} className="btn btn-danger btn-sm" style={{ minWidth: '150px' }}>
                  {returnSubmitting ? 'Processing Return...' : 'Confirm Purchase Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PURCHASE MODAL */}
      {showEditModal && editForm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>Edit Purchase: {editForm.invoice_no}</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Update vendor, bill reference, and recorded payments.
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => { setShowEditModal(false); setEditForm(null); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePurchase}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Supplier *</label>
                    <select
                      className="form-control"
                      value={editForm.supplier_id}
                      onChange={(e) => setEditForm({ ...editForm, supplier_id: e.target.value })}
                      required
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Supplier Bill #</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.supplier_invoice_no}
                      onChange={(e) => setEditForm({ ...editForm, supplier_invoice_no: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Purchase Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editForm.purchase_date}
                      onChange={(e) => setEditForm({ ...editForm, purchase_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-control"
                      value={editForm.payment_method}
                      onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Grand Total:</span>
                    <strong style={{ fontSize: '1.1rem', color: '#0284c7' }}>{formatPKR(editForm.grand_total)}</strong>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Paid Amount (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max={editForm.grand_total}
                      value={editForm.paid_amount}
                      onChange={(e) => setEditForm({ ...editForm, paid_amount: e.target.value })}
                    />
                    <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>
                      {Number(editForm.paid_amount || 0) < editForm.grand_total ? (
                        <span style={{ color: '#ef4444' }}>
                          New Payable Due: {formatPKR(editForm.grand_total - Number(editForm.paid_amount || 0))}
                        </span>
                      ) : (
                        <span style={{ color: '#10b981' }}>Full Payment</span>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Notes</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowEditModal(false); setEditForm(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE PURCHASE CONFIRMATION MODAL */}
      {showDeleteModal && selectedPurchase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '96%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} color="#dc2626" />
                <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.05rem', fontWeight: 700 }}>Delete Purchase</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => { setShowDeleteModal(false); setSelectedPurchase(null); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#991b1b' }}>
                  Are you sure you want to delete this purchase invoice?
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Invoice:</span>
                  <strong>{selectedPurchase.invoice_no}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Supplier:</span>
                  <strong>{selectedPurchase.supplier_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Grand Total:</span>
                  <strong>{formatPKR(selectedPurchase.grand_total)}</strong>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem', margin: '1rem 0 0', lineHeight: 1.45 }}>
                This will reverse all stock batches and inventory movements created by this purchase. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowDeleteModal(false); setSelectedPurchase(null); }}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeletePurchase}>Yes, Delete Purchase</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
