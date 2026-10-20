import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

/**
 * Universal Portal-based ActionMenu component
 * Renders floating dropdown into document.body to prevent any parent container
 * (like .table-responsive or cards with overflow: auto/hidden) from clipping it.
 *
 * Props:
 * - items: Array of { label, icon, onClick, danger, divider, disabled }
 * - children: Function `({ close }) => JSX` or plain JSX
 * - trigger: Custom trigger button element (defaults to sadax 3-dots button)
 * - align: 'right' | 'left' (default: 'right')
 * - title: Tooltip title for trigger button (default: 'Actions')
 * - className: Custom class for trigger
 */
export default function ActionMenu({
  items,
  children,
  trigger,
  align = 'right',
  title = 'Actions',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, right: 0, openUp: false });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuEstimatedHeight = items ? (items.length * 36 + 16) : 200;
    const openUp = spaceBelow < menuEstimatedHeight && rect.top > menuEstimatedHeight;

    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      bottom: window.innerHeight - rect.top + 6,
      right: Math.max(8, window.innerWidth - rect.right),
      left: Math.max(8, rect.left),
      openUp
    });
  }, [items]);

  const toggle = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const close = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = (e) => {
      // If scrolling inside the menu itself, do nothing
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      close();
    };

    const handleClickOutside = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        close();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const menuStyle = {
    position: 'fixed',
    zIndex: 99999,
    ...(coords.openUp ? { bottom: coords.bottom } : { top: coords.top }),
    ...(align === 'right' ? { right: coords.right } : { left: coords.left })
  };

  const renderTrigger = () => {
    if (trigger && React.isValidElement(trigger)) {
      return React.cloneElement(trigger, {
        ref: triggerRef,
        onClick: (e) => {
          if (trigger.props.onClick) trigger.props.onClick(e);
          toggle(e);
        },
        'aria-haspopup': 'true',
        'aria-expanded': isOpen
      });
    }

    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className="sadax-action-dots-btn"
        title={title}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger || <MoreHorizontal size={14} />}
      </button>
    );
  };

  return (
    <div className={`action-menu-root ${className}`} style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
      {renderTrigger()}

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="sadax-dropdown-menu"
            style={menuStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {items ? (
              items.map((item, index) => {
                if (!item) return null;
                if (item.divider) {
                  return <div key={`div-${index}`} className="sadax-dropdown-divider" />;
                }
                return (
                  <button
                    key={item.label || index}
                    type="button"
                    disabled={item.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      close();
                      if (item.onClick) item.onClick();
                    }}
                    className={`sadax-dropdown-item ${item.danger ? 'danger' : ''}`}
                  >
                    {item.icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{item.icon}</span>}
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </button>
                );
              })
            ) : typeof children === 'function' ? (
              children({ close })
            ) : (
              children
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
