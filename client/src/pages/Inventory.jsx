import React, { useState, useEffect } from 'react';
import { Search, Plus, Eye, Edit, AlertTriangle, Layers, Clock, Download, Barcode } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { exportToCSV } from '../utils/exportCsv';
import { useAuth } from '../context/AuthContext';
import BarcodeLabelModal from '../components/common/BarcodeLabelModal';

export default function Inventory() {
  const { canManageInventory } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* TOOLBAR */}
      <div className="card" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2rem', height: '32px' }}
              placeholder="Search product, SKU, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
            />
          </div>

          <select
            className="form-control"
            style={{ width: '160px', height: '32px' }}
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
            style={{ height: '32px' }}
          >
            <AlertTriangle size={14} />
            <span>Low Stock</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportStock} className="btn btn-secondary btn-sm" title="Export to Excel / CSV">
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {canManageInventory && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU / Barcode</th>
                <th>Category</th>
                <th style={{ textAlign: 'center' }}>Current Stock</th>
                <th style={{ textAlign: 'center' }}>Unit</th>
                <th style={{ textAlign: 'right' }}>Cost Price</th>
                <th style={{ textAlign: 'right' }}>Sale Price</th>
                <th style={{ textAlign: 'right' }}>Wholesale</th>
                <th>Location</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
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
                      <td style={{ fontWeight: 600 }}>
                        <div>{p.name}</div>
                        {p.brand && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.brand}</div>}
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem' }}>
                        <div>{p.sku}</div>
                        {p.barcode && <div style={{ color: '#64748b' }}>{p.barcode}</div>}
                      </td>
                      <td>{p.category_name || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`}>
                          {p.current_stock}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: '#64748b' }}>{p.unit}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(p.purchase_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>{formatPKR(p.sale_price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPKR(p.wholesale_price)}</td>
                      <td><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.storage_location || 'Freezer'}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => openBarcode(p)}
                            className="btn btn-secondary btn-sm"
                            title="Print Barcode Labels"
                          >
                            <Barcode size={13} />
                            <span>Barcode</span>
                          </button>
                          <button
                            onClick={() => viewProductDetail(p.id)}
                            className="btn btn-secondary btn-sm"
                            title="View Batches & Movements"
                          >
                            <Eye size={13} />
                            <span>Batches</span>
                          </button>
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
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Add New Frozen Food Item</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
    </div>
  );
}
