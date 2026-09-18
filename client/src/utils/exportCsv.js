// Client-side CSV/Excel export utility with UTF-8 BOM
export function exportToCSV(filename, rows, columns) {
  if (!rows || !rows.length) {
    alert('No data to export.');
    return;
  }

  // Header row
  const headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');

  // Data rows
  const csvRows = rows.map(row => {
    return columns.map(c => {
      let val = row[c.key];
      if (typeof c.format === 'function') {
        val = c.format(val, row);
      }
      if (val === null || val === undefined) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headers, ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
