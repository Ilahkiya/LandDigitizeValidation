import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  Edit2,
  ExternalLink,
  Info,
  Clock,
  X
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function ValidationView() {
  const location = useLocation();
  const incomingReport = location.state?.verificationReport;
  const incomingParcel = location.state?.parcelApplication;
  const [dismissedReport, setDismissedReport] = useState(false);
  const [dismissedParcel, setDismissedParcel] = useState(false);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [showParcelModal, setShowParcelModal] = useState(false);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [validatingAll, setValidatingAll] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.records.list();
      setRecords(res.records || []);
    } catch (err) {
      setError(err.message || 'Failed to retrieve records for validation analysis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleRerunAll = async () => {
    setValidatingAll(true);
    setNotice('');
    try {
      for (const r of records) {
        await api.records.rerunValidation(r.id);
      }
      setNotice(`Successfully reran cadastral validation on ${records.length} record(s).`);
      fetchRecords();
    } catch (err) {
      setError(err.message || 'Batch validation rerun encountered an error.');
    } finally {
      setValidatingAll(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'passed') return r.validation_status === 'Application Checks Passed';
    if (filter === 'attention') return r.validation_status !== 'Application Checks Passed';
    if (filter === 'conflict') return r.validation_status === 'Conflict Detected';
    return true;
  });

  const passedCount = records.filter((r) => r.validation_status === 'Application Checks Passed').length;
  const reviewCount = records.filter((r) => r.validation_status === 'Needs Review').length;
  const incompleteCount = records.filter((r) => r.validation_status === 'Incomplete').length;
  const conflictCount = records.filter((r) => r.validation_status === 'Conflict Detected').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Cadastral & Land Record Validation Engine</h2>
          <p>
            Automated backend rules verify required fields, survey formatting, positive extent, duplicate deeds, and title conflicts
          </p>
        </div>

        <button
          onClick={handleRerunAll}
          className="btn btn-primary"
          disabled={validatingAll || records.length === 0}
        >
          <RefreshCw size={16} className={validatingAll ? 'spin-icon' : ''} />
          <span>{validatingAll ? 'Evaluating All Records...' : 'Rerun Validation on All Records'}</span>
        </button>
      </div>

      {notice && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Incoming Document Verification Report Card (From Digitalization Engine) */}
      {incomingReport && !dismissedReport && (
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--warning)',
            backgroundColor: 'var(--bg-surface)',
            padding: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <ShieldAlert size={20} color="var(--warning)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Document Verification Report: {incomingReport.verification_ref}
                </h3>
                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={12} />
                  Pending Manual Review
                </span>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Document: <strong>{incomingReport.original_filename}</strong> • Ref ID: <strong>{incomingReport.verification_ref}</strong> • Verified: {new Date(incomingReport.timestamp).toLocaleString()}
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Authenticity Engine Status: <strong>{incomingReport.overall_status}</strong>
              </div>

              {incomingReport.warnings && incomingReport.warnings.length > 0 && (
                <div style={{ marginTop: '0.45rem', fontSize: '0.8125rem', color: '#b91c1c' }}>
                  <strong>Warnings:</strong> {incomingReport.warnings.join(' ')}
                </div>
              )}

              <div style={{ marginTop: '0.45rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <strong>Government Source Status:</strong> {incomingReport.government_verification?.notice || "Official government verification unavailable — manual verification required."}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowIncomingModal(true)}
                className="btn btn-secondary btn-sm"
              >
                <Eye size={14} />
                <span>Inspect Checks ({incomingReport.checks?.length || 8})</span>
              </button>

              <button
                type="button"
                onClick={() => setDismissedReport(true)}
                className="btn btn-secondary btn-sm"
                title="Dismiss from view"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Incoming Verification Checks */}
      <Modal
        isOpen={showIncomingModal}
        onClose={() => setShowIncomingModal(false)}
        title={`Verification Details: ${incomingReport?.verification_ref}`}
        maxWidth="750px"
      >
        {incomingReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <strong>{incomingReport.original_filename}</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{incomingReport.verification_ref}</div>
              </div>
              <span className="badge badge-warning">Pending Manual Review</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {incomingReport.checks?.map((chk) => (
                <div
                  key={chk.id}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface-alt)',
                    borderLeft: `3px solid ${
                      chk.status === 'PASSED'
                        ? 'var(--success)'
                        : chk.status === 'FAILED'
                        ? 'var(--error)'
                        : chk.status === 'NEEDS REVIEW'
                        ? 'var(--warning)'
                        : 'var(--text-subtle)'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>Check {chk.id}: {chk.name}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{chk.status}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                    {chk.summary}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {chk.explanation}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--warning-light)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
              <strong>Notice:</strong> This report is pending manual review because live official government verification is currently unavailable. Automated checks do not constitute government approval.
            </div>
          </div>
        )}
      </Modal>

      {/* Incoming Parcel Application Verification Card (From Register Land Parcel Page) */}
      {incomingParcel && !dismissedParcel && (
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--primary)',
            backgroundColor: 'var(--bg-surface)',
            padding: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <ShieldCheck size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Parcel Application Verification: {incomingParcel.application_number}
                </h3>
                <StatusBadge status={incomingParcel.registration_status} />
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Owner: <strong>{incomingParcel.formData?.owner_name || 'Owner'}</strong> • Survey: <strong>{incomingParcel.formData?.survey_number}/{incomingParcel.formData?.subdivision_number || '1'}</strong> • Location: <strong>{incomingParcel.formData?.village}, {incomingParcel.formData?.district}</strong>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Extents: <strong>{incomingParcel.formData?.land_area} {incomingParcel.formData?.land_unit}</strong> • Title Type: <strong>{incomingParcel.formData?.document_type || 'Patta'}</strong> ({incomingParcel.formData?.ownership_type || 'Sole Ownership'})
              </div>

              <div style={{ marginTop: '0.45rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <strong>Truthful Government Source Status:</strong> Official government verification unavailable — manual verification required.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowParcelModal(true)}
                className="btn btn-secondary btn-sm"
              >
                <Eye size={14} />
                <span>Inspect 12 Checks</span>
              </button>

              {incomingParcel.record_id && (
                <Link
                  to={`/records/${incomingParcel.record_id}`}
                  className="btn btn-primary btn-sm"
                >
                  <ExternalLink size={14} />
                  <span>View Parcel Record</span>
                </Link>
              )}

              <button
                type="button"
                onClick={() => setDismissedParcel(true)}
                className="btn btn-secondary btn-sm"
                title="Dismiss banner"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Incoming Parcel Application 12 Checks */}
      <Modal
        isOpen={showParcelModal}
        onClose={() => setShowParcelModal(false)}
        title={`Parcel Registration Audit: ${incomingParcel?.application_number}`}
        maxWidth="800px"
      >
        {incomingParcel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>{incomingParcel.formData?.owner_name}</strong> • {incomingParcel.formData?.village}, {incomingParcel.formData?.district}
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  App Ref: {incomingParcel.application_number}
                </div>
              </div>
              <StatusBadge status={incomingParcel.registration_status} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {incomingParcel.validation?.checks?.map((chk) => (
                <div
                  key={chk.id}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface-alt)',
                    borderLeft: `3px solid ${
                      chk.status === 'PASSED'
                        ? 'var(--success)'
                        : chk.status === 'FAILED'
                        ? 'var(--error)'
                        : chk.status === 'NEEDS REVIEW'
                        ? 'var(--warning)'
                        : 'var(--text-subtle)'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>#{chk.id} {chk.name}</span>
                    <span
                      className={`badge ${
                        chk.status === 'PASSED'
                          ? 'badge-success'
                          : chk.status === 'FAILED'
                          ? 'badge-danger'
                          : chk.status === 'NEEDS REVIEW'
                          ? 'badge-warning'
                          : 'badge-neutral'
                      }`}
                      style={{ fontSize: '0.65rem' }}
                    >
                      {chk.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                    {chk.summary}
                  </div>
                  {chk.explanation && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {chk.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--warning-light)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
              <strong>Truth in Government Status:</strong> Official government verification unavailable — manual verification required.
            </div>
          </div>
        )}
      </Modal>

      {/* Status Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div
          className="card"
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--success)' }}
          onClick={() => setFilter('passed')}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Checks Passed
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.25rem' }}>
            {passedCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            No format or conflict errors
          </div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', borderLeft: '4px solid var(--warning)' }}
          onClick={() => setFilter('attention')}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Needs Review
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)', marginTop: '0.25rem' }}>
            {reviewCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Missing subdivisions or formats
          </div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', borderLeft: '4px solid #ef4444' }}
          onClick={() => setFilter('attention')}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Incomplete
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>
            {incompleteCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Missing mandatory parameters
          </div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', borderLeft: '4px solid #b91c1c' }}
          onClick={() => setFilter('conflict')}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Conflicts Detected
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.25rem' }}>
            {conflictCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Cross-record boundary / duplicate claims
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
        >
          All Records ({records.length})
        </button>
        <button
          className={`btn btn-sm ${filter === 'attention' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('attention')}
        >
          Needing Attention ({reviewCount + incompleteCount + conflictCount})
        </button>
        <button
          className={`btn btn-sm ${filter === 'conflict' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('conflict')}
        >
          Conflicts Only ({conflictCount})
        </button>
        <button
          className={`btn btn-sm ${filter === 'passed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('passed')}
        >
          Passed Checks ({passedCount})
        </button>
      </div>

      {/* Validation List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Evaluating validation rules against SQLite repository...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={48} color="var(--success)" />
            <h3>No Records Match Selected Category</h3>
            <p>Select another filter tab or add new records to run validation checks.</p>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Parcel ID & Owner</th>
                  <th>Survey / Subdiv</th>
                  <th>Village / Taluk</th>
                  <th>Extent</th>
                  <th>Document Reference</th>
                  <th>Current Validation Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        #{r.id} • {r.owner_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.is_sample === 1 ? 'Sample Test Data' : 'User Record'}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {r.survey_number || '-'}/{r.subdivision_number || '-'}
                      </span>
                    </td>
                    <td>
                      <div>{r.village}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.district}</div>
                    </td>
                    <td>
                      {r.land_area} {r.land_unit}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {r.document_reference}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.validation_status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <Link
                          to={`/records/${r.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Inspect Validation Findings"
                        >
                          <Eye size={14} />
                          <span>Inspect Report</span>
                        </Link>
                        <Link
                          to={`/records/${r.id}/edit`}
                          className="btn btn-secondary btn-sm"
                          title="Correct Fields"
                        >
                          <Edit2 size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legal & Regulatory Disclaimer */}
      <div className="alert alert-info">
        <Info size={20} />
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
          <strong>Statutory Compliance & Technical Disclaimer:</strong>
          <br />
          LandAssist validation findings are programmatic consistency checks executed within the local application database. They do not constitute official title certification, encumbrance verification, or legal proof of ownership under the Tamil Nadu Patta Pass Book Act. Always cross-verify title with certified extracts from the official Tamil Nadu Land Records portal (eservices.tn.gov.in) before entering into property transactions.
        </div>
      </div>
    </div>
  );
}
