import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSignature,
  FileText,
  Download,
  Eye,
  PlusCircle,
  MessageSquare,
  Share2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function SavedAgreements() {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAgreements = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.agreements.list();
      setAgreements(res.agreements || []);
    } catch (err) {
      setError(err.message || 'Failed to load saved agreements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Saved Agreement Drafts</h2>
          <p>Manage, revise, share with legal reviewers, and export your drafted property agreements</p>
        </div>

        <Link to="/agreements/new" className="btn btn-primary">
          <PlusCircle size={16} />
          <span>New Agreement Draft</span>
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger">
          <span>{error}</span>
        </div>
      )}

      {/* Drafts List Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving saved drafts from repository...
          </div>
        ) : agreements.length === 0 ? (
          <div className="empty-state">
            <FileSignature size={48} color="var(--text-subtle)" />
            <h3>No Agreement Drafts Yet</h3>
            <p>
              Use the AI-Assisted Agreement Generator to draft sale deeds, rental contracts, or lease agreements.
            </p>
            <Link to="/agreements/new" className="btn btn-primary">
              Draft First Agreement
            </Link>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Title & Instrument Type</th>
                  <th>Linked Property</th>
                  <th>Generation Engine</th>
                  <th>Status</th>
                  <th>Collaboration</th>
                  <th>Last Modified</th>
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {agr.agreement_type} Agreement
                      </div>
                    </td>
                    <td>
                      {agr.record_id ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{agr.village || 'Village'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Survey {agr.survey_number || '-'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                          Manual Specification
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                        {agr.generation_mode === 'ai' ? 'AI Assisted' : 'Standard Template'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={agr.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span title="Review Comments" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <MessageSquare size={14} /> {agr.comment_count || 0}
                        </span>
                        <span title="Shared Reviewers" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <Share2 size={14} /> {agr.share_count || 0}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(agr.updated_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <Link
                          to={`/agreements/${agr.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Open Draft Editor"
                        >
                          <Eye size={14} />
                          <span>Editor</span>
                        </Link>

                        <a
                          href={api.agreements.getPdfUrl(agr.id)}
                          className="btn btn-secondary btn-sm"
                          download
                          title="Download Formatted PDF"
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
