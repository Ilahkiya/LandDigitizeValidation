import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  ShieldCheck,
  FileSignature,
  FileText,
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Calendar,
  MapPin,
  Maximize2,
  Lock,
  Check,
  Smartphone,
  Camera
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function RecordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Preview modal for linked document
  const [showDocPreview, setShowDocPreview] = useState(false);

  const fetchRecord = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.records.get(id);
      setRecord(res.record);
    } catch (err) {
      setError(err.message || 'Failed to load record details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [id]);

  const handleRerunValidation = async () => {
    try {
      setValidating(true);
      setError('');
      const res = await api.records.rerunValidation(id);
      setSuccessMsg(`Validation rules evaluated successfully: Status is "${res.validation.status}".`);
      fetchRecord();
    } catch (err) {
      setError(err.message || 'Validation execution failed.');
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading parcel cadastral profile...
      </div>
    );
  }

  if (error || !record) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="alert alert-danger">
          <span>{error || 'Land record could not be found.'}</span>
        </div>
        <Link to="/records" className="btn btn-secondary">
          <ArrowLeft size={16} /> Return to Records
        </Link>
      </div>
    );
  }

  const valDetails = record.validation_details || {};
  const issues = valDetails.issues || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Top action bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link to="/records" className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} />
          <span>Back to Records</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleRerunValidation}
            className="btn btn-secondary btn-sm"
            disabled={validating}
          >
            <ShieldCheck size={14} color="var(--primary)" />
            <span>{validating ? 'Running Validation...' : 'Rerun Validation'}</span>
          </button>

          <Link to={`/records/${record.id}/edit`} className="btn btn-secondary btn-sm">
            <Edit2 size={14} />
            <span>Edit Record</span>
          </Link>

          <button
            onClick={() => navigate('/agreements/new', { state: { recordId: record.id } })}
            className="btn btn-primary btn-sm"
          >
            <FileSignature size={14} />
            <span>Draft Agreement with this Record</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Record Summary Card */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {record.owner_photo_url ? (
              <img
                src={record.owner_photo_url}
                alt={record.owner_name}
                style={{
                  width: '54px',
                  height: '66px',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-sm)',
                  border: '2px solid var(--primary)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  flexShrink: 0
                }}
              />
            ) : (
              <div
                style={{
                  width: '54px',
                  height: '66px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-alt)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  flexShrink: 0
                }}
              >
                {(record.owner_name || 'U').charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {record.owner_name}
                </h2>
                {record.is_sample === 1 && (
                  <span className="badge badge-neutral">Sample Test Record</span>
                )}
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                App No: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{record.application_number || `APP-REC-${record.id}`}</strong> • Deed Reference: <strong>{record.document_reference}</strong> ({record.document_type || 'Patta'}) • Created:{' '}
                {new Date(record.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge status={record.registration_status || (record.validation_status === 'Application Checks Passed' ? 'VERIFICATION COMPLETED' : 'PENDING VERIFICATION')} />
            <StatusBadge status={record.validation_status} />
          </div>
        </div>

        {/* Parcel Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginTop: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Survey & Subdivision
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.survey_number || '-'}/{record.subdivision_number || '-'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Patta Number
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.patta_number || 'Not Recorded'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Land Extent
            </span>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.land_area} {record.land_unit}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Revenue Village
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.village}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Jurisdictional Taluk
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.taluk}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Revenue District
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.district}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Ownership Type
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.ownership_type || 'Sole Ownership'} ({record.number_of_owners || 1} Owner)
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Classification
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.land_classification || 'Wetland (Nanjai)'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Encumbrance Status
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {record.encumbrance_status || 'Nil / Clean Title'}
            </div>
          </div>
        </div>

        {/* Verified Owner Identity & Contact Credentials Card */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-surface-alt)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Owner Identification & 2FA Contact Verification
            </h4>
            {record.mobile_verification_status === 'Verified' ? (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                <Check size={12} /> Mobile 2FA Verified
              </span>
            ) : (
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                Mobile {record.mobile_verification_status || 'Not Verified'}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Aadhaar Number
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={13} style={{ color: 'var(--text-muted)' }} />
                <span>{record.aadhaar_masked || 'Not Provided / Exempted'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                PAN Card Number
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={13} style={{ color: 'var(--text-muted)' }} />
                <span>{record.pan_masked || 'Not Provided / Exempted'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Mobile Number & Verification
              </span>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Smartphone size={14} style={{ color: 'var(--primary)' }} />
                <span>{record.owner_mobile || 'No Mobile Registered'}</span>
                {record.mobile_verification_status === 'Verified' ? (
                  <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>✓ Verified</span>
                ) : (
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>Not Verified</span>
                )}
              </div>
            </div>

            {record.owner_address && (
              <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Owner Communication / Permanent Address:
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginLeft: '0.5rem' }}>
                  {record.owner_address}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Co-Owners Breakdown if present */}
        {record.co_owners && record.co_owners.length > 0 && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Co-Owners Schedule & Share Allocations:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.4rem' }}>
              {record.co_owners.map((co, cidx) => (
                <div key={cidx} style={{ padding: '0.6rem 0.8rem', backgroundColor: 'var(--bg-surface-alt)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>{co.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Share: <strong>{co.share_percentage}%</strong> • {co.relationship || 'Co-Owner'}
                    {co.id_reference ? ` • ${co.id_reference}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boundary Schedule if present */}
        {(record.boundary_north || record.boundary_south || record.boundary_east || record.boundary_west) && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Cadastral Boundary Schedule:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.4rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                <strong>North:</strong> {record.boundary_north || 'Not specified'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                <strong>South:</strong> {record.boundary_south || 'Not specified'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                <strong>East:</strong> {record.boundary_east || 'Not specified'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                <strong>West:</strong> {record.boundary_west || 'Not specified'}
              </div>
            </div>
            {record.access_road_details && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                <strong>Road / Access Pathway:</strong> {record.access_road_details}
              </div>
            )}
          </div>
        )}

        {/* Attached Supporting Documents */}
        {record.supporting_documents && record.supporting_documents.length > 0 && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Attached Supporting Documents ({record.supporting_documents.length}):
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
              {record.supporting_documents.map((sdoc, sidx) => (
                <div key={sidx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-surface-alt)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={14} color="var(--primary)" />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{sdoc.filename}</span>
                    <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{sdoc.category}</span>
                  </div>
                  {sdoc.file_id && (
                    <a href={api.documents.getDownloadUrl(sdoc.file_id)} className="btn btn-secondary btn-sm" download>
                      <Download size={12} />
                      <span>Download</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cadastral Validation Findings Card */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} color="var(--primary)" />
            <h3 className="card-title">Automated Cadastral Validation Engine Report</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Evaluated on: {valDetails.checked_at ? new Date(valDetails.checked_at).toLocaleString() : 'Recent'}
          </span>
        </div>

        {issues.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--success-light)', borderRadius: 'var(--radius)', border: '1px solid var(--success-border)' }}>
            <CheckCircle2 size={32} color="var(--success)" style={{ margin: '0 auto 0.5rem auto' }} />
            <h4 style={{ color: 'var(--success)', fontWeight: 700 }}>Application Checks Passed</h4>
            <p style={{ fontSize: '0.8125rem', color: '#065f46', marginTop: '0.25rem' }}>
              All structural integrity rules, positive land area bounds, and cross-record conflict checks succeeded.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Found <strong>{issues.length}</strong> validation observation(s) requiring user review:
            </div>

            {issues.map((issue, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${issue.severity === 'error' ? 'var(--error-border)' : 'var(--warning-border)'}`,
                  backgroundColor: issue.severity === 'error' ? 'var(--error-light)' : 'var(--warning-light)',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start'
                }}
              >
                {issue.severity === 'error' ? (
                  <AlertCircle size={20} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {issue.problem}
                    </strong>
                    <span
                      className={`badge ${issue.severity === 'error' ? 'badge-danger' : 'badge-warning'}`}
                      style={{ fontSize: '0.65rem' }}
                    >
                      Field: {issue.field}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    {issue.explanation}
                  </p>

                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--primary-dark)', backgroundColor: 'rgba(255, 255, 255, 0.7)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    <strong>Suggested Resolution:</strong> {issue.suggested_correction}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '1.25rem', padding: '0.75rem', backgroundColor: 'var(--bg-surface-alt)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <strong>Notice:</strong> LandAssist data quality rules verify internal format consistency and repository uniqueness. They do not substitute official Government of Tamil Nadu revenue title certification.
        </div>
      </div>

      {/* Source Document Section */}
      {record.source_document_id && (
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="var(--primary)" />
              <h3 className="card-title">Source Digitized Document</h3>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Document ID #{record.source_document_id}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                {record.source_doc_name || `Document #${record.source_document_id}`}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Digitized and securely stored in private repository.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowDocPreview(true)}
                className="btn btn-secondary btn-sm"
              >
                <Maximize2 size={14} />
                <span>Preview Document</span>
              </button>
              <a
                href={api.documents.getDownloadUrl(record.source_document_id)}
                className="btn btn-secondary btn-sm"
                download
              >
                <Download size={14} />
                <span>Download</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <Modal
        isOpen={showDocPreview}
        onClose={() => setShowDocPreview(false)}
        title={`Document Preview: ${record.source_doc_name || 'Document'}`}
        maxWidth="800px"
      >
        <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <iframe
            src={api.documents.getPreviewUrl(record.source_document_id)}
            title="Document Preview"
            style={{ width: '100%', height: '500px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
          />
        </div>
      </Modal>
    </div>
  );
}
