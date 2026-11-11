import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  KeyRound,
  ShieldCheck,
  User,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('New password must contain at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.auth.changePassword(oldPassword, newPassword);
      setPasswordMsg(res.message || 'Password successfully updated.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Account & Security Settings</h2>
          <p>Manage your account credentials, security preferences, and session controls</p>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} color="var(--primary)" />
            <h3 className="card-title">User Account Details</h3>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Full Name
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {user?.full_name || 'User'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Email Address
            </span>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {user?.email || 'user@example.com'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Assigned Role
            </span>
            <div style={{ marginTop: '0.25rem' }}>
              <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                {user?.role}
              </span>
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Session Protection
            </span>
            <div style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 600, marginTop: '0.2rem' }}>
              HttpOnly + SameSite Cookie Active
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={18} color="var(--primary)" />
            <h3 className="card-title">Change Account Password</h3>
          </div>
        </div>

        {passwordMsg && (
          <div className="alert alert-success" style={{ margin: '0.75rem 0' }}>
            <CheckCircle2 size={18} />
            <span>{passwordMsg}</span>
          </div>
        )}

        {passwordError && (
          <div className="alert alert-danger" style={{ margin: '0.75rem 0' }}>
            <AlertCircle size={18} />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '480px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="oldPassword">Current Password</label>
            <input
              id="oldPassword"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="newPassword">New Password (8+ characters)</label>
            <input
              id="newPassword"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingPassword}
            style={{ alignSelf: 'flex-start', minWidth: '160px' }}
          >
            <Save size={16} />
            <span>{savingPassword ? 'Updating...' : 'Save New Password'}</span>
          </button>
        </form>
      </div>

      {/* Security Architecture Notes */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="var(--primary)" />
            <h3 className="card-title">Application Security Architecture</h3>
          </div>
        </div>

        <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <li>
            <strong>Cryptographic Hashing:</strong> Passwords hashed using Werkzeug Scrypt. Never stored as plain text.
          </li>
          <li>
            <strong>Session Cookies:</strong> Protected via HttpOnly flags to prevent client-side script inspection.
          </li>
          <li>
            <strong>Private Storage:</strong> Uploaded deeds and PDFs stored strictly outside public web root with UUID filenames to prevent direct URL scraping or enumeration.
          </li>
          <li>
            <strong>Access Authorization:</strong> Strict server-side ownership checks enforced on every database query and file read endpoint.
          </li>
        </ul>
      </div>
    </div>
  );
}
