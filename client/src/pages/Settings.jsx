import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Database,
  Download,
  RotateCcw,
  Save,
  ShieldAlert,
  CheckCircle,
  Table,
  RefreshCw,
  ExternalLink,
  Edit2,
  Search,
  X,
  Check,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatters';

export default function Settings() {
  const [settings, setSettings] = useState({
    shop_name: 'LATIF TRADERS',
    tagline: 'Frozen Food Wholesalers & Retailers',
    phone: '',
    email: '',
    address: '',
    currency: 'PKR',
    currency_symbol: '₨',
    near_expiry_days: '15',
    allow_negative_stock: 'false',
    invoice_footer: '',
    print_default_format: 'thermal'
  });

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [downloadingBackup, setDownloadingBackup] = useState(null);

  // Database Explorer States
  const [dbTables, setDbTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('products');
  const [tableData, setTableData] = useState(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [tableCategory, setTableCategory] = useState('all');
  const [tableSearch, setTableSearch] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [editRowData, setEditRowData] = useState({});
  const [savingRow, setSavingRow] = useState(false);

  // Fresh Start / Wipe Data for Delivery States
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, bRes] = await Promise.all([
        api.get('/settings'),
        api.get('/backups')
      ]);

      if (sRes.success) {
        setSettings(prev => ({ ...prev, ...sRes.settings }));
        if (sRes.settings.shop_name) localStorage.setItem('lt_shop_name', sRes.settings.shop_name);
        if (sRes.settings.tagline) localStorage.setItem('lt_shop_tagline', sRes.settings.tagline);
        if (sRes.settings.phone) localStorage.setItem('lt_phone', sRes.settings.phone);
        if (sRes.settings.email) localStorage.setItem('lt_email', sRes.settings.email);
        if (sRes.settings.address) localStorage.setItem('lt_address', sRes.settings.address);
      }
      if (bRes.success) setBackups(bRes.backups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDbTables = async () => {
    try {
      const res = await api.get('/settings/db-tables');
      if (res.success && res.tables) {
        setDbTables(res.tables);
      }
    } catch (err) {
      console.error('Failed to load db tables:', err);
    }
  };

  const loadTableData = async (tableName) => {
    try {
      setLoadingTable(true);
      const res = await api.get(`/settings/db-table/${tableName}`);
      if (res.success) {
        setTableData(res);
      }
    } catch (err) {
      console.error('Failed to load table rows:', err);
    } finally {
      setLoadingTable(false);
    }
  };

  useEffect(() => {
    loadData();
    loadDbTables();
    loadTableData('products');
  }, []);

  const categoryTableMap = {
    inventory: ['products', 'batches', 'categories', 'units', 'inventory_movements', 'stock_adjustments'],
    sales: ['sales', 'sale_items', 'returns', 'return_items'],
    purchases: ['purchases', 'purchase_items'],
    parties: ['customers', 'suppliers', 'payments'],
    finances: ['expenses', 'expense_categories'],
    system: ['settings', 'users', 'audit_logs']
  };

  const filteredTables = dbTables.filter(t => {
    if (tableCategory === 'all') return true;
    return (categoryTableMap[tableCategory] || []).includes(t.name);
  });

  const searchedRows = (tableData?.rows || []).filter(row => {
    if (!tableSearch.trim()) return true;
    const term = tableSearch.toLowerCase();
    return Object.values(row).some(val => String(val ?? '').toLowerCase().includes(term));
  });

  const handleOpenEditRow = (row) => {
    setEditingRow(row);
    setEditRowData({ ...row });
  };

  const handleSaveRow = async (e) => {
    e.preventDefault();
    if (!editingRow) return;
    try {
      setSavingRow(true);
      const rowId = editingRow.id !== undefined ? editingRow.id : editingRow.key;
      const res = await api.put(`/settings/db-table/${selectedTable}/${encodeURIComponent(rowId)}`, editRowData);
      if (res.success) {
        setEditingRow(null);
        loadTableData(selectedTable);
        loadDbTables();
        if (selectedTable === 'settings') {
          if (editRowData.key === 'shop_name' && editRowData.value) {
            localStorage.setItem('lt_shop_name', editRowData.value);
            document.title = `${editRowData.value} - Frozen Food System`;
          }
          if (editRowData.key === 'tagline' && editRowData.value) {
            localStorage.setItem('lt_shop_tagline', editRowData.value);
          }
          window.dispatchEvent(new Event('settings_updated'));
          loadData();
        }
      }
    } catch (err) {
      alert('Failed to update record: ' + (err.message || 'Error'));
    } finally {
      setSavingRow(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/settings', settings);
      if (res.success) {
        setSaveSuccess('Settings saved successfully!');
        if (settings.shop_name) {
          localStorage.setItem('lt_shop_name', settings.shop_name);
          document.title = `${settings.shop_name} - POS & Inventory System`;
        }
        if (settings.tagline) localStorage.setItem('lt_shop_tagline', settings.tagline);
        if (settings.phone) localStorage.setItem('lt_phone', settings.phone);
        if (settings.email) localStorage.setItem('lt_email', settings.email);
        if (settings.address) localStorage.setItem('lt_address', settings.address);
        window.dispatchEvent(new CustomEvent('settings_updated', { detail: settings }));
        loadDbTables();
        if (selectedTable === 'settings') {
          loadTableData('settings');
        }
        setTimeout(() => setSaveSuccess(''), 4000);
      }
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleWipeData = async () => {
    try {
      setWiping(true);
      const res = await api.post('/settings/wipe-data-delivery');
      if (res.success) {
        setShowWipeModal(false);
        setWipeConfirmText('');
        alert(res.message || 'Database successfully wiped for fresh delivery! Sole Admin is Mudassir Arif.');
        window.location.reload();
      }
    } catch (err) {
      alert('Failed to wipe data: ' + err.message);
    } finally {
      setWiping(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setBackupSuccess('');
      const res = await api.post('/backups/create');
      if (res.success) {
        setBackupSuccess(`Backup created: ${res.backup.filename}`);
        loadData();
      }
    } catch (err) {
      alert('Backup failed: ' + err.message);
    }
  };

  const handleDownloadBackup = async (filename) => {
    try {
      setDownloadingBackup(filename);
      const token = localStorage.getItem('lt_token');
      const rawBase = import.meta.env.VITE_API_URL || '';
      const apiBase = rawBase ? `${rawBase.replace(/\/$/, '')}/api` : '/api';

      const res = await fetch(`${apiBase}/backups/download/${encodeURIComponent(filename)}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        let errMsg = `Download failed with status ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.message) errMsg = errData.message;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to download database backup: ' + err.message);
    } finally {
      setDownloadingBackup(null);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!confirm(`Are you sure you want to restore database from backup "${filename}"? Any transactions created after this backup will be replaced.`)) {
      return;
    }

    try {
      const res = await api.post('/backups/restore', { filename });
      if (res.success) {
        alert(res.message);
        window.location.reload();
      }
    } catch (err) {
      alert('Restore failed: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      {saveSuccess && (
        <div style={{ padding: '1rem', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', fontWeight: 600 }}>
          ✔ {saveSuccess}
        </div>
      )}

      {backupSuccess && (
        <div style={{ padding: '1rem', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', fontWeight: 600 }}>
          ✔ {backupSuccess}
        </div>
      )}

      {/* SHOP PROFILE & BUSINESS RULES */}
      <div className="card" style={{ padding: '1.1rem 1.35rem', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bae6fd' }}>
              <Sliders size={17} color="#0284c7" />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 700, color: '#0f172a' }}>Business Profile & Invoice Details</h3>
              <p style={{ fontSize: '0.725rem', color: '#64748b', margin: 0 }}>
                Information printed on invoices, thermal receipts, and system inventory policies.
              </p>
            </div>
          </div>

          <button type="submit" form="settings-form" disabled={saving} className="btn btn-primary btn-sm" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>

        <form id="settings-form" onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Row 1: Shop Identity & Contact (3 Columns) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                Shop Name *
              </label>
              <input
                type="text"
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px' }}
                required
                value={settings.shop_name}
                onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                Tagline / Subtitle
              </label>
              <input
                type="text"
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px' }}
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                Phone Numbers
              </label>
              <input
                type="text"
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px' }}
                placeholder="+92 300 1234567"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px' }}
                placeholder="sales@latiftraders.com"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                Shop Physical Address
              </label>
              <input
                type="text"
                className="form-control"
                style={{ height: '32px', fontSize: '0.8rem', padding: '0 8px' }}
                placeholder="Shop #, Market, City"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>
          </div>

          {/* Row 2: Inventory Policies & Receipt Footer Note (Side-by-Side) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.2rem' }}>
            {/* Inventory Policies Box */}
            <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.45rem' }}>
                📦 Inventory Policies & Alerts
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.55rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                    Near-Expiry (Days)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    style={{ height: '30px', fontSize: '0.8rem', padding: '0 6px' }}
                    min="1"
                    max="90"
                    value={settings.near_expiry_days}
                    onChange={(e) => setSettings({ ...settings, near_expiry_days: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 600, color: '#475569', marginBottom: '2px' }}>
                    Negative Stock Policy
                  </label>
                  <select
                    className="form-control"
                    style={{ height: '30px', fontSize: '0.75rem', padding: '0 6px' }}
                    value={settings.allow_negative_stock}
                    onChange={(e) => setSettings({ ...settings, allow_negative_stock: e.target.value })}
                  >
                    <option value="false">Strictly Blocked (Recommended)</option>
                    <option value="true">Allowed (Allow ≤ 0)</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '3px' }}>
                Batches expiring within {settings.near_expiry_days || 15} days show warning badge.
              </div>
            </div>

            {/* Receipt Footer Disclaimer Box */}
            <div style={{ background: '#f8fafc', padding: '0.65rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                🧾 Receipt / Invoice Footer Disclaimer
              </label>
              <textarea
                className="form-control"
                rows="2"
                style={{ fontSize: '0.75rem', padding: '4px 6px', resize: 'vertical', flex: 1, minHeight: '48px' }}
                placeholder="Thank you message or return policy printed at the bottom of bills..."
                value={settings.invoice_footer}
                onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })}
              />
            </div>
          </div>
        </form>
      </div>

      {/* DATABASE BACKUP & RESTORE */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Database size={22} color="#10b981" />
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>Database Backup & Disaster Recovery</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Create online SQLite backups, download snapshot files to USB, or restore previous data.
              </p>
            </div>
          </div>
          <button onClick={handleCreateBackup} className="btn btn-success">
            <Database size={16} />
            <span>Create Backup Now</span>
          </button>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', minWidth: '600px' }}>
            <thead>
              <tr>
                <th>Backup Filename</th>
                <th>Size</th>
                <th>Timestamp</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No backup files available yet. Click "Create Backup Now".</td></tr>
              ) : (
                backups.map(b => (
                  <tr key={b.filename}>
                    <td className="mono" style={{ fontWeight: 600 }}>{b.filename}</td>
                    <td>{b.size_kb} KB</td>
                    <td>{formatDateTime(b.created_at)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleDownloadBackup(b.filename)}
                          disabled={downloadingBackup === b.filename}
                          className="btn btn-secondary btn-sm"
                          title="Download authentic .db snapshot file"
                        >
                          <Download size={14} className={downloadingBackup === b.filename ? 'animate-spin' : ''} />
                          <span>{downloadingBackup === b.filename ? 'Downloading...' : 'Download'}</span>
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(b.filename)}
                          className="btn btn-danger btn-sm"
                          title="Restore Database"
                        >
                          <RotateCcw size={14} />
                          <span>Restore</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SYSTEM FRESH START / CLIENT DELIVERY DATA WIPE */}
      <div className="card" style={{ padding: '1.25rem', border: '1px solid #fecaca', background: '#fffafb', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fca5a5', flexShrink: 0, marginTop: '2px' }}>
              <Trash2 size={20} color="#dc2626" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: '#991b1b' }}>
                  Client Delivery Fresh Start (Wipe Test Data)
                </h3>
                <span className="badge badge-danger" style={{ fontSize: '0.675rem', padding: '2px 8px' }}>
                  Admin Tool
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#7f1d1d', margin: 0, maxWidth: '650px', lineHeight: 1.5 }}>
                Carefully cleans all test transactions, sales, purchases, test products, batches, suppliers, customer balances, and demo staff so your client starts with fresh, pristine records.
                <strong> Mudassir Arif</strong> will be preserved as the sole Administrator, and default units and categories remain ready for client use.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setWipeConfirmText('');
              setShowWipeModal(true);
            }}
            className="btn btn-danger"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, padding: '0.55rem 1.1rem', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)' }}
          >
            <Trash2 size={15} />
            <span>Wipe All Test Data (Fresh Start)</span>
          </button>
        </div>
      </div>

      {/* 3. LIVE DATABASE EXPLORER (MODERNIZED UI & LIVE EDITOR) */}
      <div className="card" style={{ padding: '1.25rem', border: '1px solid #cbd5e1', boxShadow: '0 4px 15px -3px rgba(0,0,0,0.07)' }}>
        {/* Modern Header Banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '9px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)' }}>
              <Table size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800, color: '#0f172a' }}>Live Database Explorer</h3>
                <span className="badge badge-success" style={{ fontSize: '0.675rem', padding: '2px 8px' }}>
                  SQLite WAL • Live
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Visual inspector for live database tables, schema definitions, and in-place record management.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => {
                loadDbTables();
                loadTableData(selectedTable);
              }}
              className="btn btn-secondary btn-sm"
              title="Refresh Live Data"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <RefreshCw size={13} className={loadingTable ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            <a
              href="https://sqliteviewer.app"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              title="Open in External Web SQLite Viewer"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ExternalLink size={13} />
              <span>sqliteviewer.app ↗</span>
            </a>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="horizontal-scroll-tabs" style={{ marginBottom: '0.75rem' }}>
          {[
            { id: 'all', label: 'All Tables' },
            { id: 'inventory', label: '📦 Inventory' },
            { id: 'sales', label: '🛒 Sales' },
            { id: 'purchases', label: '🚚 Purchases' },
            { id: 'parties', label: '👥 Parties' },
            { id: 'finances', label: '💰 Finance' },
            { id: 'system', label: '⚙️ System' }
          ].map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setTableCategory(cat.id)}
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: tableCategory === cat.id ? 700 : 500,
                background: tableCategory === cat.id ? '#0f172a' : '#f1f5f9',
                color: tableCategory === cat.id ? '#ffffff' : '#475569',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Table Selector Pills */}
        <div className="horizontal-scroll-tabs" style={{ marginBottom: '1.25rem', background: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {filteredTables.map(t => (
            <button
              key={t.name}
              type="button"
              onClick={() => {
                setSelectedTable(t.name);
                loadTableData(t.name);
                setTableSearch('');
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedTable === t.name ? '1px solid #0284c7' : '1px solid #e2e8f0',
                background: selectedTable === t.name ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#ffffff',
                color: selectedTable === t.name ? '#ffffff' : '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: selectedTable === t.name ? '0 2px 6px rgba(2, 132, 199, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{t.name}</span>
              <span style={{
                background: selectedTable === t.name ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                color: selectedTable === t.name ? '#ffffff' : '#64748b',
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 700
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Table Records View */}
        {loadingTable ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: '#0284c7' }} />
            Loading records from table "{selectedTable}"...
          </div>
        ) : !tableData || !tableData.columns ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Select a table above to view data.</div>
        ) : (
          <div>
            {/* Table Action / Search Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedTable}
                </span>
                <span className="badge badge-info" style={{ fontSize: '0.675rem' }}>
                  {tableData.totalRows} total rows
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>•</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {tableData.columns.length} columns
                </span>
              </div>

              {/* Instant Search Bar */}
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '1.9rem', height: '28px', fontSize: '0.775rem' }}
                  placeholder={`Search in ${selectedTable}...`}
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    style={{ position: 'absolute', right: '6px', top: '6px', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Visual Data Grid */}
            <div className="table-responsive" style={{ maxHeight: '460px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)', width: '100%', maxWidth: '100%' }}>
              <table className="table" style={{ fontSize: '0.775rem', borderCollapse: 'separate', borderSpacing: 0, minWidth: '600px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                    <th style={{ background: '#0f172a', color: '#94a3b8', width: '45px', textAlign: 'center', fontSize: '0.65rem' }}>#</th>
                    {tableData.columns.map(col => (
                      <th key={col.name} style={{ background: '#0f172a', color: '#f8fafc', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontWeight: 700 }}>{col.name}</div>
                        <div style={{ fontSize: '0.6rem', color: col.pk ? '#38bdf8' : '#94a3b8', fontWeight: 500 }}>
                          {col.type || 'TEXT'} {col.pk ? '🔑 PK' : ''}
                        </div>
                      </th>
                    ))}
                    {selectedTable !== 'audit_logs' && (
                      <th style={{ background: '#0f172a', color: '#94a3b8', textAlign: 'center', width: '65px' }}>Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {searchedRows.length === 0 ? (
                    <tr>
                      <td colSpan={tableData.columns.length + 2} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        {tableSearch ? 'No rows match your search query.' : 'Table is currently empty (0 records).'}
                      </td>
                    </tr>
                  ) : (
                    searchedRows.map((row, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        {tableData.columns.map(col => {
                          const val = row[col.name];
                          return (
                            <td key={col.name} style={{ whiteSpace: 'nowrap', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {val === null || val === undefined ? (
                                <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.7rem' }}>null</span>
                              ) : col.name.includes('price') || col.name.includes('amount') || col.name.includes('total') || col.name.includes('balance') ? (
                                <span style={{ fontWeight: 600, color: '#0284c7' }}>₨ {Number(val).toLocaleString()}</span>
                              ) : col.pk ? (
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{val}</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                        {selectedTable !== 'audit_logs' && (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditRow(row)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              title="Edit this record"
                            >
                              <Edit2 size={11} />
                              <span>Edit</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* IN-PLACE ROW EDIT MODAL */}
      {editingRow && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="modal-card card" style={{ maxWidth: '540px', width: '90%', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>
                  Edit Record in <strong>{selectedTable}</strong>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                style={{ cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRow} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tableData && tableData.columns && tableData.columns.map(col => {
                const isReadOnly = col.pk || col.name === 'id' || col.name === 'created_at' || col.name === 'updated_at';
                return (
                  <div key={col.name} className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{col.name} {col.pk ? '(Primary Key)' : ''}</span>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{col.type}</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      disabled={isReadOnly}
                      style={{ background: isReadOnly ? '#f1f5f9' : '#ffffff' }}
                      value={editRowData[col.name] ?? ''}
                      onChange={(e) => setEditRowData({ ...editRowData, [col.name]: e.target.value })}
                    />
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRow}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Check size={14} />
                  <span>{savingRow ? 'Saving Changes...' : 'Save Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FRESH START WIPE CONFIRMATION MODAL */}
      {showWipeModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="modal-card card" style={{ maxWidth: '480px', width: '90%', padding: '1.5rem', border: '2px solid #ef4444', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #fee2e2', paddingBottom: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={20} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: '#991b1b' }}>
                  Confirm Fresh Start Wipe
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>This action is permanent and irreversible.</p>
              </div>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem', marginBottom: '1.25rem', fontSize: '0.825rem', color: '#991b1b', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>The following data will be permanently cleared:</p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>All sales invoices, POS records & customer debts</li>
                <li>All purchase receipts, restocks & batches</li>
                <li>All products, suppliers & supplier ledgers</li>
                <li>All expense vouchers, return receipts & stock adjustments</li>
                <li>All demo staff accounts (Keeping <strong>Mudassir Arif</strong> as sole Admin)</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                To confirm, please type <strong style={{ color: '#dc2626' }}>WIPE</strong> below:
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Type WIPE to confirm"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                autoFocus
                style={{ fontWeight: 700, letterSpacing: '1px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                className="btn btn-secondary"
                disabled={wiping}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeData}
                disabled={wipeConfirmText !== 'WIPE' || wiping}
                className="btn btn-danger"
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={14} />
                <span>{wiping ? 'Wiping Database...' : 'Permanently Wipe & Start Fresh'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
