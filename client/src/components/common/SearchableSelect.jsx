import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "-- Select --",
  disabled = false,
  className = "form-control"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const highlightText = (text, highlight) => {
    if (!highlight.trim()) return text;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = String(text).split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} style={{ backgroundColor: '#fef08a', color: '#854d0e', padding: 0, fontWeight: 700 }}>{part}</mark> : part
    );
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        className={className}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? 'var(--hover-bg, #f8fafc)' : 'var(--input-bg, #fff)',
          color: 'var(--text-value, #1e293b)',
          borderColor: 'var(--border, #cbd5e1)',
          height: '38px',
          padding: '0 12px'
        }}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) setSearchTerm('');
          }
        }}
      >
        <span style={{ color: selectedOption ? 'var(--text-value, #0f172a)' : 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} color="var(--text-muted, #64748b)" />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'var(--dropdown-bg, var(--bg-card, #fff))',
          border: '1px solid var(--border, #cbd5e1)',
          borderRadius: '6px',
          boxShadow: 'var(--shadow-card, 0 4px 6px -1px rgba(0, 0, 0, 0.1))',
          zIndex: 9999,
          maxHeight: '250px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={14} color="var(--text-muted, #64748b)" />
            <input
              type="text"
              autoFocus
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.85rem',
                background: 'transparent',
                color: 'var(--text-value, inherit)'
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '8px 12px', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>No results found</div>
            ) : (
              filteredOptions.map((opt, i) => (
                <div
                  key={i}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    background: String(opt.value) === String(value) ? 'var(--hover-bg, #f0f9ff)' : 'transparent',
                    color: String(opt.value) === String(value) ? 'var(--primary, #0284c7)' : 'var(--text-value, #1e293b)',
                    borderBottom: '1px solid var(--border-light, var(--border, #f1f5f9))'
                  }}
                  onMouseEnter={(e) => {
                    if (String(opt.value) !== String(value)) {
                      e.currentTarget.style.background = 'var(--hover-bg, #f8fafc)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (String(opt.value) !== String(value)) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {highlightText(opt.label, searchTerm)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
