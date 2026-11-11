import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Share2,
  FileSignature,
  Eye,
  Download,
  MessageSquare,
  ShieldCheck,
  User,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function SharedAgreements() {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSharedAgreements = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.agreements.listSharedWithMe();
      setAgreements(res.agreements || []);
    } catch (err) {
      setError(err.message || 'Failed to load shared agreements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedAgreements();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Shared Agreement Reviews</h2>
          <p>Draft instruments explicitly shared with your legal reviewer account for consultation and feedback</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Shared Agreements Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving shared agreements from repository...
          </div>
        ) : agreements.length === 0 ? (
          <div className="empty-state">
            <Share2 size={48} color="var(--text-subtle)" />
            <h3>No Shared Agreements Assigned</h3>
            <p>
              When a property owner shares an agreement draft with your account for legal review, it will be listed here.
            </p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Agreement Title</th>
                  <th>Instrument Type</th>
                  <th>Property Owner</th>
                  <th>Shared Date</th>
                  <th>Status</th>
                  <th>Comments</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agreements.map((agr) => (
                  <tr key={agr.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        <Link to={`/agreements/${agr.id}`} style={{ color: 'inherit' }}>
                          {agr.title}
                        </Link>
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.65rem', textTransform: 'capitalize' }}>
                        {agr.generation_mode} Draft
                      </span>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                        {agr.agreement_type}
                      </span>
                    </td>
                    <td>
                      <div>{agr.owner_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {agr.owner_email}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(agr.shared_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={agr.status} />
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
                        <MessageSquare size={14} color="var(--primary)" />
                        {agr.comment_count || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <Link
                          to={`/agreements/${agr.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Inspect Draft and Post Review Comments"
                        >
                          <Eye size={14} />
                          <span>Review</span>
                        </Link>

                        <a
                          href={api.agreements.getPdfUrl(agr.id)}
                          className="btn btn-secondary btn-sm"
                          download
                          title="Download PDF"
                        >
                          <Download size={14} />
                        </a>
                      </div>
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
