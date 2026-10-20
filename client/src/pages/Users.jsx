import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, History, UserCheck, Lock, Edit, KeyRound, Check, XCircle, Clock, Sparkles, RefreshCw, Trash2, ChevronDown } from 'lucide-react';
import { api } from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatters';
import ActionMenu from '../components/common/ActionMenu';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'requests', 'logs'
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [resolveAction, setResolveAction] = useState('approve');
  const [newPassword, setNewPassword] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [resolving, setResolving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'sales'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      // Always fetch reset requests summary for pending badge
      try {
        const reqRes = await api.get('/users/reset-requests');
        if (reqRes.success) {
          setResetRequests(reqRes.requests || []);
          setPendingCount(reqRes.pending_count || 0);
        }
      } catch (_) {}

      if (activeTab === 'users') {
        const res = await api.get('/users');
        if (res.success) setUsers(res.users);
      } else if (activeTab === 'logs') {
        const res = await api.get('/users/audit-logs');
        if (res.success) setAuditLogs(res.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users', formData);
      if (res.success) {
        setShowAddModal(false);
        setFormData({ username: '', email: '', password: '', full_name: '', role: 'sales' });
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/users/${selectedUser.id}`, selectedUser);
      if (res.success) {
        setShowEditModal(false);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      const res = await api.delete(`/users/${selectedUser.id}`);
      if (res.success) {
        setShowDeleteModal(false);
        setSelectedUser(null);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (resolveAction === 'approve' && (!newPassword || newPassword.trim().length < 6)) {
      alert('Please provide a new password of at least 6 characters.');
      return;
    }

    try {
      setResolving(true);
      const res = await api.post(`/users/reset-requests/${selectedRequest.id}/resolve`, {
        action: resolveAction,
        new_password: newPassword.trim(),
        admin_note: adminNote.trim()
      });

      if (res.success) {
        alert(res.message || 'Request successfully processed.');
        setShowResolveModal(false);
        setSelectedRequest(null);
        setNewPassword('');
        setAdminNote('');
        loadData();
      } else {
        alert(res.message || 'Failed to process request.');
      }
    } catch (err) {
      alert(err.message || 'Error processing reset request.');
    } finally {
      setResolving(false);
    }
  };

  const generateQuickPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = 'LT@';
    for (let i = 0; i < 5; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(p);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* TABS & ADD BUTTON */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('users')}
            className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <UserCheck size={16} />
            <span>Staff</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`btn btn-sm ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ position: 'relative' }}
          >
            <KeyRound size={16} />
            <span>Password Resets</span>
            {pendingCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '10px',
                marginLeft: '4px'
              }}>
                {pendingCount} Pending
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`btn btn-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <History size={16} />
            <span>System Audit Trail</span>
          </button>
        </div>

        {activeTab === 'users' && (
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} />
            <span>Create Staff Account</span>
          </button>
        )}
      </div>

      {/* USERS LIST */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: 0, overflow: 'visible' }}>
          <div className="table-responsive" style={{ minHeight: '120px', paddingBottom: '110px', overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', minWidth: '650px' }}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="mono" style={{ fontWeight: 700 }}>{u.username}</td>
                    <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                    <td>{u.email || '-'}</td>
                    <td>
                      <span className={`badge ${
                        u.role === 'admin' ? 'badge-danger' :
                        u.role === 'sales' ? 'badge-success' :
                        u.role === 'inventory' ? 'badge-info' : 'badge-warning'
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>{formatDate(u.created_at)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <ActionMenu
                        title="User Actions"
                        items={[
                          {
                            label: 'Edit User',
                            icon: <Edit size={14} color="#0284c7" />,
                            onClick: () => {
                              setSelectedUser({ ...u, password: '' });
                              setShowEditModal(true);
                            }
                          },
                          u.username !== 'admin' && { divider: true },
                          u.username !== 'admin' && {
                            label: 'Delete User',
                            icon: <Trash2 size={14} color="#dc2626" />,
                            danger: true,
                            onClick: () => {
                              setSelectedUser(u);
                              setShowDeleteModal(true);
                            }
                          }
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PASSWORD RESET REQUESTS */}
      {activeTab === 'requests' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              <strong>Staff Password Resets</strong> &bull; Review, approve, and assign new passwords to staff members.
            </div>
            <button onClick={loadData} className="btn btn-secondary btn-sm" title="Refresh">
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="table" style={{ width: '100%', minWidth: '750px' }}>
              <thead>
                <tr>
                  <th>Requested At</th>
                  <th>Username</th>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>User Note / Contact</th>
                  <th>Status</th>
                  <th>Resolution / Password</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {resetRequests.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                      <Check size={28} style={{ color: '#10b981', margin: '0 auto 0.5rem', display: 'block' }} />
                      <strong>No password reset requests pending.</strong>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>When a staff member submits a request from the login screen, it will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  resetRequests.map(r => (
                    <tr key={r.id} style={{ background: r.status === 'pending' ? '#fffdf7' : 'transparent' }}>
                      <td style={{ fontSize: '0.785rem', color: '#64748b' }}>{formatDateTime(r.created_at)}</td>
                      <td className="mono" style={{ fontWeight: 700, color: '#0284c7' }}>{r.username}</td>
                      <td style={{ fontWeight: 600 }}>{r.full_name || '-'}</td>
                      <td>
                        <span className={`badge ${
                          r.user_role === 'admin' ? 'badge-danger' :
                          r.user_role === 'sales' ? 'badge-success' :
                          r.user_role === 'inventory' ? 'badge-info' : 'badge-warning'
                        }`}>
                          {(r.user_role || 'STAFF').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem', maxWidth: '220px' }}>
                        {r.request_note || '-'}
                      </td>
                      <td>
                        <span className={`badge ${
                          r.status === 'approved' ? 'badge-success' :
                          r.status === 'pending' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {r.status === 'approved' ? (
                          <div>
                            {r.temporary_password && (
                              <span style={{ fontWeight: 700, color: '#0f172a', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>
                                {r.temporary_password}
                              </span>
                            )}
                            <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '2px' }}>
                              By {r.resolved_by_name || 'Admin'}
                            </div>
                          </div>
                        ) : r.status === 'rejected' ? (
                          <span style={{ color: '#b91c1c' }}>{r.admin_note || 'Rejected by Admin'}</span>
                        ) : (
                          <span style={{ color: '#d97706', fontStyle: 'italic' }}>Awaiting Action</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {r.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedRequest(r);
                                setResolveAction('approve');
                                generateQuickPassword();
                                setAdminNote('Approved by Admin. New password set.');
                                setShowResolveModal(true);
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              <Check size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequest(r);
                                setResolveAction('reject');
                                setNewPassword('');
                                setAdminNote('Request rejected. Please visit admin desk.');
                                setShowResolveModal(true);
                              }}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                            >
                              <XCircle size={13} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div style={{ position: 'relative' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', height: 42 }}>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#64748B' }}>Date & Time</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#64748B' }}>User</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#64748B' }}>Action</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#64748B' }}>Entity</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#64748B' }}>Summary</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#64748B', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8' }}>
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => {
                      const dateObj = new Date(log.created_at);
                      const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-GB') : '—';
                      const timeStr = !isNaN(dateObj) ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                      
                      const actionPills = {
                        CREATE: { bg: '#DCFCE7', text: '#15803D' },
                        UPDATE: { bg: '#E0F2FE', text: '#0369A1' },
                        DELETE: { bg: '#FEE2E2', text: '#B91C1C' },
                        LOGIN: { bg: '#F3E8FF', text: '#7E22CE' },
                        LOGOUT: { bg: '#F1F5F9', text: '#475569' }
                      };
                      const pill = actionPills[log.action] || { bg: '#F1F5F9', text: '#475569' };

                      return (
                        <tr key={log.id} style={{ height: 56, borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s' }}>
                          
                          {/* Date & Time */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                              {dateStr}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                              {timeStr}
                            </div>
                          </td>

                          {/* User */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                              {log.user_name || 'System'}
                            </div>
                          </td>

                          {/* Action Pill */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              background: pill.bg,
                              color: pill.text
                            }}>
                              {log.action}
                            </span>
                          </td>

                          {/* Target Entity */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#0F766E', fontWeight: 600 }}>
                              {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                            </span>
                          </td>

                          {/* Details Summary (truncated) */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle', maxWidth: 260 }}>
                            <div style={{
                              fontSize: 13,
                              color: '#475569',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {log.details || '—'}
                            </div>
                          </td>

                          {/* View Button */}
                          <td style={{ padding: '8px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedLog(log)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 6,
                                border: '1px solid #CBD5E1',
                                background: '#FFFFFF',
                                color: '#0F766E',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <span>View</span>
                              <span>→</span>
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Details Side Panel */}
          {selectedLog && (
            <div style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 420,
              maxWidth: '92vw',
              background: '#FFFFFF',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'Outfit', 'Inter', sans-serif"
            }}>
              {/* Drawer Header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Audit Log Details</h3>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Log Entry #{selectedLog.id}</div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Drawer Body */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Timestamp</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                    {formatDateTime(selectedLog.created_at)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Responsible User</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{selectedLog.user_name || 'System'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>IP Address</div>
                    <div style={{ fontSize: 13, color: '#475569', fontFamily: 'monospace' }}>{selectedLog.ip_address || '—'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Action Type</div>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: '#E0F2FE', color: '#0369A1' }}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Entity Target</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F766E', fontFamily: 'monospace' }}>
                      {selectedLog.entity_type} {selectedLog.entity_id ? `(#${selectedLog.entity_id})` : ''}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Event Payload & Description</div>
                  <div style={{
                    padding: 12,
                    borderRadius: 8,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    fontSize: 13,
                    color: '#334155',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: selectedLog.details?.startsWith('{') ? 'monospace' : 'inherit'
                  }}>
                    {selectedLog.details || 'No additional details logged.'}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedLog(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Create Staff Account</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Register a cashier, store manager, or administrator.
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAddModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Username *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. cashier2"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Tariq Mehmood"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. tariq@latiftraders.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Role Permissions *</label>
                  <select
                    className="form-control"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="sales">Sales Staff / Cashier (POS & Sales)</option>
                    <option value="inventory">Store / Inventory Staff (Purchases & Stock)</option>
                    <option value="accountant">Accountant</option>
                    <option value="admin">Owner / Administrator (Full Access)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Initial Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    required
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px', width: '96%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Edit User</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                  Username: <strong className="mono" style={{ color: '#0284c7' }}>{selectedUser.username}</strong>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Identity Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: selectedUser.role === 'admin' ? '#fee2e2' : selectedUser.role === 'inventory' ? '#dbeafe' : selectedUser.role === 'accountant' ? '#fef3c7' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', color: selectedUser.role === 'admin' ? '#dc2626' : selectedUser.role === 'inventory' ? '#2563eb' : selectedUser.role === 'accountant' ? '#d97706' : '#16a34a' }}>
                      {selectedUser.full_name?.charAt(0) || selectedUser.username?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selectedUser.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedUser.email || 'No email set'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <span className={`badge ${selectedUser.role === 'admin' ? 'badge-danger' : selectedUser.role === 'sales' ? 'badge-success' : selectedUser.role === 'inventory' ? 'badge-info' : 'badge-warning'}`}>
                      {selectedUser.role?.toUpperCase()}
                    </span>
                    <span className={`badge ${selectedUser.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {selectedUser.status}
                    </span>
                  </div>
                </div>

                {/* Row 1: Full Name & Email */}
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={selectedUser.full_name}
                      onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={selectedUser.email || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                      placeholder="user@latiftraders.com"
                    />
                  </div>
                </div>

                {/* Row 2: Role & Status */}
                <div className="form-grid-2">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Role Permissions</label>
                    <select
                      className="form-control"
                      value={selectedUser.role}
                      onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                    >
                      <option value="sales">Sales Staff / Cashier (POS & Sales)</option>
                      <option value="inventory">Store / Inventory Staff (Purchases & Stock)</option>
                      <option value="accountant">Accountant</option>
                      <option value="admin">Owner / Administrator (Full Access)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Account Status</label>
                    <select
                      className="form-control"
                      value={selectedUser.status}
                      onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive / Deactivated</option>
                    </select>
                  </div>
                </div>

                {/* Reset Password */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Reset Password (Optional)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Leave blank to keep existing password"
                    value={selectedUser.password || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, password: e.target.value })}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px' }}>
                    Minimum 6 characters. Only set if you want to change the user's password.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ minWidth: '110px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px', width: '96%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trash2 size={18} color="#dc2626" />
                <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.05rem', fontWeight: 700 }}>Delete User</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#991b1b', fontSize: '0.85rem' }}>
                  Are you sure you want to delete this user account?
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Username:</span>
                  <strong className="mono">{selectedUser.username}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Full Name:</span>
                  <strong>{selectedUser.full_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Role:</span>
                  <strong>{selectedUser.role}</strong>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '1rem 0 0', lineHeight: 1.45 }}>
                This action cannot be undone. All password reset requests for this user will also be removed.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteUser}>Yes, Delete User</button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE PASSWORD RESET MODAL */}
      {showResolveModal && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '96%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} style={{ color: resolveAction === 'approve' ? '#10b981' : '#ef4444' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  {resolveAction === 'approve' ? 'Approve & Assign Password' : 'Reject Reset Request'}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowResolveModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleResolveSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#64748b' }}>Staff Username:</span>
                    <strong className="mono" style={{ color: '#0284c7' }}>{selectedRequest.username}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#64748b' }}>Full Name:</span>
                    <strong>{selectedRequest.full_name || '-'}</strong>
                  </div>
                  {selectedRequest.request_note && (
                    <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed #cbd5e1', color: '#475569', fontSize: '0.785rem' }}>
                      <strong>User Message:</strong> {selectedRequest.request_note}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Action</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="radio"
                        name="resolveAction"
                        value="approve"
                        checked={resolveAction === 'approve'}
                        onChange={() => {
                          setResolveAction('approve');
                          if (!newPassword) generateQuickPassword();
                        }}
                      />
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Approve & Reset Password</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="radio"
                        name="resolveAction"
                        value="reject"
                        checked={resolveAction === 'reject'}
                        onChange={() => setResolveAction('reject')}
                      />
                      <span style={{ color: '#b91c1c', fontWeight: 600 }}>Reject Request</span>
                    </label>
                  </div>
                </div>

                {resolveAction === 'approve' && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>New Password for Staff *</label>
                      <button
                        type="button"
                        onClick={generateQuickPassword}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284c7',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Sparkles size={12} />
                        <span>Generate Random</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      className="form-control mono"
                      required
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                      Staff can view this new password on the login screen's "Check Status" tab.
                    </small>
                  </div>
                )}

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Note for Staff (Optional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder={resolveAction === 'approve' ? 'e.g. Password has been reset. Please keep it secure.' : 'e.g. Invalid request. Contact administrator.'}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className={`btn btn-sm ${resolveAction === 'approve' ? 'btn-primary' : 'btn-danger'}`}
                  style={{ minWidth: '150px' }}
                >
                  {resolving ? 'Processing...' : (resolveAction === 'approve' ? 'Approve & Reset Password' : 'Reject Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
