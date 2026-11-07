import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Custom DatePicker with DD/MM/YYYY formatting and calendar popover.
 * Eliminates native browser mm/dd/yyyy inputs.
 * Props:
 *  - value: 'YYYY-MM-DD' string or ''
 *  - onChange: callback(dateStr: 'YYYY-MM-DD')
 *  - placeholder: string (defaults to 'DD/MM/YYYY')
 *  - minDate, maxDate: 'YYYY-MM-DD'
 *  - style: custom inline styles for trigger button
 */
export default function CustomDatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  minDate,
  maxDate,
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const containerRef = useRef(null);

  // Parse YYYY-MM-DD into Date or default to today
  const parsedDate = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(parsedDate ? parsedDate.getFullYear() : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate ? parsedDate.getMonth() : new Date().getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Viewport collision detection: if opening to the right overflows screen, anchor right
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popoverWidth = 270;
      if (rect.left + popoverWidth > window.innerWidth || (window.innerWidth - rect.right < 140)) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Format YYYY-MM-DD -> DD/MM/YYYY
  const displayValue = value ? (() => {
    const parts = value.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return value;
  })() : '';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Generate calendar days
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const handleSelectDay = (day) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const isoStr = `${viewYear}-${mm}-${dd}`;
    onChange(isoStr);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const handleToday = (e) => {
    e.stopPropagation();
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const isoStr = `${now.getFullYear()}-${mm}-${dd}`;
    onChange(isoStr);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          height: '34px',
          minWidth: '130px',
          padding: '0 10px',
          background: 'var(--input-bg, #FFFFFF)',
          border: '1px solid var(--border, #D1D5DB)',
          borderRadius: '7px',
          color: displayValue ? 'var(--text-title, #111827)' : 'var(--text-muted, #9CA3AF)',
          fontSize: '13px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          ...style
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <CalendarIcon size={14} style={{ color: 'var(--text-muted, #6B7280)' }} />
          <span>{displayValue || placeholder}</span>
        </span>
        {displayValue && (
          <span
            onClick={handleClear}
            style={{
              padding: '2px',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title="Clear date"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: alignRight ? 'auto' : 0,
            right: alignRight ? 0 : 'auto',
            zIndex: 1050,
            width: '260px',
            background: 'var(--bg-card, #FFFFFF)',
            border: '1px solid var(--border, #E5E7EB)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '12px',
            userSelect: 'none'
          }}
        >
          {/* Calendar Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: 'none',
                border: '1px solid var(--border, #E5E7EB)',
                borderRadius: '6px',
                width: '28px',
                height: '28px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-title, #374151)'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title, #111827)' }}>
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                background: 'none',
                border: '1px solid var(--border, #E5E7EB)',
                borderRadius: '6px',
                width: '28px',
                height: '28px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-title, #374151)'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday Labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '6px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #9CA3AF)' }}>
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {/* Prev month fill */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <span
                key={'prev-' + i}
                style={{
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: 'var(--border, #D1D5DB)'
                }}
              >
                {daysInPrevMonth - firstDayOfWeek + i + 1}
              </span>
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const mm = String(viewMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const iso = `${viewYear}-${mm}-${dd}`;
              const isSelected = iso === value;
              const isToday = iso === new Date().toISOString().split('T')[0];

              return (
                <button
                  key={'curr-' + day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  style={{
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : (isToday ? 600 : 400),
                    borderRadius: '6px',
                    border: isToday && !isSelected ? '1px solid var(--primary, #10B981)' : 'none',
                    background: isSelected ? 'var(--primary, #10B981)' : 'transparent',
                    color: isSelected ? '#FFFFFF' : (isToday ? 'var(--primary, #10B981)' : 'var(--text-title, #1F2937)'),
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover, #F3F4F6)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick Shortcuts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border, #E5E7EB)' }}>
            <button
              type="button"
              onClick={handleToday}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary, #10B981)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 4px'
              }}
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #6B7280)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '2px 4px'
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
