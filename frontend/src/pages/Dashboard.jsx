import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Files,
  AlertTriangle,
  FileSignature,
  Upload,
  PlusCircle,
  ShieldCheck,
  ArrowRight,
  Clock,
  Activity,
  FileCheck2
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.dashboard.getStats();
      setData(res);
    } catch (err) {
      setError('Unable to load dashboard metrics: ' + (err.message || 'Server error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Retrieving operational metrics from database...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const recentActivity = data?.recent_activity || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Banner / Welcome */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderColor: '#e2e8f0', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Welcome back, {user?.full_name || 'Property Owner'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              LandAssist Cadastral Registry & Agreement Workspace ({user?.role?.toUpperCase()})
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/digitize" className="btn btn-primary">
              <Upload size={16} />
              <span>Digitize Document</span>
            </Link>
            <Link to="/agreements/new" className="btn btn-secondary">
              <FileSignature size={16} />
              <span>Draft Agreement</span>
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <FileSpreadsheet size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total_records ?? 0}</span>
            <span className="stat-label">Total Land Records</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Files size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total_documents ?? 0}</span>
            <span className="stat-label">Digitized Documents</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.records_requiring_review ?? 0}</span>
            <span className="stat-label">Records Needing Review</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <FileSignature size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {user?.role === 'reviewer' ? (stats.shared_agreements ?? 0) : (stats.saved_agreements ?? 0)}
            </span>
            <span className="stat-label">
              {user?.role === 'reviewer' ? 'Assigned Reviews' : 'Saved Agreement Drafts'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Quick Actions</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <Link
            to="/digitize"
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-surface)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={18} />
              </div>
              <ArrowRight size={16} color="var(--text-subtle)" />
            </div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>Upload & Digitize Document</strong>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Extract structured cadastral fields from deed PDFs or scanned images using PyMuPDF and OCR.
            </p>
          </Link>

          <Link
            to="/records/new"
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-surface)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--success-light)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PlusCircle size={18} />
              </div>
              <ArrowRight size={16} color="var(--text-subtle)" />
            </div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>Add Land Record</strong>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Register property boundaries, Patta number, Survey number, and ownership details manually.
            </p>
          </Link>

          <Link
            to="/validation"
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-surface)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--warning-light)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={18} />
              </div>
              <ArrowRight size={16} color="var(--text-subtle)" />
            </div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>Cadastral Validation</strong>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Run deterministic rules to detect duplicate deed references and conflicting boundary claims.
            </p>
          </Link>

          <Link
            to="/agreements/new"
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-surface)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSignature size={18} />
              </div>
              <ArrowRight size={16} color="var(--text-subtle)" />
            </div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>Agreement Generator</strong>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Draft comprehensive Sale, Rental, or Lease agreements with AI assistance and export to PDF.
            </p>
          </Link>
        </div>
      </div>

      {/* Recent Activity Timeline */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--primary)" />
            <h3 className="card-title">Recent Operational Activity</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Logged via Security Audit Engine</span>
        </div>

        {recentActivity.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <Clock size={36} color="var(--text-subtle)" />
            <h4 style={{ marginTop: '0.75rem', fontWeight: 600 }}>No activity events recorded yet</h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Actions such as uploading documents, editing records, or sharing drafts will appear here.
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Event Action</th>
                  <th>Target Entity</th>
                  <th>Actor</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((act) => (
                  <tr key={act.id}>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-main)' }}>
                        {act.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {act.target_type || 'System'} #{act.target_id || '-'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {act.actor_name || 'System'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                        {new Date(act.created_at).toLocaleString()}
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
  );
}
