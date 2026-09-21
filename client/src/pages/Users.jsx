import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, History, UserCheck, Lock, Edit, KeyRound, Check, XCircle, Clock, Sparkles, RefreshCw, Trash2, ChevronDown } from 'lucide-react';
import { api } from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatters';

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
  const [resolveAction, setResolveAction] = useState('approve');
  const [newPassword, setNewPassword] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);

  useEffect(() => {
    const handleOutsideClick = () => setActionMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuId(actionMenuId === u.id ? null : u.id);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderRadius: '5px'
                          }}
                          title="User Actions"
                        >
                          <span>Action</span>
                          <ChevronDown size={12} />
                        </button>

                        {actionMenuId === u.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              boxShadow: '0 10px 25px -3px rgba(0,0,0,0.18), 0 4px 6px -2px rgba(0,0,0,0.08)',
                              zIndex: 9999,
                              minWidth: '160px',
                              padding: '4px 0',
                              textAlign: 'left'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setActionMenuId(null);
                                setSelectedUser({ ...u, password: '' });
                                setShowEditModal(true);
                              }}
                              style={{
                                width: '100%',
                                padding: '7px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: 'none',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#1e293b',
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <Edit size={13} color="#0284c7" />
                              <span>Edit User</span>
                            </button>

                            {u.username !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuId(null);
                                  setSelectedUser(u);
                                  setShowDeleteModal(true);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '7px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'none',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  borderTop: '1px solid #f1f5f9'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                              >
                                <Trash2 size={13} color="#dc2626" />
                                <span>Delete User</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Responsible User</th>
                  <th>Action</th>
                  <th>Target Entity</th>
                  <th>Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatDateTime(log.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{log.user_name}</td>
                    <td><span className="badge badge-info">{log.action}</span></td>
                    <td><span className="mono" style={{ fontSize: '0.8rem' }}>{log.entity_type}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{log.details}</td>
                    <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Create Staff Account</h3>
              <button onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
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

                <div className="form-group">
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

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. tariq@latiftraders.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
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

                <div className="form-group">
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Edit User</h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Username: <strong className="mono" style={{ color: '#0284c7' }}>{selectedUser.username}</strong>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', padding: '1.25rem' }}>
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
              <div className="modal-footer" style={{ padding: '0.75rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#dc2626' }}>Delete User</h3>
              <button onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#991b1b' }}>
                  Are you sure you want to delete this user account?
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
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
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '1rem 0 0' }}>
                This action cannot be undone. All password reset requests for this user will also be removed.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteUser}>Yes, Delete User</button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE PASSWORD RESET MODAL */}
      {showResolveModal && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} style={{ color: resolveAction === 'approve' ? '#10b981' : '#ef4444' }} />
                <h3>{resolveAction === 'approve' ? 'Approve & Assign Password' : 'Reject Reset Request'}</h3>
              </div>
              <button onClick={() => setShowResolveModal(false)}>✕</button>
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

                <div className="form-group">
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
                  <div className="form-group">
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

                <div className="form-group">
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className={`btn ${resolveAction === 'approve' ? 'btn-primary' : 'btn-danger'}`}
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
