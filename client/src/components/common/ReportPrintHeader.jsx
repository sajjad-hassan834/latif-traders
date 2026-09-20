import React from 'react';

export default function ReportPrintHeader({
  settings = {},
  reportTitle,
  reportSubtitle,
  dateRangeText,
  docRef,
  user
}) {
  const shopName = settings.shop_name || localStorage.getItem('lt_shop_name') || 'Latif Traders';
  const tagline = settings.tagline || localStorage.getItem('lt_shop_tagline') || 'CHICKEN SUPPLIER';
  const phone = settings.phone || localStorage.getItem('lt_phone') || '';
  const email = settings.email || localStorage.getItem('lt_email') || '';
  const address = settings.address || localStorage.getItem('lt_address') || '';
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const printedBy = user?.full_name || user?.username || 'Latif Admin (Owner)';

  return (
    <div className="report-print-header">
      {/* Top Trademark & Corporate Brand Letterhead */}
      <div className="report-brand-row">
        <div className="report-brand-left">
          <div className="report-logo-badge">
            <div className="report-logo-icon">❄️</div>
            <div>
              <div className="report-company-name">
                {shopName} <span className="trademark-symbol">™</span>
              </div>
              <div className="report-company-tagline">{tagline}</div>
              <div className="report-company-contacts">
                <span>📍 {address}</span>
                <span>📞 {phone}</span>
                {email && <span>✉️ {email}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="report-brand-right">
          <div className="report-seal-badge">
            <span className="seal-verified">✔ AUDIT VERIFIED</span>
            <span className="seal-reg">REGISTERED TRADEMARK</span>
          </div>
          <div className="report-ref-box">
            <div className="report-ref-line"><strong>REF:</strong> {docRef || `TR-${Date.now().toString().slice(-6)}`}</div>
            <div className="report-ref-line"><strong>DATE:</strong> {generatedAt}</div>
          </div>
        </div>
      </div>

      {/* Report Document Title Banner */}
      <div className="report-title-banner">
        <div>
          <h2 className="report-main-title">{reportTitle}</h2>
          {reportSubtitle && <div className="report-main-subtitle">{reportSubtitle}</div>}
        </div>
        <div className="report-meta-chips">
          {dateRangeText && (
            <div className="report-meta-chip">
              <span className="chip-label">PERIOD:</span>
              <span className="chip-val">{dateRangeText}</span>
            </div>
          )}
          <div className="report-meta-chip">
            <span className="chip-label">ISSUED BY:</span>
            <span className="chip-val">{printedBy}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
