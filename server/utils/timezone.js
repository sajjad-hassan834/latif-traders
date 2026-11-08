/**
 * Timezone and Business Date Utilities for Latif Traders
 * Business Timezone: Asia/Karachi (PKT, UTC+5)
 * All daily sales, cashbook entries, and "today" filters strictly resolve
 * according to the Pakistan Standard Time business day.
 */

const PKT_TIMEZONE = 'Asia/Karachi';

/**
 * Returns current business date in 'YYYY-MM-DD' formatted for PKT
 */
function getPKTDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  // Using Intl to format in Asia/Karachi
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PKT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

/**
 * Returns full timestamp in 'YYYY-MM-DD HH:mm:ss' formatted for PKT
 */
function getPKTDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const datePart = getPKTDate(d);
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: PKT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return `${datePart} ${timeFormatter.format(d)}`;
}

/**
 * Given a PKT date string 'YYYY-MM-DD', returns the UTC ISO boundaries
 * representing 00:00:00 to 23:59:59.999 in PKT (UTC+5).
 * e.g. for '2026-10-25', start is 2026-10-24T19:00:00.000Z and end is 2026-10-25T18:59:59.999Z.
 */
function getPKTDayRangeUTC(pktDateStr) {
  const [year, month, day] = pktDateStr.split('-').map(Number);
  // PKT is UTC+5. 00:00:00 PKT on day D is (D-1) 19:00:00 UTC
  const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (5 * 60 * 60 * 1000));
  const endUTC = new Date(startUTC.getTime() + (24 * 60 * 60 * 1000) - 1);
  return {
    startUTC: startUTC.toISOString(),
    endUTC: endUTC.toISOString(),
    startDate: pktDateStr,
    endDate: pktDateStr
  };
}

module.exports = {
  PKT_TIMEZONE,
  getPKTDate,
  getPKTDateTime,
  getPKTDayRangeUTC
};
