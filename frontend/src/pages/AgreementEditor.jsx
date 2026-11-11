import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Download,
  Share2,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Send,
  XCircle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function AgreementEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [agreement, setAgreement] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null);

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [sectionRef, setSectionRef] = useState('');
  const [commenting, setCommenting] = useState(false);

  const fetchAgreement = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.agreements.get(id);
      const agr = res.agreement;
      setAgreement(agr);
      setContent(agr.content || '');
      setTitle(agr.title || '');
    } catch (err) {
      setError(err.message || 'Failed to load agreement draft.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreement();
  }, [id]);

  const handleSaveDraft = async () => {
    setSaving(true);
    setSuccessMsg('');
    setError('');
    try {
      const res = await api.agreements.update(id, {
        title,
        content,
        notes: `Edited by ${user?.full_name || 'User'}`,
      });
      setSuccessMsg(`Draft saved successfully (Revision #${res.revision_number}).`);
      fetchAgreement();
    } catch (err) {
      setError(err.message || 'Failed to update draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim()) return;

    setSharing(true);
    setError('');
    try {
      const res = await api.agreements.share(id, shareEmail.trim());
      setShareResult(res);
      setSuccessMsg(res.message);
      fetchAgreement();
    } catch (err) {
      setError(err.message || 'Sharing failed.');
    } finally {
      setSharing(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    try {
      await api.agreements.revokeShare(id, shareId);
      setSuccessMsg('Reviewer access revoked.');
      fetchAgreement();
    } catch (err) {
      setError(err.message || 'Failed to revoke access.');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setCommenting(true);
    try {
      await api.agreements.addComment(id, newComment, sectionRef);
      setNewComment('');
      setSectionRef('');
      fetchAgreement();
    } catch (err) {
      setError(err.message || 'Failed to submit comment.');
    } finally {
      setCommenting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading agreement instrument and revision history...
      </div>
    );
  }

  if (error && !agreement) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="alert alert-danger">
          <span>{error}</span>
        </div>
        <Link to="/agreements" className="btn btn-secondary">
          <ArrowLeft size={16} /> Return to Drafts
        </Link>
      </div>
    );
  }

  const isOwnerOrAdmin = agreement?.is_owner;
  const revisions = agreement?.revisions || [];
  const comments = agreement?.comments || [];
  const shares = agreement?.shares || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Header Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link to="/agreements" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} />
          <span>Back to Drafts</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isOwnerOrAdmin && (
            <button
              onClick={() => {
                setShowShareModal(true);
                setShareResult(null);
              }}
              className="btn btn-secondary btn-sm"
            >
              <Share2 size={14} />
              <span>Share with Reviewer</span>
            </button>
          )}

          <a
            href={api.agreements.getPdfUrl(id)}
            className="btn btn-secondary btn-sm"
            download
          >
            <Download size={14} />
            <span>Download PDF</span>
          </a>

          {isOwnerOrAdmin && (
            <button
              onClick={handleSaveDraft}
              className="btn btn-primary btn-sm"
              disabled={saving}
            >
              <Save size={14} />
              <span>{saving ? 'Saving Revision...' : 'Save Draft'}</span>
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Left Editor + Right Comments/Revisions Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Document Editor Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <div style={{ flex: 1, marginRight: '1rem' }}>
              {isOwnerOrAdmin ? (
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '1.25rem', fontWeight: 800, border: 'none', padding: '0.25rem 0', background: 'transparent' }}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              ) : (
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{title}</h2>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                {agreement.generation_mode === 'ai' ? 'AI Generated' : 'Template Generated'}
              </span>
              <StatusBadge status={agreement.status} />
            </div>
          </div>

          {/* Legal notice banner */}
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#92400e', display: 'flex', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              <strong>Preparatory Draft Notice:</strong> This document is generated for drafting convenience. It requires qualified advocate scrutiny, applicable Tamil Nadu stamp duty payment, and formal registration before the Sub-Registrar to take legal effect.
            </span>
          </div>

          {/* Editor Area */}
          {isOwnerOrAdmin ? (
            <textarea
              className="form-control"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                minHeight: '620px',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          ) : (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                minHeight: '620px',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-surface-alt)',
                borderRadius: 'var(--radius)',
                whiteSpace: 'pre-wrap',
                border: '1px solid var(--border)',
              }}
            >
              {content}
            </div>
          )}
        </div>

        {/* Sidebar Drawer: Revisions & Comments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Comments Panel */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={18} color="var(--primary)" />
                <h3 className="card-title">Review Comments</h3>
              </div>
              <span className="badge badge-neutral">{comments.length}</span>
            </div>

            {/* Comment Thread */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto', marginBottom: '1rem' }}>
              {comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>
                  No comments posted yet. Shared reviewers can leave clause feedback here.
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface-alt)',
                      border: '1px solid var(--border)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {c.author_name} ({c.author_role})
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {c.section_ref && (
                      <span className="badge badge-info" style={{ fontSize: '0.65rem', marginBottom: '0.35rem' }}>
                        Ref: {c.section_ref}
                      </span>
                    )}

                    <p style={{ color: 'var(--text-main)', marginTop: '0.2rem' }}>
                      {c.comment_text}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Clause reference (e.g. Clause 4)"
                value={sectionRef}
                onChange={(e) => setSectionRef(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '0.45rem' }}
              />

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <textarea
                  className="form-control"
                  placeholder="Enter review feedback..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  style={{ minHeight: '60px', fontSize: '0.8125rem' }}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={commenting || !newComment.trim()}
                style={{ alignSelf: 'flex-end' }}
              >
                <Send size={12} />
                <span>{commenting ? 'Posting...' : 'Post Comment'}</span>
              </button>
            </form>
          </div>

          {/* Revision History Panel */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} color="var(--primary)" />
                <h3 className="card-title">Revision History</h3>
              </div>
              <span className="badge badge-neutral">{revisions.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {revisions.map((rev) => (
                <div
                  key={rev.id}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-surface)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--text-main)' }}>Revision #{rev.revision_number}</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {rev.notes} by {rev.author_name}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Shares Panel (Owner Only) */}
          {isOwnerOrAdmin && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserCheck size={18} color="var(--primary)" />
                  <h3 className="card-title">Authorized Reviewers</h3>
                </div>
              </div>

              {shares.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  This draft is currently private. Share with a legal reviewer to collaborate.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {shares.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-surface-alt)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {s.shared_with_email}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Status: {s.status}
                        </div>
                      </div>

                      {s.status === 'active' && (
                        <button
                          onClick={() => handleRevokeShare(s.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem', color: 'var(--error)', padding: '0.2rem 0.45rem' }}
                          title="Revoke access"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Agreement with Legal Reviewer"
        maxWidth="500px"
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowShareModal(false)}
          >
            Close
          </button>
        }
      >
        <form onSubmit={handleShareSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Grant an authorized legal reviewer secure access to inspect and add review comments to this draft.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="reviewer-email">Reviewer Email Address</label>
            <input
              id="reviewer-email"
              type="email"
              className="form-control"
              placeholder="reviewer@example.com (e.g. reviewer@landassist.local)"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={sharing || !shareEmail.trim()}
          >
            <Share2 size={16} />
            <span>{sharing ? 'Granting Access...' : 'Share Draft'}</span>
          </button>

          {shareResult && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--success-light)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '0.25rem' }}>
                Access granted to {shareEmail}!
              </div>
              <div style={{ color: 'var(--text-main)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                Reviewer Access Token: <code>{shareResult.access_token}</code>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
