import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FileSpreadsheet,
  Search,
  Filter,
  PlusCircle,
  Eye,
  Edit2,
  Trash2,
  ShieldCheck,
  FileText,
  AlertCircle,
  RefreshCw,
  FileCheck2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function LandRecords() {
  const location = useLocation();
  const [records, setRecords] = useState([]);
  const [counts, setCounts] = useState({ total: 0, drafts: 0, submitted: 0, passed: 0, needs_review: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle flash message from navigation
  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMsg(location.state.successMessage);
      // Clean location state to avoid re-trigger on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Validation modal state
  const [validatingId, setValidatingId] = useState(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (districtFilter) params.district = districtFilter;

      const res = await api.records.list(params);
      setRecords(res.records || []);
      if (res.counts) {
        setCounts(res.counts);
      } else {
        // Fallback count calculation
        const recList = res.records || [];
        setCounts({
          total: recList.length,
          drafts: recList.filter(r => r.is_draft === 1 || r.registration_status === 'DRAFT').length,
          submitted: recList.filter(r => r.is_draft !== 1 && (r.registration_status === 'Submitted for Review' || r.registration_status === 'PENDING VERIFICATION')).length,
          passed: recList.filter(r => r.is_draft !== 1 && (r.validation_status === 'Application Checks Passed' || r.registration_status === 'VERIFICATION COMPLETED')).length,
          needs_review: recList.filter(r => r.is_draft !== 1 && r.validation_status === 'Needs Review' && r.registration_status !== 'Submitted for Review').length,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve land records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [statusFilter, districtFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleRunValidation = async (recordId) => {
    try {
      setValidatingId(recordId);
      const res = await api.records.rerunValidation(recordId);
      setSuccessMsg(`Validation completed for Record #${recordId}: Status is now "${res.validation.status}".`);
      fetchRecords();
    } catch (err) {
      setError(err.message || 'Validation execution failed.');
    } finally {
      setValidatingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.records.delete(deleteTarget.id);
      setSuccessMsg(`Land record #${deleteTarget.id} successfully deleted.`);
      setDeleteTarget(null);
      fetchRecords();
    } catch (err) {
      setError(err.message || 'Failed to delete record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Land Records Registry</h2>
          <p>Digitized land parcels, patta records, and automated cadastral quality verification</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/digitize" className="btn btn-secondary">
            <FileText size={16} />
            <span>Digitize from Document</span>
          </Link>
          <Link to="/records/new" className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Add Record Manually</span>
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="alert alert-success">
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg('')}
            style={{ marginLeft: 'auto', fontWeight: 700, color: 'inherit' }}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 'auto', fontWeight: 700, color: 'inherit' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
        <div
          onClick={() => setStatusFilter('')}
          style={{
            padding: '1rem',
            backgroundColor: statusFilter === '' ? 'var(--primary-light)' : 'var(--bg-surface)',
            border: `1.5px solid ${statusFilter === '' ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>All Records</span>
            <FileSpreadsheet size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>{counts.total}</div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? '' : 'DRAFT')}
          style={{
            padding: '1rem',
            backgroundColor: statusFilter === 'DRAFT' ? '#f1f5f9' : 'var(--bg-surface)',
            border: `1.5px solid ${statusFilter === 'DRAFT' ? '#475569' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Drafts</span>
            <Clock size={16} color="#64748b" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#334155' }}>{counts.drafts}</div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'Submitted for Review' ? '' : 'Submitted for Review')}
          style={{
            padding: '1rem',
            backgroundColor: statusFilter === 'Submitted for Review' ? '#e0f2fe' : 'var(--bg-surface)',
            border: `1.5px solid ${statusFilter === 'Submitted for Review' ? '#0284c7' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1', textTransform: 'uppercase' }}>Under Review</span>
            <FileCheck2 size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0369a1' }}>{counts.submitted}</div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'Application Checks Passed' ? '' : 'Application Checks Passed')}
          style={{
            padding: '1rem',
            backgroundColor: statusFilter === 'Application Checks Passed' ? '#ecfdf5' : 'var(--bg-surface)',
            border: `1.5px solid ${statusFilter === 'Application Checks Passed' ? '#059669' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#065f46', textTransform: 'uppercase' }}>Checks Passed</span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#065f46' }}>{counts.passed}</div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'Needs Review' ? '' : 'Needs Review')}
          style={{
            padding: '1rem',
            backgroundColor: statusFilter === 'Needs Review' ? '#fffbeb' : 'var(--bg-surface)',
            border: `1.5px solid ${statusFilter === 'Needs Review' ? '#d97706' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Needs Review</span>
            <AlertCircle size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309' }}>{counts.needs_review}</div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-subtle)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Search by owner name, survey no, village, or doc ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses ({counts.total})</option>
              <option value="DRAFT">Drafts ({counts.drafts})</option>
              <option value="Submitted for Review">Submitted for Review ({counts.submitted})</option>
              <option value="Application Checks Passed">Checks Passed ({counts.passed})</option>
              <option value="Needs Review">Needs Review ({counts.needs_review})</option>
              <option value="Conflict Detected">Conflict Detected</option>
            </select>

            <button type="submit" className="btn btn-secondary">
              Search
            </button>

            {(search || statusFilter || districtFilter) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setDistrictFilter('');
                }}
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Records Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading land records from repository...
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <FileSpreadsheet size={48} color="var(--text-subtle)" />
            <h3>No Land Records Found</h3>
            <p>
              {search || statusFilter
                ? 'No records match your selected filter criteria. Try adjusting your search query.'
                : 'Get started by uploading a title document for digitization or registering a parcel record manually.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/digitize" className="btn btn-secondary">
                Upload Document
              </Link>
              <Link to="/records/new" className="btn btn-primary">
                Add First Record
              </Link>
            </div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Application / Owner</th>
                  <th>Survey / Subdiv</th>
                  <th>Village / Taluk</th>
                  <th>District</th>
                  <th>Extent</th>
                  <th>Deed Reference</th>
                  <th>Registration Status</th>
                  <th>Validation</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                        {r.owner_photo_url ? (
                          <img
                            src={r.owner_photo_url}
                            alt={r.owner_name}
                            style={{
                              width: '38px',
                              height: '46px',
                              objectFit: 'cover',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                              flexShrink: 0,
                              marginTop: '2px'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '38px',
                              height: '46px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-surface-alt)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-muted)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              flexShrink: 0,
                              marginTop: '2px'
                            }}
                          >
                            {(r.owner_name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                            <span>{r.owner_name}</span>
                            {r.is_sample === 1 && (
                              <span
                                className="badge badge-neutral"
                                style={{ fontSize: '0.65rem' }}
                                title="Fictional test record"
                              >
                                Sample
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                            {r.application_number || `APP-REC-${r.id}`}
                          </div>

                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Patta: {r.patta_number || 'Unassigned'} • {r.document_type || 'Patta'}
                          </div>

                          {(r.aadhaar_masked || r.pan_masked) && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {r.aadhaar_masked && <span>Aadhaar: <code style={{ color: 'var(--text-main)' }}>{r.aadhaar_masked}</code></span>}
                              {r.pan_masked && <span>PAN: <code style={{ color: 'var(--text-main)' }}>{r.pan_masked}</code></span>}
                            </div>
                          )}

                          {r.owner_mobile && (
                            <div style={{ fontSize: '0.68rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{r.owner_mobile}</span>
                              {r.mobile_verification_status === 'Verified' ? (
                                <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                                  Verified ✓
                                </span>
                              ) : (
                                <span className="badge badge-neutral" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                                  Not Verified
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {r.survey_number || '-'}/{r.subdivision_number || '-'}
                      </span>
                    </td>
                    <td>
                      <div>{r.village}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.taluk}</div>
                    </td>
                    <td>{r.district}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        {r.land_area} {r.land_unit}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {r.document_reference}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.registration_status || (r.validation_status === 'Application Checks Passed' ? 'VERIFICATION COMPLETED' : 'PENDING VERIFICATION')} />
                    </td>
                    <td>
                      <StatusBadge status={r.validation_status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <Link
                          to={`/records/${r.id}`}
                          className="btn btn-secondary btn-sm"
                          title="View Details & Validation Report"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link
                          to={`/records/${r.id}/edit`}
                          className="btn btn-secondary btn-sm"
                          title="Edit Record"
                        >
                          <Edit2 size={14} />
                        </Link>
                        <button
                          onClick={() => handleRunValidation(r.id)}
                          className="btn btn-secondary btn-sm"
                          title="Rerun Validation Engine"
                          disabled={validatingId === r.id}
                        >
                          <ShieldCheck size={14} color={validatingId === r.id ? 'var(--text-subtle)' : 'var(--primary)'} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="btn btn-secondary btn-sm"
                          title="Delete Record"
                          style={{ color: 'var(--error)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Record Deletion"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Record'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
          Are you sure you want to delete the land record for{' '}
          <strong>{deleteTarget?.owner_name}</strong> (Survey {deleteTarget?.survey_number}/{deleteTarget?.subdivision_number})?
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          This operation will permanently remove the record and its validation history from the database.
        </p>
      </Modal>
    </div>
  );
}
