import React from 'react';

export default function ReportPrintFooter({ shopName = 'Sajjad Traders' }) {
  return (
    <div className="report-print-footer">
      <div className="report-signatures-grid">
        <div className="signature-box">
          <div className="signature-line"></div>
          <div className="signature-title">Prepared By / Cashier</div>
          <div className="signature-sub">Signature & Timestamp</div>
        </div>

        <div className="signature-box">
          <div className="signature-line"></div>
          <div className="signature-title">Audited & Verified By</div>
          <div className="signature-sub">Branch Manager / Accountant</div>
        </div>

        <div className="signature-stamp-box">
          <div className="stamp-frame">
            <span>OFFICIAL COMPANY SEAL</span>
            <span className="stamp-sub">{shopName}™</span>
          </div>
        </div>
      </div>

      <div className="report-legal-notice">
        <p>
          CONFIDENTIAL & PROPRIETARY • This is an official computer-generated audit record issued under the authority of {shopName}™ ERP Management System. Any alteration or unauthorized reproduction invalidates this certificate.
        </p>
      </div>
    </div>
  );
}
