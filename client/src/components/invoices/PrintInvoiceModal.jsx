import { BRAND_NAME, BRAND_DOMAIN } from '../../config/brand';
import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, FileText, Share2, MessageSquare, Check, RefreshCw, ChevronDown } from 'lucide-react';
import { formatPKR, formatDate, formatDateTime } from '../../utils/formatters';
import { api } from '../../utils/api';

// Safe PKR currency formatter that uses clean ASCII 'Rs. ' to prevent broken glyphs on thermal and POS drivers
const safeFormatPKR = (amt) => {
  if (amt === undefined || amt === null || isNaN(amt)) return 'Rs. 0';
  return 'Rs. ' + Number(amt).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

export default function PrintInvoiceModal({ sale: rawSale, items: propItems = [], settings: propSettings = {}, onClose }) {
  const [printFormat, setPrintFormat] = useState(() => {
    const saved = localStorage.getItem('lt_invoice_format');
    return (saved === 'a4' || saved === 'thermal') ? saved : 'thermal';
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const printContainerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleFormatSelect = (fmt) => {
    setPrintFormat(fmt);
    localStorage.setItem('lt_invoice_format', fmt);
    setDropdownOpen(false);
  };

  const sale = rawSale?.sale || rawSale || {};
  const initialItems = (propItems && propItems.length > 0) ? propItems : (rawSale?.items || rawSale?.sale_items || []);
  const initialSettings = (propSettings && Object.keys(propSettings).length > 0) ? propSettings : (rawSale?.settings || {});

  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
  const [loadingDetails, setLoadingDetails] = useState(!initialItems || initialItems.length === 0);

  // If items were omitted by the caller, auto-fetch full sale details seamlessly
  useEffect(() => {
    let isMounted = true;
    const hasItems = (propItems && propItems.length > 0) || (rawSale?.items && rawSale.items.length > 0) || (rawSale?.sale_items && rawSale.sale_items.length > 0);
    if (!hasItems && sale?.id) {
      setLoadingDetails(true);
      api.get(`/sales/${sale.id}`)
        .then(res => {
          if (isMounted && res && res.success) {
            if (res.items && Array.isArray(res.items)) setItems(res.items);
            if (res.settings && typeof res.settings === 'object') setSettings(res.settings);
          }
        })
        .catch(err => console.error('Failed to load invoice items:', err))
        .finally(() => {
          if (isMounted) setLoadingDetails(false);
        });
    } else {
      setItems(initialItems);
      setSettings(initialSettings);
      setLoadingDetails(false);
    }
    return () => { isMounted = false; };
  }, [sale?.id, propItems, rawSale]);

  if (!sale || !sale.id) return null;

  const handlePrint = () => {
    try {
      const printableElement = printContainerRef.current;
      if (!printableElement) {
        window.print();
        return;
      }

      // Remove any lingering print iframe
      let iframe = document.getElementById('pos-print-frame');
      if (iframe) {
        iframe.remove();
      }

      // Create isolated invisible iframe with real layout dimensions for printer drivers
      iframe = document.createElement('iframe');
      iframe.id = 'pos-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = printFormat === 'thermal' ? '80mm' : '210mm';
      iframe.style.height = '1200px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      const contentHtml = printableElement.innerHTML.replace(/₨\s*/g, 'Rs. ');

      // Note: Do NOT use "size: 80mm auto" because Windows Xprinter/ESC-POS drivers reject auto height and cancel the job.
      // Setting "@page { margin: 0; }" lets the thermal printer roll feed and cut naturally.
      const thermalStyles = `
        @page {
          margin: 0mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color: #000000 !important;
          border-color: #000000 !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Courier New', Courier, monospace !important;
          font-size: 12px !important;
          line-height: 1.35 !important;
          width: 100% !important;
        }
        .thermal-receipt {
          width: 76mm !important;
          max-width: 78mm !important;
          margin: 0 auto !important;
          padding: 3mm 2mm 8mm 2mm !important;
        }
        .center { text-align: center !important; }
        .divider {
          border-top: 1px dashed #000000 !important;
          margin: 6px 0 !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 11px !important;
        }
        th, td {
          color: #000000 !important;
        }
      `;

      const a4Styles = `
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #1e293b !important;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 12px !important;
        }
        table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
      `;

      const selectedStyles = printFormat === 'thermal' ? thermalStyles : a4Styles;

      doc.open();
      doc.write(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<title>Invoice - ' + (sale.invoice_no || 'Receipt') + '</title>' +
        '<meta charset="utf-8" />' +
        '<style>' + selectedStyles + '</style>' +
        '</head>' +
        '<body>' +
        contentHtml +
        '</body>' +
        '</html>'
      );
      doc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error('Iframe print error, falling back to window.print():', e);
          window.print();
        }
      };

      if (doc.readyState === 'complete') {
        setTimeout(triggerPrint, 200);
      } else {
        iframe.contentWindow.addEventListener('load', triggerPrint);
        setTimeout(triggerPrint, 350);
      }
    } catch (err) {
      console.error('Printing error:', err);
      window.print();
    }
  };

  const tenantShopName = settings.company_name || settings.shop_name || localStorage.getItem('lt_shop_name');
  const shopName = tenantShopName || 'LATIF TRADERS';
  const tagline = settings.tagline || (tenantShopName ? '' : 'Frozen Food Wholesalers & Retailers');
  const phone = settings.company_phone || settings.phone || '';
  const address = settings.company_address || settings.address || '';
  const footerNote = settings.invoice_footer || `Thank you for shopping at ${shopName}!`;

  const hasCustomerBalance = Boolean(sale.customer_id && sale.customer_id > 1);
  const currentCustomerBalance = Number(sale.customer_current_balance) || 0;
  const paid = Number(sale.paid_amount || 0);
  const grandTotal = Number(sale.grand_total || 0);
  const excessPaid = Math.max(0, paid - grandTotal);
  const previousBalance = Math.max(0, currentCustomerBalance - Number(sale.balance_due || 0) + excessPaid);
  const netRemainingBalance = currentCustomerBalance;
  const changeReturn = (!hasCustomerBalance || previousBalance <= 0) ? excessPaid : 0;
  const udhaarDeduction = (hasCustomerBalance && excessPaid > 0) ? Math.min(excessPaid, previousBalance) : 0;

  // WhatsApp Message Generator
  const generateWhatsAppMessage = () => {
    const lines = [
      `*${shopName}*`,
      `${tagline}`,
      `--------------------------`,
      `📄 *Invoice #:* ${sale.invoice_no}`,
      `📅 *Date:* ${formatDateTime(sale.created_at || sale.sale_date)}`,
      `👤 *Customer:* ${sale.customer_name || 'Counter Customer'}`,
      `--------------------------`,
      `*ITEMS:*`
    ];

    items.forEach((it, idx) => {
      lines.push(`${idx + 1}. ${it.product_name} - ${it.quantity} ${it.unit} @ ${it.unit_price} = ${formatPKR(it.total_price)}`);
    });

    lines.push(`--------------------------`);
    lines.push(`💰 *Grand Total:* ${formatPKR(sale.grand_total)}`);
    lines.push(`💵 *Paid (${sale.payment_method || 'Cash'}):* ${formatPKR(sale.paid_amount)}`);
    if (changeReturn > 0) {
      lines.push(`🔄 *Change Return (Wapis):* ${formatPKR(changeReturn)}`);
    }
    if (sale.balance_due > 0) {
      lines.push(`⚠️ *This Bill Due:* ${formatPKR(sale.balance_due)}`);
    } else {
      lines.push(`✔ *Status:* Fully Settled`);
    }
    if (hasCustomerBalance) {
      lines.push(`📜 *Previous Udhaar:* ${formatPKR(previousBalance)}`);
      lines.push(`💳 *Total Remaining Udhaar:* ${formatPKR(netRemainingBalance)}`);
    }
    lines.push(`--------------------------`);
    lines.push(`📞 Phone: ${phone}`);
    lines.push(`📍 ${address}`);
    lines.push(`_${footerNote}_`);

    return lines.join('\n');
  };

  const handleWhatsAppShare = () => {
    const text = generateWhatsAppMessage();
    let targetPhone = sale.customer_phone ? sale.customer_phone.replace(/[^0-9]/g, '') : '';
    if (targetPhone.startsWith('0')) {
      targetPhone = '92' + targetPhone.slice(1);
    }

    if (!targetPhone) {
      const inputPhone = prompt('Enter customer WhatsApp phone number (e.g. 03001234567):', '');
      if (!inputPhone) return;
      targetPhone = inputPhone.replace(/[^0-9]/g, '');
      if (targetPhone.startsWith('0')) targetPhone = '92' + targetPhone.slice(1);
    }

    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content" style={{ maxWidth: printFormat === 'a4' ? '820px' : '440px', width: '96%' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-title)' }}>Invoice Preview</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ref: {sale.invoice_no}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Custom Listbox Dropdown for Invoice Format (>= 12px gap from title & close button) */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setDropdownOpen(prev => !prev)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-title)',
                  cursor: 'pointer',
                  height: '34px'
                }}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                <FileText size={14} style={{ color: 'var(--primary)' }} />
                <span>{printFormat === 'thermal' ? 'Thermal Slip - 80mm roll' : 'A4 Invoice - Full page'}</span>
                <ChevronDown size={14} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', color: 'var(--text-muted)' }} />
              </button>

              {dropdownOpen && (
                <ul
                  role="listbox"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    minWidth: '220px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
                    padding: '4px',
                    margin: 0,
                    listStyle: 'none',
                    zIndex: 1300
                  }}
                >
                  <li
                    role="option"
                    aria-selected={printFormat === 'thermal'}
                    onClick={() => handleFormatSelect('thermal')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: printFormat === 'thermal' ? 700 : 500,
                      color: printFormat === 'thermal' ? 'var(--primary)' : 'var(--text-title)',
                      background: printFormat === 'thermal' ? 'var(--hover-bg)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (printFormat !== 'thermal') e.currentTarget.style.background = 'var(--hover-bg)';
                    }}
                    onMouseLeave={(e) => {
                      if (printFormat !== 'thermal') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>Thermal Slip - 80mm roll</span>
                    {printFormat === 'thermal' && <Check size={14} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />}
                  </li>

                  <li
                    role="option"
                    aria-selected={printFormat === 'a4'}
                    onClick={() => handleFormatSelect('a4')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: printFormat === 'a4' ? 700 : 500,
                      color: printFormat === 'a4' ? 'var(--primary)' : 'var(--text-title)',
                      background: printFormat === 'a4' ? 'var(--hover-bg)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (printFormat !== 'a4') e.currentTarget.style.background = 'var(--hover-bg)';
                    }}
                    onMouseLeave={(e) => {
                      if (printFormat !== 'a4') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>A4 Invoice - Full page</span>
                    {printFormat === 'a4' && <Check size={14} style={{ color: 'var(--primary)', strokeWidth: 2.5 }} />}
                  </li>
                </ul>
              )}
            </div>

            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close"
              style={{ marginLeft: '2px' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ background: '#f8fafc', padding: '1rem' }}>
          {loadingDetails && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '12px', color: '#64748b', background: '#e0f2fe', borderRadius: '6px', marginBottom: '8px' }}>
              <RefreshCw size={14} className="animate-spin" />
              <span>Loading invoice line items...</span>
            </div>
          )}
          <div className="printable-area" ref={printContainerRef}>
            {printFormat === 'thermal' ? (
              /* THERMAL RECEIPT LAYOUT */
              <div className="thermal-receipt">
                <div className="center">
                  <h2 style={{ fontSize: '15px', fontWeight: 'bold' }}>{shopName}</h2>
                  <div style={{ fontSize: '10px' }}>{tagline}</div>
                  <div style={{ fontSize: '9px' }}>{address}</div>
                  <div style={{ fontSize: '10px' }}>Tel: {phone}</div>
                </div>

                <div className="divider"></div>

                <div>
                  <div><strong>Inv #:</strong> {sale.invoice_no}</div>
                  <div><strong>Date:</strong> {formatDateTime(sale.created_at || sale.sale_date)}</div>
                  <div><strong>Cashier:</strong> {sale.user_name || 'Counter'}</div>
                  <div><strong>Customer:</strong> {sale.customer_name || 'Walk-in Customer'}</div>
                  {sale.customer_phone && <div><strong>Phone:</strong> {sale.customer_phone}</div>}
                </div>

                <div className="divider"></div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                      <th>Item</th>
                      <th style={{ textAlign: 'center' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '2px 0' }}>
                          <div>{it.product_name}</div>
                          <div style={{ fontSize: '8px', color: '#555' }}>Company: {it.brand_name || it.supplier_name || it.company_name || shopName}</div>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'top' }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right', verticalAlign: 'top' }}>{it.unit_price}</td>
                        <td style={{ textAlign: 'right', verticalAlign: 'top' }}>{it.total_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="divider"></div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <strong>{safeFormatPKR(sale.subtotal)}</strong>
                </div>
                {sale.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span>
                    <span>-{safeFormatPKR(sale.discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0' }}>
                  <strong>GRAND TOTAL:</strong>
                  <strong>{safeFormatPKR(sale.grand_total)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paid ({sale.payment_method || 'Cash'}):</span>
                  <span>{safeFormatPKR(sale.paid_amount)}</span>
                </div>
                {changeReturn > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 'bold' }}>
                    <span>Change Return (Wapis):</span>
                    <span>{safeFormatPKR(changeReturn)}</span>
                  </div>
                )}
                {sale.balance_due > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontWeight: 'bold' }}>
                    <span>This Bill Due:</span>
                    <span>{safeFormatPKR(sale.balance_due)}</span>
                  </div>
                )}

                {hasCustomerBalance && (
                  <>
                    <div style={{ borderTop: '1px dashed #777', margin: '4px 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444' }}>
                      <span>Previous Udhaar:</span>
                      <span>{safeFormatPKR(previousBalance)}</span>
                    </div>
                    {sale.balance_due > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#b91c1c' }}>
                        <span>Added This Bill:</span>
                        <span>+{safeFormatPKR(sale.balance_due)}</span>
                      </div>
                    )}
                    {udhaarDeduction > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#16a34a', fontWeight: 'bold' }}>
                        <span>Deducted from Udhaar:</span>
                        <span>-{safeFormatPKR(udhaarDeduction)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: netRemainingBalance > 0 ? '#b91c1c' : '#16a34a' }}>
                      <span>Total Remaining Udhaar:</span>
                      <span>{safeFormatPKR(netRemainingBalance)}</span>
                    </div>
                  </>
                )}

                <div className="divider"></div>
                <div className="center" style={{ fontSize: '9px', marginTop: '4px' }}>
                  <p>{footerNote}</p>
                  <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px dotted #ccc', fontSize: '8px', color: '#666', textAlign: 'center' }}>
                    Powered by <strong style={{ color: '#0F4D3A' }}>{BRAND_NAME}</strong> ({BRAND_DOMAIN})
                  </div>
                </div>
              </div>
            ) : (
              /* A4 FULL INVOICE LAYOUT */
              <div style={{
                background: '#fff',
                padding: '2rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                color: '#1e293b'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0284c7', paddingBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', color: '#0284c7', fontWeight: 800 }}>{shopName}</h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{tagline}</p>
                    <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>{address} • Tel: {phone}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>TAX INVOICE</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0284c7' }}>#{sale.invoice_no}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Date: {formatDateTime(sale.created_at || sale.sale_date)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', margin: '1rem 0' }}>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Customer:</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{sale.customer_name || 'Walk-in Retail Customer'}</div>
                    {sale.customer_phone && <div style={{ fontSize: '0.8rem', color: '#475569' }}>Phone: {sale.customer_phone}</div>}
                  </div>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Payment Details:</div>
                    <div style={{ fontSize: '0.85rem' }}>Method: <strong>{sale.payment_method || 'Cash'}</strong></div>
                    <div style={{ fontSize: '0.85rem' }}>Cashier: <strong>{sale.user_name || 'Counter'}</strong></div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', margin: '1rem 0' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left', fontSize: '0.775rem' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>#</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Item Description</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Company</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Total (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '0.825rem' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{it.product_name}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{it.brand_name || it.supplier_name || it.company_name || '-'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>{it.quantity} {it.unit}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{safeFormatPKR(it.unit_price)}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>{safeFormatPKR(it.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '1rem 0' }}>
                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>{safeFormatPKR(sale.subtotal)}</span>
                    </div>
                    {sale.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                        <span>Discount:</span>
                        <span>-{safeFormatPKR(sale.discount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '0.35rem', fontSize: '1.05rem', fontWeight: 800 }}>
                      <span>Grand Total:</span>
                      <span style={{ color: '#0284c7' }}>{safeFormatPKR(sale.grand_total)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Paid ({sale.payment_method || 'Cash'}):</span>
                      <span>{safeFormatPKR(sale.paid_amount)}</span>
                    </div>
                    {changeReturn > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 700 }}>
                        <span>Change Return (Wapis):</span>
                        <span>{safeFormatPKR(changeReturn)}</span>
                      </div>
                    )}
                    {sale.balance_due > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 700 }}>
                        <span>This Invoice Due:</span>
                        <span>{safeFormatPKR(sale.balance_due)}</span>
                      </div>
                    )}
                    {hasCustomerBalance && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                          <span>Previous Balance (Pehla Udhaar):</span>
                          <span>{safeFormatPKR(previousBalance)}</span>
                        </div>
                        {sale.balance_due > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontSize: '0.8rem' }}>
                            <span>Added This Bill:</span>
                            <span>+{safeFormatPKR(sale.balance_due)}</span>
                          </div>
                        )}
                        {udhaarDeduction > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontSize: '0.85rem', fontWeight: 700 }}>
                            <span>Deducted from Udhaar:</span>
                            <span>-{safeFormatPKR(udhaarDeduction)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: netRemainingBalance > 0 ? '#b91c1c' : '#16a34a', fontWeight: 800, fontSize: '0.95rem' }}>
                          <span>Total Remaining Udhaar:</span>
                          <span>{safeFormatPKR(netRemainingBalance)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                  <div>{footerNote}</div>
                  <div>Authorized Stamp / Signature</div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                  Powered by <strong style={{ color: '#0F4D3A' }}>{BRAND_NAME}</strong> — Modern Cloud POS &amp; Inventory Management ({BRAND_DOMAIN})
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={handleWhatsAppShare}
            style={{ background: '#25D366', color: '#fff', border: 'none', padding: '0 0.6rem', height: '30px' }}
            title="Share Bill via WhatsApp"
          >
            <MessageSquare size={14} />
            <span><span className="hide-mobile">Send </span>WhatsApp</span>
          </button>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ height: '30px', padding: '0 0.6rem' }}>
              Close
            </button>
            <button className="btn btn-primary btn-sm" onClick={handlePrint} style={{ height: '32px', padding: '0 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <Printer size={14} />
              <span>{printFormat === 'thermal' ? 'Print 80mm Slip' : 'Print A4 Invoice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
