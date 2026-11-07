import React, { useState } from 'react';
import api from '../../utils/api';
import { playAudio } from '../../utils/audio';

export default function ManagerPinModal({
  isOpen,
  onClose,
  onSuccess,
  actionTitle = 'Authorization Required',
  actionDescription = 'This action requires managerial approval.',
  requiredAction = 'VOID_ACTION'
}) {
  const [managerUsername, setManagerUsername] = useState('admin');
  const [managerPassword, setManagerPassword] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!managerUsername || !managerPassword) {
      setError('Please enter manager username and password/PIN.');
      playAudio('error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/manager-override', {
        managerUsername: managerUsername.trim(),
        managerPassword,
        reason: reason.trim(),
        action: requiredAction
      });

      if (res.success) {
        playAudio('tender');
        if (onSuccess) {
          onSuccess({
            authorizedBy: res.authorizedBy,
            overrideToken: res.overrideToken,
            reason: reason.trim()
          });
        }
        onClose();
      } else {
        setError(res.message || 'Authorization failed.');
        playAudio('error');
      }
    } catch (err) {
      setError(err.message || 'Invalid manager authorization credentials.');
      playAudio('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '440px', width: '92%', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>🔐</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title)' }}>
                {actionTitle}
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {actionDescription}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                padding: '0.65rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.825rem',
                fontWeight: 500
              }}>
                ⚠️ {error}
              </div>
            )}

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Manager Username *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. admin"
                value={managerUsername}
                onChange={(e) => setManagerUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Manager Password / PIN *</label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter password or numeric PIN"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Reason / Justification</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Damaged carton / Customer changed order"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ minWidth: '130px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Authorize Action'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

