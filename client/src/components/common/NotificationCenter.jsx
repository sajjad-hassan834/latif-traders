import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  X,
  Package,
  ArrowRight
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

export default function NotificationCenter({ alerts = {}, setTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'low_stock', 'expiry'
  const dropdownRef = useRef(null);

  const lowStockItems = alerts.low_stock_items || [];
  const nearExpiryBatches = alerts.near_expiry_batches || [];

  const totalAlerts = (alerts.low_stock_count || 0) + (alerts.near_expiry_count || 0);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavigate = (tab) => {
    setTab(tab);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary btn-sm"
        style={{
          position: 'relative',
          padding: '5px 9px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px'
        }}
        title="Notifications & Inventory Alerts"
        aria-label="Notifications"
      >
        <Bell size={16} color={totalAlerts > 0 ? '#0284c7' : '#64748b'} />
        {totalAlerts > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 800,
            borderRadius: '9999px',
            padding: '1px 5px',
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }}>
            {totalAlerts}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '115%',
          width: '380px',
          maxWidth: '92vw',
          background: '#ffffff',
          borderRadius: '10px',
          boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.18), 0 4px 10px -2px rgba(15, 23, 42, 0.08)',
          border: '1px solid #e2e8f0',
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          {/* HEADER */}
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid #f1f5f9',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={16} color="#0284c7" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>System Alerts</span>
              {totalAlerts > 0 && (
                <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                  {totalAlerts} New
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* FILTER TABS */}
          <div style={{
            display: 'flex',
            padding: '0.4rem 0.75rem',
            gap: '0.35rem',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '3px 8px',
                fontSize: '0.725rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                background: activeTab === 'all' ? '#0284c7' : 'transparent',
                color: activeTab === 'all' ? '#fff' : '#64748b',
                cursor: 'pointer'
              }}
            >
              All ({totalAlerts})
            </button>
            <button
              onClick={() => setActiveTab('low_stock')}
              style={{
                padding: '3px 8px',
                fontSize: '0.725rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                background: activeTab === 'low_stock' ? '#f59e0b' : 'transparent',
                color: activeTab === 'low_stock' ? '#fff' : '#64748b',
                cursor: 'pointer'
              }}
            >
              Low Stock ({alerts.low_stock_count || 0})
            </button>
            <button
              onClick={() => setActiveTab('expiry')}
              style={{
                padding: '3px 8px',
                fontSize: '0.725rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                background: activeTab === 'expiry' ? '#ef4444' : 'transparent',
                color: activeTab === 'expiry' ? '#fff' : '#64748b',
                cursor: 'pointer'
              }}
            >
              Expiry QC ({alerts.near_expiry_count || 0})
            </button>
          </div>

          {/* ALERTS LIST */}
          <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '0.5rem' }}>
            {totalAlerts === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>All Clear!</div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                  No low stock or near-expiry batches detected.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {/* 1. Low Stock Alerts */}
                {(activeTab === 'all' || activeTab === 'low_stock') && lowStockItems.map(item => {
                  const isOut = (item.current_stock || 0) <= 0;
                  return (
                    <div
                      key={`ls-${item.id}`}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '6px',
                        background: isOut ? '#fef2f2' : '#fffbeb',
                        border: `1px solid ${isOut ? '#fecaca' : '#fde68a'}`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.5rem', minWidth: 0 }}>
                        <div style={{ marginTop: '2px' }}>
                          <AlertTriangle size={15} color={isOut ? '#ef4444' : '#f59e0b'} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                            Stock: <strong style={{ color: isOut ? '#ef4444' : '#d97706' }}>{item.current_stock} {item.unit}</strong> (Min: {item.min_stock_level})
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleNavigate('inventory')}
                        className="btn btn-sm"
                        style={{
                          padding: '2px 7px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: '#fff',
                          border: '1px solid #cbd5e1',
                          color: '#0284c7',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                      >
                        Restock
                      </button>
                    </div>
                  );
                })}

                {/* 2. Near Expiry Batches */}
                {(activeTab === 'all' || activeTab === 'expiry') && nearExpiryBatches.map(b => {
                  const isExpired = (b.days_remaining || 0) <= 0;
                  return (
                    <div
                      key={`exp-${b.id}`}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '6px',
                        background: isExpired ? '#fef2f2' : '#fff7ed',
                        border: `1px solid ${isExpired ? '#fecaca' : '#fed7aa'}`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.5rem', minWidth: 0 }}>
                        <div style={{ marginTop: '2px' }}>
                          <Clock size={15} color={isExpired ? '#ef4444' : '#ea580c'} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.product_name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                            Lot: <span className="mono" style={{ fontWeight: 600 }}>{b.batch_no}</span> • {b.quantity} {b.unit || ''}
                          </div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isExpired ? '#dc2626' : '#ea580c', marginTop: '2px' }}>
                            {isExpired ? 'Expired' : `Expires in ${b.days_remaining} days`} ({formatDate(b.expiry_date)})
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleNavigate('reports')}
                        className="btn btn-sm"
                        style={{
                          padding: '2px 7px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          background: '#fff',
                          border: '1px solid #cbd5e1',
                          color: '#ea580c',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                      >
                        Inspect
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div style={{
            padding: '0.5rem 0.85rem',
            borderTop: '1px solid #f1f5f9',
            background: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <button
              onClick={() => handleNavigate('inventory')}
              style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <span>Inventory Management</span>
              <ArrowRight size={12} />
            </button>
            <button
              onClick={() => handleNavigate('reports')}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >
              All Reports
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
