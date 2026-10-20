import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Global Base Modal Component
 * Ensures 100% consistent styling, animation, Esc key listener,
 * and backdrop handling across the entire application.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = '520px',
  closeOnBackdrop = true,
  closeOnEsc = true,
  headerExtra = null,
  bodyPadding = '24px 28px',
  hideHeader = false,
  zIndex = 1100
}) {
  const modalContentRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (closeOnEsc && (e.key === 'Escape' || e.keyCode === 27)) {
        e.stopPropagation();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '16px'
      }}
    >
      <div
        ref={modalContentRef}
        role="dialog"
        aria-modal="true"
        style={{
          width: maxWidth,
          maxWidth: '92vw',
          background: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
          border: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
          padding: 0,
          boxSizing: 'border-box',
          animation: 'modalSlideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        {!hideHeader && (
          <div
            style={{
              padding: '24px 28px 20px',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              {icon && (
                <div style={{ flexShrink: 0 }}>
                  {icon}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                {title && (
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#111827',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.3
                    }}
                  >
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '13px',
                      color: '#6B7280',
                      lineHeight: 1.4
                    }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {headerExtra}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: '#F4F6F9',
                  border: 'none',
                  color: '#6B7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#E5E7EB';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#F4F6F9';
                  e.currentTarget.style.color = '#6B7280';
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* MODAL BODY */}
        <div
          style={{
            padding: bodyPadding,
            overflowY: 'auto',
            flex: 1,
            color: '#374151',
            boxSizing: 'border-box'
          }}
        >
          {children}
        </div>

        {/* MODAL FOOTER */}
        {footer && (
          <div
            style={{
              padding: '16px 28px 24px',
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              flexShrink: 0,
              boxSizing: 'border-box'
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
