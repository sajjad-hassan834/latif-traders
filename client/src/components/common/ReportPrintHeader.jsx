import React from 'react';
import { BRAND_NAME } from '../../config/brand';

export default function ReportPrintHeader({
  settings = {},
  reportTitle,
  reportSubtitle,
  dateRangeText,
  docRef,
  user
}) {
  const shopName = settings.shop_name || BRAND_NAME;
  const tagline = settings.tagline || '';
  const phone = settings.phone || '';
  const email = settings.email || '';
  const address = settings.address || '';
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const printedBy = user?.full_name || user?.username || 'Authorized User';

  return (
    <div className="report-print-header">
      {/* Top Trademark & Corporate Brand Letterhead */}
      <div className="report-brand-row">
        <div className="report-brand-left">
          <div className="report-logo-badge">
            <div className="report-logo-icon">🏢</div>
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
          {docRef && (
            <div className="report-meta-chip">
              <span className="chip-label">REF:</span>
              <span className="chip-val">{docRef}</span>
            </div>
          )}
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
