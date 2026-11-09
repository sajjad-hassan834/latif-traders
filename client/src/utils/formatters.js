// Localization & formatting utilities for PKR currency, Pakistani date conventions, and numbers

export function formatPKR(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₨ 0';
  return '₨ ' + Number(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const str = String(dateString).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const [y, m, d] = str.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    }
    let dateToParse = str;
    if (!dateToParse.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(dateToParse)) {
      if (/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}/.test(dateToParse)) {
        dateToParse = dateToParse.replace(' ', 'T') + 'Z';
      }
    }
    const d = new Date(dateToParse);
    if (isNaN(d.getTime())) return String(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateString);
  }
}

export function formatDateTime(dateString) {
  if (!dateString) return '-';
  try {
    let str = String(dateString).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-');
      return `${d}/${m}/${y}`;
    }
    if (!str.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      if (/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}/.test(str)) {
        str = str.replace(' ', 'T') + 'Z';
      }
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return String(dateString);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');

    return `${day}/${month}/${year}, ${strHours}:${minutes} ${ampm}`;
  } catch (e) {
    return String(dateString);
  }
}
