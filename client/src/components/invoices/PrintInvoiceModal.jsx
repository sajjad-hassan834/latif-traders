import React, { useState } from 'react';
import { Printer, X, FileText, Share2, MessageSquare, Check } from 'lucide-react';
import { formatPKR, formatDate, formatDateTime } from '../../utils/formatters';

export default function PrintInvoiceModal({ sale, items = [], settings = {}, onClose }) {
  const [printFormat, setPrintFormat] = useState('thermal');
  const [whatsappCopied, setWhatsappCopied] = useState(false);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const shopName = settings.shop_name || 'LATIF TRADERS';
  const tagline = settings.tagline || 'Frozen Food Wholesalers & Retailers';
  const phone = settings.phone || '+92 300 1234567';
  const address = settings.address || 'Shop # 14-16, Commercial Market, Frozen Food Market, Lahore';
  const footerNote = settings.invoice_footer || 'Thank you for shopping at Latif Traders! Keep frozen at -18°C.';

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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: printFormat === 'a4' ? '820px' : '440px', width: '96%' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Invoice Preview</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Ref: {sale.invoice_no}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
              <button
                className={`btn btn-sm ${printFormat === 'thermal' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                onClick={() => setPrintFormat('thermal')}
              >
                80mm Slip
              </button>
              <button
                className={`btn btn-sm ${printFormat === 'a4' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                onClick={() => setPrintFormat('a4')}
              >
                A4 Invoice
              </button>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ background: '#f8fafc', padding: '1rem' }}>
          <div className="printable-area">
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
                          <div style={{ fontSize: '8px', color: '#555' }}>Company: {it.brand_name || it.supplier_name || it.company_name || 'Latif Traders'}</div>
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
                  <strong>{formatPKR(sale.subtotal)}</strong>
                </div>
                {sale.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span>
                    <span>-{formatPKR(sale.discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '3px 0' }}>
                  <strong>GRAND TOTAL:</strong>
                  <strong>{formatPKR(sale.grand_total)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paid ({sale.payment_method || 'Cash'}):</span>
                  <span>{formatPKR(sale.paid_amount)}</span>
                </div>
                {changeReturn > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 'bold' }}>
                    <span>Change Return (Wapis):</span>
                    <span>{formatPKR(changeReturn)}</span>
                  </div>
                )}
                {sale.balance_due > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontWeight: 'bold' }}>
                    <span>This Bill Due:</span>
                    <span>{formatPKR(sale.balance_due)}</span>
                  </div>
                )}

                {hasCustomerBalance && (
                  <>
                    <div style={{ borderTop: '1px dashed #777', margin: '4px 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444' }}>
                      <span>Previous Udhaar:</span>
                      <span>{formatPKR(previousBalance)}</span>
                    </div>
                    {sale.balance_due > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#b91c1c' }}>
                        <span>Added This Bill:</span>
                        <span>+{formatPKR(sale.balance_due)}</span>
                      </div>
                    )}
                    {udhaarDeduction > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#16a34a', fontWeight: 'bold' }}>
                        <span>Deducted from Udhaar:</span>
                        <span>-{formatPKR(udhaarDeduction)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: netRemainingBalance > 0 ? '#b91c1c' : '#16a34a' }}>
                      <span>Total Remaining Udhaar:</span>
                      <span>{formatPKR(netRemainingBalance)}</span>
                    </div>
                  </>
                )}

                <div className="divider"></div>
                <div className="center" style={{ fontSize: '9px', marginTop: '4px' }}>
                  <p>{footerNote}</p>
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
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{formatPKR(it.unit_price)}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>{formatPKR(it.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '1rem 0' }}>
                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>{formatPKR(sale.subtotal)}</span>
                    </div>
                    {sale.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                        <span>Discount:</span>
                        <span>-{formatPKR(sale.discount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '0.35rem', fontSize: '1.05rem', fontWeight: 800 }}>
                      <span>Grand Total:</span>
                      <span style={{ color: '#0284c7' }}>{formatPKR(sale.grand_total)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Paid ({sale.payment_method || 'Cash'}):</span>
                      <span>{formatPKR(sale.paid_amount)}</span>
                    </div>
                    {changeReturn > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 700 }}>
                        <span>Change Return (Wapis):</span>
                        <span>{formatPKR(changeReturn)}</span>
                      </div>
                    )}
                    {sale.balance_due > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 700 }}>
                        <span>This Invoice Due:</span>
                        <span>{formatPKR(sale.balance_due)}</span>
                      </div>
                    )}
                    {hasCustomerBalance && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                          <span>Previous Balance (Pehla Udhaar):</span>
                          <span>{formatPKR(previousBalance)}</span>
                        </div>
                        {sale.balance_due > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontSize: '0.8rem' }}>
                            <span>Added This Bill:</span>
                            <span>+{formatPKR(sale.balance_due)}</span>
                          </div>
                        )}
                        {udhaarDeduction > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontSize: '0.85rem', fontWeight: 700 }}>
                            <span>Deducted from Udhaar:</span>
                            <span>-{formatPKR(udhaarDeduction)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: netRemainingBalance > 0 ? '#b91c1c' : '#16a34a', fontWeight: 800, fontSize: '0.95rem' }}>
                          <span>Total Remaining Udhaar:</span>
                          <span>{formatPKR(netRemainingBalance)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                  <div>{footerNote}</div>
                  <div>Authorized Stamp / Signature</div>
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
            <button className="btn btn-primary btn-sm" onClick={handlePrint} style={{ height: '30px', padding: '0 0.6rem' }}>
              <Printer size={14} />
              <span>Print<span className="hide-mobile"> Slip</span></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
