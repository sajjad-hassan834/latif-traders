import React, { useState, useEffect } from 'react';
import { Building2, Plus, FileText, DollarSign, Printer, Search, Edit, ChevronDown, Trash2, RefreshCw, ArrowUpRight, ShieldAlert, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/common/Pagination';
import ActionMenu from '../components/common/ActionMenu';
import CustomDatePicker from '../components/common/CustomDatePicker';
import ReceiptVoucherModal from '../components/invoices/ReceiptVoucherModal';

export default function Suppliers() {
  const { user, isAdmin: authIsAdmin, tenant } = useAuth();
  const [tenantSettings, setTenantSettings] = useState(null);
  const isAdmin = authIsAdmin || user?.role === 'admin';
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [auditing, setAuditing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [selectedSup, setSelectedSup] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const handleViewPurchaseDetails = async (row) => {
    try {
      if (row.type === 'SUPPLIER_PAYMENT' || row.type === 'PAYMENT' || (row.ref_no && row.ref_no.startsWith('REC-'))) {
        setViewingReceipt({
          ...row,
          supplier_name: ledgerData?.supplier?.name,
          supplier_phone: ledgerData?.supplier?.phone
        });
        return;
      }
      if (row.id && (row.type === 'PURCHASE' || row.type === 'PURCHASE_BILL' || (row.ref_no && (row.ref_no.startsWith('PUR-') || row.ref_no.startsWith('PO-'))))) {
        const res = await api.get(`/purchases/${row.id}`);
        if (res.success) {
          setViewingPurchase(res);
          return;
        }
      }
      setViewingPurchase({
        purchase: {
          invoice_no: row.ref_no,
          purchase_date: row.date,
          supplier_name: ledgerData?.supplier?.name,
          grand_total: row.credit || 0,
          paid_amount: row.debit || 0,
          balance_due: row.balance || 0,
          notes: row.notes
        },
        items: []
      });
    } catch (err) {
      alert('Failed to load purchase details: ' + (err.message || ''));
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => setActionMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    contact_person: '',
    opening_balance: '0',
    notes: ''
  });

  const [editFormData, setEditFormData] = useState(null);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/parties/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      if (res.success) setSuppliers(res.suppliers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
    api.get('/settings').then(res => {
      if (res && res.success && res.settings) setTenantSettings(res.settings);
    }).catch(() => {});
  }, []);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/parties/suppliers', formData);
      if (res.success) {
        setShowAddModal(false);
        setFormData({
          name: '',
          phone: '',
          address: '',
          contact_person: '',
          opening_balance: '0',
          notes: ''
        });
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to add supplier');
    }
  };

  const openEditSupplier = (sup) => {
    setSelectedSup(sup);
    setEditFormData({
      name: sup.name || '',
      phone: sup.phone || '',
      address: sup.address || '',
      contact_person: sup.contact_person || '',
      notes: sup.notes || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/parties/suppliers/${selectedSup.id}`, editFormData);
      if (res.success) {
        setShowEditModal(false);
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to update supplier');
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      const res = await api.delete(`/parties/suppliers/${supplierToDelete.id}`);
      if (res.success) {
        setShowDeleteModal(false);
        setSupplierToDelete(null);
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete supplier');
    }
  };

  const openLedger = async (sup, customStart = ledgerStartDate, customEnd = ledgerEndDate) => {
    try {
      setSelectedSup(sup);
      let url = `/parties/suppliers/${sup.id}/ledger?`;
      if (customStart) url += `start_date=${customStart}&`;
      if (customEnd) url += `end_date=${customEnd}&`;
      const res = await api.get(url);
      if (res.success) {
        setLedgerData(res);
        setShowLedgerModal(true);
      }
    } catch (err) {
      alert('Failed to load supplier ledger');
    }
  };

  const handlePrintStatement = () => {
    if (!ledgerData) return;
    try {
      const sup = ledgerData.supplier || {};
      const summary = ledgerData.summary || {};
      const rawEntries = ledgerData.chronological_ledger || (ledgerData.ledger ? [...ledgerData.ledger].reverse() : []);
      const shopName = tenant?.business_name || user?.business_name || 'Store Account';
      const shopPhone = tenant?.phone || '';
      const shopAddress = tenant?.address || '';

      let iframe = document.getElementById('supplier-print-frame');
      if (iframe) iframe.remove();

      iframe = document.createElement('iframe');
      iframe.id = 'supplier-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '210mm';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const rowsHtml = rawEntries.map((r, i) => {
        const isCredit = (r.credit || 0) > 0;
        const isDebit = (r.debit || 0) > 0;
        const purStr = isCredit ? `Rs. ${Number(r.credit).toLocaleString('en-PK')}` : '—';
        const paidStr = isDebit ? `Rs. ${Number(r.debit).toLocaleString('en-PK')}` : '—';
        const balStr = `Rs. ${Number(r.running_balance || 0).toLocaleString('en-PK')}`;
        const desc = r.notes || (r.type === 'PURCHASE' ? 'Purchase Bill' : r.type === 'OPENING' ? 'Opening Balance' : 'Payment');
        return `
          <tr style="border-bottom: 1px solid #E2E8F0; background: ${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
            <td style="padding: 7px 10px; font-size: 11px; white-space: nowrap;">${formatDate(r.date)}</td>
            <td style="padding: 7px 10px; font-size: 11px; font-weight: 600; white-space: nowrap;">${r.ref_no || '—'}</td>
            <td style="padding: 7px 10px; font-size: 11px;">${desc}</td>
            <td style="padding: 7px 10px; font-size: 11px; text-align: right; font-weight: ${isCredit ? '600' : 'normal'};">${purStr}</td>
            <td style="padding: 7px 10px; font-size: 11px; text-align: right; color: #16A34A; font-weight: ${isDebit ? '600' : 'normal'};">${paidStr}</td>
            <td style="padding: 7px 10px; font-size: 11px; text-align: right; font-weight: 700; color: ${(r.running_balance || 0) > 0 ? '#DC2626' : '#16A34A'};">${balStr}</td>
          </tr>
        `;
      }).join('');

      const statementDate = new Date().toLocaleDateString('en-GB');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Supplier Statement - ${sup.name || 'Account'}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #0F172A; font-size: 12px; background: #FFFFFF; }
            .header-bar { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #0F766E; margin-bottom: 14px; }
            .shop-title { font-size: 20px; font-weight: 800; color: #0F766E; margin: 0; }
            .doc-title { font-size: 15px; font-weight: 700; color: #0F172A; text-align: right; margin: 0; }
            .sup-box { display: flex; justify-content: space-between; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
            .sup-name { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
            .balance-chip { text-align: right; }
            .bal-label { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; }
            .bal-amount { font-size: 18px; font-weight: 800; color: ${(summary.closing_balance || 0) > 0 ? '#DC2626' : '#16A34A'}; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #0F766E; color: #FFFFFF; padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: left; }
            th.right { text-align: right; }
            .summary-box { display: flex; justify-content: flex-end; margin-bottom: 24px; }
            .summary-table { width: 280px; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden; }
            .summary-table td { padding: 6px 12px; font-size: 11px; }
            .footer-sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 15px; border-top: 1px solid #CBD5E1; font-size: 10px; color: #64748B; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1 class="shop-title">${shopName}</h1>
              ${shopAddress ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${shopAddress}</div>` : ''}
              ${shopPhone ? `<div style="font-size: 11px; color: #475569;">Tel: ${shopPhone}</div>` : ''}
            </div>
            <div style="text-align: right;">
              <h2 class="doc-title">SUPPLIER PAYABLE STATEMENT</h2>
              <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Date: ${statementDate}</div>
              <div style="font-size: 10px; color: #94A3B8;">Transactions: ${rawEntries.length}</div>
            </div>
          </div>

          <div class="sup-box">
            <div>
              <div class="sup-name">${sup.name || 'Supplier'}</div>
              <div style="font-size: 11px; color: #475569;">${sup.contact_person ? `Contact: ${sup.contact_person}` : 'Vendor'}${sup.phone ? ` • Tel: ${sup.phone}` : ''}</div>
              ${sup.address ? `<div style="font-size: 11px; color: #64748B;">Address: ${sup.address}</div>` : ''}
            </div>
            <div class="balance-chip">
              <div class="bal-label">Outstanding Payable</div>
              <div class="bal-amount">Rs. ${Number(summary.closing_balance || 0).toLocaleString('en-PK')}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 85px;">Date</th>
                <th style="width: 120px;">Reference</th>
                <th>Description</th>
                <th class="right" style="width: 100px;">Purchases (Cr)</th>
                <th class="right" style="width: 100px;">Paid (Dr)</th>
                <th class="right" style="width: 110px;">Closing Payable</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary-box">
            <table class="summary-table">
              <tr style="background: #F8FAFC;">
                <td style="color: #475569;">Total Purchases:</td>
                <td style="text-align: right; font-weight: 600;">Rs. ${Number(summary.total_credit || 0).toLocaleString('en-PK')}</td>
              </tr>
              <tr style="background: #FFFFFF;">
                <td style="color: #475569;">Total Paid:</td>
                <td style="text-align: right; font-weight: 600; color: #16A34A;">Rs. ${Number(summary.total_debit || 0).toLocaleString('en-PK')}</td>
              </tr>
              <tr style="background: #0F766E; color: #FFFFFF;">
                <td style="font-weight: 700;">Net Payable Balance:</td>
                <td style="text-align: right; font-weight: 800;">Rs. ${Number(summary.closing_balance || 0).toLocaleString('en-PK')}</td>
              </tr>
            </table>
          </div>

          <div class="footer-sign">
            <div>This is a verified computer-generated statement issued by ${shopName}.</div>
            <div style="text-align: center; border-top: 1px dashed #64748B; width: 180px; padding-top: 4px;">Authorized Signature / Stamp</div>
          </div>
        </body>
        </html>
      `;

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 250);
    } catch (err) {
      console.error('Print statement error:', err);
      window.print();
    }
  };

  const openPayModal = (sup) => {
    setSelectedSup(sup);
    setPayAmount(String(sup.current_balance > 0 ? sup.current_balance : ''));
    setShowPayModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/payments/supplier-payment', {
        supplier_id: selectedSup.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        payment_date: payDate,
        notes: payNotes.trim()
      });
      if (res.success) {
        setShowPayModal(false);
        setPayNotes('');
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to record supplier payment');
    }
  };

  const handleOpenAuditModal = async () => {
    try {
      setAuditing(true);
      const res = await api.get('/parties/suppliers/audit-balances');
      if (res.success) {
        setAuditData(res);
        setShowAuditModal(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to audit supplier balances.');
    } finally {
      setAuditing(false);
    }
  };

  const handleConfirmSync = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/parties/suppliers/sync-balances', {});
      if (res.success) {
        alert(res.message);
        setShowAuditModal(false);
        setAuditData(null);
        loadSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to synchronize supplier balances.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadSuppliers()}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              onClick={handleOpenAuditModal}
              disabled={auditing}
              className="btn btn-secondary"
              title="Audit and review discrepancies between stored balances and verified purchase bills & payments"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={auditing ? 'spin' : ''} />
              <span>{auditing ? 'Auditing...' : 'Sync'}</span>
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <Plus size={16} />
            <span>+ Supplier</span>
          </button>
        </div>
      </div>

      {/* SUPPLIERS TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div className="table-responsive" style={{ minHeight: '300px', paddingBottom: '90px', overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: '700px' }}>
            <thead>
              <tr>
                <th>Supplier</th>
                <th style={{ minWidth: '130px' }}>Contact</th>
                <th style={{ minWidth: '120px' }}>Phone</th>
                <th style={{ minWidth: '150px' }}>Address</th>
                <th style={{ textAlign: 'right', minWidth: '120px' }}>Balance</th>
                <th style={{ textAlign: 'center', width: '85px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading suppliers...</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No suppliers found.</td></tr>
              ) : (
                suppliers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(s => (
                  <tr key={s.id}>
                    <td style={{ minWidth: '180px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-title)' }}>{s.name}</div>
                      {s.address && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {s.address}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-table)', fontWeight: 500 }}>{s.contact_person || '-'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{s.phone || '-'}</td>
                    <td><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.address || '-'}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {Number(s.current_balance) > 0 ? (
                        <span style={{ color: '#ef4444' }}>{formatPKR(s.current_balance)}</span>
                      ) : Number(s.current_balance) < 0 ? (
                        <span style={{ 
                          display: 'inline-block',
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          background: '#E0F2FE', 
                          color: '#0369A1', 
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}>
                          Adv: {formatPKR(Math.abs(s.current_balance))}
                        </span>
                      ) : (
                        <span style={{ color: '#10b981' }}>Settled</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => openLedger(s)}
                          className="btn-table-action"
                          title="View statement & ledger"
                        >
                          <span>Details</span>
                          <ArrowUpRight size={13} />
                        </button>

                        <ActionMenu
                          title="Supplier Actions"
                          items={[
                            {
                              label: 'Edit Supplier',
                              icon: <Edit size={14} color="#0284c7" />,
                              onClick: () => openEditSupplier(s)
                            },
                            {
                              label: 'Statement',
                              icon: <FileText size={14} color="#6366f1" />,
                              onClick: () => openLedger(s)
                            },
                            s.current_balance > 0 && {
                              label: 'Disburse Payment',
                              icon: <DollarSign size={14} color="#ef4444" />,
                              onClick: () => openPayModal(s)
                            },
                            isAdmin && { divider: true },
                            isAdmin && {
                              label: 'Delete',
                              icon: <Trash2 size={14} color="#dc2626" />,
                              danger: true,
                              onClick: () => {
                                setSupplierToDelete(s);
                                setShowDeleteModal(true);
                              }
                            }
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={suppliers.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Add New Supplier</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Register a distributor or vendor for procurement.
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
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Supplier Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Dawn Bread & Frozen Foods"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Contact</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Asim Butt (Sales Manager)"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="042-111567567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Factory / depot address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Opening Payable Balance (PKR)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="0"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER LEDGER MODAL */}
      {showLedgerModal && ledgerData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '960px', width: '96%', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            {/* FIX 1: MODAL HEADER */}
            <div className="modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#0F766E',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {(ledgerData.supplier.name || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-title)', lineHeight: 1.2 }}>
                    {ledgerData.supplier.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
                    Supplier
                    {ledgerData.supplier.phone && ledgerData.supplier.phone !== 'None' && ledgerData.supplier.phone !== '-' && (
                      <span> • 📞 {ledgerData.supplier.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Right: Info Chips & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ background: '#F3F4F6', color: '#374151', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>📅</span> Supplier since: {ledgerData.supplier.created_at ? formatDate(ledgerData.supplier.created_at) : 'Active'}
                </div>
                <div style={{ background: '#F3F4F6', color: '#374151', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>📦</span> Total Purchases: {formatPKR(ledgerData.summary.total_purchases ?? ledgerData.summary.total_credit ?? ledgerData.summary.total_billed ?? 0)}
                </div>
                {Number(ledgerData.summary.closing_balance || 0) < 0 ? (
                  <div style={{ background: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    🔵 Advance: {formatPKR(Math.abs(ledgerData.summary.closing_balance))} (Credit)
                  </div>
                ) : Number(ledgerData.summary.closing_balance || 0) === 0 ? (
                  <div style={{ background: '#D1FAE5', color: '#065F46', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ✓ Fully Settled
                  </div>
                ) : (
                  <div style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ {formatPKR(ledgerData.summary.closing_balance)} Payable
                  </div>
                )}

                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setShowLedgerModal(false)}
                  aria-label="Close"
                  style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-title)', fontSize: '16px', fontWeight: 700 }}
                  title="Close ledger"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px' }}>
              {/* DATE FILTER BAR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Filter by date:</span>
                <CustomDatePicker
                  value={ledgerStartDate}
                  onChange={(v) => { setLedgerStartDate(v); openLedger(selectedSup, v, ledgerEndDate); }}
                  placeholder="From (dd/mm/yyyy)"
                />
                <span style={{ color: 'var(--text-muted)' }}>–</span>
                <CustomDatePicker
                  value={ledgerEndDate}
                  onChange={(v) => { setLedgerEndDate(v); openLedger(selectedSup, ledgerStartDate, v); }}
                  placeholder="To (dd/mm/yyyy)"
                />
                {(ledgerStartDate || ledgerEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLedgerStartDate('');
                      setLedgerEndDate('');
                      openLedger(selectedSup, '', '');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6B7280',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '0 8px',
                      textDecoration: 'underline'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* FIX 3 & 4: REDESIGNED TABLE COLUMNS & ROWS */}
              <div className="table-responsive" style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '10px' }}>
                <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E5E7EB' }}>
                      <th style={{ width: '100px', padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ width: '140px', padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Bill #</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Description</th>
                      <th style={{ width: '110px', padding: '10px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Amount</th>
                      <th style={{ width: '110px', padding: '10px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Paid</th>
                      <th style={{ width: '130px', padding: '10px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Running Balance</th>
                      <th style={{ width: '80px', padding: '10px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.ledger.map((row, idx) => {
                      const isOpening = row.type === 'OPENING' || row.ref_no === 'OPN-BAL';
                      const isPurchase = row.type === 'PURCHASE' || row.type === 'PURCHASE_BILL' || (row.ref_no && (row.ref_no.startsWith('PUR-') || row.ref_no.startsWith('PO-')));

                      let dot = '•';
                      let descText = row.notes || 'Transaction';
                      let descColor = '#374151';

                      if (isOpening) {
                        dot = '⚫';
                        descText = 'Account Opening Balance';
                        descColor = '#6B7280';
                      } else if (row.type === 'PAYMENT' || row.type === 'SUPPLIER_PAYMENT' || (!row.credit && row.debit > 0)) {
                        dot = '🔵';
                        descText = 'Payment Disbursed';
                        descColor = '#0F766E';
                      } else if (row.credit > 0) {
                        if (row.debit > row.credit) {
                          dot = '🔵';
                          descText = `Overpaid (Advance ₨ ${(row.debit - row.credit).toLocaleString()})`;
                          descColor = '#0284C7';
                        } else if (row.debit === row.credit) {
                          dot = '🟢';
                          descText = 'Paid in Full';
                          descColor = '#16A34A';
                        } else if (row.debit > 0) {
                          dot = '🟡';
                          descText = `Partial Payment (₨ ${(row.credit - row.debit).toLocaleString()} due)`;
                          descColor = '#D97706';
                        } else {
                          dot = '🔴';
                          descText = `Credit Purchase (₨ ${row.credit.toLocaleString()} due)`;
                          descColor = '#DC2626';
                        }
                      }

                      if (isOpening) {
                        return (
                          <tr
                            key={idx}
                            style={{
                              height: '52px',
                              background: '#FFFBEB',
                              borderBottom: '1px solid #F3F4F6',
                              verticalAlign: 'middle'
                            }}
                          >
                            <td style={{ padding: '0 16px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                              {formatDate(row.date)}
                            </td>
                            <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                background: '#E5E7EB',
                                color: '#374151',
                                borderRadius: '12px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.5px'
                              }}>
                                OPENING
                              </span>
                            </td>
                            <td style={{ padding: '0 16px', fontSize: '13px', color: '#6B7280' }}>
                              <span style={{ marginRight: '6px' }}>⚫</span>
                              <span>Account Opening Balance</span>
                            </td>
                            <td style={{ padding: '0 16px', textAlign: 'right', fontSize: '14px', color: '#9CA3AF' }}>—</td>
                            <td style={{ padding: '0 16px', textAlign: 'right', fontSize: '14px', color: '#9CA3AF' }}>—</td>
                            <td style={{ padding: '0 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {Math.abs(row.balance || 0) < 0.01 ? (
                                <span style={{
                                  background: '#D1FAE5',
                                  color: '#065F46',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  display: 'inline-block'
                                }}>
                                  Rs 0 ✓
                                </span>
                              ) : row.balance < 0 ? (
                                <span style={{
                                  background: '#E0F2FE',
                                  color: '#0369A1',
                                  border: '1px solid #BAE6FD',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  display: 'inline-block'
                                }} title="Advance balance with supplier">
                                  Adv: {formatPKR(Math.abs(row.balance))}
                                </span>
                              ) : (
                                <span style={{
                                  background: '#FEE2E2',
                                  color: '#991B1B',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  display: 'inline-block'
                                }}>
                                  {formatPKR(row.balance)}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>—</td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={idx}
                          style={{
                            height: '52px',
                            borderBottom: '1px solid #F3F4F6',
                            verticalAlign: 'middle',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                        >
                          <td style={{ padding: '0 16px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {formatDate(row.date)}
                          </td>
                          <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                            {isPurchase ? (
                              <button
                                type="button"
                                onClick={() => handleViewPurchaseDetails(row)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0F766E',
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: 0,
                                  textDecoration: 'none',
                                  whiteSpace: 'nowrap'
                                }}
                                title="Click to view purchase voucher"
                              >
                                {row.ref_no}
                              </button>
                            ) : (
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4B5563', whiteSpace: 'nowrap' }}>
                                {row.ref_no || '—'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0 16px', fontSize: '13px', color: descColor, whiteSpace: 'nowrap' }}>
                            <span style={{ marginRight: '6px' }}>{dot}</span>
                            <span style={{ fontWeight: 500 }}>{descText}</span>
                          </td>
                          <td style={{ padding: '0 16px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: 'var(--text-title)', whiteSpace: 'nowrap' }}>
                            {row.credit > 0 ? formatPKR(row.credit) : <span style={{ color: '#9CA3AF' }}>—</span>}
                          </td>
                          <td style={{ padding: '0 16px', textAlign: 'right', fontWeight: 600, fontSize: '14px', color: '#16A34A', whiteSpace: 'nowrap' }}>
                            {row.debit > 0 ? formatPKR(row.debit) : <span style={{ color: '#9CA3AF' }}>—</span>}
                          </td>
                          <td style={{ padding: '0 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {Math.abs(row.balance || 0) < 0.01 ? (
                              <span style={{
                                background: '#D1FAE5',
                                color: '#065F46',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'inline-block'
                              }}>
                                Rs 0 ✓
                              </span>
                            ) : row.balance < 0 ? (
                              <span style={{
                                background: '#E0F2FE',
                                color: '#0369A1',
                                border: '1px solid #BAE6FD',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'inline-block'
                              }} title="Advance balance with supplier">
                                Adv: {formatPKR(Math.abs(row.balance))}
                              </span>
                            ) : (
                              <span style={{
                                background: '#FEE2E2',
                                color: '#991B1B',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'inline-block'
                              }}>
                                {formatPKR(row.balance)}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => handleViewPurchaseDetails(row)}
                              style={{
                                height: '28px',
                                padding: '0 12px',
                                border: '1px solid #E5E7EB',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#374151',
                                background: '#FFFFFF',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#0F766E';
                                e.currentTarget.style.color = '#0F766E';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#E5E7EB';
                                e.currentTarget.style.color = '#374151';
                              }}
                            >
                              View →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FIX 6: MODAL FOOTER */}
            <div style={{
              borderTop: '1px solid #F3F4F6',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {ledgerData.ledger.length} transactions  •  Total Purchases: <strong style={{ color: 'var(--text-title)' }}>{formatPKR(ledgerData.summary.total_purchases ?? ledgerData.summary.total_credit ?? ledgerData.summary.total_billed ?? 0)}</strong>  •  Total Paid: <strong style={{ color: '#16A34A' }}>{formatPKR(ledgerData.summary.total_paid ?? ledgerData.summary.total_debit ?? 0)}</strong>  •  {Number(ledgerData.summary.closing_balance || 0) < 0 ? (
                  <span>Advance Balance: <strong style={{ color: '#0369A1' }}>{formatPKR(Math.abs(ledgerData.summary.closing_balance))} (Credit)</strong></span>
                ) : Number(ledgerData.summary.closing_balance || 0) === 0 ? (
                  <span>Closing Balance: <strong style={{ color: '#16A34A' }}>Rs 0 (Settled)</strong></span>
                ) : (
                  <span>Closing Payable: <strong style={{ color: '#DC2626' }}>{formatPKR(ledgerData.summary.closing_balance)}</strong></span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePrintStatement}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Printer size={14} />
                  <span>Print Statement</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowLedgerModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PURCHASE VOUCHER MODAL */}
      {viewingPurchase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px', width: '96%', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-title)' }}>Purchase Voucher</h3>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                  Ref #: <strong style={{ fontFamily: 'monospace' }}>{viewingPurchase.purchase.invoice_no}</strong> • Date: {formatDate(viewingPurchase.purchase.purchase_date)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                  <Printer size={14} />
                  <span>Print</span>
                </button>
                <button type="button" className="modal-close-btn" onClick={() => setViewingPurchase(null)}>
                  ✕
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Supplier</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-title)' }}>{viewingPurchase.purchase.supplier_name || selectedSup?.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6B7280', fontWeight: 600 }}>Status</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: viewingPurchase.purchase.balance_due > 0 ? '#DC2626' : '#16A34A' }}>
                    {viewingPurchase.purchase.balance_due > 0 ? `Payable: ${formatPKR(viewingPurchase.purchase.balance_due)}` : 'Fully Settled ✓'}
                  </div>
                </div>
              </div>

              {viewingPurchase.items && viewingPurchase.items.length > 0 ? (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#4B5563' }}>Item</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#4B5563' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#4B5563' }}>Rate</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#4B5563' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingPurchase.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-title)' }}>{it.product_name}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>{it.quantity} {it.unit}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatPKR(it.unit_price)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatPKR(it.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                viewingPurchase.purchase.notes && (
                  <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', color: '#4B5563', marginBottom: '16px' }}>
                    <strong>Notes:</strong> {viewingPurchase.purchase.notes}
                  </div>
                )
              )}

              <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#6B7280' }}>Total Amount:</span>
                  <strong>{formatPKR(viewingPurchase.purchase.grand_total)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#6B7280' }}>Paid:</span>
                  <strong style={{ color: '#16A34A' }}>{formatPKR(viewingPurchase.purchase.paid_amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, borderTop: '1px solid #E5E7EB', paddingTop: '6px' }}>
                  <span>Payable Due:</span>
                  <span style={{ color: viewingPurchase.purchase.balance_due > 0 ? '#DC2626' : '#16A34A' }}>
                    {formatPKR(viewingPurchase.purchase.balance_due)}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setViewingPurchase(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISBURSE PAYMENT MODAL */}
      {showPayModal && selectedSup && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Pay Supplier</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Vendor: <strong>{selectedSup.name}</strong>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowPayModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#fee2e2', border: '1px solid #fecaca', padding: '0.75rem 1rem', borderRadius: '6px', color: '#991b1b', fontWeight: 600, fontSize: '0.85rem' }}>
                  Total Payable Outstanding: <strong>{formatPKR(selectedSup.current_balance)}</strong>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Amount (PKR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    required
                    min="1"
                    placeholder="Enter amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Method</label>
                    <select
                      className="form-control"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Bank slip # / online transfer ref"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger btn-sm" style={{ minWidth: '130px' }}>Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUPPLIER MODAL */}
      {showEditModal && editFormData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Edit Supplier</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Update vendor details and contact information.
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
            <form onSubmit={handleUpdateSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Supplier Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.contact_person}
                      onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => {
                        setShowEditModal(false);
                        setSupplierToDelete(selectedSup);
                        setShowDeleteModal(true);
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save Changes</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SUPPLIER MODAL */}
      {showDeleteModal && supplierToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px', width: '96%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} color="#dc2626" />
                <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.05rem', fontWeight: 700 }}>Delete</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete supplier <strong>"{supplierToDelete.name}"</strong>?
              {supplierToDelete.current_balance > 0 ? (
                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontWeight: 600, fontSize: '0.8rem' }}>
                  ⚠️ This supplier has an active payable balance of {formatPKR(supplierToDelete.current_balance)}. Please settle this balance before deleting.
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  This action will remove the supplier profile from your supplier directory. Historical purchase records will be preserved for financial auditing.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteSupplier}
                disabled={supplierToDelete.current_balance > 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={13} />
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER AUDIT & SYNC BALANCES BEFORE/AFTER DIFF MODAL */}
      {showAuditModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowAuditModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '780px', width: '96%', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
          >
            <div className="modal-header" style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={20} style={{ color: auditData?.discrepancies_count > 0 ? '#DC2626' : '#16A34A' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-title)' }}>
                    Audit
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Verified double-entry ledger calculation against stored database balances
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAuditModal(false)}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-hover)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 22px', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '160px', padding: '12px', borderRadius: '8px', background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Suppliers Audited</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-title)', marginTop: '2px' }}>{auditData?.total_checked || 0}</div>
                </div>
                <div style={{ flex: '1', minWidth: '160px', padding: '12px', borderRadius: '8px', background: auditData?.discrepancies_count > 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${auditData?.discrepancies_count > 0 ? '#FECACA' : '#BBF7D0'}` }}>
                  <div style={{ fontSize: '11px', color: auditData?.discrepancies_count > 0 ? '#991B1B' : '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Discrepancies Found</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: auditData?.discrepancies_count > 0 ? '#DC2626' : '#16A34A', marginTop: '2px' }}>{auditData?.discrepancies_count || 0}</div>
                </div>
              </div>

              {auditData?.discrepancies_count === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                  <CheckCircle2 size={36} style={{ color: '#16A34A', margin: '0 auto 10px auto' }} />
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#166534' }}>All Balances 100% Synchronized!</div>
                  <div style={{ fontSize: '13px', color: '#15803D', marginTop: '4px' }}>
                    Every supplier's stored balance perfectly matches the verified sum of their purchase bills, payments, and returns.
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--text-title)', fontWeight: 600, marginBottom: '10px' }}>
                    Discrepancy Preview (Before vs After):
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Supplier</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Stored Balance</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#16A34A' }}>Verified True Balance</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#DC2626' }}>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditData?.discrepancies.map((d) => (
                          <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 14px' }}>
                              <strong style={{ color: 'var(--text-title)' }}>{d.name}</strong>
                              {d.phone && d.phone !== 'None' && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📞 {d.phone}</div>}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {formatPKR(d.stored_balance)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#16A34A' }}>
                              {formatPKR(d.calculated_balance)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: d.diff > 0 ? '#DC2626' : '#2563EB' }}>
                              {d.diff > 0 ? `+${formatPKR(d.diff)}` : formatPKR(d.diff)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
              {auditData?.discrepancies_count > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmSync}
                  disabled={syncing}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={13} className={syncing ? 'spin' : ''} />
                  <span>{syncing ? 'Synchronizing...' : 'Confirm & Synchronize Balances'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* VIEW PAYMENT RECEIPT VOUCHER */}
      {viewingReceipt && (
        <ReceiptVoucherModal
          receipt={viewingReceipt}
          party={selectedSup || { name: viewingReceipt.supplier_name || 'Supplier' }}
          tenantSettings={tenantSettings || {
            shop_name: tenant?.business_name || '',
            tagline: '',
            phone: '',
            address: ''
          }}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}
