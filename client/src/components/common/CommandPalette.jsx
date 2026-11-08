import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  UserPlus,
  ArrowDownToLine,
  Sliders,
  LayoutDashboard,
  Receipt,
  Package,
  Users,
  Building2,
  Wallet,
  DollarSign,
  BarChart3,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  X,
  CornerDownLeft
} from 'lucide-react';
import { isSoundEnabled, setSoundEnabled, playBeep } from '../../utils/audio';

export default function CommandPalette({ isOpen, onClose, setTab, onAction }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [soundState, setSoundState] = useState(isSoundEnabled());
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSoundState(isSoundEnabled());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleSoundChange = (e) => {
      setSoundState(e.detail?.enabled ?? isSoundEnabled());
    };
    window.addEventListener('lt-sound-changed', handleSoundChange);
    return () => window.removeEventListener('lt-sound-changed', handleSoundChange);
  }, []);

  const commands = [
    // Quick Actions
    {
      id: 'act-new-sale',
      title: 'New Sale POS',
      category: 'Quick Actions',
      icon: ShoppingCart,
      shortcut: 'F2',
      action: () => { setTab('pos'); onClose(); }
    },
    {
      id: 'act-add-customer',
      title: 'Add New Customer',
      category: 'Quick Actions',
      icon: UserPlus,
      action: () => { setTab('customers'); onAction?.('add-customer'); onClose(); }
    },
    {
      id: 'act-new-purchase',
      title: 'New Purchase Bill',
      category: 'Quick Actions',
      icon: ArrowDownToLine,
      action: () => { setTab('purchases'); onAction?.('add-purchase'); onClose(); }
    },
    {
      id: 'act-stock-adjust',
      title: 'Stock Adjustment',
      category: 'Quick Actions',
      icon: Sliders,
      action: () => { setTab('stock-adjust'); onClose(); }
    },
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      category: 'Navigation',
      icon: LayoutDashboard,
      action: () => { setTab('dashboard'); onClose(); }
    },
    {
      id: 'nav-pos',
      title: 'Go to POS Counter',
      category: 'Navigation',
      icon: ShoppingCart,
      action: () => { setTab('pos'); onClose(); }
    },
    {
      id: 'nav-orders',
      title: 'Go to Orders & Sales List',
      category: 'Navigation',
      icon: Receipt,
      action: () => { setTab('sales'); onClose(); }
    },
    {
      id: 'nav-products',
      title: 'Go to Products & Inventory',
      category: 'Navigation',
      icon: Package,
      action: () => { setTab('inventory'); onClose(); }
    },
    {
      id: 'nav-purchases',
      title: 'Go to Purchases & Inward Bills',
      category: 'Navigation',
      icon: ArrowDownToLine,
      action: () => { setTab('purchases'); onClose(); }
    },
    {
      id: 'nav-customers',
      title: 'Go to Customers & Udhaar',
      category: 'Navigation',
      icon: Users,
      action: () => { setTab('customers'); onClose(); }
    },
    {
      id: 'nav-suppliers',
      title: 'Go to Suppliers & Vendors',
      category: 'Navigation',
      icon: Building2,
      action: () => { setTab('suppliers'); onClose(); }
    },
    {
      id: 'nav-expenses',
      title: 'Go to Expenses',
      category: 'Navigation',
      icon: Wallet,
      action: () => { setTab('expenses'); onClose(); }
    },
    {
      id: 'nav-cashbook',
      title: 'Go to Cashbook & Finance',
      category: 'Navigation',
      icon: DollarSign,
      action: () => { setTab('cashflow'); onClose(); }
    },
    {
      id: 'nav-analytics',
      title: 'Go to Analytics & Reports',
      category: 'Navigation',
      icon: BarChart3,
      action: () => { setTab('reports'); onClose(); }
    },
    // Appearance & Settings
    {
      id: 'theme-classic-light',
      title: 'Theme: Switch to Classic Light',
      category: 'Appearance',
      icon: Sun,
      action: () => {
        window.dispatchEvent(new CustomEvent('lt-change-theme', { detail: { theme: 'classic-light' } }));
        playBeep('click');
        onClose();
      }
    },
    {
      id: 'theme-royal-indigo',
      title: 'Theme: Switch to Royal Indigo',
      category: 'Appearance',
      icon: Moon,
      action: () => {
        window.dispatchEvent(new CustomEvent('lt-change-theme', { detail: { theme: 'royal-indigo' } }));
        playBeep('click');
        onClose();
      }
    },
    {
      id: 'sound-toggle',
      title: soundState ? 'Mute Sound Effects' : 'Enable Sound Effects',
      category: 'Appearance',
      icon: soundState ? VolumeX : Volume2,
      action: () => {
        const next = !soundState;
        setSoundEnabled(next);
        setSoundState(next);
        if (next) playBeep('scan');
        onClose();
      }
    }
  ];

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q))
    );
  });

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      playBeep('click');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      playBeep('click');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        playBeep('click');
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'paletteFadeIn 0.15s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text, #0f172a)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            position: 'relative'
          }}
        >
          <Search size={20} style={{ color: 'var(--primary, #0284c7)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, page, or action... (Ctrl + K)"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '15px',
              fontWeight: 500,
              color: 'inherit'
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          )}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--border, #f1f5f9)',
              color: 'var(--text-muted, #64748b)',
              fontFamily: 'monospace'
            }}
          >
            ESC
          </span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            padding: '8px',
            flex: 1
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              No matching commands or pages found.
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    playBeep('click');
                    cmd.action();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary, #0284c7)' : 'transparent',
                    color: isSelected ? '#ffffff' : 'inherit',
                    transition: 'all 0.1s ease',
                    marginBottom: '2px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-subtle, #f8fafc)',
                        color: isSelected ? '#ffffff' : 'var(--primary, #0284c7)'
                      }}
                    >
                      <Icon size={17} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{cmd.title}</div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: isSelected ? 'rgba(255, 255, 255, 0.8)' : 'var(--text-muted, #64748b)'
                        }}
                      >
                        {cmd.category}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cmd.shortcut && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--border, #f1f5f9)',
                          color: isSelected ? '#ffffff' : 'var(--text-muted, #64748b)',
                          fontFamily: 'monospace'
                        }}
                      >
                        {cmd.shortcut}
                      </span>
                    )}
                    {isSelected && <CornerDownLeft size={14} style={{ opacity: 0.9 }} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            color: 'var(--text-muted, #64748b)',
            background: 'var(--bg-subtle, #f8fafc)'
          }}
        >
          <span>Use <strong>↑↓</strong> to navigate, <strong>Enter</strong> to select</span>
          <span>Press <strong>Ctrl + K</strong> to toggle</span>
        </div>
      </div>
    </div>
  );
}

