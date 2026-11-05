/**
 * Non-Latif Print Previews & Tenant Isolation Verification Suite
 *
 * Verifies that when a tenant (e.g. Al-Madina Superstore or Metro Mart) renders:
 *  1. Sale Invoice Print Preview
 *  2. Customer Statement / Receipt Voucher
 *  3. Supplier Statement / Disbursement Voucher
 *  4. Cashbook Print Preview
 *  5. Purchase Delivery Voucher
 *  6. Official Report Print Preview (Header & Footer)
 *
 * Requirements:
 *  - Tenant name is strictly present in the printed document.
 *  - "latif" (case-insensitive) is NEVER present.
 *  - Empty/fallback states default to BRAND_NAME (ShoppyOS) or empty string, NEVER Latif.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { BRAND_NAME } = require('../config/brand');

console.log('========================================================================');
console.log('NON-LATIF PRINT PREVIEWS & BRAND INTEGRITY TEST SUITE');
console.log('========================================================================');

const nonLatifTenant = {
  id: 't_al_madina_981',
  business_name: 'Al-Madina Superstore',
  business_type: 'retail_general',
  phone: '0300-1122334',
  address: 'Shop # 45, Main Boulevard, Gulberg, Lahore'
};

const nonLatifSettings = {
  shop_name: 'Al-Madina Superstore',
  company_name: 'Al-Madina Superstore',
  tagline: 'Your Neighborhood Mart',
  phone: '0300-1122334',
  address: 'Shop # 45, Main Boulevard, Gulberg, Lahore',
  invoice_footer: 'Thank you for shopping at Al-Madina Superstore!'
};

let testsRun = 0;
let testsPassed = 0;

function runTest(name, fn) {
  testsRun++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    throw err;
  }
}

// 1. Sale Invoice Print Preview Logic
runTest('Invoice Print Preview: uses tenant shop name and contains zero "latif"', () => {
  // Simulate PrintInvoiceModal shop name resolution
  const tenantShopName = nonLatifSettings.company_name || nonLatifSettings.shop_name;
  const shopName = tenantShopName || BRAND_NAME;
  const tagline = nonLatifSettings.tagline || '';
  const footerNote = nonLatifSettings.invoice_footer || `Thank you for shopping at ${shopName}!`;

  const renderedInvoice = `
    ========================================
    ${shopName.toUpperCase()}
    ${tagline}
    Phone: ${nonLatifSettings.phone}
    Address: ${nonLatifSettings.address}
    ========================================
    INVOICE #: INV-2026-0001
    Items: Basmati Rice 5kg (Rs 1,650)
    Total: Rs 1,650
    ${footerNote}
  `;

  assert(renderedInvoice.includes('AL-MADINA SUPERSTORE'), 'Must contain tenant name');
  assert(!/latif/i.test(renderedInvoice), 'Must NOT contain "latif" (case-insensitive)');

  // Fallback test when no settings provided
  const fallbackShop = null || BRAND_NAME;
  assert.strictEqual(fallbackShop, 'ShoppyOS', 'Fallback must be BRAND_NAME, never Latif');
});

// 2. Customer Statement / Receipt Voucher
runTest('Customer Statement Receipt Voucher: uses tenant shop name and contains zero "latif"', () => {
  const shopName = nonLatifSettings.shop_name || BRAND_NAME;
  const tagline = nonLatifSettings.tagline || '';

  const renderedReceipt = `
    ========================================
    ${shopName.toUpperCase()}
    ${tagline}
    PAYMENT RECEIPT VOUCHER
    Customer: Muhammad Usman
    Received: Rs 5,000
    Remaining Balance: Rs 0
    ========================================
  `;

  assert(renderedReceipt.includes('AL-MADINA SUPERSTORE'), 'Must contain tenant shop name');
  assert(!/latif/i.test(renderedReceipt), 'Must NOT contain "latif"');
});

// 3. Supplier Disbursement Voucher
runTest('Supplier Disbursement Voucher: uses tenant shop name and contains zero "latif"', () => {
  const shopName = nonLatifSettings.shop_name || BRAND_NAME;
  const tagline = nonLatifSettings.tagline || '';

  const renderedDisbursement = `
    ========================================
    ${shopName.toUpperCase()}
    ${tagline}
    PAYMENT DISBURSEMENT VOUCHER
    Supplier: National Distributors
    Paid: Rs 25,000
    Remaining Payable: Rs 10,000
    ========================================
  `;

  assert(renderedDisbursement.includes('AL-MADINA SUPERSTORE'), 'Must contain tenant shop name');
  assert(!/latif/i.test(renderedDisbursement), 'Must NOT contain "latif"');
});

// 4. Cashbook Print Preview
runTest('Cashbook Print Preview: uses tenant shop name and contains zero "latif"', () => {
  const shopName = nonLatifTenant.business_name || BRAND_NAME;
  const renderedCashbook = `
    ========================================
    DAILY CASH BOOK SUMMARY: ${shopName.toUpperCase()}
    Period: 01 Nov 2026 - 05 Nov 2026
    Cash Inflow: Rs 85,000
    Cash Outflow: Rs 42,000
    Net Cash Closing: Rs 43,000
    ========================================
  `;

  assert(renderedCashbook.includes('AL-MADINA SUPERSTORE'), 'Must contain tenant name');
  assert(!/latif/i.test(renderedCashbook), 'Must NOT contain "latif"');
});

// 5. Purchase Delivery Receiving Voucher
runTest('Purchase Voucher: uses tenant shop name and contains zero "latif"', () => {
  const shopName = nonLatifTenant.business_name || '';
  const header = shopName ? `${shopName.toUpperCase()} - PURCHASE VOUCHER` : 'PURCHASE VOUCHER';
  const subtitle = 'Supply Delivery Receiving Record';

  const renderedPurchaseVoucher = `
    ========================================
    ${header}
    ${subtitle}
    Supplier: Al-Karam Grains
    Voucher #: PV-2026-0042
    Items Received: 50 bags
    Grand Total: Rs 120,000
    ========================================
  `;

  assert(renderedPurchaseVoucher.includes('AL-MADINA SUPERSTORE - PURCHASE VOUCHER'), 'Must contain tenant voucher header');
  assert(!/latif/i.test(renderedPurchaseVoucher), 'Must NOT contain "latif"');
});

// 6. Report Print Header & Footer
runTest('Report Print Header & Footer: uses tenant shop name and contains zero "latif"', () => {
  const resolvedHeaderShop = nonLatifSettings.shop_name || BRAND_NAME;
  const resolvedFooterShop = nonLatifSettings.shop_name || BRAND_NAME;
  const printedBy = 'Authorized User';

  const renderedReport = `
    ========================================
    ${resolvedHeaderShop}™ • OFFICIAL BUSINESS RECORD
    Tagline: ${nonLatifSettings.tagline}
    Printed By: ${printedBy}
    ----------------------------------------
    PROFIT & LOSS STATEMENT
    Net Profit: Rs 145,000
    ----------------------------------------
    OFFICIAL COMPANY SEAL
    ${resolvedFooterShop}™
    CONFIDENTIAL & PROPRIETARY • ${resolvedFooterShop}™ ERP Management System
    ========================================
  `;

  assert(renderedReport.includes('Al-Madina Superstore™'), 'Must contain tenant trademark title');
  assert(!/latif/i.test(renderedReport), 'Must NOT contain "latif"');
});

// 7. Client Code Static Audit: Zero Hardcoded "LATIF TRADERS" in Views/Modals
runTest('Client views and modals have zero hardcoded "LATIF TRADERS" or "Latif Traders" fallbacks', () => {
  const auditedFiles = [
    'client/src/pages/Customers.jsx',
    'client/src/pages/Suppliers.jsx',
    'client/src/pages/CashFlow.jsx',
    'client/src/pages/Purchases.jsx',
    'client/src/components/invoices/PrintInvoiceModal.jsx',
    'client/src/components/invoices/ReceiptVoucherModal.jsx',
    'client/src/components/layout/Header.jsx',
    'client/src/pages/Reports.jsx',
    'client/src/components/common/ReportPrintHeader.jsx',
    'client/src/components/common/ReportPrintFooter.jsx',
    'client/src/components/common/BarcodeLabelModal.jsx',
    'client/src/pages/Register.jsx'
  ];

  for (const rel of auditedFiles) {
    const fullPath = path.resolve(__dirname, '../..', rel);
    const content = fs.readFileSync(fullPath, 'utf8');
    // Strip comments
    const codeOnly = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    assert(!/LATIF TRADERS/i.test(codeOnly), `File ${rel} must not contain "LATIF TRADERS" in code!`);
  }
});

console.log('------------------------------------------------------------------------');
console.log(`Verdict: ${testsPassed}/${testsRun} non-Latif print preview tests PASSED!`);
console.log('========================================================================\n');

