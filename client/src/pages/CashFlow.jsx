import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Printer, Calendar } from 'lucide-react';
import { api } from '../utils/api';
import { formatPKR, formatDate } from '../utils/formatters';

export default function CashFlow() {
  const [cashbook, setCashbook] = useState(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const loadCashbook = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/payments/cashbook?start_date=${startDate}&end_date=${endDate}`);
      if (res.success) setCashbook(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashbook();
  }, [startDate, endDate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* DATE RANGE & PRINT CONTROLS */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>From:</span>
            <input
              type="date"
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>To:</span>
            <input
              type="date"
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button onClick={loadCashbook} className="btn btn-secondary">
            Filter
          </button>
        </div>

        <button onClick={() => window.print()} className="btn btn-secondary">
          <Printer size={16} />
          <span>Print Daily Cashbook</span>
        </button>
      </div>

      {/* CASHBOOK TOTALS */}
      <div className="grid grid-cols-3">
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>TOTAL CASH IN</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                {formatPKR(cashbook?.total_in || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Sales & Collections</div>
            </div>
            <div style={{ background: '#d1fae5', padding: '10px', borderRadius: '8px', color: '#10b981' }}>
              <ArrowDownLeft size={24} />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>TOTAL CASH OUT</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>
                {formatPKR(cashbook?.total_out || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Expenses & Supplier Payouts</div>
            </div>
            <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '8px', color: '#ef4444' }}>
              <ArrowUpRight size={24} />
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>NET CASH FLOW</div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: (cashbook?.net_cash_flow || 0) >= 0 ? '#0284c7' : '#ef4444',
                marginTop: '0.25rem'
              }}>
                {formatPKR(cashbook?.net_cash_flow || 0)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Cash In minus Cash Out</div>
            </div>
            <div style={{ background: '#e0f2fe', padding: '10px', borderRadius: '8px', color: '#0284c7' }}>
              <DollarSign size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* CASHBOOK LEDGER TABLE */}
      <div className="card printable-area" style={{ padding: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>Cashbook Transaction Details</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Period: {formatDate(startDate)} to {formatDate(endDate)}
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ref #</th>
                <th>Transaction Type</th>
                <th>Party / Category</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Cash In (Receipt)</th>
                <th style={{ textAlign: 'right' }}>Cash Out (Payment)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Loading cashbook entries...</td></tr>
              ) : cashbook?.entries?.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No cash transactions found for this date.</td></tr>
              ) : (
                cashbook?.entries?.map((entry, idx) => (
                  <tr key={idx}>
                    <td>{formatDate(entry.date)}</td>
                    <td className="mono">{entry.ref_no}</td>
                    <td style={{ fontWeight: 600 }}>{entry.title}</td>
                    <td>{entry.party_name || '-'}</td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{entry.notes || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      {entry.flow === 'IN' ? formatPKR(entry.amount) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                      {entry.flow === 'OUT' ? formatPKR(entry.amount) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
