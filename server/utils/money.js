/**
 * Money and Numeric Type Utilities
 * Decision: All monetary values in PostgreSQL are stored as NUMERIC(14,2).
 * Reason: Eliminates binary floating-point rounding errors (e.g., 0.1 + 0.2 !== 0.3)
 * while providing up to 999 billion rupees with exact paisa (2 decimal places) precision.
 * 
 * NEVER mix string and number arithmetic.
 */

function round2(val) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function parseNumeric(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return round2(val);
  const parsed = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(parsed) ? 0 : round2(parsed);
}

function formatPKR(val) {
  const num = parseNumeric(val);
  return '₨ ' + num.toLocaleString('en-PK', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

/**
 * Parity comparison tolerance helper:
 * Tolerance of 0.005 (half a paisa) is strictly reserved for comparing
 * legacy SQLite REAL (IEEE 754 float) values against PostgreSQL NUMERIC(14,2).
 * For all pure PostgreSQL operations, exact equality (delta === 0) is enforced.
 */
function isPaisaEqual(a, b, tolerance = 0.005) {
  const diff = Math.abs(parseNumeric(a) - parseNumeric(b));
  return diff <= tolerance;
}

module.exports = {
  round2,
  parseNumeric,
  formatPKR,
  isPaisaEqual
};
