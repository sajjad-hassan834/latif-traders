import React, { useRef } from 'react';
import { Printer, X, Check, DollarSign } from 'lucide-react';
import { formatPKR, formatDate, formatDateTime } from '../../utils/formatters';
import { BRAND_NAME } from '../../config/brand';

// Safe PKR formatter
const safeFormatPKR = (amt) => {
  if (amt === undefined || amt === null || isNaN(amt)) return 'Rs. 0';
  return 'Rs. ' + Number(amt).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

export default function ReceiptVoucherModal({ receipt, party, tenantSettings = {}, onClose }) {
  const printRef = useRef(null);

  if (!receipt) return null;

  const isCustomer = receipt.type === 'CUSTOMER_RECEIPT' || receipt.party_type === 'CUSTOMER' || !receipt.type?.includes('SUPPLIER');
  const voucherTitle = isCustomer ? 'PAYMENT RECEIPT VOUCHER' : 'PAYMENT DISBURSEMENT VOUCHER';
  const voucherColor = isCustomer ? '#0F766E' : '#2563EB';

  const refNo = receipt.ref_no || receipt.reference_no || `REC-${receipt.id || '0000'}`;
  const amount = Number(receipt.received_amount || receipt.amount || receipt.credit || receipt.debit || 0);
  const paymentMethod = receipt.payment_method || 'Cash';
  const notes = receipt.notes || (isCustomer ? 'Received with thanks on account.' : 'Paid towards supplier account.');
  const partyName = party?.name || receipt.customer_name || receipt.supplier_name || 'Valued Account';
  const partyPhone = party?.phone || receipt.customer_phone || receipt.supplier_phone || '';
  const remainingBalance = receipt.running_balance !== undefined ? receipt.running_balance : (receipt.balance !== undefined ? receipt.balance : null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #FFFFFF)',
          color: 'var(--text-title, #1F2937)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Top Action Bar */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--bg-hover, #F9FAFB)',
            borderBottom: '1px solid var(--border, #E5E7EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: isCustomer ? 'rgba(15, 118, 110, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                color: voucherColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <DollarSign size={16} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)' }}>
              Receipt Voucher Preview
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '32px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              <Printer size={13} />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '1px solid var(--border, #E5E7EB)',
                background: 'var(--bg-card, #FFFFFF)',
                color: 'var(--text-muted, #6B7280)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Close (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Voucher Body (Printable Area) */}
        <div
          ref={printRef}
          className="receipt-print-area printable-area"
          style={{
            padding: '28px 32px',
            overflowY: 'auto',
            flex: 1,
            background: '#FFFFFF',
            color: '#111827',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #D1D5DB', paddingBottom: '16px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {tenantSettings.shop_name || BRAND_NAME}
            </h2>
            {tenantSettings.tagline && (
              <div style={{ fontSize: '12px', color: '#4B5563', marginTop: '2px' }}>
                {tenantSettings.tagline}
              </div>
            )}
            {tenantSettings.address && (
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px' }}>
                {tenantSettings.address}
              </div>
            )}
            {tenantSettings.phone && (
              <div style={{ fontSize: '11px', color: '#6B7280' }}>
                Tel: {tenantSettings.phone}
              </div>
            )}

            <div
              style={{
                display: 'inline-block',
                marginTop: '12px',
                padding: '4px 14px',
                borderRadius: '4px',
                background: isCustomer ? '#F0FDF4' : '#EFF6FF',
                color: voucherColor,
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '1px',
                border: `1px solid ${isCustomer ? '#BBF7D0' : '#BFDBFE'}`
              }}
            >
              {voucherTitle}
            </div>
          </div>

          {/* Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginBottom: '18px' }}>
            <div>
              <span style={{ color: '#6B7280', display: 'block', fontSize: '11px', fontWeight: 600 }}>Voucher No:</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#111827' }}>{refNo}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#6B7280', display: 'block', fontSize: '11px', fontWeight: 600 }}>Date & Time:</span>
              <strong style={{ color: '#111827' }}>{formatDate(receipt.date)}</strong>
            </div>
            <div>
              <span style={{ color: '#6B7280', display: 'block', fontSize: '11px', fontWeight: 600 }}>
                {isCustomer ? 'Received From:' : 'Paid To:'}
              </span>
              <strong style={{ fontSize: '14px', color: '#111827' }}>{partyName}</strong>
              {partyPhone && <div style={{ color: '#6B7280', fontSize: '11px' }}>{partyPhone}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#6B7280', display: 'block', fontSize: '11px', fontWeight: 600 }}>Payment Method:</span>
              <span
                style={{
                  display: 'inline-block',
                  background: '#F3F4F6',
                  color: '#1F2937',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '11px',
                  marginTop: '2px'
                }}
              >
                {paymentMethod}
              </span>
            </div>
          </div>

          {/* Amount Box */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              background: isCustomer ? '#F0FDF4' : '#EFF6FF',
              border: `1.5px solid ${isCustomer ? '#86EFAC' : '#93C5FD'}`,
              textAlign: 'center',
              marginBottom: '20px'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: voucherColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Amount {isCustomer ? 'Received' : 'Disbursed'}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: voucherColor, marginTop: '2px' }}>
              {safeFormatPKR(amount)}
            </div>
          </div>

          {/* Notes & Account Balance */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '14px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#6B7280', fontWeight: 600 }}>Notes:</span>
              <span style={{ color: '#111827', fontWeight: 500, textAlign: 'right', maxWidth: '65%' }}>
                {notes}
              </span>
            </div>

            {remainingBalance !== null && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#F9FAFB',
                  borderRadius: '6px',
                  marginTop: '8px',
                  border: '1px solid #E5E7EB'
                }}
              >
                <span style={{ color: '#4B5563', fontWeight: 600 }}>Remaining Account Balance:</span>
                <strong style={{ color: remainingBalance > 0 ? '#DC2626' : '#16A34A', fontSize: '13px' }}>
                  {safeFormatPKR(remainingBalance)}
                </strong>
              </div>
            )}
          </div>

          {/* Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '40px', paddingTop: '10px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #9CA3AF', paddingTop: '4px', fontSize: '11px', color: '#6B7280' }}>
                Customer Signature
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #9CA3AF', paddingTop: '4px', fontSize: '11px', color: '#6B7280' }}>
                Authorized Signature
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '10px', color: '#9CA3AF' }}>
            Computer generated voucher • Valid without physical stamp • Printed {formatDateTime(new Date().toISOString())}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--bg-hover, #F9FAFB)',
            borderTop: '1px solid var(--border, #E5E7EB)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handlePrint}
            style={{
              height: '32px',
              padding: '0 16px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={13} />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
}
