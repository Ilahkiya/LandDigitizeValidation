import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Files,
  Upload,
  Download,
  Eye,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCheck2,
  Maximize2
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState(null);

  // Delete modal state
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.documents.list();
      setDocuments(res.documents || []);
    } catch (err) {
      setError(err.message || 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setError('');
    try {
      await api.documents.upload(uploadFile);
      setSuccessMsg('Document successfully uploaded and saved to private storage.');
      setShowUploadModal(false);
      setUploadFile(null);
      fetchDocuments();
    } catch (err) {
      setError(err.message || 'Document upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    try {
      await api.documents.delete(deleteDoc.id);
      setSuccessMsg(`Document "${deleteDoc.original_filename}" deleted.`);
      setDeleteDoc(null);
      fetchDocuments();
    } catch (err) {
      setError(err.message || 'Failed to delete document.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Private Document Storage Library</h2>
          <p>Secure, authenticated repository of deed copies, patta certificates, and cadastral sketches</p>
        </div>

        <button
          onClick={() => {
            setShowUploadModal(true);
            setUploadFile(null);
          }}
          className="btn btn-primary"
        >
          <Upload size={16} />
          <span>Upload Document</span>
        </button>
      </div>

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
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

      {/* Documents Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving documents from private storage...
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <Files size={48} color="var(--text-subtle)" />
            <h3>No Documents in Private Library</h3>
            <p>
              Upload deed scans, patta papers, or FMB maps to preserve and extract property attributes.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn btn-primary"
            >
              Upload First Document
            </button>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>File Type</th>
                  <th>Size</th>
                  <th>Upload Date</th>
                  <th>OCR / Text Status</th>
                  <th>Linked Land Record</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={16} />
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {doc.original_filename}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Doc ID: #{doc.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        {doc.file_type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {(doc.file_size / 1024).toFixed(1)} KB
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={doc.extraction_status} />
                    </td>
                    <td>
                      {doc.linked_record_id ? (
                        <Link
                          to={`/records/${doc.linked_record_id}`}
                          style={{ fontSize: '0.8rem', fontWeight: 600 }}
                        >
                          Record #{doc.linked_record_id} ({doc.linked_owner_name})
                        </Link>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                          Unlinked
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="btn btn-secondary btn-sm"
                          title="Preview Document"
                        >
                          <Maximize2 size={14} />
                        </button>
                        <a
                          href={api.documents.getDownloadUrl(doc.id)}
                          className="btn btn-secondary btn-sm"
                          download
                          title="Download File"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => setDeleteDoc(doc)}
                          className="btn btn-secondary btn-sm"
                          title="Delete File"
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

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Land Record Document"
        maxWidth="500px"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowUploadModal(false)}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUploadSubmit}
              disabled={uploading || !uploadFile}
            >
              {uploading ? 'Uploading & Digitizing...' : 'Upload File'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Files are stored in private server storage outside the public web root. Access is secured by session authorization checks.
          </p>

          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="form-control"
            onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
          />

          {uploadFile && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-main)', backgroundColor: 'var(--bg-surface-alt)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
              Selected: <strong>{uploadFile.name}</strong> ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={`Document Preview: ${previewDoc?.original_filename}`}
        maxWidth="850px"
      >
        {previewDoc && (
          <div style={{ minHeight: '450px' }}>
            <iframe
              src={api.documents.getPreviewUrl(previewDoc.id)}
              title="Secure Document Preview"
              style={{ width: '100%', height: '520px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            />
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteDoc)}
        onClose={() => setDeleteDoc(null)}
        title="Confirm Document Removal"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteDoc(null)}
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
              {deleting ? 'Deleting...' : 'Delete File'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
          Are you sure you want to delete <strong>{deleteDoc?.original_filename}</strong>?
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          This will delete the file from private storage disk.
        </p>
      </Modal>
    </div>
  );
}
