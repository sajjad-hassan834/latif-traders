import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  Printer,
  Barcode,
  User,
  CreditCard,
  Percent,
  RefreshCw,
  X,
  PlusCircle,
  Zap,
  Pause,
  Play,
  HelpCircle,
  Volume2,
  VolumeX,
  UserPlus,
  TrendingUp,
  Edit2
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR } from '../utils/formatters';
import { playBeep, isAudioMuted, toggleAudioMute } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';

function getCategoryIcon(catName = '') {
  const name = catName.toLowerCase();
  if (name.includes('chicken') || name.includes('nugget')) return '🍗';
  if (name.includes('fries') || name.includes('potato')) return '🍟';
  if (name.includes('paratha') || name.includes('roti') || name.includes('bread')) return '🫓';
  if (name.includes('samosa') || name.includes('roll')) return '🥟';
  if (name.includes('kabab') || name.includes('meatball')) return '🍢';
  if (name.includes('fish') || name.includes('seafood') || name.includes('prawn')) return '🐟';
  if (name.includes('ice cream') || name.includes('sweet') || name.includes('dessert')) return '🍨';
  return '❄️';
}

export default function PosSales() {
  const { isAdmin, canViewFinances } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(1);
  const [saleType, setSaleType] = useState('Retail');
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Audio mute state
  const [muted, setMuted] = useState(isAudioMuted);

  // Held Carts (Park Bill) state
  const [heldOrders, setHeldOrders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lt_pos_held_orders') || '[]');
    } catch {
      return [];
    }
  });
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Quick Add Item Modal State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickItem, setQuickItem] = useState({
    name: '',
    sku: '',
    sale_price: '',
    purchase_price: '',
    unit: 'pkt',
    opening_stock: '10'
  });

  // Quick Add Customer Modal State
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [quickCust, setQuickCust] = useState({
    name: '',
    phone: '',
    address: '',
    customer_type: 'Retail'
  });

  // Keyboard Shortcuts Modal State
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Editing inline item price/discount modal or state
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [tempItemPrice, setTempItemPrice] = useState('');
  const [tempItemDiscount, setTempItemDiscount] = useState('');

  // Mobile POS view switcher (catalog vs cart)
  const [mobileTab, setMobileTab] = useState('catalog');

  const searchInputRef = useRef(null);

  // Save held orders to localStorage
  useEffect(() => {
    localStorage.setItem('lt_pos_held_orders', JSON.stringify(heldOrders));
  }, [heldOrders]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, custRes] = await Promise.all([
        api.get('/products?status=active'),
        api.get('/products/meta/categories'),
        api.get('/parties/customers')
      ]);

      if (prodRes.success) setProducts(prodRes.products);
      if (catRes.success) setCategories(catRes.categories);
      if (custRes.success) setCustomers(custRes.customers);
    } catch (err) {
      console.error('POS data loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in an input (except F-keys and Escape)
      const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === 'F2' || (!isInput && e.key === '/')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleCompleteSale();
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleHoldCurrentOrder();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setShowHeldModal(prev => !prev);
      } else if (!isInput && e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      } else if (e.key === 'Escape') {
        setShowQuickAdd(false);
        setShowQuickCustomer(false);
        setShowHeldModal(false);
        setShowShortcuts(false);
        setEditingItemIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCustomer, saleType, discount, paidAmount, paymentMethod, showQuickAdd, showQuickCustomer, heldOrders]);

  const handleToggleSound = () => {
    const next = toggleAudioMute();
    setMuted(next);
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.category_id === Number(selectedCategory);
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const handleBarcodeSubmit = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      const exactMatch = products.find(p =>
        (p.barcode && p.barcode.toLowerCase() === searchQuery.trim().toLowerCase()) ||
        p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
      );

      if (exactMatch) {
        addToCart(exactMatch);
        setSearchQuery('');
      } else if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearchQuery('');
      }
    }
  };

  const addToCart = (product) => {
    setErrorMsg('');
    const existingIndex = cart.findIndex(item => item.product_id === product.id);
    const currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;

    if (currentQtyInCart + 1 > product.current_stock) {
      playBeep('error');
      setErrorMsg(`Only ${product.current_stock} ${product.unit} available in stock.`);
      return;
    }

    playBeep('add');

    const price = saleType === 'Wholesale' && product.wholesale_price > 0
      ? product.wholesale_price
      : product.sale_price;

    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        unit_price: price,
        purchase_price: product.purchase_price || 0,
        quantity: 1,
        discount: 0,
        current_stock: product.current_stock
      }]);
    }
  };

  const updateQuantity = (index, delta) => {
    setErrorMsg('');
    const item = cart[index];
    const newQty = item.quantity + delta;

    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }

    if (newQty > item.current_stock) {
      playBeep('error');
      setErrorMsg(`Stock limit reached for ${item.name} (${item.current_stock} available).`);
      return;
    }

    playBeep('add');
    const updated = [...cart];
    updated[index].quantity = newQty;
    setCart(updated);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setPaidAmount('');
    setNotes('');
    setErrorMsg('');
  };

  // Hold / Resume Order Feature
  const handleHoldCurrentOrder = () => {
    if (cart.length === 0) {
      setErrorMsg('Cannot hold an empty cart.');
      return;
    }

    const currentCustomerObj = customers.find(c => c.id === Number(selectedCustomer));
    const customerLabel = currentCustomerObj ? currentCustomerObj.name : 'Walk-in';

    const newHeld = {
      id: Date.now(),
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer_id: selectedCustomer,
      customer_name: customerLabel,
      sale_type: saleType,
      discount: discount,
      notes: notes,
      items: cart,
      subtotal: subtotal,
      grand_total: grandTotal
    };

    setHeldOrders([newHeld, ...heldOrders]);
    playBeep('success');
    setSuccessMsg(`Cart parked for "${customerLabel}". Counter ready for next customer.`);
    setTimeout(() => setSuccessMsg(''), 4000);
    clearCart();
  };

  const handleResumeHeldOrder = (held) => {
    if (cart.length > 0) {
      if (!window.confirm('Current cart has items! Do you want to replace it with the resumed order?')) {
        return;
      }
    }
    setCart(held.items);
    setSelectedCustomer(held.customer_id);
    setSaleType(held.sale_type || 'Retail');
    setDiscount(held.discount || 0);
    setNotes(held.notes || '');
    setPaidAmount('');
    setHeldOrders(heldOrders.filter(h => h.id !== held.id));
    setShowHeldModal(false);
    playBeep('add');
  };

  const handleDiscardHeldOrder = (id) => {
    setHeldOrders(heldOrders.filter(h => h.id !== id));
  };

  // Inline Price & Discount Edit
  const handleStartEditItem = (idx) => {
    setEditingItemIndex(idx);
    setTempItemPrice(String(cart[idx].unit_price));
    setTempItemDiscount(String(cart[idx].discount || 0));
  };

  const handleSaveItemEdit = (idx) => {
    const updated = [...cart];
    updated[idx].unit_price = Math.max(0, Number(tempItemPrice) || 0);
    updated[idx].discount = Math.max(0, Number(tempItemDiscount) || 0);
    setCart(updated);
    setEditingItemIndex(null);
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.unit_price) - (item.discount || 0), 0);
  const totalCost = cart.reduce((acc, item) => acc + (item.quantity * (item.purchase_price || 0)), 0);
  const totalDiscount = Number(discount) || 0;
  const grandTotal = Math.max(0, subtotal - totalDiscount);
  const estimatedProfit = Math.max(0, grandTotal - totalCost);
  const profitMarginPct = grandTotal > 0 ? ((estimatedProfit / grandTotal) * 100).toFixed(1) : 0;

  const enteredPaid = paidAmount === '' ? grandTotal : Number(paidAmount);
  const balanceDue = Math.max(0, grandTotal - enteredPaid);
  const changeDue = Math.max(0, enteredPaid - grandTotal);

  const handleCustomerChange = (custId) => {
    setSelectedCustomer(custId);
    const cust = customers.find(c => c.id === Number(custId));
    if (cust && cust.customer_type === 'Wholesale') {
      setSaleType('Wholesale');
      setCart(cart.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        return {
          ...item,
          unit_price: (prod?.wholesale_price > 0 ? prod.wholesale_price : prod?.sale_price) || item.unit_price
        };
      }));
    } else {
      setSaleType('Retail');
      setCart(cart.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        return {
          ...item,
          unit_price: prod?.sale_price || item.unit_price
        };
      }));
    }
  };

  const setQuickCash = (amt) => {
    if (amt === 'exact') {
      setPaidAmount(String(grandTotal));
    } else {
      setPaidAmount(String(amt));
    }
  };

  const handleCompleteSale = async () => {
    setErrorMsg('');
    if (cart.length === 0) {
      playBeep('error');
      setErrorMsg('Cart is empty.');
      return;
    }

    if (balanceDue > 0 && Number(selectedCustomer) === 1) {
      playBeep('error');
      setErrorMsg('Walk-in retail customer cannot have an unpaid balance. Please select a registered customer for credit sales.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customer_id: Number(selectedCustomer) === 1 ? null : Number(selectedCustomer),
        sale_type: saleType,
        sale_date: new Date().toISOString().split('T')[0],
        items: cart.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit: i.unit,
          unit_price: i.unit_price,
          discount: i.discount || 0
        })),
        discount: totalDiscount,
        tax: 0,
        paid_amount: enteredPaid,
        payment_method: paymentMethod,
        notes: notes.trim()
      };

      const res = await api.post('/sales', payload);
      if (res.success) {
        playBeep('success');
        const saleDetail = await api.get(`/sales/${res.data.id}`);
        setCompletedSale(saleDetail);
        clearCart();
        loadInitialData();
      }
    } catch (err) {
      playBeep('error');
      setErrorMsg(err.message || 'Failed to complete transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Add Item Directly in POS
  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const sku = quickItem.sku.trim() || `ITM-${Date.now().toString().slice(-6)}`;
      const res = await api.post('/products', {
        name: quickItem.name.trim(),
        sku,
        sale_price: Number(quickItem.sale_price) || 0,
        purchase_price: Number(quickItem.purchase_price) || 0,
        unit: quickItem.unit,
        opening_stock: Number(quickItem.opening_stock) || 0,
        min_stock_level: 5
      });

      if (res.success) {
        setShowQuickAdd(false);
        setQuickItem({ name: '', sku: '', sale_price: '', purchase_price: '', unit: 'pkt', opening_stock: '10' });
        await loadInitialData();
        const newProduct = {
          id: res.id,
          name: quickItem.name.trim(),
          sku,
          unit: quickItem.unit,
          sale_price: Number(quickItem.sale_price),
          wholesale_price: Number(quickItem.sale_price),
          purchase_price: Number(quickItem.purchase_price) || 0,
          current_stock: Number(quickItem.opening_stock)
        };
        addToCart(newProduct);
      }
    } catch (err) {
      alert(err.message || 'Failed to create quick product');
    }
  };

  // Quick Add Customer Directly in POS
  const handleQuickCustomerSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/parties/customers', {
        name: quickCust.name.trim(),
        phone: quickCust.phone.trim(),
        address: quickCust.address.trim(),
        customer_type: quickCust.customer_type
      });

      if (res.success) {
        setShowQuickCustomer(false);
        setQuickCust({ name: '', phone: '', address: '', customer_type: 'Retail' });
        const custRes = await api.get('/parties/customers');
        if (custRes.success) {
          setCustomers(custRes.customers);
          handleCustomerChange(res.id);
        }
        playBeep('success');
      }
    } catch (err) {
      alert(err.message || 'Failed to create customer');
    }
  };

  return (
    <div>
      {errorMsg && (
        <div style={{
          padding: '0.4rem 0.75rem',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#991b1b',
          marginBottom: '0.4rem',
          fontSize: '0.775rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ color: '#991b1b' }}><X size={14} /></button>
        </div>
      )}

      {successMsg && (
        <div style={{
          padding: '0.4rem 0.75rem',
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          color: '#166534',
          marginBottom: '0.4rem',
          fontSize: '0.775rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ color: '#166534' }}><X size={14} /></button>
        </div>
      )}

      {/* MOBILE VIEW SWITCHER TABS (PHONES & TABLETS) */}
      <div className="pos-mobile-nav">
        <button
          type="button"
          className={`pos-mobile-tab-btn ${mobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setMobileTab('catalog')}
        >
          <span>📦 Products ({filteredProducts.length})</span>
        </button>
        <button
          type="button"
          className={`pos-mobile-tab-btn ${mobileTab === 'cart' ? 'active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          <span>🛒 Cart ({cart.length}) {grandTotal > 0 ? `• ${formatPKR(grandTotal)}` : ''}</span>
        </button>
      </div>

      <div className="pos-layout">
        {/* LEFT CATALOG PANEL */}
        <div className={`pos-catalog ${mobileTab !== 'catalog' ? 'pos-mobile-hidden' : ''}`}>
          {/* SEARCH & ACTION BAR */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '9px', top: '8px', color: '#94a3b8' }} />
              <input
                ref={searchInputRef}
                type="text"
                className="form-control"
                style={{ paddingLeft: '1.85rem', height: '30px', fontSize: '0.775rem' }}
                placeholder="Scan barcode or search name/SKU... [F2 or /]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleBarcodeSubmit}
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '8px', top: '7px', color: '#94a3b8' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowQuickAdd(true)}
              className="btn btn-secondary btn-sm"
              title="Quick Add New Product to Database"
              style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.55rem' }}
            >
              <PlusCircle size={13} color="#0284c7" />
              <span>+ Item</span>
            </button>

            <button
              onClick={loadInitialData}
              className="btn btn-secondary btn-sm"
              title="Refresh Products"
              style={{ padding: '0 0.45rem', height: '30px' }}
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* CATEGORIES HORIZONTAL PILLS */}
          <div className="pos-categories-bar horizontal-scroll-tabs">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`pos-cat-pill ${selectedCategory === 'ALL' ? 'active' : ''}`}
            >
              <span>❄️</span>
              <span>All Products</span>
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`pos-cat-pill ${selectedCategory === c.id ? 'active' : ''}`}
              >
                <span>{getCategoryIcon(c.name)}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          {/* COMPACT PRODUCT TILES GRID */}
          <div className="pos-products-grid">
            {filteredProducts.map(p => {
              const inStock = p.current_stock > 0;
              const isLow = p.current_stock <= p.min_stock_level;
              const displayPrice = saleType === 'Wholesale' && p.wholesale_price > 0 ? p.wholesale_price : p.sale_price;

              return (
                <div
                  key={p.id}
                  className={`pos-product-card ${!inStock ? 'out-of-stock' : ''}`}
                  onClick={() => inStock && addToCart(p)}
                >
                  <div>
                    <div className="pos-card-header">
                      <div className="pos-item-icon">
                        {getCategoryIcon(p.category_name)}
                      </div>
                      <span className={`badge ${!inStock ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`}>
                        {p.current_stock} {p.unit}
                      </span>
                    </div>

                    <div className="pos-item-brand">{p.brand || 'Frozen'}</div>
                    <div className="pos-item-title" title={p.name}>{p.name}</div>
                  </div>

                  <div className="pos-card-footer">
                    <div>
                      <div className="pos-item-price">{formatPKR(displayPrice)}</div>
                      <div className="pos-item-unit">per {p.unit}</div>
                    </div>
                    <button
                      type="button"
                      disabled={!inStock}
                      style={{
                        background: inStock ? '#f0f9ff' : '#f1f5f9',
                        color: inStock ? '#0284c7' : '#94a3b8',
                        border: '1px solid #bae6fd',
                        borderRadius: '4px',
                        padding: '2px 5px',
                        fontSize: '10px',
                        fontWeight: 700
                      }}
                    >
                      + ADD
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* BOTTOM SHORTCUTS HELPER */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.675rem',
            color: '#64748b',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '0.3rem',
            marginTop: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#0284c7', fontWeight: 600 }}
              >
                <HelpCircle size={12} />
                <span>Shortcuts [?]</span>
              </button>
              <span>•</span>
              <span><strong>[F2]</strong> Search</span>
              <span>•</span>
              <span><strong>[F4]</strong> Complete</span>
              <span>•</span>
              <span><strong>[F7]</strong> Hold Order</span>
            </div>

            <button
              type="button"
              onClick={handleToggleSound}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: muted ? '#94a3b8' : '#10b981',
                fontWeight: 600
              }}
              title="Toggle Audio Feedback"
            >
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              <span>{muted ? 'Muted' : 'Beep ON'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT CART DRAWER */}
        <div className={`pos-cart ${mobileTab !== 'cart' ? 'pos-mobile-hidden' : ''}`}>
          <div className="pos-cart-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, fontSize: '0.825rem' }}>
                <button
                  type="button"
                  onClick={() => setMobileTab('catalog')}
                  className="btn btn-secondary btn-sm pos-mobile-back-btn"
                  style={{ fontSize: '0.675rem', padding: '1px 5px', height: '22px', marginRight: '3px' }}
                >
                  ← Products
                </button>
                <ShoppingCart size={14} color="var(--primary)" />
                <span>Sales Cart</span>
                <span className="badge badge-info" style={{ marginLeft: '2px', fontSize: '0.675rem', padding: '1px 5px' }}>
                  {cart.length}
                </span>

                {/* HELD ORDERS BADGE */}
                {heldOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHeldModal(true)}
                    className="badge badge-warning"
                    style={{ marginLeft: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                    title="Click to view & resume held orders [F8]"
                  >
                    <Pause size={10} />
                    <span>Held ({heldOrders.length})</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleHoldCurrentOrder}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.675rem', padding: '1px 5px', height: '22px' }}
                    title="Park / Hold current cart to serve next customer [F7]"
                  >
                    <Pause size={11} color="#f59e0b" /> Hold
                  </button>
                )}

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    style={{ color: '#ef4444', fontSize: '0.675rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* CUSTOMER SELECT & QUICK ADD CUSTOMER */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.25rem', alignItems: 'center' }}>
              <select
                className="form-control"
                value={selectedCustomer}
                onChange={(e) => handleCustomerChange(e.target.value)}
                style={{ fontSize: '0.725rem', height: '26px', padding: '1px 4px' }}
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.current_balance > 0 ? `(Bal: ₨ ${c.current_balance})` : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowQuickCustomer(true)}
                title="Quick Add Customer"
                style={{ height: '26px', padding: '0 5px' }}
              >
                <UserPlus size={12} color="#0284c7" />
              </button>

              <button
                type="button"
                className={`btn btn-sm ${saleType === 'Wholesale' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  const nextType = saleType === 'Retail' ? 'Wholesale' : 'Retail';
                  setSaleType(nextType);
                }}
                style={{ fontSize: '0.675rem', height: '26px', padding: '0 6px' }}
              >
                {saleType}
              </button>
            </div>
          </div>

          {/* CART ITEMS LIST */}
          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem', color: '#94a3b8', margin: 'auto' }}>
                <ShoppingCart size={24} style={{ margin: '0 auto 0.25rem', opacity: 0.35 }} />
                <div style={{ fontWeight: 600, fontSize: '0.775rem' }}>Cart is empty</div>
                <div style={{ fontSize: '0.675rem' }}>Click or scan products to add</div>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="pos-cart-item">
                  <div style={{ flex: 1, paddingRight: '0.3rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.75rem', color: '#0f172a', lineHeight: 1.15 }}>
                      {item.name}
                    </div>

                    {editingItemIndex === idx ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px' }}>
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '60px', height: '20px', fontSize: '0.675rem', padding: '0 3px' }}
                          placeholder="Price"
                          value={tempItemPrice}
                          onChange={(e) => setTempItemPrice(e.target.value)}
                        />
                        <span style={{ fontSize: '0.65rem' }}>Disc:</span>
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '45px', height: '20px', fontSize: '0.675rem', padding: '0 3px' }}
                          placeholder="Disc"
                          value={tempItemDiscount}
                          onChange={(e) => setTempItemDiscount(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveItemEdit(idx)}
                          className="btn btn-primary btn-sm"
                          style={{ height: '20px', padding: '0 5px', fontSize: '0.65rem' }}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItemIndex(null)}
                          style={{ fontSize: '0.7rem', color: '#64748b' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span>
                          {formatPKR(item.unit_price)} × {item.quantity} {item.discount > 0 ? `(-₨ ${item.discount})` : ''} = <strong>{formatPKR((item.quantity * item.unit_price) - (item.discount || 0))}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartEditItem(idx)}
                          title="Edit Line Price / Discount"
                          style={{ color: '#0284c7', padding: '0 2px' }}
                        >
                          <Edit2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div className="pos-stepper">
                      <button
                        type="button"
                        className="pos-stepper-btn"
                        onClick={() => updateQuantity(idx, -1)}
                      >
                        <Minus size={9} />
                      </button>
                      <span className="pos-stepper-qty">{item.quantity}</span>
                      <button
                        type="button"
                        className="pos-stepper-btn"
                        onClick={() => updateQuantity(idx, 1)}
                      >
                        <Plus size={9} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(idx)}
                      style={{ color: '#ef4444', padding: '2px' }}
                      title="Remove"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* CART SUMMARY & CHECKOUT */}
          <div className="pos-cart-footer">
            {/* Quick Cash Presets */}
            <div className="quick-cash-chips">
              <button type="button" className="cash-chip" onClick={() => setQuickCash('exact')}>Exact</button>
              <button type="button" className="cash-chip" onClick={() => setQuickCash(500)}>₨ 500</button>
              <button type="button" className="cash-chip" onClick={() => setQuickCash(1000)}>₨ 1,000</button>
              <button type="button" className="cash-chip" onClick={() => setQuickCash(2000)}>₨ 2,000</button>
              <button type="button" className="cash-chip" onClick={() => setQuickCash(5000)}>₨ 5,000</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginBottom: '0.35rem', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Subtotal:</span>
                <span>{formatPKR(subtotal)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748b' }}>Discount (PKR):</span>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: '65px', height: '22px', padding: '1px 4px', fontSize: '0.7rem', textAlign: 'right' }}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  min="0"
                />
              </div>

              {/* ESTIMATED PROFIT FOR ADMIN / MANAGER */}
              {(isAdmin || canViewFinances) && cart.length > 0 && totalCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontSize: '0.675rem', fontWeight: 600 }}>
                  <span>Est. Margin:</span>
                  <span>+{formatPKR(estimatedProfit)} ({profitMarginPct}%)</span>
                </div>
              )}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1rem',
                fontWeight: 800,
                borderTop: '1px solid #e2e8f0',
                paddingTop: '0.25rem',
                marginTop: '0.1rem'
              }}>
                <span>Grand Total:</span>
                <span style={{ color: '#0284c7' }}>{formatPKR(grandTotal)}</span>
              </div>
            </div>

            {/* PAID & METHOD */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginBottom: '0.4rem', marginTop: '0.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.675rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Paid (PKR)
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder={String(grandTotal)}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  style={{ width: '100%', height: '28px', fontWeight: 700, fontSize: '0.8rem', padding: '0 6px', borderRadius: '5px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.675rem', fontWeight: 700, color: '#475569', marginBottom: '3px' }}>
                  Method
                </label>
                <select
                  className="form-control"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%', height: '28px', fontSize: '0.75rem', fontWeight: 600, padding: '0 6px', borderRadius: '5px' }}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                </select>
              </div>
            </div>

            {/* STATUS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.35rem', fontWeight: 600 }}>
              {balanceDue > 0 ? (
                <span style={{ color: '#ef4444' }}>Credit Due: {formatPKR(balanceDue)}</span>
              ) : changeDue > 0 ? (
                <span style={{ color: '#10b981' }}>Change Due: {formatPKR(changeDue)}</span>
              ) : (
                <span style={{ color: '#10b981' }}>Fully Settled</span>
              )}
            </div>

            <button
              onClick={handleCompleteSale}
              disabled={submitting || cart.length === 0}
              className="btn btn-primary"
              style={{ width: '100%', height: '32px', fontSize: '0.8rem' }}
            >
              {submitting ? 'Processing...' : `Complete Sale • ${formatPKR(grandTotal)}`}
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING CHECKOUT BAR ON MOBILE */}
      {mobileTab === 'catalog' && cart.length > 0 && (
        <div className="pos-mobile-floating-bar">
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="btn btn-primary"
            style={{
              width: '100%',
              height: '38px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 0.85rem',
              fontSize: '0.8rem',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.45)'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ShoppingCart size={15} />
              <span>{cart.length} item{cart.length > 1 ? 's' : ''} in cart</span>
            </span>
            <strong>Checkout • {formatPKR(grandTotal)} →</strong>
          </button>
        </div>
      )}

      {/* HELD ORDERS MODAL */}
      {showHeldModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Pause size={16} color="#f59e0b" />
                <h3 style={{ fontSize: '0.95rem' }}>Parked / Held Carts ({heldOrders.length})</h3>
              </div>
              <button onClick={() => setShowHeldModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {heldOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                  No held orders currently.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {heldOrders.map((held) => (
                    <div
                      key={held.id}
                      style={{
                        padding: '0.6rem 0.75rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>
                          {held.customer_name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Parked at {held.created_at} • {held.items.length} item(s) • Total: <strong>{formatPKR(held.grand_total)}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ height: '26px', fontSize: '0.725rem', padding: '0 0.5rem' }}
                          onClick={() => handleResumeHeldOrder(held)}
                        >
                          <Play size={11} /> Resume
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ height: '26px', fontSize: '0.725rem', padding: '0 0.4rem', color: '#ef4444' }}
                          onClick={() => handleDiscardHeldOrder(held.id)}
                          title="Discard Parked Bill"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowHeldModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD PRODUCT MODAL */}
      {showQuickAdd && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={15} color="var(--primary)" />
                <h3 style={{ fontSize: '0.95rem' }}>Quick Add Product to POS</h3>
              </div>
              <button onClick={() => setShowQuickAdd(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickAddSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Dawn Chapli Kabab 4s"
                    value={quickItem.name}
                    onChange={(e) => setQuickItem({ ...quickItem, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="form-grid-2" style={{ gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Sale Price (PKR) *</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      placeholder="Retail rate"
                      value={quickItem.sale_price}
                      onChange={(e) => setQuickItem({ ...quickItem, sale_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price (PKR)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Buying rate"
                      value={quickItem.purchase_price}
                      onChange={(e) => setQuickItem({ ...quickItem, purchase_price: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2" style={{ gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select
                      className="form-control"
                      value={quickItem.unit}
                      onChange={(e) => setQuickItem({ ...quickItem, unit: e.target.value })}
                    >
                      <option value="pkt">Packet (pkt)</option>
                      <option value="box">Box (box)</option>
                      <option value="ctn">Carton (ctn)</option>
                      <option value="kg">Kilogram (kg)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Opening Stock</label>
                    <input
                      type="number"
                      className="form-control"
                      value={quickItem.opening_stock}
                      onChange={(e) => setQuickItem({ ...quickItem, opening_stock: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowQuickAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save & Add to Cart</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL */}
      {showQuickCustomer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserPlus size={15} color="var(--primary)" />
                <h3 style={{ fontSize: '0.95rem' }}>Quick Register Customer</h3>
              </div>
              <button onClick={() => setShowQuickCustomer(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickCustomerSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Tariq Mehmood"
                    value={quickCust.name}
                    onChange={(e) => setQuickCust({ ...quickCust, name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="0300-1234567"
                    value={quickCust.phone}
                    onChange={(e) => setQuickCust({ ...quickCust, phone: e.target.value })}
                  />
                </div>

                <div className="form-grid-2" style={{ gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Customer Type</label>
                    <select
                      className="form-control"
                      value={quickCust.customer_type}
                      onChange={(e) => setQuickCust({ ...quickCust, customer_type: e.target.value })}
                    >
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Area / Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. F-10 Markaz"
                      value={quickCust.address}
                      onChange={(e) => setQuickCust({ ...quickCust, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowQuickCustomer(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Create & Select</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KEYBOARD SHORTCUTS CHEAT SHEET MODAL */}
      {showShortcuts && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <HelpCircle size={16} color="var(--primary)" />
                <h3 style={{ fontSize: '0.95rem' }}>Cashier POS Keyboard Shortcuts</h3>
              </div>
              <button onClick={() => setShowShortcuts(false)}>✕</button>
            </div>
            <div className="modal-body">
              <table className="table" style={{ fontSize: '0.775rem' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '120px' }}><kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>F2</kbd> or <kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>/</kbd></td>
                    <td>Focus Barcode Scanner / Product Search</td>
                  </tr>
                  <tr>
                    <td><kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Enter</kbd></td>
                    <td>Add matched barcode or searched item to cart</td>
                  </tr>
                  <tr>
                    <td><kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>F4</kbd></td>
                    <td>Complete Sale & Process Checkout</td>
                  </tr>
                  <tr>
                    <td><kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>F7</kbd></td>
                    <td>Hold / Park Current Cart for next customer</td>
                  </tr>
                  <tr>
                    <td><kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>F8</kbd></td>
                    <td>Open Parked / Held Carts list to resume</td>
                  </tr>
                  <tr>
                    <td><kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>?</kbd></td>
                    <td>Show this shortcuts help dialog</td>
                  </tr>
                  <tr>
                    <td><kbd style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Esc</kbd></td>
                    <td>Close any active modal or clear selection</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowShortcuts(false)}>
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL UPON SUCCESS */}
      {completedSale && (
        <PrintInvoiceModal
          sale={completedSale.sale}
          items={completedSale.items}
          settings={completedSale.settings}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </div>
  );
}
