import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Printer, FileText, Eye, CheckCircle, Filter } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import ReportPrintHeader from '../components/common/ReportPrintHeader';
import ReportPrintFooter from '../components/common/ReportPrintFooter';
import PrintInvoiceModal from '../components/invoices/PrintInvoiceModal';

export default function CashFlow() {
  const { user } = useAuth();
  const [cashbook, setCashbook] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  // Receipt & Invoice viewing states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [genericReceipt, setGenericReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const [settings, setSettings] = useState(() => ({
    shop_name: localStorage.getItem('lt_shop_name') || 'Latif Traders',
    tagline: localStorage.getItem('lt_shop_tagline') || 'CHICKEN SUPPLIER',
    phone: localStorage.getItem('lt_phone') || '',
    address: localStorage.getItem('lt_address') || '',
    email: localStorage.getItem('lt_email') || ''
  }));

  useEffect(() => {
    api.get('/settings').then(res => {
      if (res && res.success && res.settings) {
        setSettings(res.settings);
        if (res.settings.shop_name) localStorage.setItem('lt_shop_name', res.settings.shop_name);
        if (res.settings.tagline) localStorage.setItem('lt_shop_tagline', res.settings.tagline);
      }
    }).catch(() => {});
  }, []);

  const loadCashbook = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/payments/cashbook?start_date=${startDate}&end_date=${endDate}`);
      if (res.success) setCashbook(res);
    } catch (err) {
      console.error('Failed to load cashbook:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashbook();
  }, [startDate, endDate]);

  const handleViewReceipt = async (entry) => {
    try {
      setReceiptLoading(true);
      if (entry.source_type === 'SALE' || (entry.ref_no && entry.ref_no.startsWith('INV-'))) {
        const res = await api.get(`/sales/${entry.ref_no}`);
        if (res.success && res.sale) {
          setSelectedInvoice(res);
          return;
        }
      }
      setGenericReceipt(entry);
    } catch (err) {
      setGenericReceipt(entry);
    } finally {
      setReceiptLoading(false);
    }
  };

  const dateRangeText = startDate === endDate
    ? `Date: ${formatDate(startDate)}`
    : `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`;

  const docRef = `CBK-${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* DATE RANGE & PRINT CONTROLS (Hidden in Print) */}
      <div className="card no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>From:</span>
            <input
              type="date"
              className="form-control"
              style={{ height: '34px', fontSize: '0.85rem', minWidth: '135px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>To:</span>
            <input
              type="date"
              className="form-control"
              style={{ height: '34px', fontSize: '0.85rem', minWidth: '135px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button
            onClick={loadCashbook}
            className="btn btn-primary btn-sm"
            style={{ height: '34px', padding: '0 1rem', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600 }}
          >
            <Filter size={14} />
            <span>Filter</span>
          </button>
        </div>

        <button
          onClick={() => window.print()}
          className="btn btn-secondary btn-sm"
          style={{ height: '34px', padding: '0 1rem', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}
        >
          <Printer size={15} />
          <span>Print Daily Cashbook</span>
        </button>
      </div>

      {/* PRINTABLE CASHBOOK AUDIT DOCUMENT */}
      <div className="printable-area">
        {/* Subtle diagonal background watermark */}
        <div className="report-watermark">
          {settings.shop_name || 'Latif Traders'}™ • OFFICIAL BUSINESS RECORD
        </div>

        <div className="report-print-container">
          <ReportPrintHeader
            settings={settings}
            reportTitle="DAILY CASHBOOK & CASH FLOW STATEMENT"
            reportSubtitle="Certified ledger of cash receipts, customer recoveries, supplier disbursements & shop expenses"
            dateRangeText={dateRangeText}
            docRef={docRef}
            user={user}
          />

          {/* CASHBOOK SUMMARY METRIC CARDS (Formatted for both screen & paper) */}
          <div className="cashbook-print-summary">
            <div className="cashbook-summary-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>TOTAL CASH IN</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>
                    {formatPKR(cashbook?.total_in || 0)}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>Sales & Collections</div>
                </div>
                <div style={{ background: '#d1fae5', padding: '6px', borderRadius: '6px', color: '#10b981' }}>
                  <ArrowDownLeft size={20} />
                </div>
              </div>
            </div>

            <div className="cashbook-summary-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>TOTAL CASH OUT</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444', marginTop: '0.2rem' }}>
                    {formatPKR(cashbook?.total_out || 0)}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>Expenses & Supplier Payouts</div>
                </div>
                <div style={{ background: '#fee2e2', padding: '6px', borderRadius: '6px', color: '#ef4444' }}>
                  <ArrowUpRight size={20} />
                </div>
              </div>
            </div>

            <div className="cashbook-summary-card" style={{ borderLeft: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>NET CASH FLOW</div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 900,
                    color: (cashbook?.net_cash_flow || 0) >= 0 ? '#0284c7' : '#ef4444',
                    marginTop: '0.2rem'
                  }}>
                    {formatPKR(cashbook?.net_cash_flow || 0)}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.15rem' }}>Cash In minus Cash Out</div>
                </div>
                <div style={{ background: '#e0f2fe', padding: '6px', borderRadius: '6px', color: '#0284c7' }}>
                  <DollarSign size={20} />
                </div>
              </div>
            </div>
          </div>

          {/* CASHBOOK LEDGER TABLE */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Cashbook Details</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {cashbook?.entries?.length || 0} Cash entries recorded for {dateRangeText}
                </p>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Currency: <strong style={{ color: '#0f172a' }}>PKR (₨)</strong>
              </div>
            </div>

            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '95px', minWidth: '95px', textAlign: 'left' }}>Date</th>
                    <th style={{ width: '150px', minWidth: '150px', textAlign: 'left' }}>Ref / Invoice #</th>
                    <th style={{ width: '140px', minWidth: '140px', textAlign: 'left' }}>Transaction Type</th>
                    <th style={{ width: '140px', minWidth: '140px', textAlign: 'left' }}>Party / Account</th>
                    <th style={{ minWidth: '120px', textAlign: 'left' }}>Notes</th>
                    <th style={{ textAlign: 'right', width: '130px', minWidth: '130px' }}>Cash In (Receipt)</th>
                    <th style={{ textAlign: 'right', width: '130px', minWidth: '130px' }}>Cash Out (Payment)</th>
                    <th className="no-print" style={{ textAlign: 'center', width: '85px', minWidth: '85px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>Loading cashbook records...</td></tr>
                  ) : cashbook?.entries?.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>No cash transactions recorded for this period.</td></tr>
                  ) : (
                    cashbook?.entries?.map((entry, idx) => (
                      <tr key={idx}>
                        <td style={{ width: '95px', whiteSpace: 'nowrap', textAlign: 'left' }}>{formatDate(entry.date)}</td>
                        <td style={{ width: '150px', textAlign: 'left' }}>
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(entry)}
                            className="mono"
                            style={{
                              padding: 0,
                              margin: 0,
                              background: 'none',
                              border: 'none',
                              fontWeight: 700,
                              color: '#0284c7',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontSize: '0.785rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title="Click to view & print full receipt"
                          >
                            <FileText size={12} />
                            <span>{entry.ref_no}</span>
                          </button>
                        </td>
                        <td style={{ width: '140px', fontWeight: 600, textAlign: 'left' }}>{entry.title}</td>
                        <td style={{ width: '140px', textAlign: 'left' }}>{entry.party_name || '-'}</td>
                        <td style={{ minWidth: '120px', fontSize: '0.8rem', color: '#64748b', textAlign: 'left' }}>{entry.notes || '-'}</td>
                        <td style={{ textAlign: 'right', width: '130px', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>
                          {entry.flow === 'IN' ? formatPKR(entry.amount) : '-'}
                        </td>
                        <td style={{ textAlign: 'right', width: '130px', fontWeight: 700, color: '#ef4444', whiteSpace: 'nowrap' }}>
                          {entry.flow === 'OUT' ? formatPKR(entry.amount) : '-'}
                        </td>
                        <td className="no-print" style={{ textAlign: 'center', width: '85px', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewReceipt(entry)}
                            style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            title="View Voucher / Receipt"
                          >
                            <Printer size={11} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {cashbook?.entries?.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                      <td colSpan="5" style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontSize: '0.85rem' }}>TOTALS:</td>
                      <td style={{ textAlign: 'right', width: '130px', color: '#10b981', padding: '0.65rem 0.75rem', fontSize: '0.875rem' }}>
                        {formatPKR(cashbook?.total_in || 0)}
                      </td>
                      <td style={{ textAlign: 'right', width: '130px', color: '#ef4444', padding: '0.65rem 0.75rem', fontSize: '0.875rem' }}>
                        {formatPKR(cashbook?.total_out || 0)}
                      </td>
                      <td className="no-print" style={{ width: '85px' }}></td>
                    </tr>
                    <tr style={{ background: '#f1f5f9', fontWeight: 900 }}>
                      <td colSpan="5" style={{ textAlign: 'right', padding: '0.65rem 0.75rem', fontSize: '0.85rem', color: '#0f172a' }}>
                        NET CASH BALANCE:
                      </td>
                      <td colSpan="2" style={{
                        textAlign: 'right',
                        padding: '0.65rem 0.75rem',
                        fontSize: '1.05rem',
                        color: (cashbook?.net_cash_flow || 0) >= 0 ? '#0284c7' : '#ef4444'
                      }}>
                        {formatPKR(cashbook?.net_cash_flow || 0)}
                      </td>
                      <td className="no-print" style={{ width: '85px' }}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <ReportPrintFooter shopName={settings.shop_name || 'Latif Traders'} />
        </div>
      </div>

      {/* SALE INVOICE PRINT MODAL */}
      {selectedInvoice && (
        <PrintInvoiceModal
          sale={selectedInvoice.sale}
          items={selectedInvoice.items}
          settings={selectedInvoice.settings}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {/* GENERIC CASH TRANSACTION VOUCHER MODAL */}
      {genericReceipt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Cash Transaction Voucher</h3>
              </div>
              <button onClick={() => setGenericReceipt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>{settings.shop_name}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{settings.tagline}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0284c7', marginTop: '4px' }}>
                  {genericReceipt.title}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Voucher / Ref #:</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{genericReceipt.ref_no}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Date:</span>
                  <span>{formatDate(genericReceipt.date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Party / Account:</span>
                  <span style={{ fontWeight: 600 }}>{genericReceipt.party_name || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Cash</span>
                </div>
                {genericReceipt.notes && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Notes:</span>
                    <span style={{ maxWidth: '220px', textAlign: 'right' }}>{genericReceipt.notes}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  marginTop: '0.4rem'
                }}>
                  <span style={{ fontWeight: 700 }}>Amount:</span>
                  <span style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: genericReceipt.flow === 'IN' ? '#10b981' : '#ef4444'
                  }}>
                    {genericReceipt.flow === 'IN' ? '+' : '-'}{formatPKR(genericReceipt.amount)}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGenericReceipt(null)}>Close</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Printer size={13} />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
