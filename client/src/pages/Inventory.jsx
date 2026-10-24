import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Eye,
  Edit,
  AlertTriangle,
  Layers,
  Clock,
  Download,
  Barcode,
  ChevronDown,
  MoreVertical,
  PlusCircle,
  Trash2,
  AlertCircle,
  Check,
  X,
  Archive,
  ArrowUpRight,
  Home,
  RefreshCw,
  MoreHorizontal,
  Package,
  Filter,
  Calendar
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import { useAuth } from '../context/AuthContext';
import BarcodeLabelModal from '../components/common/BarcodeLabelModal';
import Pagination from '../components/common/Pagination';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import ActionMenu from '../components/common/ActionMenu';

export default function Inventory() {
  const { isAdmin, canManageInventory } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  const datePickerRef = useRef(null);
  const moreFiltersRef = useRef(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleteWarning, setDeleteWarning] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingMetaItem, setEditingMetaItem] = useState(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockForm, setRestockForm] = useState({
    quantity: '50',
    purchase_price: '',
    sale_price: '',
    wholesale_price: '',
    supplier_id: '',
    batch_no: '',
    expiry_date: '',
    storage_location: 'Freezer #1'
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [actionMenuId, setActionMenuId] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      setActionMenuId(null);
      setMoreActionsOpen(false);
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

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category_id: '',
    brand: '',
    supplier_id: '',
    unit: 'pkt',
    purchase_price: '',
    sale_price: '',
    wholesale_price: '',
    min_stock_level: '5',
    storage_location: 'Freezer #1',
    opening_stock: '0',
    batch_no: '',
    expiry_date: ''
  });

  const [editFormData, setEditFormData] = useState(null);
  const [customBrandModeAdd, setCustomBrandModeAdd] = useState(false);
  const [customBrandModeEdit, setCustomBrandModeEdit] = useState(false);
  const [metaTab, setMetaTab] = useState('categories');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandDesc, setNewBrandDesc] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      let query = `/products?`;
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (selectedCat) query += `category_id=${selectedCat}&`;
      if (selectedBrand) query += `brand=${encodeURIComponent(selectedBrand)}&`;
      if (lowStockOnly) query += `low_stock=true&`;

      const [pRes, cRes, uRes, bRes, sRes] = await Promise.all([
        api.get(query),
        api.get('/products/meta/categories'),
        api.get('/products/meta/units'),
        api.get('/products/meta/brands'),
        api.get('/parties/suppliers').catch(() => ({ success: false, suppliers: [] }))
      ]);

      if (pRes.success) setProducts(pRes.products);
      if (cRes.success) setCategories(cRes.categories);
      if (uRes.success) setUnits(uRes.units);
      if (bRes.success) setBrands(bRes.brands);
      if (sRes.success) setSuppliers(sRes.suppliers);
    } catch (err) {
      console.error('Inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCat, selectedBrand, lowStockOnly]);

  const viewProductDetail = async (id) => {
    try {
      const res = await api.get(`/products/${id}`);
      if (res.success) {
        setSelectedProduct(res.product);
        setBatches(res.batches);
        setMovements(res.movements);
        setShowDetailModal(true);
      }
    } catch (err) {
      alert('Failed to load product details');
    }
  };

  const openBarcode = (prod) => {
    setSelectedProduct(prod);
    setShowBarcodeModal(true);
  };

  const handleExportStock = () => {
    exportToCSV('Latif_Traders_Inventory', products, [
      { label: 'Product Name', key: 'name' },
      { label: 'SKU', key: 'sku' },
      { label: 'Barcode', key: 'barcode' },
      { label: 'Category', key: 'category_name' },
      { label: 'Brand', key: 'brand' },
      { label: 'Supplier / Vendor', key: 'supplier_name' },
      { label: 'Current Stock', key: 'current_stock' },
      { label: 'Unit', key: 'unit' },
      { label: 'Purchase Price (PKR)', key: 'purchase_price' },
      { label: 'Sale Price (PKR)', key: 'sale_price' },
      { label: 'Wholesale Price (PKR)', key: 'wholesale_price' },
      { label: 'Location', key: 'storage_location' }
    ]);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/products', formData);
      if (res.success) {
        setShowAddModal(false);
        setCustomBrandModeAdd(false);
        setFormData({
          name: '',
          sku: '',
          barcode: '',
          category_id: '',
          brand: '',
          supplier_id: '',
          unit: 'pkt',
          purchase_price: '',
          sale_price: '',
          wholesale_price: '',
          min_stock_level: '5',
          storage_location: 'Freezer #1',
          opening_stock: '0',
          batch_no: '',
          expiry_date: ''
        });
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to save product');
    }
  };

  const openEditProduct = (p) => {
    setEditFormData({
      id: p.id,
      name: p.name || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      category_id: p.category_id || '',
      brand: p.brand || '',
      supplier_id: p.supplier_id || '',
      unit: p.unit || 'pkt',
      purchase_price: p.purchase_price || 0,
      sale_price: p.sale_price || 0,
      wholesale_price: p.wholesale_price || 0,
      min_stock_level: p.min_stock_level || 5,
      storage_location: p.storage_location || '',
      status: p.status || 'active'
    });
    setCustomBrandModeEdit(false);
    setShowEditModal(true);
  };

  const openRestock = (p) => {
    setRestockProduct(p);
    setRestockForm({
      quantity: '50',
      purchase_price: p.purchase_price || '',
      sale_price: p.sale_price || '',
      wholesale_price: p.wholesale_price || '',
      supplier_id: p.supplier_id || '',
      batch_no: `LOT-${Date.now().toString().slice(-4)}`,
      expiry_date: '',
      storage_location: p.storage_location || 'Freezer #1'
    });
    setShowRestockModal(true);
  };

  const handleSaveRestock = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/products/${restockProduct.id}/restock`, restockForm);
      if (res.success) {
        alert(res.message);
        setShowRestockModal(false);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to restock product');
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/products/${editFormData.id}`, editFormData);
      if (res.success) {
        setShowEditModal(false);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to update product');
    }
  };

  const handleCreateBrand = async (e) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    try {
      const res = await api.post('/products/meta/brands', {
        name: newBrandName.trim(),
        description: newBrandDesc.trim()
      });
      if (res.success) {
        setNewBrandName('');
        setNewBrandDesc('');
        const bRes = await api.get('/products/meta/brands');
        if (bRes.success) setBrands(bRes.brands);
      }
    } catch (err) {
      alert(err.message || 'Failed to add brand');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await api.post('/products/meta/categories', {
        name: newCatName.trim(),
        description: newCatDesc.trim()
      });
      if (res.success) {
        setNewCatName('');
        setNewCatDesc('');
        const cRes = await api.get('/products/meta/categories');
        if (cRes.success) setCategories(cRes.categories);
      }
    } catch (err) {
      alert(err.message || 'Failed to add category');
    }
  };

  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!newUnitName.trim() || !newUnitCode.trim()) return;
    try {
      const res = await api.post('/products/meta/units', {
        name: newUnitName.trim(),
        short_code: newUnitCode.trim()
      });
      if (res.success) {
        setNewUnitName('');
        setNewUnitCode('');
        const uRes = await api.get('/products/meta/units');
        if (uRes.success) setUnits(uRes.units);
      }
    } catch (err) {
      alert(err.message || 'Failed to add unit');
    }
  };

  const confirmDeleteProduct = (prod) => {
    setProductToDelete(prod);
    setDeleteWarning(null);
    setShowDeleteModal(true);
  };

  const handleDeleteProduct = async (force = false, archive = false) => {
    if (!productToDelete) return;
    try {
      setDeleting(true);
      let url = `/products/${productToDelete.id}?`;
      if (force) url += 'force=true&';
      if (archive) url += 'archive=true&';

      const res = await api.delete(url);
      if (res.success) {
        setShowDeleteModal(false);
        setProductToDelete(null);
        setDeleteWarning(null);
        loadData();
      } else {
        if (res.hasHistory) {
          setDeleteWarning(res);
        } else {
          alert(res.message || 'Failed to delete product');
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Delete this category? Associated products will become unassigned.')) return;
    try {
      const res = await api.delete(`/products/meta/categories/${id}`);
      if (res.success) {
        const cRes = await api.get('/products/meta/categories');
        if (cRes.success) setCategories(cRes.categories);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const handleUpdateCategory = async (id, name, desc) => {
    try {
      const res = await api.put(`/products/meta/categories/${id}`, { name, description: desc });
      if (res.success) {
        setEditingMetaItem(null);
        const cRes = await api.get('/products/meta/categories');
        if (cRes.success) setCategories(cRes.categories);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to update category');
    }
  };

  const handleDeleteBrand = async (id) => {
    if (!window.confirm('Delete this brand?')) return;
    try {
      const res = await api.delete(`/products/meta/brands/${id}`);
      if (res.success) {
        const bRes = await api.get('/products/meta/brands');
        if (bRes.success) setBrands(bRes.brands);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete brand');
    }
  };

  const handleUpdateBrand = async (id, name, desc) => {
    try {
      const res = await api.put(`/products/meta/brands/${id}`, { name, description: desc });
      if (res.success) {
        setEditingMetaItem(null);
        const bRes = await api.get('/products/meta/brands');
        if (bRes.success) setBrands(bRes.brands);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to update brand');
    }
  };

  const handleDeleteUnit = async (id) => {
    if (!window.confirm('Delete this unit?')) return;
    try {
      const res = await api.delete(`/products/meta/units/${id}`);
      if (res.success) {
        const uRes = await api.get('/products/meta/units');
        if (uRes.success) setUnits(uRes.units);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete unit');
    }
  };

  const handleUpdateUnit = async (id, name, code) => {
    try {
      const res = await api.put(`/products/meta/units/${id}`, { name, short_code: code });
      if (res.success) {
        setEditingMetaItem(null);
        const uRes = await api.get('/products/meta/units');
        if (uRes.success) setUnits(uRes.units);
      }
    } catch (err) {
      alert(err.message || 'Failed to update unit');
    }
  };

  const totalProducts = products.length;
  const outOfStockCount = products.filter(p => Number(p.current_stock) <= 0).length;
  const lowStockCount = products.filter(p => Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock_level)).length;
  const inStockCount = products.filter(p => Number(p.current_stock) > Number(p.min_stock_level)).length;
  const totalStockValue = products.reduce((acc, p) => acc + ((Number(p.purchase_price) || 0) * (Number(p.current_stock) || 0)), 0);

  const filteredProducts = products.filter(p => {
    if (statusFilter === 'in_stock') return Number(p.current_stock) > Number(p.min_stock_level);
    if (statusFilter === 'low_stock') return Number(p.current_stock) > 0 && Number(p.current_stock) <= Number(p.min_stock_level);
    if (statusFilter === 'out_of_stock') return Number(p.current_stock) <= 0;
    if (startDate && p.created_at && new Date(p.created_at) < new Date(startDate)) return false;
    if (endDate && p.created_at && new Date(p.created_at) > new Date(endDate + 'T23:59:59')) return false;
    return true;
  });

  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const isFilterActive = search || selectedCat || selectedBrand || statusFilter !== 'all' || lowStockOnly || startDate || endDate;

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCat('');
    setSelectedBrand('');
    setStatusFilter('all');
    setLowStockOnly(false);
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. PAGE HEADER (SadaxCart Breadcrumb & Actions) */}
      <div className="page-header-container">
        <div>
          <div className="header-breadcrumbs" style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', color: '#10b981' }}>
              <Home size={15} color="#10b981" />
            </span>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>/</span>
            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.8125rem' }}>Products List</span>
          </div>
          <h1 className="page-header-title" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-title)', margin: '0 0 2px 0' }}>Products List</h1>
          <p className="page-header-subtitle" style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Here you can find all of your products</p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {canManageInventory && (
            <button
              type="button"
              onClick={() => {
                setCustomBrandModeAdd(false);
                setShowAddModal(true);
              }}
              className="btn-sadax-teal"
            >
              <Plus size={16} />
              <span>+ Add Product</span>
            </button>
          )}

          {/* More Actions Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMoreActionsOpen(!moreActionsOpen);
              }}
              className="btn-sadax-white"
            >
              <span>More Actions ···</span>
            </button>

            {moreActionsOpen && (
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
                  boxShadow: 'var(--shadow-card)',
                  zIndex: 200,
                  width: '210px',
                  padding: '6px 0'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMoreActionsOpen(false);
                    handleExportStock();
                  }}
                  className="dropdown-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    color: 'var(--text-title)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <Download size={14} color="#0284c7" />
                  <span>Export CSV</span>
                </button>

                {canManageInventory && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      setShowMetaModal(true);
                    }}
                    className="dropdown-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 14px',
                      fontSize: '0.8rem',
                      color: 'var(--text-title)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <Layers size={14} color="#6366f1" />
                    <span>Brands & Categories</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMoreActionsOpen(false);
                    loadData();
                  }}
                  className="dropdown-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 14px',
                    fontSize: '0.8rem',
                    color: 'var(--text-title)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <RefreshCw size={14} color="#10b981" />
                  <span>Refresh Products</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. STATS CARDS ROW (4 Cards matching SadaxCart reference style) */}
      <div className="sadax-stat-card-row">
        <StatCard
          label="Total Products"
          value={totalProducts.toLocaleString()}
          trend="up"
          subtitle="Total Products last 365 days"
        />
        <StatCard
          label="Products Sales"
          value={formatPKR(totalStockValue)}
          trend="neutral"
          subtitle="Total Products Sales last 365 days"
        />
        <StatCard
          label="Stock Products"
          value={inStockCount.toLocaleString()}
          trend="up"
          subtitle="Available for immediate sale"
        />
        <StatCard
          label="Out of Stock"
          value={outOfStockCount.toLocaleString()}
          trend="down"
          subtitle={`${lowStockCount} low stock alerts`}
        />
      </div>

      {/* 3. TOOLBAR & TABLE CONTAINER (SadaxCart Card) */}
      <div className="sadax-table-card">
        {/* Filter Toolbar Row */}
        <div className="sadax-toolbar-row">
          {/* Search Box (left-aligned search icon inside input, height 40px) */}
          <div className="sadax-search-box">
            <Search size={15} className="sadax-search-icon" />
            <input
              type="text"
              placeholder="Search by name, Product ID, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
              className="sadax-search-input"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* All Status Dropdown */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="sadax-select-control"
              >
                <option value="all">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

            {/* Date Range Picker Button */}
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
                    Select Date Range
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
                className={`sadax-filter-btn ${(selectedCat || selectedBrand || lowStockOnly) ? 'active' : ''}`}
              >
                <Filter size={14} color={(selectedCat || selectedBrand || lowStockOnly) ? '#10b981' : '#6b7280'} />
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
                      Category
                    </label>
                    <select
                      value={selectedCat}
                      onChange={(e) => {
                        setSelectedCat(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="form-control"
                      style={{ height: '32px', fontSize: '0.8rem' }}
                    >
                      <option value="">All Categories</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                      Brand
                    </label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => {
                        setSelectedBrand(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="form-control"
                      style={{ height: '32px', fontSize: '0.8rem' }}
                    >
                      <option value="">All Brands</option>
                      {brands.map(b => (
                        <option key={b.id || b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-title)' }}>
                      <input
                        type="checkbox"
                        checked={lowStockOnly}
                        onChange={(e) => {
                          setLowStockOnly(e.target.checked);
                          setCurrentPage(1);
                        }}
                      />
                      <span>Low Stock Items Only</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCat('');
                        setSelectedBrand('');
                        setLowStockOnly(false);
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
              onClick={loadData}
              className="sadax-icon-btn"
              title="Refresh inventory"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* 4. PRODUCTS DATA TABLE (EXACT 6 COLUMNS MATCHING SADAXCART) */}
        <div className="table-responsive" style={{ margin: 0, border: 'none' }}>
          <table className="sadax-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: '240px' }}>Product Name</th>
                <th style={{ minWidth: '160px' }}>ID & Create Date</th>
                <th style={{ minWidth: '140px' }}>Price</th>
                <th style={{ minWidth: '120px' }}>Stock</th>
                <th style={{ minWidth: '130px' }}>Status</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.875rem' }}>
                      <RefreshCw size={18} className="spin" color="#10b981" />
                      <span>Loading products inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                      <Package size={24} />
                    </div>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-title)' }}>No products found</strong>
                    <p style={{ fontSize: '0.785rem', color: '#64748b', margin: '4px 0 1rem 0' }}>
                      {isFilterActive ? 'Try adjusting your search query, status filters, or date range.' : 'Click "+ Add Product" to add your first product.'}
                    </p>
                    {isFilterActive ? (
                      <button onClick={handleClearFilters} className="btn btn-secondary btn-sm">
                        Clear All Filters
                      </button>
                    ) : (
                      <button onClick={() => setShowAddModal(true)} className="btn-sadax-teal btn-sm" style={{ height: '32px' }}>
                        + Add Product
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isLow = Number(p.current_stock) <= Number(p.min_stock_level) && Number(p.current_stock) > 0;
                  const isOut = Number(p.current_stock) <= 0;

                  return (
                    <tr
                      key={p.id}
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
                            }} title={p.name}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                              {p.category_name || 'General Product'}
                              {p.brand && ` • ${p.brand}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: ID & Create Date */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-title)' }}>
                          #{p.sku || `ITM-${p.id}`}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {p.created_at ? formatDate(p.created_at) : '17/10/2026'}
                        </div>
                      </td>

                      {/* Column 3: Price */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-title)' }}>
                          {formatPKR(p.sale_price)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Cost: {formatPKR(p.purchase_price)}
                        </div>
                      </td>

                      {/* Column 4: Stock */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: isOut ? '#dc2626' : 'var(--text-title)' }}>
                          {Number(p.current_stock).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {p.unit || 'pkt'}
                        </div>
                      </td>

                      {/* Column 5: Status */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <StatusBadge status={isOut ? 'out-stock' : isLow ? 'low-stock' : 'published'} />
                      </td>

                      {/* Column 6: Action */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {/* Direct Details Button */}
                          <button
                            type="button"
                            onClick={() => viewProductDetail(p.id)}
                            className="sadax-action-details"
                            title="View Batches & Stock Details"
                          >
                            Details
                          </button>

                          {/* Action Dropdown Menu (Portal-based, immune to clipping) */}
                          <ActionMenu
                            title="Product Actions"
                            items={[
                              canManageInventory && {
                                label: 'Edit Product',
                                icon: <Edit size={14} color="#0284c7" />,
                                onClick: () => openEditProduct(p)
                              },
                              canManageInventory && {
                                label: 'Add Stock (Inward)',
                                icon: <PlusCircle size={14} color="#10b981" />,
                                onClick: () => openRestock(p)
                              },
                              {
                                label: 'Batches & History',
                                icon: <Eye size={14} color="#0284c7" />,
                                onClick: () => viewProductDetail(p.id)
                              },
                              {
                                label: 'Print Barcode Label',
                                icon: <Barcode size={14} color="#6366f1" />,
                                onClick: () => {
                                  setSelectedProduct(p);
                                  setShowBarcodeModal(true);
                                }
                              },
                              canManageInventory && { divider: true },
                              canManageInventory && {
                                label: 'Delete Product',
                                icon: <Trash2 size={14} color="#dc2626" />,
                                danger: true,
                                onClick: () => confirmDeleteProduct(p)
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

        {/* 5. PAGINATION CONTROLS */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredProducts.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={setItemsPerPage}
        />
      </div>

      {/* BARCODE LABELS MODAL */}
      {showBarcodeModal && selectedProduct && (
        <BarcodeLabelModal
          product={selectedProduct}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}

      {/* QUICK RESTOCK / STOCK INWARD MODAL */}
      {showRestockModal && restockProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>
                  Restock / Inward Stock Lot
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  {restockProduct.name} • Current Stock: <strong>{restockProduct.current_stock} {restockProduct.unit}</strong> • Standard Sale: <strong>{formatPKR(restockProduct.sale_price)}</strong>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRestockModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveRestock}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Incoming Quantity ({restockProduct.unit}) *</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      min="0.1"
                      step="any"
                      placeholder="e.g. 50, 100, 200"
                      value={restockForm.quantity}
                      onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Supplier / Vendor</label>
                    <select
                      className="form-control"
                      value={restockForm.supplier_id}
                      onChange={(e) => setRestockForm({ ...restockForm, supplier_id: e.target.value })}
                    >
                      <option value="">-- Select Vendor --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.company_name ? `(${s.company_name})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Purchase Cost (PKR) *</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      min="0"
                      step="any"
                      placeholder="Cost"
                      value={restockForm.purchase_price}
                      onChange={(e) => setRestockForm({ ...restockForm, purchase_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">New Retail Price (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step="any"
                      placeholder="New Retail"
                      value={restockForm.sale_price}
                      onChange={(e) => setRestockForm({ ...restockForm, sale_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">New Wholesale (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step="any"
                      placeholder="Wholesale"
                      value={restockForm.wholesale_price}
                      onChange={(e) => setRestockForm({ ...restockForm, wholesale_price: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Batch / Lot # (Auto-Generated)</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Leave blank for Auto: LOT-YYMM-XXXX"
                      value={restockForm.batch_no}
                      onChange={(e) => setRestockForm({ ...restockForm, batch_no: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Expiry Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={restockForm.expiry_date}
                      onChange={(e) => setRestockForm({ ...restockForm, expiry_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Storage Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Freezer #1"
                      value={restockForm.storage_location}
                      onChange={(e) => setRestockForm({ ...restockForm, storage_location: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 12px', fontSize: '0.8rem', color: '#166534', lineHeight: 1.45 }}>
                  💡 <strong>FIFO Rule:</strong> This new batch will be stored as an independent inventory lot. When you sell at POS, the system will automatically sell your older batch first, and then transition to this new batch with its updated cost.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRestockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ background: '#10b981', borderColor: '#059669', minWidth: '130px' }}>
                  Save Inward Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>Add Product</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Register a new inventory product, brand, unit, and stock alerts.
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
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* Row 1: Product Name & Brand */}
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Product Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. Dawn Plain Paratha 10s"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>Brand / Company</label>
                      <button
                        type="button"
                        style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 600 }}
                        onClick={() => setCustomBrandModeAdd(!customBrandModeAdd)}
                      >
                        {customBrandModeAdd ? '← Select from list' : '+ Enter custom brand'}
                      </button>
                    </div>
                    {customBrandModeAdd ? (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Type brand name..."
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      <select
                        className="form-control"
                        value={formData.brand}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setCustomBrandModeAdd(true);
                          } else {
                            setFormData({ ...formData, brand: e.target.value });
                          }
                        }}
                      >
                        <option value="">-- Select Brand / Company --</option>
                        {brands.map(b => (
                          <option key={b.id || b.name} value={b.name}>{b.name}</option>
                        ))}
                        {formData.brand && !brands.some(b => b.name.toLowerCase() === formData.brand.toLowerCase()) && (
                          <option value={formData.brand}>{formData.brand} (Custom)</option>
                        )}
                        <option value="__custom__">➕ Type Custom Brand Name...</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Row 2: Category & Unit */}
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
                    <label className="form-label">Unit</label>
                    <select
                      className="form-control"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    >
                      <option value="pkt">Packet (pkt)</option>
                      <option value="box">Box (box)</option>
                      <option value="ctn">Carton (ctn)</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="pcs">Piece (pcs)</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Item Code & Min Stock Alert */}
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Item Code</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="auto"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value, barcode: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Min Stock Level (Alert)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="5"
                      min="0"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 4: Pricing */}
                <div className="form-grid-3">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Purchase Price / Cost (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0"
                      min="0"
                      step="any"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Retail Sale Price * (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      placeholder="0"
                      min="0"
                      step="any"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Wholesale Price (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0"
                      min="0"
                      step="any"
                      value={formData.wholesale_price}
                      onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                    />
                  </div>
                </div>

                {/* OPENING STOCK (OPTIONAL) */}
                <div style={{ background: 'var(--hover-bg)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '0.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-title)' }}>
                      📦 Opening Stock Lot (Optional)
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Creates initial FIFO inventory batch</span>
                  </div>
                  <div className="form-grid-3">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Opening Qty</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="0"
                        min="0"
                        value={formData.opening_stock}
                        onChange={(e) => setFormData({ ...formData, opening_stock: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Batch / Lot No</label>
                      <input
                        type="text"
                        className="form-control mono"
                        placeholder="e.g. LOT-2609"
                        value={formData.batch_no}
                        onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Expiry Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.expiry_date}
                        onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL & BATCHES MODAL */}
      {showDetailModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>{selectedProduct.name}</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Item Code: {selectedProduct.sku} • Brand: <strong>{selectedProduct.brand || 'Frozen'}</strong> • Unit: <strong>{selectedProduct.unit}</strong>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDetailModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-title)' }}>Active Batches (FIFO Lot Tracking)</h4>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Batch / Lot #</th>
                        <th>Expiry Date</th>
                        <th style={{ textAlign: 'center' }}>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Cost Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: 'center' }}>No active batches found.</td></tr>
                      ) : (
                        batches.map(b => (
                          <tr key={b.id}>
                            <td className="mono" style={{ fontWeight: 600 }}>{b.batch_no}</td>
                            <td>{formatDate(b.expiry_date)}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{b.quantity} {selectedProduct.unit}</td>
                            <td style={{ textAlign: 'right' }}>{formatPKR(b.purchase_price)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-title)' }}>Recent Stock Movements</h4>
                <div className="table-responsive" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'center' }}>Delta</th>
                        <th style={{ textAlign: 'center' }}>Balance After</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map(m => (
                        <tr key={m.id}>
                          <td>{formatDate(m.created_at)}</td>
                          <td><span className="badge badge-info">{m.type}</span></td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: m.quantity_delta > 0 ? '#10b981' : '#ef4444' }}>
                            {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                          </td>
                          <td style={{ textAlign: 'center' }}>{m.balance_after}</td>
                          <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {showEditModal && editFormData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>Edit Product</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Update product details, pricing tiers, and inventory alert levels.
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
            <form onSubmit={handleUpdateProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* Row 1: Product Name & Brand */}
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Product Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>Brand / Company</span>
                        {isAdmin ? (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Admin Edit</span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Admin Only</span>
                        )}
                      </label>
                      {isAdmin && (
                        <button
                          type="button"
                          style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontWeight: 600 }}
                          onClick={() => setCustomBrandModeEdit(!customBrandModeEdit)}
                        >
                          {customBrandModeEdit ? '← Select from list' : '+ Enter custom brand'}
                        </button>
                      )}
                    </div>
                    {customBrandModeEdit ? (
                      <input
                        type="text"
                        className="form-control"
                        value={editFormData.brand || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                        disabled={!isAdmin}
                        style={!isAdmin ? { background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' } : {}}
                        placeholder="e.g. Big Bird / Dawn"
                        autoFocus
                      />
                    ) : (
                      <select
                        className="form-control"
                        value={editFormData.brand || ''}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setCustomBrandModeEdit(true);
                          } else {
                            setEditFormData({ ...editFormData, brand: e.target.value });
                          }
                        }}
                        disabled={!isAdmin}
                        style={!isAdmin ? { background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' } : {}}
                      >
                        <option value="">-- Select Brand / Company --</option>
                        {brands.map(b => (
                          <option key={b.id || b.name} value={b.name}>{b.name}</option>
                        ))}
                        {editFormData.brand && !brands.some(b => b.name.toLowerCase() === editFormData.brand.toLowerCase()) && (
                          <option value={editFormData.brand}>{editFormData.brand} (Custom)</option>
                        )}
                        {isAdmin && <option value="__custom__">➕ Type Custom Brand Name...</option>}
                      </select>
                    )}
                  </div>
                </div>

                {/* Row 2: Category & Unit */}
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Category</label>
                    <select
                      className="form-control"
                      value={editFormData.category_id}
                      onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value })}
                    >
                      <option value="">-- No Category --</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Unit</label>
                    <select
                      className="form-control"
                      value={editFormData.unit}
                      onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                    >
                      {units.map(u => <option key={u.id} value={u.short_code}>{u.name} ({u.short_code})</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 3: Item Code / SKU */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Item Code / SKU *</label>
                  <input
                    type="text"
                    className="form-control mono"
                    value={editFormData.sku}
                    onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value, barcode: e.target.value })}
                    required
                  />
                </div>

                {/* Row 4: Pricing */}
                <div className="form-grid-3">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Purchase / Cost (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step="any"
                      value={editFormData.purchase_price}
                      onChange={(e) => setEditFormData({ ...editFormData, purchase_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Retail Sale (PKR) *</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step="any"
                      value={editFormData.sale_price}
                      onChange={(e) => setEditFormData({ ...editFormData, sale_price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Wholesale (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step="any"
                      value={editFormData.wholesale_price}
                      onChange={(e) => setEditFormData({ ...editFormData, wholesale_price: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 5: Min Stock Alert & Status */}
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Min Stock Alert Level</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={editFormData.min_stock_level}
                      onChange={(e) => setEditFormData({ ...editFormData, min_stock_level: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Status</label>
                    <select
                      className="form-control"
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div>
                  {canManageInventory && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => {
                        const targetProd = products.find(p => p.id === editFormData.id) || editFormData;
                        setShowEditModal(false);
                        confirmDeleteProduct(targetProd);
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete Product</span>
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Update Product</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE CATEGORIES & UNITS MODAL */}
      {showMetaModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Layers size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>Brands, Categories & Units Manager</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowMetaModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setMetaTab('brands')}
                  className={`btn btn-sm ${metaTab === 'brands' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Frozen Brands ({brands.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMetaTab('categories')}
                  className={`btn btn-sm ${metaTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Categories ({categories.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMetaTab('units')}
                  className={`btn btn-sm ${metaTab === 'units' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Units ({units.length})
                </button>
              </div>

              {metaTab === 'brands' ? (
                <div>
                  <form onSubmit={handleCreateBrand} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      style={{ flex: 1, minWidth: '150px' }}
                      placeholder="Brand Name (e.g., Sabroso, K&N's)"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      style={{ flex: 1.5, minWidth: '180px' }}
                      placeholder="Brand description / notes"
                      value={newBrandDesc}
                      onChange={(e) => setNewBrandDesc(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-sm">Add Brand</button>
                  </form>
                    <div className="table-responsive" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Brand Name</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brands.map(b => (
                          <tr key={b.id || b.name}>
                            <td style={{ fontWeight: 600, color: '#0284c7' }}>{b.name}</td>
                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.description || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newN = window.prompt('Edit Brand Name:', b.name);
                                    if (newN && newN.trim()) {
                                      const newD = window.prompt('Edit Brand Description:', b.description || '');
                                      handleUpdateBrand(b.id, newN.trim(), newD !== null ? newD.trim() : b.description);
                                    }
                                  }}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 5px', fontSize: '0.7rem' }}
                                  title="Edit Brand"
                                >
                                  <Edit size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBrand(b.id)}
                                  className="btn btn-sm"
                                  style={{ padding: '2px 5px', fontSize: '0.7rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}
                                  title="Delete Brand"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : metaTab === 'categories' ? (
                <div>
                  <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      style={{ flex: 1, minWidth: '150px' }}
                      placeholder="Category name (e.g., Seafood)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      style={{ flex: 1.5, minWidth: '180px' }}
                      placeholder="Description / notes"
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-sm">Add Category</button>
                  </form>
                  <div className="table-responsive" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Category Name</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'center' }}>Products</th>
                          <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map(c => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.description || '-'}</td>
                            <td style={{ textAlign: 'center' }}><span className="badge badge-info">{c.product_count || 0}</span></td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newN = window.prompt('Edit Category Name:', c.name);
                                    if (newN && newN.trim()) {
                                      const newD = window.prompt('Edit Category Description:', c.description || '');
                                      handleUpdateCategory(c.id, newN.trim(), newD !== null ? newD.trim() : c.description);
                                    }
                                  }}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 5px', fontSize: '0.7rem' }}
                                  title="Edit Category"
                                >
                                  <Edit size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(c.id)}
                                  className="btn btn-sm"
                                  style={{ padding: '2px 5px', fontSize: '0.7rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}
                                  title="Delete Category"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div>
                  <form onSubmit={handleCreateUnit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      style={{ flex: 1.5, minWidth: '140px' }}
                      placeholder="Unit Name (e.g., Kilogram)"
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      className="form-control form-control-sm mono"
                      style={{ flex: 1, minWidth: '100px' }}
                      placeholder="Code (e.g., kg)"
                      value={newUnitCode}
                      onChange={(e) => setNewUnitCode(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn btn-primary btn-sm">Add Unit</button>
                  </form>
                  <div className="table-responsive" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Unit Name</th>
                          <th style={{ textAlign: 'center' }}>Short Code</th>
                          <th style={{ textAlign: 'center', width: '100px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {units.map(u => (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                            <td style={{ textAlign: 'center' }}><span className="badge badge-secondary mono">{u.short_code}</span></td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newN = window.prompt('Edit Unit Name:', u.name);
                                    if (newN && newN.trim()) {
                                      const newC = window.prompt('Edit Short Code:', u.short_code);
                                      if (newC && newC.trim()) {
                                        handleUpdateUnit(u.id, newN.trim(), newC.trim());
                                      }
                                    }
                                  }}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 5px', fontSize: '0.7rem' }}
                                  title="Edit Unit"
                                >
                                  <Edit size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUnit(u.id)}
                                  className="btn btn-sm"
                                  style={{ padding: '2px 5px', fontSize: '0.7rem', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}
                                  title="Delete Unit"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowMetaModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      {showDeleteModal && productToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                <Trash2 size={20} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#991b1b' }}>Delete Product</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => { setShowDeleteModal(false); setProductToDelete(null); setDeleteWarning(null); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-title)' }}>{productToDelete.name}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.775rem', color: '#64748b', flexWrap: 'wrap' }}>
                  <span><strong>SKU:</strong> {productToDelete.sku}</span>
                  {productToDelete.brand && <span><strong>Brand:</strong> {productToDelete.brand}</span>}
                  <span><strong>Current Stock:</strong> {productToDelete.current_stock ?? 0} {productToDelete.unit}</span>
                </div>
              </div>

              {deleteWarning ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.85rem', color: '#92400e', fontSize: '0.825rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                    <AlertTriangle size={16} color="#d97706" />
                    <span>Transaction History Detected</span>
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.4 }}>
                    {deleteWarning.message}
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.775rem', color: '#b45309' }}>
                    Recommendation: Mark this product as Inactive instead of deleting so that previous sales invoices and accounting records remain intact.
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 }}>
                    Are you sure you want to delete this product? All corresponding batches and movements will be removed.
                  </p>
                  {productToDelete.current_stock > 0 && (
                    <div style={{ marginTop: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#b91c1c', fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertCircle size={14} />
                      <span>Warning: This item still has <strong>{productToDelete.current_stock} {productToDelete.unit}</strong> remaining in inventory!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setShowDeleteModal(false); setProductToDelete(null); setDeleteWarning(null); }}
                disabled={deleting}
              >
                Cancel
              </button>

              {deleteWarning ? (
                <>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 600 }}
                    onClick={() => handleDeleteProduct(false, true)}
                    disabled={deleting}
                  >
                    Archive (Make Inactive)
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteProduct(true, false)}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Force Delete Permanently'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteProduct(false, false)}
                  disabled={deleting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Trash2 size={13} />
                  <span>{deleting ? 'Deleting...' : 'Confirm Delete'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
