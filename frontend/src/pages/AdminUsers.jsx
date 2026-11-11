import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Activity,
  Server,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit2,
  RefreshCw,
  Search
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/Modal';

export default function AdminUsers() {
  const [tab, setTab] = useState('users'); // 'users', 'audit', 'system'

  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Edit user modal
  const [editUser, setEditUser] = useState(null);
  const [newRole, setNewRole] = useState('owner');
  const [isActive, setIsActive] = useState(true);
  const [savingUser, setSavingUser] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [actionFilter, setActionFilter] = useState('');

  // System status state
  const [systemStatus, setSystemStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await api.admin.getUsers();
      setUsers(res.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const params = actionFilter ? { action: actionFilter } : {};
      const res = await api.admin.getAuditLogs(params);
      setAuditLogs(res.logs || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await api.admin.getSystemStatus();
      setSystemStatus(res);
    } catch (err) {
      setError(err.message || 'Failed to load system diagnostics.');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    if (tab === 'audit') fetchAuditLogs();
    if (tab === 'system') fetchSystemStatus();
  }, [tab]);

  const handleEditClick = (u) => {
    setEditUser(u);
    setNewRole(u.role);
    setIsActive(Boolean(u.is_active));
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSavingUser(true);
    try {
      await api.admin.updateUser(editUser.id, {
        role: newRole,
        is_active: isActive,
      });
      setMessage(`User account ${editUser.email} updated successfully.`);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user account.');
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>System Administration Console</h2>
          <p>Protected administrative control panel for user roles, security audits, and engine diagnostics</p>
        </div>
      </div>

      {message && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
          <button
            onClick={() => setMessage('')}
            style={{ marginLeft: 'auto', fontWeight: 700, color: 'inherit' }}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 'auto', fontWeight: 700, color: 'inherit' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Admin Tab Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('users')}
        >
          <Users size={14} />
          <span>User Accounts ({users.length})</span>
        </button>

        <button
          className={`btn btn-sm ${tab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('audit')}
        >
          <Activity size={14} />
          <span>Security Audit Trail</span>
        </button>

        <button
          className={`btn btn-sm ${tab === 'system' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('system')}
        >
          <Server size={14} />
          <span>Engine Status & Diagnostics</span>
        </button>
      </div>

      {/* TAB 1: User Accounts Management */}
      {tab === 'users' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loadingUsers ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading user registry...
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>User & Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Records Count</th>
                    <th>Documents</th>
                    <th>Drafts</th>
                    <th>Last Login</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {u.full_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {u.email}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.role === 'admin'
                              ? 'badge-danger'
                              : u.role === 'reviewer'
                              ? 'badge-warning'
                              : 'badge-info'
                          }`}
                          style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>{u.record_count || 0}</td>
                      <td>{u.doc_count || 0}</td>
                      <td>{u.draft_count || 0}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleEditClick(u)}
                          className="btn btn-secondary btn-sm"
                          title="Modify User Role or Access"
                        >
                          <Edit2 size={14} />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Security Audit Trail */}
      {tab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '0.75rem 1rem' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchAuditLogs();
              }}
              style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}
            >
              <Search size={16} color="var(--text-subtle)" />
              <input
                type="text"
                className="form-control"
                placeholder="Filter by action (e.g. LOGIN_SUCCESS, LAND_RECORD_CREATED, DOCUMENT_UPLOADED)..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                Filter
              </button>
              {actionFilter && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setActionFilter('');
                    fetchAuditLogs();
                  }}
                >
                  Clear
                </button>
              )}
            </form>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loadingAudit ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading audit trail events...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="empty-state">
                <Activity size={48} color="var(--text-subtle)" />
                <h3>No Audit Events Found</h3>
                <p>No logged security actions match your filter criteria.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Action Event</th>
                      <th>Actor</th>
                      <th>Target Type / ID</th>
                      <th>IP Address</th>
                      <th>Details</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)' }}>
                            {log.action}
                          </span>
                        </td>
                        <td>
                          <div>{log.actor_name || 'Anonymous / Unauth'}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {log.actor_email}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                            {log.target_type || '-'} #{log.target_id || '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                            {log.ip_address}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {log.details || '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Engine Diagnostics */}
      {tab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loadingStatus ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Checking backend subsystem health...
            </div>
          ) : systemStatus ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div className="card">
                <div className="card-header">
                  <h4 className="card-title">OCR Engine Subsystem</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <strong>PDF Text Layer:</strong> {systemStatus.ocr_engine?.pymupdf}
                  </div>
                  <div>
                    <strong>Tesseract OCR Binary:</strong> {systemStatus.ocr_engine?.tesseract_ocr}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h4 className="card-title">Agreement Drafting Engine</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <strong>Execution Mode:</strong> {systemStatus.ai_engine?.mode}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Configured with secure backend-only API key handling and fallback templates.
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h4 className="card-title">SQLite Database Persistence</h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <strong>Engine:</strong> {systemStatus.database?.engine}
                  </div>
                  <div>
                    <strong>Database Size:</strong> {(systemStatus.database?.size_bytes / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Edit User Modal */}
      <Modal
        isOpen={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title={`Modify User: ${editUser?.full_name}`}
        maxWidth="480px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditUser(null)}
              disabled={savingUser}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveUser}
              disabled={savingUser}
            >
              {savingUser ? 'Updating...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="text"
              className="form-control"
              value={editUser?.email || ''}
              disabled
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Role</label>
            <select
              className="form-control"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <option value="owner">Property Owner</option>
              <option value="reviewer">Legal Reviewer</option>
              <option value="admin">System Administrator</option>
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Account Active & Allowed to Sign In</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
