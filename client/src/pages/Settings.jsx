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
  Check
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
          document.title = `${settings.shop_name} - Frozen Food System`;
        }
        if (settings.tagline) {
          localStorage.setItem('lt_shop_tagline', settings.tagline);
        }
        window.dispatchEvent(new Event('settings_updated'));
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
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
          <Sliders size={22} color="var(--primary)" />
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>Business Profile & Invoice Details</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Information printed on retail invoices and thermal receipts.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Shop Name *</label>
              <input
                type="text"
                className="form-control"
                required
                value={settings.shop_name}
                onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tagline / Subtitle</label>
              <input
                type="text"
                className="form-control"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Phone Numbers</label>
              <input
                type="text"
                className="form-control"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Shop Address</label>
            <input
              type="text"
              className="form-control"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            />
          </div>

          {/* BUSINESS RULES */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#0f172a' }}>Inventory Policies & Warnings</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Near-Expiry Warning Threshold (Days)</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="90"
                  value={settings.near_expiry_days}
                  onChange={(e) => setSettings({ ...settings, near_expiry_days: e.target.value })}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Batches expiring within this number of days appear on alert badges.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Negative Stock Policy</label>
                <select
                  className="form-control"
                  value={settings.allow_negative_stock}
                  onChange={(e) => setSettings({ ...settings, allow_negative_stock: e.target.value })}
                >
                  <option value="false">Blocked (Recommended - Prevents selling non-existent stock)</option>
                  <option value="true">Allowed (Permits sales even if stock count is zero)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Current setting: <strong>{settings.allow_negative_stock === 'true' ? 'Allowed' : 'Strictly Blocked'}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Invoice / Receipt Footer Disclaimer</label>
            <textarea
              className="form-control"
              rows="2"
              value={settings.invoice_footer}
              onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save System Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* DATABASE BACKUP & RESTORE */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
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
          <table className="table">
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
                        <a
                          href={`/api/backups/download/${encodeURIComponent(b.filename)}`}
                          download
                          className="btn btn-secondary btn-sm"
                          title="Download .db to Computer / USB"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </a>
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
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
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
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
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
            <div className="table-responsive" style={{ maxHeight: '460px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)' }}>
              <table className="table" style={{ fontSize: '0.775rem', borderCollapse: 'separate', borderSpacing: 0 }}>
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
    </div>
  );
}
