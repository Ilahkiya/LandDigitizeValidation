import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, ShieldAlert, Clock, FileCheck } from 'lucide-react';

export default function StatusBadge({ status }) {
  if (!status) return null;

  switch (status) {
    case 'Application Checks Passed':
      return (
        <span className="badge badge-success">
          <CheckCircle2 size={12} />
          Checks Passed
        </span>
      );

    case 'Needs Review':
      return (
        <span className="badge badge-warning">
          <AlertTriangle size={12} />
          Needs Review
        </span>
      );

    case 'Incomplete':
      return (
        <span className="badge badge-danger">
          <AlertCircle size={12} />
          Incomplete
        </span>
      );

    case 'Conflict Detected':
      return (
        <span className="badge badge-danger" style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#f87171' }}>
          <ShieldAlert size={12} />
          Conflict Detected
        </span>
      );

    case 'DRAFT':
    case 'draft':
      return (
        <span className="badge badge-neutral">
          <Clock size={12} />
          Draft
        </span>
      );

    case 'PENDING VERIFICATION':
      return (
        <span className="badge badge-warning" style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>
          <Clock size={12} />
          Pending Verification
        </span>
      );

    case 'FLAGGED FOR REVIEW':
      return (
        <span className="badge badge-danger" style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#f87171' }}>
          <ShieldAlert size={12} />
          Flagged for Review
        </span>
      );

    case 'VERIFICATION COMPLETED':
      return (
        <span className="badge badge-success" style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' }}>
          <CheckCircle2 size={12} />
          Verification Completed
        </span>
      );

    case 'REGISTERED':
      return (
        <span className="badge badge-primary" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', borderColor: '#a5b4fc' }}>
          <FileCheck size={12} />
          Registered
        </span>
      );

    case 'SUBMITTED FOR REVIEW':
    case 'Submitted for Review':
    case 'submitted_for_review':
      return (
        <span className="badge badge-info" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}>
          <Clock size={12} />
          Submitted for Review
        </span>
      );

    case 'under_review':
      return (
        <span className="badge badge-warning">
          <Clock size={12} />
          Under Review
        </span>
      );

    case 'finalized':
      return (
        <span className="badge badge-success">
          <FileCheck size={12} />
          Finalized
        </span>
      );

    case 'completed':
      return (
        <span className="badge badge-success">
          <CheckCircle2 size={12} />
          Digitized
        </span>
      );

    case 'pending':
      return (
        <span className="badge badge-neutral">
          <Clock size={12} />
          Processing
        </span>
      );

    case 'failed':
      return (
        <span className="badge badge-danger">
          <AlertCircle size={12} />
          Failed
        </span>
      );

    default:
      return <span className="badge badge-neutral">{status}</span>;
  }
}
