import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, History, UserCheck, Lock, Edit } from 'lucide-react';
import { api } from '../utils/api';
import { formatDate, formatDateTime } from '../utils/formatters';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'logs'
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

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
      if (activeTab === 'users') {
        const res = await api.get('/users');
        if (res.success) setUsers(res.users);
      } else {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* TABS & ADD BUTTON */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('users')}
            className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <UserCheck size={16} />
            <span>Staff Users & Roles</span>
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
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="table">
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
                      <button
                        onClick={() => {
                          setSelectedUser({ ...u, password: '' });
                          setShowEditModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                        title="Edit User / Reset Password"
                      >
                        <Edit size={14} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="table">
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
                  <label className="form-label">Role Permissions *</label>
                  <select
                    className="form-control"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="sales">Sales Staff / Cashier (POS & Sales)</option>
                    <option value="inventory">Store / Inventory Staff (Purchases & Stock)</option>
                    <option value="accountant">Accountant (Ledgers, Cashbook, Reports)</option>
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
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Edit User: {selectedUser.username}</h3>
              <button onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={selectedUser.full_name}
                    onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-control"
                    value={selectedUser.role}
                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                  >
                    <option value="sales">Sales Staff / Cashier</option>
                    <option value="inventory">Store / Inventory Staff</option>
                    <option value="accountant">Accountant</option>
                    <option value="admin">Administrator (Owner)</option>
                  </select>
                </div>

                <div className="form-group">
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

                <div className="form-group">
                  <label className="form-label">Reset Password (Optional)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Leave blank to keep existing password"
                    value={selectedUser.password || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
