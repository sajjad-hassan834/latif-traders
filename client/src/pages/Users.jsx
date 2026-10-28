import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, History, UserCheck, Lock, Edit, KeyRound, Check, XCircle, Clock, Sparkles, RefreshCw, Trash2, ChevronDown, Copy, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatters';
import ActionMenu from '../components/common/ActionMenu';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { plan } = useAuth();
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
  const [approvedTempPassword, setApprovedTempPassword] = useState(null);
  const [copiedTempPassword, setCopiedTempPassword] = useState(false);

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
        setShowResolveModal(false);
        const reqUsername = selectedRequest?.username || 'Staff member';
        setSelectedRequest(null);
        setNewPassword('');
        setAdminNote('');
        loadData();

        if (resolveAction === 'approve' && (res.temporary_password || newPassword.trim())) {
          setApprovedTempPassword({
            username: reqUsername,
            password: res.temporary_password || newPassword.trim()
          });
        } else {
          alert(res.message || 'Request successfully processed.');
        }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {plan === 'free' && users.length >= 1 && (
              <span style={{ fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
                Free limit: 1 user
              </span>
            )}
            <button
              onClick={() => {
                if (plan === 'free' && users.length >= 1) return;
                setShowAddModal(true);
              }}
              disabled={plan === 'free' && users.length >= 1}
              title={plan === 'free' && users.length >= 1 ? 'Upgrade to Pro to add up to 5 team members' : 'Add new staff user'}
              className="btn btn-primary btn-sm"
              style={{
                opacity: plan === 'free' && users.length >= 1 ? 0.6 : 1,
                cursor: plan === 'free' && users.length >= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <Plus size={16} />
              <span>Create Staff Account</span>
            </button>
          </div>
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
          <div style={{ padding: '0.85rem 1.25rem', background: 'var(--bg-table-head, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted, #475569)' }}>
              <strong style={{ color: 'var(--text-title)' }}>Staff Password Resets</strong> &bull; Review, approve, and assign new passwords to staff members.
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
                            <span style={{ fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem' }}>
                              One-time temp password issued
                            </span>
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
                  <tr style={{ background: 'var(--bg-table-head)', borderBottom: '1px solid var(--border)', height: 42 }}>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Date & Time</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>User</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Action</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Entity</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Summary</th>
                    <th style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
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
                                border: '1px solid var(--border)',
                                background: 'var(--hover-bg)',
                                color: 'var(--primary)',
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
              background: 'var(--bg-card)',
              borderLeft: '1px solid var(--border)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "'Outfit', 'Inter', sans-serif"
            }}>
              {/* Drawer Header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-title)' }}>Audit Log Details</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Log Entry #{selectedLog.id}</div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Drawer Body */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Timestamp</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-title)' }}>
                    {formatDateTime(selectedLog.created_at)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Responsible User</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-title)' }}>{selectedLog.user_name || 'System'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>IP Address</div>
                    <div style={{ fontSize: 13, color: 'var(--text-value)', fontFamily: 'monospace' }}>{selectedLog.ip_address || '—'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Action Type</div>
                    <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Entity Target</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2dd4bf', fontFamily: 'monospace' }}>
                      {selectedLog.entity_type} {selectedLog.entity_id ? `(#${selectedLog.entity_id})` : ''}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Event Payload & Description</div>
                  <div style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--hover-bg)',
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    color: 'var(--text-value)',
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
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedLog(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--hover-bg)', color: 'var(--text-title)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title, #0f172a)' }}>Create Staff Account</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
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
                    placeholder="e.g. staff@example.com"
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-title, #0f172a)' }}>Edit User</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                  Username: <strong className="mono" style={{ color: 'var(--primary, #0284c7)' }}>{selectedUser.username}</strong>
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
                <div style={{ background: 'var(--hover-bg, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: selectedUser.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : selectedUser.role === 'inventory' ? 'rgba(59, 130, 246, 0.2)' : selectedUser.role === 'accountant' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', color: selectedUser.role === 'admin' ? '#ef4444' : selectedUser.role === 'inventory' ? '#3b82f6' : selectedUser.role === 'accountant' ? '#f59e0b' : '#10b981' }}>
                      {selectedUser.full_name?.charAt(0) || selectedUser.username?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-title, #0f172a)' }}>{selectedUser.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>{selectedUser.email || 'No email set'}</div>
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
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '3px' }}>
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
                <div style={{ background: 'var(--hover-bg, #f8fafc)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-muted, #64748b)' }}>Staff Username:</span>
                    <strong className="mono" style={{ color: 'var(--primary, #0284c7)' }}>{selectedRequest.username}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-muted, #64748b)' }}>Full Name:</span>
                    <strong style={{ color: 'var(--text-title)' }}>{selectedRequest.full_name || '-'}</strong>
                  </div>
                  {selectedRequest.request_note && (
                    <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed var(--border, #cbd5e1)', color: 'var(--text-muted, #475569)', fontSize: '0.785rem' }}>
                      <strong style={{ color: 'var(--text-title)' }}>User Message:</strong> {selectedRequest.request_note}
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
                      Temporary password will be displayed once upon approval. Copy and provide it to the staff member.
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

      {/* ONE-TIME TEMPORARY PASSWORD DISPLAY MODAL */}
      {approvedTempPassword && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} style={{ color: '#15803d' }} />
                <h5 className="modal-title" style={{ color: '#14532d', margin: 0 }}>
                  Temporary Password Generated
                </h5>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#334155', margin: '0 0 1rem' }}>
                A temporary password has been successfully configured for user <strong>{approvedTempPassword.username}</strong>:
              </p>

              {/* Password Display Box */}
              <div style={{
                background: '#f8fafc',
                border: '2px dashed #0266FE',
                borderRadius: '8px',
                padding: '1rem',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Temporary Password
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '1px',
                  wordBreak: 'break-all'
                }}>
                  {approvedTempPassword.password}
                </div>
              </div>

              {/* Copy Button */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(approvedTempPassword.password);
                  setCopiedTempPassword(true);
                  setTimeout(() => setCopiedTempPassword(false), 2500);
                }}
                style={{
                  width: '100%',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: copiedTempPassword ? '#15803d' : '#0266FE',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  marginBottom: '1rem'
                }}
              >
                {copiedTempPassword ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedTempPassword ? 'Copied to Clipboard!' : 'Copy Temporary Password'}</span>
              </button>

              {/* Warning Alert */}
              <div style={{
                padding: '0.75rem 1rem',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                color: '#92400e',
                fontSize: '0.8rem',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                lineHeight: 1.45
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>CRITICAL SECURITY NOTICE:</strong> This temporary password will only be displayed <strong>once</strong>. For security, it is not stored in plaintext on the server and cannot be viewed again. Please copy and securely deliver it to the staff member now.
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setApprovedTempPassword(null)}
                style={{ minWidth: '120px' }}
              >
                Done / Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
