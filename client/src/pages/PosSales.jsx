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
  Edit2,
  FileText,
  PackageOpen,
  Package,
  List,
  LayoutGrid
} from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { playBeep, isAudioMuted, toggleAudioMute } from '../utils/audio';
import { useAuth } from '../context/AuthContext';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';
import SearchableSelect from '../components/common/SearchableSelect';

function getCategoryIcon(catName = '') {
  const name = String(catName || '').toLowerCase();
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

  // Recent Receipts / Invoices View Modal State
  const [showRecentInvoicesModal, setShowRecentInvoicesModal] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [recentSearch, setRecentSearch] = useState('');

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

  // Catalog View Mode ('list' compact view or 'grid' card view)
  const [catalogView, setCatalogView] = useState('list');

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
      const [prodResult, catResult, custResult] = await Promise.allSettled([
        api.get('/products?status=active'),
        api.get('/products/meta/categories'),
        api.get('/parties/customers')
      ]);

      if (prodResult.status === 'fulfilled' && prodResult.value.success) {
        setProducts(prodResult.value.products);
      } else {
        const errMsg = prodResult.status === 'rejected' ? prodResult.reason?.message : 'Failed to load products';
        setErrorMsg(errMsg);
        console.error('Products fetch error:', prodResult.reason || prodResult.value);
      }

      if (catResult.status === 'fulfilled' && catResult.value.success) {
        setCategories(catResult.value.categories);
      } else {
        console.error('Categories fetch error:', catResult.reason || catResult.value);
      }

      if (custResult.status === 'fulfilled' && custResult.value.success) {
        setCustomers(custResult.value.customers);
      } else {
        console.error('Customers fetch error:', custResult.reason || custResult.value);
      }
    } catch (err) {
      console.error('POS data loading error:', err);
      setErrorMsg('Failed to load POS data. Please refresh.');
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
    const q = String(searchQuery || '').toLowerCase().trim();
    if (!matchesCat) return false;
    if (!q) return true;
    const nameStr = String(p.name || '').toLowerCase();
    const skuStr = String(p.sku || '').toLowerCase();
    const barcodeStr = String(p.barcode || '').toLowerCase();
    const brandStr = String(p.brand || '').toLowerCase();
    return nameStr.includes(q) || skuStr.includes(q) || barcodeStr.includes(q) || brandStr.includes(q);
  });

  const handleBarcodeSubmit = (e) => {
    if (e.key === 'Enter' && searchQuery?.trim()) {
      e.preventDefault();
      const q = String(searchQuery).trim().toLowerCase();
      const exactMatch = products.find(p =>
        (p.barcode && String(p.barcode).toLowerCase() === q) ||
        (p.sku && String(p.sku).toLowerCase() === q)
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

  // Dynamic FIFO Tiered Multi-Batch Pricing Calculator
  const calculateFifoTieredPricing = (product, requestedQty, currentSaleType = saleType) => {
    const qty = Number(requestedQty) || 0;
    if (qty <= 0) {
      const baseSale = currentSaleType === 'Wholesale' && Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : Number(product.sale_price);
      return {
        totalSale: 0,
        totalCost: 0,
        effectiveRate: baseSale,
        effectiveCost: Number(product.purchase_price) || 0,
        breakdownText: ''
      };
    }

    const activeBatches = (product.batches && product.batches.length > 0)
      ? product.batches
      : [{
          id: product.fifo_batch_id || 0,
          batch_no: product.fifo_batch_no || 'Standard',
          quantity: product.current_stock || 999999,
          sale_price: product.sale_price,
          wholesale_price: product.wholesale_price,
          purchase_price: product.purchase_price
        }];

    let remaining = qty;
    let totalSale = 0;
    let totalCost = 0;
    const breakdown = [];

    for (const b of activeBatches) {
      if (remaining <= 0) break;
      const bQty = Number(b.quantity) || 0;
      if (bQty <= 0) continue;
      const take = Math.min(bQty, remaining);

      const bRate = currentSaleType === 'Wholesale' && Number(b.wholesale_price) > 0 ? Number(b.wholesale_price) : Number(b.sale_price);
      const bCost = Number(b.purchase_price) || 0;

      totalSale += (take * bRate);
      totalCost += (take * bCost);
      breakdown.push({
        batch_id: b.id,
        batch_no: b.batch_no,
        qty: take,
        rate: bRate,
        cost: bCost
      });

      remaining -= take;
    }

    // If requested quantity exceeds active batches (e.g. negative stock allowed or extra qty)
    if (remaining > 0) {
      const lastBatch = activeBatches[activeBatches.length - 1];
      const fallbackRate = currentSaleType === 'Wholesale' && Number(lastBatch?.wholesale_price || product.wholesale_price) > 0
        ? Number(lastBatch?.wholesale_price || product.wholesale_price)
        : Number(lastBatch?.sale_price || product.sale_price);
      const fallbackCost = Number(lastBatch?.purchase_price || product.purchase_price) || 0;

      totalSale += (remaining * fallbackRate);
      totalCost += (remaining * fallbackCost);
      breakdown.push({
        batch_id: lastBatch?.id || 0,
        batch_no: lastBatch?.batch_no || 'Additional',
        qty: remaining,
        rate: fallbackRate,
        cost: fallbackCost
      });
    }

    const effectiveRate = qty > 0 ? Math.round((totalSale / qty) * 100) / 100 : 0;
    const effectiveCost = qty > 0 ? Math.round((totalCost / qty) * 100) / 100 : 0;

    let breakdownText = '';
    if (breakdown.length > 1) {
      breakdownText = breakdown.map(b => `${b.qty} @ ₨${b.rate}`).join(' + ');
    }

    return {
      totalSale,
      totalCost,
      effectiveRate,
      effectiveCost,
      breakdownText
    };
  };

  const addToCart = (product) => {
    setErrorMsg('');
    const existingIndex = cart.findIndex(item => item.product_id === product.id);
    const currentQtyInCart = existingIndex >= 0 ? (Number(cart[existingIndex].quantity) || 0) : 0;
    const newQty = currentQtyInCart + 1;

    if (newQty > product.current_stock) {
      playBeep('error');
      setErrorMsg(`Only ${product.current_stock} ${product.unit} available in stock.`);
      return;
    }

    playBeep('add');

    if (existingIndex >= 0) {
      const updated = [...cart];
      const item = updated[existingIndex];
      item.quantity = newQty;

      if (!item.is_manual_rate) {
        const fifo = calculateFifoTieredPricing(product, newQty, saleType);
        item.unit_price = fifo.effectiveRate;
        item.total_price = fifo.totalSale;
        item.purchase_price = fifo.effectiveCost;
        item.fifo_breakdown = fifo.breakdownText;
      } else {
        item.total_price = newQty * item.unit_price;
      }

      setCart(updated);
    } else {
      const fifo = calculateFifoTieredPricing(product, 1, saleType);
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        brand: product.brand,
        company_name: product.brand || product.supplier_name || product.company_name,
        supplier_name: product.supplier_name,
        unit_price: fifo.effectiveRate,
        total_price: fifo.totalSale,
        original_price: product.sale_price,
        purchase_price: fifo.effectiveCost,
        fifo_batch_no: product.fifo_batch_no,
        fifo_batch_qty: product.fifo_batch_qty,
        fifo_breakdown: fifo.breakdownText,
        quantity: 1,
        discount: 0,
        current_stock: product.current_stock,
        is_manual_rate: false
      }]);
    }
  };

  const handleSetQuantity = (index, val) => {
    setErrorMsg('');
    const raw = String(val);
    if (raw === '') {
      const updated = [...cart];
      updated[index].quantity = '';
      setCart(updated);
      return;
    }
    const qty = Number(raw);
    if (isNaN(qty) || qty < 0) return;
    const item = cart[index];
    if (qty > item.current_stock) {
      playBeep('error');
      setErrorMsg(`Stock limit reached for ${item.name} (${item.current_stock} available).`);
    }

    const prod = products.find(p => p.id === item.product_id) || item;
    const updated = [...cart];
    updated[index].quantity = qty;

    if (!item.is_manual_rate) {
      const fifo = calculateFifoTieredPricing(prod, qty, saleType);
      updated[index].unit_price = fifo.effectiveRate;
      updated[index].total_price = fifo.totalSale;
      updated[index].purchase_price = fifo.effectiveCost;
      updated[index].fifo_breakdown = fifo.breakdownText;
    } else {
      updated[index].total_price = qty * item.unit_price;
    }

    setCart(updated);
  };

  const updateQuantity = (index, delta) => {
    setErrorMsg('');
    const item = cart[index];
    const currentQty = Number(item.quantity) || 0;
    const newQty = currentQty + delta;

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
    const prod = products.find(p => p.id === item.product_id) || item;
    const updated = [...cart];
    updated[index].quantity = newQty;

    if (!item.is_manual_rate) {
      const fifo = calculateFifoTieredPricing(prod, newQty, saleType);
      updated[index].unit_price = fifo.effectiveRate;
      updated[index].total_price = fifo.totalSale;
      updated[index].purchase_price = fifo.effectiveCost;
      updated[index].fifo_breakdown = fifo.breakdownText;
    } else {
      updated[index].total_price = newQty * item.unit_price;
    }

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
    const newPrice = Math.max(0, Number(tempItemPrice) || 0);
    updated[idx].unit_price = newPrice;
    updated[idx].is_manual_rate = true;
    updated[idx].fifo_breakdown = '';
    updated[idx].total_price = (Number(updated[idx].quantity) || 0) * newPrice;
    updated[idx].discount = Math.max(0, Number(tempItemDiscount) || 0);
    setCart(updated);
    setEditingItemIndex(null);
  };

  const handleUpdateCartRate = (idx, newRate) => {
    const updated = [...cart];
    const rate = Math.max(0, Number(newRate) || 0);
    updated[idx].unit_price = rate;
    updated[idx].is_manual_rate = true;
    updated[idx].fifo_breakdown = '';
    updated[idx].total_price = (Number(updated[idx].quantity) || 0) * rate;
    setCart(updated);
  };

  const subtotal = cart.reduce((acc, item) => {
    const rawTotal = (item.total_price !== undefined && item.total_price !== null)
      ? Number(item.total_price)
      : ((Number(item.quantity) || 0) * Number(item.unit_price));
    return acc + rawTotal - (item.discount || 0);
  }, 0);

  const totalCost = cart.reduce((acc, item) => {
    return acc + ((Number(item.quantity) || 0) * (item.purchase_price || 0));
  }, 0);

  const totalDiscount = Number(discount) || 0;
  const grandTotal = Math.max(0, subtotal - totalDiscount);
  const estimatedProfit = Math.max(0, grandTotal - totalCost);
  const profitMarginPct = grandTotal > 0 ? ((estimatedProfit / grandTotal) * 100).toFixed(1) : 0;

  const enteredPaid = paidAmount === '' ? grandTotal : Number(paidAmount);
  const balanceDue = Math.max(0, grandTotal - enteredPaid);
  const changeDue = Math.max(0, enteredPaid - grandTotal);
  const activeCustomer = customers.find(c => c.id === Number(selectedCustomer));

  const handleCustomerChange = (custId) => {
    setSelectedCustomer(custId);
    const cust = customers.find(c => c.id === Number(custId));
    const newSaleType = (cust && cust.customer_type === 'Wholesale') ? 'Wholesale' : 'Retail';
    setSaleType(newSaleType);
    setCart(cart.map(item => {
      if (item.is_manual_rate) return item;
      const prod = products.find(p => p.id === item.product_id) || item;
      const fifo = calculateFifoTieredPricing(prod, Number(item.quantity) || 1, newSaleType);
      return {
        ...item,
        unit_price: fifo.effectiveRate,
        total_price: fifo.totalSale,
        purchase_price: fifo.effectiveCost,
        fifo_breakdown: fifo.breakdownText
      };
    }));
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
        items: cart.map(i => {
          const qty = Number(i.quantity) || 1;
          const rawTotal = (i.total_price !== undefined && i.total_price !== null)
            ? Number(i.total_price)
            : (qty * Number(i.unit_price));
          return {
            product_id: i.product_id,
            quantity: qty,
            unit: i.unit,
            unit_price: Number(i.unit_price) || 0,
            total_price: rawTotal,
            discount: i.discount || 0
          };
        }),
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

  const openRecentInvoices = async () => {
    try {
      const res = await api.get('/sales');
      if (res.success) {
        setRecentInvoices(res.sales || []);
        setShowRecentInvoicesModal(true);
      }
    } catch (err) {
      alert('Failed to load recent sales history');
    }
  };

  const handleSelectRecentInvoice = async (id) => {
    try {
      const saleDetail = await api.get(`/sales/${id}`);
      if (saleDetail.success) {
        setCompletedSale(saleDetail);
        setShowRecentInvoicesModal(false);
      }
    } catch (err) {
      alert('Failed to load invoice receipt');
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
              onClick={openRecentInvoices}
              className="btn btn-secondary btn-sm"
              title="View & Print Specific Receipt"
              style={{ height: '30px', fontSize: '0.75rem', padding: '0 0.55rem' }}
            >
              <FileText size={13} color="#6366f1" />
              <span>Receipts</span>
            </button>

            <button
              onClick={loadInitialData}
              className="btn btn-secondary btn-sm"
              title="Refresh Products"
              style={{ padding: '0 0.45rem', height: '30px' }}
            >
              <RefreshCw size={13} />
            </button>

            {/* CATALOG VIEW MODE TOGGLE (LIST / GRID) */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setCatalogView('list')}
                style={{
                  padding: '3px 7px',
                  fontSize: '0.72rem',
                  borderRadius: '4px',
                  border: 'none',
                  background: catalogView === 'list' ? '#0284c7' : 'transparent',
                  color: catalogView === 'list' ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontWeight: 700
                }}
                title="Compact List View"
              >
                <List size={13} />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setCatalogView('grid')}
                style={{
                  padding: '3px 7px',
                  fontSize: '0.72rem',
                  borderRadius: '4px',
                  border: 'none',
                  background: catalogView === 'grid' ? '#0284c7' : 'transparent',
                  color: catalogView === 'grid' ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontWeight: 700
                }}
                title="Grid Card View"
              >
                <LayoutGrid size={13} />
                <span>Grid</span>
              </button>
            </div>
          </div>

          {/* CATEGORIES HORIZONTAL PILLS (Shown only when products exist) */}
          {products.length > 0 && categories.length > 0 && (
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
          )}

          {/* PRODUCT ITEMS LIST OR GRID */}
          <div className={catalogView === 'list' ? 'pos-products-list' : 'pos-products-grid'}>
            {loading ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                color: '#64748b'
              }}>
                <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', display: 'block', color: '#0284c7' }} />
                <p>Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                background: '#f8fafc',
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                margin: '1rem 0'
              }}>
                <PackageOpen size={48} style={{ color: '#0284c7', margin: '0 auto 0.75rem', display: 'block' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  No Products in Stock
                </h3>
                <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '380px', margin: '0 auto 1.25rem', lineHeight: 1.4 }}>
                  All dummy products have been removed. Your catalog is clean and ready. Add products from the Inventory menu or click below.
                </p>
                <button onClick={() => setShowQuickAdd(true)} className="btn btn-primary btn-sm">
                  <PlusCircle size={15} />
                  <span>+ Add First Product Item</span>
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                <Search size={32} style={{ color: '#94a3b8', margin: '0 auto 0.5rem', display: 'block' }} />
                <p>No products match your search or filter.</p>
              </div>
            ) : (
              filteredProducts.map(p => {
                const inStock = p.current_stock > 0;
                const isLow = p.current_stock <= p.min_stock_level;
                const displayPrice = saleType === 'Wholesale' && p.wholesale_price > 0 ? p.wholesale_price : p.sale_price;

                if (catalogView === 'list') {
                  return (
                    <div
                      key={p.id}
                      className={`pos-product-list-item ${!inStock ? 'out-of-stock' : ''}`}
                      onClick={() => inStock && addToCart(p)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: 0 }}>
                        <div className="pos-item-icon" style={{ flexShrink: 0 }}>
                          {getCategoryIcon(p.category_name)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#0284c7', lineHeight: 1.1, textTransform: 'uppercase' }}>
                            {p.brand || 'Frozen'}
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>
                            {p.name}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>
                            {formatPKR(displayPrice)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                            <span className={`badge ${!inStock ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.6rem', padding: '0 4px' }}>
                              {p.current_stock} {p.unit}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!inStock}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '2px 7px', fontSize: '0.72rem', height: '25px', borderRadius: '4px' }}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  );
                }

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '1px' }}>
                        <span className="pos-item-unit">per {p.unit}</span>
                        {p.purchase_price > 0 && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              color: '#0284c7',
                              background: '#f0f9ff',
                              border: '1px solid #bae6fd',
                              padding: '0 4px',
                              borderRadius: '3px'
                            }}
                            title="Actual Kharid / Cost Price (For shop reference only)"
                          >
                            Cost: ₨{p.purchase_price}
                          </span>
                        )}
                      </div>
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
            })
          )}
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
              <div style={{ flex: 1, minWidth: 0 }}>
                <SearchableSelect
                  className="form-control"
                  value={selectedCustomer}
                  onChange={(val) => handleCustomerChange(val)}
                  options={customers.map(c => ({
                    value: c.id,
                    label: `${c.name} ${c.id !== 1 && c.current_balance > 0 ? `— (Bakaya Udhaar: ₨ ${c.current_balance})` : c.id !== 1 ? '— (Bal: ₨ 0)' : ''}`
                  }))}
                  placeholder="-- Select Customer --"
                />
              </div>

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

            {/* CUSTOMER CREDIT & BALANCE DETAIL BADGE */}
            {activeCustomer && activeCustomer.id !== 1 && (
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '5px',
                padding: '4px 6px',
                marginTop: '0.35rem',
                fontSize: '0.675rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Udhaar / Bal: <strong style={{ color: activeCustomer.current_balance > 0 ? '#dc2626' : '#16a34a' }}>{formatPKR(activeCustomer.current_balance || 0)}</strong></span>
                  <span>Limit: <strong>{activeCustomer.credit_limit > 0 ? formatPKR(activeCustomer.credit_limit) : 'No Limit'}</strong></span>
                </div>
                {balanceDue > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#0369a1', fontWeight: 600 }}>
                    <span>This Bill Due: +{formatPKR(balanceDue)}</span>
                    <span>New Bal: {formatPKR((activeCustomer.current_balance || 0) + balanceDue)}</span>
                  </div>
                )}
                {activeCustomer.credit_limit > 0 && ((activeCustomer.current_balance || 0) + balanceDue) > activeCustomer.credit_limit && (
                  <div style={{ color: '#dc2626', fontWeight: 700, marginTop: '2px' }}>
                    ⚠️ Exceeds credit limit of {formatPKR(activeCustomer.credit_limit)}!
                  </div>
                )}
              </div>
            )}
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

                    {/* DIRECT MANUAL RATE OPTION PER KG / PACKET */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Rate: ₨</span>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleUpdateCartRate(idx, e.target.value)}
                          style={{
                            width: '58px',
                            height: '21px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0 3px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            color: '#0284c7',
                            textAlign: 'right'
                          }}
                          title="Direct manual selling rate per KG / Packet"
                        />
                        <span style={{ fontSize: '0.62rem', color: '#64748b' }}>/{item.unit || 'unit'}</span>
                      </div>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>•</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a' }}>
                        {formatPKR(((item.total_price !== undefined && item.total_price !== null) ? Number(item.total_price) : ((Number(item.quantity) || 0) * Number(item.unit_price))) - (item.discount || 0))}
                      </span>
                      {item.discount > 0 && (
                        <span style={{ fontSize: '0.62rem', color: '#16a34a' }}>(-₨{item.discount})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStartEditItem(idx)}
                        title="Edit Line Discount"
                        style={{ color: '#0284c7', padding: '0 2px', marginLeft: 'auto' }}
                      >
                        <Edit2 size={10} />
                      </button>
                    </div>

                    {/* ACTUAL PURCHASE / COST PRICE (FOR SHOP US ONLY - NEVER ON CUSTOMER BILL) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: '#0369a1',
                          background: '#e0f2fe',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          border: '1px solid #bae6fd',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="Actual Kharid / Purchase Cost Price (For shop reference only - not printed on customer bill)"
                      >
                        <span>Actual Cost:</span>
                        <strong style={{ color: '#0284c7' }}>₨{item.purchase_price || 0}</strong>
                        {Number(item.unit_price) > Number(item.purchase_price || 0) ? (
                          <span style={{ color: '#16a34a', fontWeight: 700, marginLeft: '2px' }}>
                            (+₨{Math.round((Number(item.unit_price) - Number(item.purchase_price || 0)) * 100) / 100} profit)
                          </span>
                        ) : Number(item.unit_price) < Number(item.purchase_price || 0) ? (
                          <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: '2px' }}>
                            (⚠️ Below Cost -₨{Math.round((Number(item.purchase_price || 0) - Number(item.unit_price)) * 100) / 100})
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontWeight: 600, marginLeft: '2px' }}>
                            (= cost)
                          </span>
                        )}
                      </span>

                      {/* COMPANY NAME BADGE */}
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          color: '#065f46',
                          background: '#d1fae5',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          border: '1px solid #a7f3d0'
                        }}
                        title={`Company / Brand: ${item.company_name || item.brand || item.supplier_name || 'Latif Traders'}`}
                      >
                        Company: {item.company_name || item.brand || item.supplier_name || 'Latif Traders'}
                      </span>

                      {item.original_price && Number(item.original_price) !== Number(item.unit_price) && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            color: '#64748b',
                            background: '#f8fafc',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            border: '1px solid #e2e8f0'
                          }}
                          title="Original Catalog Retail Price"
                        >
                          Catalog: <span style={{ textDecoration: 'line-through' }}>₨{item.original_price}</span>
                        </span>
                      )}
                    </div>

                    {/* DYNAMIC MULTI-BATCH FIFO TIER BADGE */}
                    {item.fifo_breakdown && (
                      <div
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: '#92400e',
                          background: '#fef3c7',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid #fde68a',
                          marginTop: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Automatic Multi-Batch FIFO Pricing Breakdown"
                      >
                        <span>⚡ FIFO Lots:</span>
                        <span>{item.fifo_breakdown}</span>
                      </div>
                    )}

                    {editingItemIndex === idx && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>
                        <span style={{ fontSize: '0.65rem' }}>Disc:</span>
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '50px', height: '20px', fontSize: '0.675rem', padding: '0 3px' }}
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
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div className="pos-stepper" style={{ border: '1px solid #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', background: '#fff' }}>
                      <button
                        type="button"
                        className="pos-stepper-btn"
                        onClick={() => updateQuantity(idx, -1)}
                        style={{ border: 'none', background: 'none', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <Minus size={9} />
                      </button>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={item.quantity === '' ? '' : item.quantity}
                        onChange={(e) => handleSetQuantity(idx, e.target.value)}
                        onBlur={() => {
                          if (!item.quantity || Number(item.quantity) <= 0) {
                            removeFromCart(idx);
                          }
                        }}
                        style={{
                          width: '42px',
                          height: '21px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textAlign: 'center',
                          border: 'none',
                          background: 'transparent',
                          padding: '0 2px',
                          color: '#0f172a'
                        }}
                        title="Directly enter item quantity (e.g. 50, 100, 200)"
                      />
                      <button
                        type="button"
                        className="pos-stepper-btn"
                        onClick={() => updateQuantity(idx, 1)}
                        style={{ border: 'none', background: 'none', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
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

            {/* CHANGE RETURN & CUSTOMER UDHAAR BREAKDOWN */}
            {(() => {
              const custPrevBalance = (activeCustomer && activeCustomer.id !== 1) ? (Number(activeCustomer.current_balance) || 0) : 0;
              const extraPaid = Math.max(0, enteredPaid - grandTotal);
              const amountAppliedToUdhaar = (custPrevBalance > 0) ? Math.min(extraPaid, custPrevBalance) : 0;
              const actualChangeReturn = extraPaid - amountAppliedToUdhaar;
              const netRemainingUdhaar = custPrevBalance + balanceDue - amountAppliedToUdhaar;

              return (
                <div style={{
                  background: actualChangeReturn > 0 || amountAppliedToUdhaar > 0 ? '#ecfdf5' : balanceDue > 0 ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${actualChangeReturn > 0 || amountAppliedToUdhaar > 0 ? '#a7f3d0' : balanceDue > 0 ? '#fecaca' : '#e2e8f0'}`,
                  borderRadius: '6px',
                  padding: '6px 8px',
                  marginBottom: '0.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  fontSize: '0.725rem'
                }}>
                  {/* Cash Return / Wapis */}
                  {actualChangeReturn > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#065f46', fontWeight: 800, fontSize: '0.85rem' }}>
                      <span>💵 Change Return (Wapis):</span>
                      <span style={{ fontSize: '0.95rem' }}>{formatPKR(actualChangeReturn)}</span>
                    </div>
                  )}

                  {/* Unpaid on this bill */}
                  {balanceDue > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#b91c1c', fontWeight: 700 }}>
                      <span>⚠️ Unpaid on this bill:</span>
                      <span>{formatPKR(balanceDue)}</span>
                    </div>
                  )}

                  {balanceDue === 0 && actualChangeReturn === 0 && amountAppliedToUdhaar === 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
                      <span>Status:</span>
                      <span>✔ Exact Payment Settled</span>
                    </div>
                  )}

                  {/* Registered Customer Udhaar Ledger Details */}
                  {activeCustomer && activeCustomer.id !== 1 && (
                    <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '4px', marginTop: '3px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.675rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Previous Udhaar:</span>
                        <strong>{formatPKR(custPrevBalance)}</strong>
                      </div>
                      {balanceDue > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                          <span>Added to Udhaar (This Bill):</span>
                          <strong>+{formatPKR(balanceDue)}</strong>
                        </div>
                      )}
                      {amountAppliedToUdhaar > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}>
                          <span>Deducted from Udhaar (Extra Cash):</span>
                          <strong>-{formatPKR(amountAppliedToUdhaar)}</strong>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0369a1', fontWeight: 700 }}>
                        <span>Total Remaining Udhaar:</span>
                        <span style={{ color: netRemainingUdhaar > 0 ? '#dc2626' : '#16a34a' }}>
                          {formatPKR(netRemainingUdhaar)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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

      {/* RECENT RECEIPTS MODAL */}
      {showRecentInvoicesModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Recent Sales Invoices & Receipts</h3>
              </div>
              <button onClick={() => setShowRecentInvoicesModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search invoice number or customer name..."
                value={recentSearch}
                onChange={(e) => setRecentSearch(e.target.value)}
                autoFocus
              />
              <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices
                      .filter(s => {
                        if (!recentSearch) return true;
                        const q = recentSearch.toLowerCase();
                        return (
                          (s.invoice_no && s.invoice_no.toLowerCase().includes(q)) ||
                          (s.customer_name && s.customer_name.toLowerCase().includes(q))
                        );
                      })
                      .slice(0, 30)
                      .map(s => (
                        <tr key={s.id}>
                          <td className="mono" style={{ fontWeight: 600, color: '#0284c7' }}>{s.invoice_no}</td>
                          <td>{s.customer_name || 'Walk-in Counter'}</td>
                          <td style={{ fontSize: '0.75rem' }}>{formatDate(s.sale_date || s.created_at)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPKR(s.grand_total)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleSelectRecentInvoice(s.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            >
                              <Printer size={12} />
                              <span>View Receipt</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRecentInvoicesModal(false)}>
                Close
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
