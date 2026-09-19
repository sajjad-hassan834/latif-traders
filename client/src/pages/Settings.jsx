import React, { useState, useEffect } from 'react';
import { Sliders, Database, Download, RotateCcw, Save, ShieldAlert, CheckCircle, Table, RefreshCw, ExternalLink } from 'lucide-react';
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, bRes] = await Promise.all([
        api.get('/settings'),
        api.get('/backups')
      ]);

      if (sRes.success) setSettings(prev => ({ ...prev, ...sRes.settings }));
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

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/settings', settings);
      if (res.success) {
        setSaveSuccess('Settings saved successfully!');
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

      {/* 3. LIVE DATABASE EXPLORER (UI TABLE VIEWER) */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Table size={20} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Live Database Explorer (Raw Tables)</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Direct visual inspector for live SQLite database tables, schema columns, and records.
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
              title="Refresh Current Table"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <a
              href="https://sqliteviewer.app"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              title="Open External Web GUI Viewer"
            >
              <ExternalLink size={14} />
              <span>sqliteviewer.app ↗</span>
            </a>
          </div>
        </div>

        {/* Table Selector Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {dbTables.map(t => (
            <button
              key={t.name}
              type="button"
              onClick={() => {
                setSelectedTable(t.name);
                loadTableData(t.name);
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.775rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: selectedTable === t.name ? '1px solid #0284c7' : '1px solid #cbd5e1',
                background: selectedTable === t.name ? '#0284c7' : '#f8fafc',
                color: selectedTable === t.name ? '#ffffff' : '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{t.name}</span>
              <span style={{
                background: selectedTable === t.name ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: selectedTable === t.name ? '#ffffff' : '#64748b',
                padding: '1px 5px',
                borderRadius: '4px',
                fontSize: '0.675rem'
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Table Records View */}
        {loadingTable ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading table records...</div>
        ) : !tableData || !tableData.columns ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Select a table above to view data.</div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
              <span>Showing up to 100 recent rows in <strong>{selectedTable}</strong> ({tableData.totalRows} total records)</span>
              <span>{tableData.columns.length} columns</span>
            </div>

            <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <table className="table" style={{ fontSize: '0.75rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    {tableData.columns.map(col => (
                      <th key={col.name} style={{ background: '#f1f5f9', whiteSpace: 'nowrap' }}>
                        <div>{col.name}</div>
                        <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 500 }}>{col.type}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={tableData.columns.length} style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                        Table is currently empty (0 records).
                      </td>
                    </tr>
                  ) : (
                    tableData.rows.map((row, idx) => (
                      <tr key={idx}>
                        {tableData.columns.map(col => {
                          const val = row[col.name];
                          return (
                            <td key={col.name} style={{ whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {val === null || val === undefined ? (
                                <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>null</span>
                              ) : typeof val === 'object' ? (
                                JSON.stringify(val)
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
