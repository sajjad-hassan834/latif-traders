import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Edit, AlertTriangle, Layers, Clock, Download, Barcode, ChevronDown, MoreVertical } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import { useAuth } from '../context/AuthContext';
import BarcodeLabelModal from '../components/common/BarcodeLabelModal';

export default function Inventory() {
  const { isAdmin, canManageInventory } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [actionMenuId, setActionMenuId] = useState(null);

  useEffect(() => {
    const handleOutsideClick = () => setActionMenuId(null);
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
  const [metaTab, setMetaTab] = useState('categories');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      let query = `/products?`;
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (selectedCat) query += `category_id=${selectedCat}&`;
      if (lowStockOnly) query += `low_stock=true&`;

      const [pRes, cRes, uRes] = await Promise.all([
        api.get(query),
        api.get('/products/meta/categories'),
        api.get('/products/meta/units')
      ]);

      if (pRes.success) setProducts(pRes.products);
      if (cRes.success) setCategories(cRes.categories);
      if (uRes.success) setUnits(uRes.units);
    } catch (err) {
      console.error('Inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCat, lowStockOnly]);

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
        setFormData({
          name: '',
          sku: '',
          barcode: '',
          category_id: '',
          brand: '',
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
      unit: p.unit || 'pkt',
      purchase_price: p.purchase_price || 0,
      sale_price: p.sale_price || 0,
      wholesale_price: p.wholesale_price || 0,
      min_stock_level: p.min_stock_level || 5,
      storage_location: p.storage_location || '',
      status: p.status || 'active'
    });
    setShowEditModal(true);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* TOOLBAR */}
      <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flex: '1 1 340px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '150px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.8rem' }}
                placeholder="Search product, SKU, barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
              />
            </div>

            <select
              className="form-control"
              style={{ width: '135px', height: '32px', fontSize: '0.8rem' }}
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`btn btn-sm ${lowStockOnly ? 'btn-danger' : 'btn-secondary'}`}
              style={{ height: '32px', padding: '0 8px', fontSize: '0.75rem' }}
            >
              <AlertTriangle size={13} />
              <span>Low Stock</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleExportStock} className="btn btn-secondary btn-sm" style={{ height: '32px', padding: '0 8px', fontSize: '0.75rem' }} title="Export to Excel / CSV">
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            {canManageInventory && (
              <button onClick={() => setShowMetaModal(true)} className="btn btn-secondary btn-sm" style={{ height: '32px', padding: '0 8px', fontSize: '0.75rem' }} title="Manage Categories & Units">
                <Layers size={13} />
                <span>Categories & Units</span>
              </button>
            )}

            {canManageInventory && (
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm" style={{ height: '32px', padding: '0 10px', fontSize: '0.75rem' }}>
                <Plus size={14} />
                <span>Add Product</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: '140px', maxWidth: '200px' }}>Product Name</th>
                <th style={{ width: '95px' }}>SKU / Barcode</th>
                <th style={{ width: '110px' }}>Category</th>
                <th style={{ textAlign: 'center', width: '65px' }}>Stock</th>
                <th style={{ textAlign: 'center', width: '45px' }}>Unit</th>
                <th style={{ textAlign: 'right', width: '70px' }}>Cost</th>
                <th style={{ textAlign: 'right', width: '70px' }}>Sale</th>
                <th style={{ textAlign: 'right', width: '70px' }}>Wholesale</th>
                <th style={{ width: '85px' }}>Location</th>
                <th style={{ textAlign: 'center', width: '75px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>Loading inventory records...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No products found.</td>
                </tr>
              ) : (
                products.map(p => {
                  const isLow = p.current_stock <= p.min_stock_level;
                  const isOut = p.current_stock === 0;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, maxWidth: '200px' }}>
                        <div style={{ wordBreak: 'break-word', lineHeight: 1.25, fontSize: '0.8125rem' }}>{p.name}</div>
                        {p.brand && <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>{p.brand}</div>}
                      </td>
                      <td className="mono" style={{ fontSize: '0.725rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{p.sku}</div>
                        {p.barcode && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{p.barcode}</div>}
                      </td>
                      <td style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.category_name}>
                        {p.category_name || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`} style={{ padding: '0.15rem 0.4rem' }}>
                          {p.current_stock}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>{p.unit}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatPKR(p.purchase_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatPKR(p.sale_price)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{formatPKR(p.wholesale_price)}</td>
                      <td style={{ maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.storage_location || 'Freezer'}>
                        <span style={{ fontSize: '0.725rem', color: '#64748b' }}>{p.storage_location || 'Freezer'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuId(actionMenuId === p.id ? null : p.id);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              borderRadius: '5px'
                            }}
                            title="Product Actions"
                          >
                            <span>Action</span>
                            <ChevronDown size={12} />
                          </button>

                          {actionMenuId === p.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: '4px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15), 0 4px 6px -2px rgba(0,0,0,0.08)',
                                zIndex: 100,
                                minWidth: '155px',
                                padding: '4px 0',
                                textAlign: 'left'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {canManageInventory && (
                                <button
                                  onClick={() => {
                                    setActionMenuId(null);
                                    openEditProduct(p);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '7px 12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: 'none',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: '#1e293b',
                                    cursor: 'pointer',
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                  <Edit size={13} color="#0284c7" />
                                  <span>Edit Product</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setActionMenuId(null);
                                  openBarcode(p);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'none',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  color: '#1e293b',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <Barcode size={13} color="#6366f1" />
                                <span>Barcode Sticker</span>
                              </button>

                              <button
                                onClick={() => {
                                  setActionMenuId(null);
                                  viewProductDetail(p.id);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'none',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  color: '#1e293b',
                                  cursor: 'pointer',
                                  textAlign: 'left'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <Eye size={13} color="#10b981" />
                                <span>Batches & History</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BARCODE LABELS MODAL */}
      {showBarcodeModal && selectedProduct && (
        <BarcodeLabelModal
          product={selectedProduct}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px', overflowX: 'hidden' }}>
            <div className="modal-header">
              <h3>Add New Frozen Food Item</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowX: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '0.75rem' }}>
                  <div className="form-group">
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
                  <div className="form-group">
                    <label className="form-label">Brand / Company</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Dawn / K&N's"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">SKU / Item Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      placeholder="e.g. DW-PRT-010"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Barcode (Scan USB)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Scan or leave blank"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>
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
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
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
                  <div className="form-group">
                    <label className="form-label">Purchase Price</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Cost (PKR)"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Retail Sale Price *</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      placeholder="Sale (PKR)"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Wholesale Price</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Bulk (PKR)"
                      value={formData.wholesale_price}
                      onChange={(e) => setFormData({ ...formData, wholesale_price: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Min Stock Level (Alert)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Storage Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Deep Freezer #2 - Shelf B"
                      value={formData.storage_location}
                      onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                    />
                  </div>
                </div>

                {/* OPENING STOCK */}
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '0.5rem', color: '#0f172a' }}>
                    Opening Stock Lot (Optional)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Opening Qty</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="0"
                        value={formData.opening_stock}
                        onChange={(e) => setFormData({ ...formData, opening_stock: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Batch / Lot No</label>
                      <input
                        type="text"
                        className="form-control"
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
                <button type="submit" className="btn btn-primary btn-sm">Save Product</button>
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
                <h3>{selectedProduct.name}</h3>
                <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                  SKU: {selectedProduct.sku} • Location: {selectedProduct.storage_location || 'Freezer'}
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.4rem', color: '#0f172a' }}>Active Batches (FEFO Tracking)</h4>
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Batch #</th>
                        <th>Expiry Date</th>
                        <th style={{ textAlign: 'center' }}>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Cost Rate</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.length === 0 ? (
                        <tr><td colSpan="5" style={{ textAlign: 'center' }}>No active batches found.</td></tr>
                      ) : (
                        batches.map(b => (
                          <tr key={b.id}>
                            <td className="mono" style={{ fontWeight: 600 }}>{b.batch_no}</td>
                            <td>{formatDate(b.expiry_date)}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{b.quantity} {selectedProduct.unit}</td>
                            <td style={{ textAlign: 'right' }}>{formatPKR(b.purchase_price)}</td>
                            <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.storage_location || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.4rem', color: '#0f172a' }}>Recent Stock Movements</h4>
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
          <div className="modal-content" style={{ maxWidth: '680px', overflowX: 'hidden' }}>
            <div className="modal-header">
              <h3>Edit Frozen Product</h3>
              <button onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdateProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowX: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU Code *</label>
                    <input
                      type="text"
                      className="form-control mono"
                      value={editFormData.sku}
                      onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Barcode</label>
                    <input
                      type="text"
                      className="form-control mono"
                      value={editFormData.barcode}
                      onChange={(e) => setEditFormData({ ...editFormData, barcode: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
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
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Brand</span>
                      {isAdmin ? (
                        <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Admin Edit</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Admin Only</span>
                      )}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.brand || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                      disabled={!isAdmin}
                      style={!isAdmin ? { background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' } : {}}
                      title={!isAdmin ? 'Brand name can only be edited by an Administrator' : ''}
                      placeholder="e.g. Big Bird / Dawn"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select
                      className="form-control"
                      value={editFormData.unit}
                      onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                    >
                      {units.map(u => <option key={u.id} value={u.short_code}>{u.name} ({u.short_code})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      step="any"
                      value={editFormData.purchase_price}
                      onChange={(e) => setEditFormData({ ...editFormData, purchase_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sale (PKR) *</label>
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
                  <div className="form-group">
                    <label className="form-label">Wholesale</label>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Min Stock Alert</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={editFormData.min_stock_level}
                      onChange={(e) => setEditFormData({ ...editFormData, min_stock_level: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Storage Location</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.storage_location}
                      onChange={(e) => setEditFormData({ ...editFormData, storage_location: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
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
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Update Product</button>
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
                <h3 style={{ margin: 0 }}>Categories & Units Manager</h3>
              </div>
              <button onClick={() => setShowMetaModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setMetaTab('categories')}
                  className={`btn btn-sm ${metaTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Product Categories ({categories.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMetaTab('units')}
                  className={`btn btn-sm ${metaTab === 'units' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  Measurement Units ({units.length})
                </button>
              </div>

              {metaTab === 'categories' ? (
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
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map(c => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{c.description || '-'}</td>
                            <td style={{ textAlign: 'center' }}><span className="badge badge-info">{c.product_count || 0}</span></td>
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
                        </tr>
                      </thead>
                      <tbody>
                        {units.map(u => (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                            <td style={{ textAlign: 'center' }}><span className="badge badge-secondary mono">{u.short_code}</span></td>
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
    </div>
  );
}
