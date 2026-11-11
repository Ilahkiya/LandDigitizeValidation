import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  FileText,
  FileCheck,
  Eye,
  X,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Info,
  Clock,
  Printer
} from 'lucide-react';
import { api } from '../services/api';
import Modal from '../components/Modal';

export default function Digitization() {
  const navigate = useNavigate();

  // Workflow state: 'upload' -> 'report'
  const [step, setStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Verification results from backend
  const [verificationReport, setVerificationReport] = useState(null);
  const [uploadedDoc, setUploadedDoc] = useState(null);

  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showFullReportModal, setShowFullReportModal] = useState(false);

  const validateAndSetFile = (file) => {
    setError('');
    if (!file) return;

    // Validate size (16 MB limit)
    const MAX_SIZE = 16 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the maximum allowed limit of 16 MB.`);
      return;
    }

    // Validate extension
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'png', 'jpg', 'jpeg'];
    if (!allowed.includes(ext)) {
      setError('Unsupported file format. Please upload a PDF, JPG, JPEG, or PNG document.');
      return;
    }

    // Generate local preview URL
    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
    } catch {
      // Fallback if URL.createObjectURL fails
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    setSelectedFile(null);
    setError('');
  };

  const handleVerifyDocument = async () => {
    if (!selectedFile) {
      setError('Please select a land document file (PDF, JPG, PNG) to verify.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const res = await api.documents.verify(selectedFile);
      setUploadedDoc(res.document);
      setVerificationReport(res.verification);
      setStep('report');
    } catch (err) {
      setError(err.message || 'Document authenticity verification failed. Please check file format.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSendToValidation = () => {
    if (!verificationReport) return;

    // Pass the complete verification report and document reference to the existing Validation page
    navigate('/validation', {
      state: {
        verificationReport: {
          verification_ref: verificationReport.verification_ref,
          document_id: uploadedDoc?.id,
          original_filename: verificationReport.original_filename,
          overall_status: verificationReport.overall_status,
          checks: verificationReport.checks,
          warnings: verificationReport.warnings,
          timestamp: verificationReport.timestamp,
          government_verification: verificationReport.government_verification,
          extracted_cadastral_data: verificationReport.extracted_cadastral_data,
          preview_url: uploadedDoc?.preview_url || (uploadedDoc?.id ? api.documents.getPreviewUrl(uploadedDoc.id) : '')
        }
      }
    });
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    setSelectedFile(null);
    setVerificationReport(null);
    setUploadedDoc(null);
    setError('');
    setStep('upload');
  };

  const getCheckBadge = (status) => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle2 size={12} />
            PASSED
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <AlertCircle size={12} />
            FAILED
          </span>
        );
      case 'NEEDS REVIEW':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <AlertTriangle size={12} />
            NEEDS REVIEW
          </span>
        );
      case 'NOT VERIFIED':
      default:
        return (
          <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <HelpCircle size={12} />
            NOT VERIFIED
          </span>
        );
    }
  };

  const getOverallBadge = (status) => {
    switch (status) {
      case 'VERIFIED AGAINST OFFICIAL RECORDS':
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', borderRadius: 'var(--radius)', backgroundColor: 'var(--success-light)', border: '1px solid var(--success-border)', color: 'var(--success)', fontWeight: 700, fontSize: '0.9rem' }}>
            <ShieldCheck size={18} />
            <span>VERIFIED AGAINST OFFICIAL RECORDS</span>
          </div>
        );
      case 'FLAGGED FOR REVIEW':
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', borderRadius: 'var(--radius)', backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', fontWeight: 700, fontSize: '0.9rem' }}>
            <ShieldAlert size={18} />
            <span>FLAGGED FOR REVIEW</span>
          </div>
        );
      case 'PENDING MANUAL VERIFICATION':
      default:
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.85rem', borderRadius: 'var(--radius)', backgroundColor: 'var(--warning-light)', border: '1px solid var(--warning-border)', color: 'var(--warning)', fontWeight: 700, fontSize: '0.9rem' }}>
            <Clock size={18} />
            <span>PENDING MANUAL VERIFICATION</span>
          </div>
        );
    }
  };

  const getFileExt = (filename) => {
    return filename?.split('.').pop()?.toUpperCase() || 'DOC';
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Government Land Document Authenticity Verification System</h2>
          <p>
            Verify document attributes, official seals, handwritten or cryptographic signatures, tampering indicators, and government record status
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: DOCUMENT UPLOAD */}
      {step === 'upload' && (
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Upload Government Land Document for Verification
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Accepts digital PDFs, scanned land deeds, Patta/Chitta extracts, and photos (PDF, PNG, JPG, JPEG up to 16 MB)
            </p>
          </div>

          <label
            htmlFor="verify-file-input"
            className="dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              display: 'block',
              borderColor: isDragging ? 'var(--primary)' : 'var(--border)',
              backgroundColor: isDragging ? 'var(--primary-light)' : 'transparent',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
          >
            <input
              id="verify-file-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Upload size={28} />
              </div>

              {selectedFile ? (
                <div style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    <span className="badge badge-neutral" style={{ marginRight: '0.5rem' }}>
                      {getFileExt(selectedFile.name)}
                    </span>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Ready for verification
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowPreviewModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Eye size={14} />
                        <span>Preview Document</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--error)' }}
                    >
                      <X size={14} />
                      <span>Remove File</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    Click to browse or drop document here
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Supports PDF, JPG, JPEG, and PNG files up to 16 MB
                  </div>
                </div>
              )}
            </div>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem' }}>
            <button
              onClick={handleVerifyDocument}
              className="btn btn-primary"
              disabled={!selectedFile || verifying}
              style={{ minWidth: '220px' }}
            >
              {verifying ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Verifying Authenticity...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Upload & Verify Document</span>
                </>
              )}
            </button>
          </div>

          <style>{`
            .spin-icon { animation: spin 1s linear infinite; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {/* STEP 2: VERIFICATION REPORT */}
      {step === 'report' && verificationReport && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Verification Overview Card */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Verification Report
                  </h3>
                  {getOverallBadge(verificationReport.overall_status)}
                </div>

                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <span>
                    Ref ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{verificationReport.verification_ref}</strong>
                  </span>
                  <span>
                    Document: <strong>{verificationReport.original_filename}</strong> ({verificationReport.document_type})
                  </span>
                  <span>
                    Date: <strong>{new Date(verificationReport.timestamp).toLocaleString()}</strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="btn btn-secondary btn-sm"
                >
                  <Eye size={14} />
                  <span>Preview Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullReportModal(true)}
                  className="btn btn-secondary btn-sm"
                >
                  <FileText size={14} />
                  <span>View Full Report</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendToValidation}
                  className="btn btn-primary btn-sm"
                >
                  <ArrowRight size={14} />
                  <span>Send to Validation</span>
                </button>
              </div>
            </div>

            {/* Recommended Next Action Banner */}
            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--bg-surface-alt)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <Info size={18} color="var(--primary)" />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                <strong>Recommended Next Action:</strong> {verificationReport.recommended_action}
              </div>
            </div>
          </div>

          {/* Statutory Government Record Verification Status Notice */}
          <div className="alert alert-warning" style={{ alignItems: 'flex-start' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                Official Government Verification Status
              </div>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                {verificationReport.government_verification?.notice ||
                  'Official government verification unavailable — manual verification required.'}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: 'var(--text-muted)' }}>
                LandAssist validation findings are technical data-integrity and consistency checks. Technical verification by this application is not government certification. Always verify title deeds using certified extracts from the official Tamil Nadu Land Records portal (
                <a
                  href="https://eservices.tn.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'underline', color: 'inherit', fontWeight: 600 }}
                >
                  eservices.tn.gov.in <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </a>
                ).
              </div>
            </div>
          </div>

          {/* Warnings and Missing Information (if any) */}
          {verificationReport.warnings && verificationReport.warnings.length > 0 && (
            <div className="alert alert-danger" style={{ alignItems: 'flex-start' }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  Warnings & Attention Items ({verificationReport.warnings.length})
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                  {verificationReport.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* The 8 Individual Verification Checks Section */}
          <div>
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Individual Authenticity & Integrity Checks (8)
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Evaluated against available document structures and cadastral repository
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1rem' }}>
              {verificationReport.checks.map((c) => (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderLeft: `4px solid ${
                      c.status === 'PASSED'
                        ? 'var(--success)'
                        : c.status === 'FAILED'
                        ? 'var(--error)'
                        : c.status === 'NEEDS REVIEW'
                        ? 'var(--warning)'
                        : 'var(--text-subtle)'
                    }`
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Check {c.id} • {c.category}
                        </div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>
                          {c.name}
                        </h4>
                      </div>
                      {getCheckBadge(c.status)}
                    </div>

                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                      {c.summary}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {c.explanation}
                    </div>
                  </div>

                  {c.details?.disclaimer && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)', fontSize: '0.75rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                      {c.details.disclaimer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
            >
              Upload Another Document
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowFullReportModal(true)}
              >
                <FileCheck size={16} />
                <span>View Full Summary</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSendToValidation}
              >
                <ArrowRight size={16} />
                <span>Send to Validation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={`Document Preview: ${selectedFile?.name || uploadedDoc?.original_filename || 'Land Document'}`}
        maxWidth="850px"
      >
        <div style={{ minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-surface-alt)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {previewUrl ? (
            selectedFile?.name?.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={previewUrl}
                title="Document PDF Preview"
                style={{ width: '100%', height: '550px', border: 'none' }}
              />
            ) : (
              <img
                src={previewUrl}
                alt="Document Preview"
                style={{ maxWidth: '100%', maxHeight: '550px', objectFit: 'contain' }}
              />
            )
          ) : uploadedDoc?.preview_url ? (
            uploadedDoc.file_type === 'pdf' ? (
              <iframe
                src={uploadedDoc.preview_url}
                title="Document PDF Preview"
                style={{ width: '100%', height: '550px', border: 'none' }}
              />
            ) : (
              <img
                src={uploadedDoc.preview_url}
                alt="Document Preview"
                style={{ maxWidth: '100%', maxHeight: '550px', objectFit: 'contain' }}
              />
            )
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No visual preview available for this document.
            </div>
          )}
        </div>
      </Modal>

      {/* Comprehensive Report Modal */}
      <Modal
        isOpen={showFullReportModal}
        onClose={() => setShowFullReportModal(false)}
        title="Official Verification Summary Report"
        maxWidth="850px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => window.print()}
            >
              <Printer size={14} /> Print Report
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setShowFullReportModal(false);
                handleSendToValidation();
              }}
            >
              Send to Validation <ArrowRight size={14} />
            </button>
          </div>
        }
      >
        {verificationReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <div>
                <h4 style={{ fontWeight: 800, fontSize: '1.1rem' }}>LandAssist Verification Record</h4>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Verification Ref: <strong>{verificationReport.verification_ref}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</div>
                <div style={{ fontWeight: 700 }}>{verificationReport.overall_status}</div>
              </div>
            </div>

            {/* Extracted Cadastral Parameters Table */}
            <div>
              <h5 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Parsed Cadastral Parameters
              </h5>
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '35%', fontWeight: 600 }}>Document Type</td>
                    <td>{verificationReport.extracted_cadastral_data?.document_type || '-'}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Owner / Pattadhar Name</td>
                    <td>{verificationReport.extracted_cadastral_data?.owner_name || 'Not detected'}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Survey & Subdivision</td>
                    <td>
                      {verificationReport.extracted_cadastral_data?.survey_number || '-'}/
                      {verificationReport.extracted_cadastral_data?.subdivision_number || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Revenue Village / Taluk / District</td>
                    <td>
                      {verificationReport.extracted_cadastral_data?.village || '-'},{' '}
                      {verificationReport.extracted_cadastral_data?.taluk || '-'},{' '}
                      {verificationReport.extracted_cadastral_data?.district || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Land Extent</td>
                    <td>
                      {verificationReport.extracted_cadastral_data?.land_area || '-'}{' '}
                      {verificationReport.extracted_cadastral_data?.land_unit || ''}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Document Reference</td>
                    <td>{verificationReport.extracted_cadastral_data?.document_reference || '-'}</td>
                  </tr>
                  {verificationReport.extracted_cadastral_data?.aadhaar_masked && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>Masked Identity Reference</td>
                      <td>{verificationReport.extracted_cadastral_data.aadhaar_masked}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Verification Checklist */}
            <div>
              <h5 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                Authenticity Checks Breakdown
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {verificationReport.checks.map((chk) => (
                  <div
                    key={chk.id}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface-alt)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700 }}>Check {chk.id}: {chk.name}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chk.summary}</div>
                    </div>
                    {getCheckBadge(chk.status)}
                  </div>
                ))}
              </div>
            </div>

            {/* Statutory Disclaimer */}
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--warning-light)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <strong>Notice:</strong> This verification report records automated and internal database checks performed by LandAssist. It does not replace official certified revenue extracts from the Government of Tamil Nadu.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
