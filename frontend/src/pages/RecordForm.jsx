import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Upload,
  FileText,
  Eye,
  ExternalLink,
  ChevronRight,
  Info,
  Maximize2,
  Camera,
  UserCheck,
  Check,
  Lock,
  Smartphone
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';

export const TN_DISTRICTS = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
  'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Karur', 'Krishnagiri',
  'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur',
  'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi',
  'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur',
  'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'
];

export const DOCUMENT_TYPES = [
  'Patta',
  'Chitta',
  'Adangal',
  'Sale Deed',
  'Gift Deed',
  'Partition Deed',
  'Settlement Deed',
  'Release Deed',
  'Exchange Deed',
  'Other'
];

export const OWNERSHIP_TYPES = [
  'Sole Ownership',
  'Joint Ownership',
  'Coparcenary',
  'Partnership',
  'Trust / Society',
  'Corporate / Company'
];

export const TRANSFER_MODES = [
  'Purchase / Sale Deed',
  'Inheritance / Legal Heir Succession',
  'Gift Deed',
  'Family Settlement Deed',
  'Partition Deed',
  'Court Decree / Order',
  'Government Allotment / Assignment'
];

export const LAND_CLASSIFICATIONS = [
  'Wetland (Nanjai)',
  'Dryland (Punjai)',
  'Gramanatham (Natham)',
  'Poramboke (Assigned)',
  'Residential Layout / House Site',
  'Commercial Plot',
  'Industrial Land',
  'Agricultural'
];

export const LAND_USE_TYPES = [
  'Agricultural - Paddy / Cash Crop',
  'Agricultural - Plantation / Orchard',
  'Residential - Built-up House',
  'Residential - Vacant House Site',
  'Commercial - Retail / Office',
  'Industrial - Warehouse / Factory',
  'Mixed Use - Commercial / Residential',
  'Fallow / Uncultivated'
];

export const POSSESSION_STATUSES = [
  'Self-Occupied / In Possession',
  'Leased / Tenanted',
  'Mortgaged / Hypothecated',
  'Under Civil Litigation / Disputed',
  'Vacant / Unoccupied'
];

export const ENCUMBRANCE_STATUSES = [
  'Nil / No Encumbrance (Clean Title)',
  'Bank Mortgage / Hypothecated',
  'Under Court Attachment',
  'Government Acquisition Notice',
  'Lis Pendens / Pending Lawsuit'
];

export const DOC_CATEGORIES = [
  'Sale Deed',
  'Patta Extract',
  'Encumbrance Certificate (EC)',
  'Property Tax Receipt',
  'Cadastral Survey Sketch / FMB',
  'Identity Proof (Aadhaar/PAN)',
  'Legal Heirship Certificate',
  'Power of Attorney',
  'Other'
];

export const parseStoredMobile = (raw) => {
  if (!raw) return { code: '+91', number: '' };
  const str = String(raw).trim();
  const knownCodes = ['+91', '+1', '+44', '+971', '+65', '+60'];
  for (const kc of knownCodes) {
    if (str.startsWith(kc)) {
      return { code: kc, number: str.slice(kc.length).replace(/\D/g, '') };
    }
  }
  if (str.startsWith('+')) {
    const match = str.match(/^(\+\d{1,3})(\d+)$/);
    if (match) {
      return { code: match[1], number: match[2] };
    }
  }
  const digits = str.replace(/\D/g, '');
  if (digits.length === 10) {
    return { code: '+91', number: digits };
  }
  if (digits.length > 10) {
    return { code: '+' + digits.slice(0, digits.length - 10), number: digits.slice(-10) };
  }
  return { code: '+91', number: digits };
};

export default function RecordForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // Section A: Land Document Details
    document_type: 'Patta',
    document_reference: '',
    registration_date: '',
    patta_number: '',
    previous_doc_reference: '',
    issuing_authority: '',
    document_issue_date: '',

    // Section B: Owner & Ownership Details
    owner_name: '',
    previous_owner_name: '',
    number_of_owners: 1,
    ownership_type: 'Sole Ownership',
    co_owners: [],
    owner_address: '',
    transfer_details: 'Purchase / Sale Deed',
    aadhaar_number: '',
    aadhaar_masked: '',
    pan_number: '',
    pan_masked: '',
    owner_photo_id: null,
    owner_photo_url: '',
    owner_mobile: '',
    mobile_country_code: '+91',
    mobile_verification_status: 'Not Verified',
    owner_mobile_verified: 0,

    // Section C: Land Location & Revenue Details
    district: 'Coimbatore',
    taluk: '',
    village: '',
    panchayat_local_body: '',
    survey_number: '',
    subdivision_number: '',
    plot_number: '',
    land_address: '',

    // Section D: Land Measurement & Classification
    land_area: '',
    land_unit: 'sq.ft',
    land_classification: 'Wetland (Nanjai)',
    wetland_dryland: 'Wetland (Nanjai)',
    land_use_type: 'Agricultural - Paddy / Cash Crop',
    possession_status: 'Self-Occupied / In Possession',
    encumbrance_status: 'Nil / No Encumbrance (Clean Title)',
    property_tax_reference: '',

    // Section E: Land Boundary Details
    boundary_north: '',
    boundary_south: '',
    boundary_east: '',
    boundary_west: '',
    adjacent_survey_numbers: '',
    access_road_details: '',

    // Section F: Supporting Documents
    supporting_documents: [],
    source_document_id: null,
  });

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  // Document Upload State
  const [selectedDocCategory, setSelectedDocCategory] = useState('Sale Deed');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [availableDocs, setAvailableDocs] = useState([]);
  const [previewDocId, setPreviewDocId] = useState(null);

  // Verification Result Modal State
  const [verificationResult, setVerificationResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Owner Identity, Photo & OTP Verification State
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSentOnce, setOtpSentOnce] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [devOtpCode, setDevOtpCode] = useState('');

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);

  const [aadhaarValidation, setAadhaarValidation] = useState({ isValid: true, message: '' });
  const [panValidation, setPanValidation] = useState({ isValid: true, message: '' });

  // Cooldown countdown effect
  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Load existing record for edit mode
  useEffect(() => {
    if (isEdit) {
      const fetchRecord = async () => {
        try {
          setLoading(true);
          const res = await api.records.get(id);
          const rec = res.record;

          if (rec.owner_photo_url) {
            setPhotoPreview(rec.owner_photo_url);
          }

          const { code: parsedCode, number: parsedNumber } = parseStoredMobile(rec.owner_mobile);

          setFormData({
            document_type: rec.document_type || 'Patta',
            document_reference: rec.document_reference || '',
            registration_date: rec.registration_date || '',
            patta_number: rec.patta_number || '',
            previous_doc_reference: rec.previous_doc_reference || '',
            issuing_authority: rec.issuing_authority || '',
            document_issue_date: rec.document_issue_date || '',

            owner_name: rec.owner_name || '',
            previous_owner_name: rec.previous_owner_name || '',
            number_of_owners: rec.number_of_owners || 1,
            ownership_type: rec.ownership_type || 'Sole Ownership',
            co_owners: Array.isArray(rec.co_owners) ? rec.co_owners : [],
            owner_address: rec.owner_address || '',
            transfer_details: rec.transfer_details || 'Purchase / Sale Deed',
            aadhaar_number: '',
            aadhaar_masked: rec.aadhaar_masked || '',
            pan_number: '',
            pan_masked: rec.pan_masked || '',
            owner_photo_id: rec.owner_photo_id || null,
            owner_photo_url: rec.owner_photo_url || '',
            owner_mobile: parsedNumber,
            mobile_country_code: parsedCode || '+91',
            mobile_verification_status: rec.mobile_verification_status || 'Not Verified',
            owner_mobile_verified: rec.owner_mobile_verified || 0,

            district: rec.district || 'Coimbatore',
            taluk: rec.taluk || '',
            village: rec.village || '',
            panchayat_local_body: rec.panchayat_local_body || '',
            survey_number: rec.survey_number || '',
            subdivision_number: rec.subdivision_number || '',
            plot_number: rec.plot_number || '',
            land_address: rec.land_address || '',

            land_area: rec.land_area != null ? rec.land_area : '',
            land_unit: rec.land_unit || 'sq.ft',
            land_classification: rec.land_classification || 'Wetland (Nanjai)',
            wetland_dryland: rec.wetland_dryland || 'Wetland (Nanjai)',
            land_use_type: rec.land_use_type || 'Agricultural - Paddy / Cash Crop',
            possession_status: rec.possession_status || 'Self-Occupied / In Possession',
            encumbrance_status: rec.encumbrance_status || 'Nil / No Encumbrance (Clean Title)',
            property_tax_reference: rec.property_tax_reference || '',

            boundary_north: rec.boundary_north || '',
            boundary_south: rec.boundary_south || '',
            boundary_east: rec.boundary_east || '',
            boundary_west: rec.boundary_west || '',
            adjacent_survey_numbers: rec.adjacent_survey_numbers || '',
            access_road_details: rec.access_road_details || '',

            supporting_documents: Array.isArray(rec.supporting_documents) ? rec.supporting_documents : [],
            source_document_id: rec.source_document_id || null,
          });
        } catch (err) {
          setError('Failed to fetch existing record: ' + (err.message || 'Server error'));
        } finally {
          setLoading(false);
        }
      };
      fetchRecord();
    }
  }, [id, isEdit]);

  // Load existing digitized documents for quick linking
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await api.documents.list();
        setAvailableDocs(res.documents || []);
      } catch (err) {
        console.warn('Could not fetch existing document library:', err);
      }
    };
    fetchDocs();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Aadhaar input formatting (adds spaces every 4 digits) & validation
  const handleAadhaarChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    // Format as 1234 5678 9012
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setFormData((prev) => ({ ...prev, aadhaar_number: formatted }));

    if (!raw) {
      setAadhaarValidation({ isValid: true, message: '' });
    } else if (raw.length === 12) {
      setAadhaarValidation({ isValid: true, message: 'Valid 12-digit Aadhaar' });
    } else {
      setAadhaarValidation({ isValid: false, message: `Aadhaar must be 12 numeric digits (${raw.length}/12)` });
    }
  };

  // PAN input formatting (converts to uppercase) & regex validation
  const handlePanChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, pan_number: val }));

    if (!val) {
      setPanValidation({ isValid: true, message: '' });
    } else if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
      setPanValidation({ isValid: true, message: 'Valid PAN format' });
    } else {
      setPanValidation({ isValid: false, message: 'Pattern: 5 uppercase letters, 4 numbers, 1 letter (e.g. ABCDE1234F)' });
    }
  };

  // Passport photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validExtensions = ['jpg', 'jpeg', 'png'];
    const fileExt = file.name ? file.name.split('.').pop().toLowerCase() : '';

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
      setPhotoError('Invalid format. Only JPG, JPEG, and PNG passport-size photographs are accepted.');
      setPhotoSuccess('');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photograph size exceeds maximum limit of 5 MB.');
      setPhotoSuccess('');
      return;
    }

    try {
      setPhotoUploading(true);
      setPhotoError('');
      setPhotoSuccess('');
      const res = await api.records.uploadOwnerPhoto(file);
      setFormData((prev) => ({
        ...prev,
        owner_photo_id: res.photo_id,
        owner_photo_url: res.photo_url,
      }));
      setPhotoPreview(res.photo_url);
      setPhotoSuccess('Photograph uploaded successfully!');
    } catch (err) {
      setPhotoError(err.message || 'Failed to upload photo. Please check CSRF token or file size.');
      setPhotoSuccess('');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({
      ...prev,
      owner_photo_id: null,
      owner_photo_url: '',
    }));
    setPhotoPreview(null);
    setPhotoError('');
    setPhotoSuccess('');
  };

  // Mobile OTP: Send
  const handleSendOtp = async () => {
    const rawDigits = (formData.owner_mobile || '').replace(/\D/g, '');
    if (!rawDigits || rawDigits.length < 10) {
      setOtpError('Please enter a valid 10-digit mobile number before requesting an OTP.');
      return;
    }

    const fullMobile = `${formData.mobile_country_code || '+91'}${rawDigits.slice(-10)}`;
    setOtpSending(true);
    setOtpError('');
    setOtpMessage('');

    try {
      const res = await api.otp.send(fullMobile);
      setOtpSentOnce(true);
      setOtpCooldown(res.cooldown_seconds || 60);
      setFormData((prev) => ({
        ...prev,
        mobile_verification_status: 'OTP Sent',
      }));
      setOtpMessage(res.message || `OTP sent successfully to ${fullMobile}.`);
      if (res.dev_otp) {
        setDevOtpCode(res.dev_otp);
      }
    } catch (err) {
      setOtpError(err.message || 'Failed to send verification OTP.');
      setFormData((prev) => ({
        ...prev,
        mobile_verification_status: err.status === 503 ? 'Not Configured' : 'Verification Failed',
      }));
    } finally {
      setOtpSending(false);
    }
  };

  // Mobile OTP: Verify
  const handleVerifyOtp = async () => {
    const code = (otpCode || '').replace(/\D/g, '');
    if (code.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }

    const rawDigits = (formData.owner_mobile || '').replace(/\D/g, '');
    const fullMobile = `${formData.mobile_country_code || '+91'}${rawDigits.slice(-10)}`;
    setOtpVerifying(true);
    setOtpError('');
    setOtpMessage('');

    try {
      await api.otp.verify(fullMobile, code);
      setFormData((prev) => ({
        ...prev,
        mobile_verification_status: 'Verified',
        owner_mobile_verified: 1,
      }));
      setOtpMessage('✓ Mobile number successfully verified!');
      setOtpCode('');
      setDevOtpCode('');
    } catch (err) {
      setOtpError(err.message || 'Invalid or expired OTP code.');
      setFormData((prev) => ({
        ...prev,
        mobile_verification_status: 'Verification Failed',
        owner_mobile_verified: 0,
      }));
    } finally {
      setOtpVerifying(false);
    }
  };

  // Co-Owners dynamic row management
  const handleAddCoOwner = () => {
    setFormData((prev) => ({
      ...prev,
      co_owners: [
        ...prev.co_owners,
        { name: '', share_percentage: '', relationship: '', id_reference: '' }
      ],
      number_of_owners: Math.max(2, prev.co_owners.length + 2)
    }));
  };

  const handleRemoveCoOwner = (index) => {
    setFormData((prev) => {
      const updated = prev.co_owners.filter((_, i) => i !== index);
      return {
        ...prev,
        co_owners: updated,
        number_of_owners: Math.max(1, updated.length + 1)
      };
    });
  };

  const handleCoOwnerChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.co_owners];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, co_owners: updated };
    });
  };

  // Co-owners share percentage sum calculator
  const totalCoOwnerShare = formData.co_owners.reduce((acc, curr) => {
    const val = parseFloat(curr.share_percentage);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Document Upload Handler (<= 16MB)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      setError('Selected file exceeds maximum limit of 16MB.');
      e.target.value = '';
      return;
    }

    try {
      setUploadingDoc(true);
      setError('');
      const uploadRes = await api.documents.upload(file);
      const newDocEntry = {
        file_id: uploadRes.document.id,
        filename: uploadRes.document.original_filename,
        category: selectedDocCategory,
        size_bytes: file.size,
        uploaded_at: new Date().toISOString()
      };

      setFormData((prev) => ({
        ...prev,
        source_document_id: prev.source_document_id || uploadRes.document.id,
        supporting_documents: [...prev.supporting_documents, newDocEntry]
      }));

      setSuccessMsg(`Document "${uploadRes.document.original_filename}" uploaded and attached as ${selectedDocCategory}.`);
    } catch (err) {
      setError('File upload failed: ' + (err.message || 'Server error'));
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleRemoveSupportingDoc = (index) => {
    setFormData((prev) => ({
      ...prev,
      supporting_documents: prev.supporting_documents.filter((_, i) => i !== index)
    }));
  };

  const handleLinkExistingDoc = (docId) => {
    const found = availableDocs.find((d) => String(d.id) === String(docId));
    if (!found) return;

    if (formData.supporting_documents.some((d) => String(d.file_id) === String(docId))) {
      return;
    }

    const docEntry = {
      file_id: found.id,
      filename: found.original_filename,
      category: 'Digitized Title Record',
      size_bytes: found.file_size || 0,
      uploaded_at: found.created_at
    };

    setFormData((prev) => ({
      ...prev,
      source_document_id: found.id,
      supporting_documents: [...prev.supporting_documents, docEntry]
    }));
  };

  // Form Submission: Draft vs. Validate and Save
  const handleSaveDraft = async () => {
    setError('');
    setSavingDraft(true);

    try {
      const rawDigits = (formData.owner_mobile || '').replace(/\D/g, '');
      const fullMobile = rawDigits
        ? `${formData.mobile_country_code || '+91'}${rawDigits.slice(-10)}`
        : '';

      const payload = {
        ...formData,
        is_draft: true,
        registration_status: 'DRAFT',
        owner_mobile: fullMobile,
        land_area: formData.land_area !== '' && !isNaN(formData.land_area) ? parseFloat(formData.land_area) : 0.0,
      };

      let res;
      if (isEdit) {
        res = await api.records.update(id, payload);
      } else {
        res = await api.records.create(payload);
      }

      const refNo = formData.document_reference || res?.application_number || 'Draft';
      navigate('/records', {
        state: {
          successMessage: `Draft land record saved successfully (${refNo}). You can reopen and edit this draft at any time.`
        }
      });
    } catch (err) {
      setError('Draft save error: ' + (err.message || 'Operation failed'));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleValidateAndSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');

    const errors = {};

    // Validate Section A: Land Document Details
    if (!formData.document_reference?.trim()) {
      errors.document_reference = 'Document / Deed Number is required.';
    }

    // Validate Section B: Owner & Ownership Details
    if (!formData.owner_name?.trim()) {
      errors.owner_name = 'Owner Legal Name is required.';
    }
    if (formData.owner_mobile) {
      const cleanDigits = formData.owner_mobile.replace(/\D/g, '');
      if (cleanDigits.length !== 10) {
        errors.owner_mobile = 'Please enter a valid 10-digit mobile number (e.g. 9876543210).';
      }
    }
    if (formData.ownership_type === 'Joint Ownership' && formData.co_owners.length > 0) {
      if (Math.abs(totalCoOwnerShare - 100.0) > 0.1) {
        errors.co_owners = `Joint ownership share allocation must exactly equal 100%. Current sum: ${totalCoOwnerShare.toFixed(1)}%.`;
      }
    }

    // Validate Section C: Location & Revenue Details
    if (!formData.district?.trim()) {
      errors.district = 'Revenue District is required.';
    }
    if (!formData.taluk?.trim()) {
      errors.taluk = 'Taluk / Tehsil is required.';
    }
    if (!formData.village?.trim()) {
      errors.village = 'Revenue Village is required.';
    }
    if (!formData.survey_number?.trim()) {
      errors.survey_number = 'Cadastral Survey Number is mandatory.';
    }

    // Validate Section D: Extent / Area
    if (formData.land_area === '' || isNaN(formData.land_area) || parseFloat(formData.land_area) <= 0) {
      errors.land_area = 'Please provide a valid positive land extent / area.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please resolve all highlighted field-specific errors before saving.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const rawDigits = (formData.owner_mobile || '').replace(/\D/g, '');
      const fullMobile = rawDigits
        ? `${formData.mobile_country_code || '+91'}${rawDigits.slice(-10)}`
        : '';

      const payload = {
        ...formData,
        is_draft: false,
        registration_status: 'Submitted for Review',
        owner_mobile: fullMobile,
        land_area: parseFloat(formData.land_area),
      };

      let resultData;
      if (isEdit) {
        resultData = await api.records.update(id, payload);
      } else {
        resultData = await api.records.create(payload);
      }

      const docDisplay = formData.document_reference || resultData?.application_number || 'Record';
      navigate('/records', {
        state: {
          successMessage: `Land record "${docDisplay}" successfully validated and submitted for review!`
        }
      });
    } catch (err) {
      setError(err.message || 'Validation and land record submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAndSubmit = handleValidateAndSave;

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading parcel cadastral details...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top back link and header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Link to="/records" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex' }}>
          <ArrowLeft size={14} />
          <span>Back to Land Records</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mandatory Verification Workflow
          </span>
          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
            Multi-Factor Validation Active
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isEdit ? 'Update & Re-Verify Land Parcel' : 'Register Land Parcel'}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Submit comprehensive land parcel parameters. All entries undergo 12-point automated verification before registration.
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ margin: '1rem 0' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success" style={{ margin: '1rem 0' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleValidateAndSave} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* =========================================================================
              SECTION A: Land Document Details
             ========================================================================= */}
          <div className="form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <span className="badge badge-primary" style={{ fontWeight: 700 }}>A</span>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Land Document Details
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="document_type">
                  Document Type <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  id="document_type"
                  name="document_type"
                  className="form-control"
                  value={formData.document_type}
                  onChange={handleChange}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="document_reference">
                  Document / Deed Number <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  id="document_reference"
                  name="document_reference"
                  type="text"
                  className="form-control"
                  placeholder="e.g. DOC-2024-CBE-1092"
                  value={formData.document_reference}
                  onChange={handleChange}
                  style={{ borderColor: fieldErrors.document_reference ? 'var(--error)' : undefined }}
                />
                {fieldErrors.document_reference && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.document_reference}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="registration_date">
                  Registration Date
                </label>
                <input
                  id="registration_date"
                  name="registration_date"
                  type="date"
                  className="form-control"
                  value={formData.registration_date}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="patta_number">
                  Patta Number
                </label>
                <input
                  id="patta_number"
                  name="patta_number"
                  type="text"
                  className="form-control"
                  placeholder="e.g. PAT-49120-TN"
                  value={formData.patta_number}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="previous_doc_reference">
                  Previous Document Reference / Parent Doc No
                </label>
                <input
                  id="previous_doc_reference"
                  name="previous_doc_reference"
                  type="text"
                  className="form-control"
                  placeholder="e.g. DOC-2018-CBE-0442"
                  value={formData.previous_doc_reference}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="issuing_authority">
                  Issuing Authority / Registration Office
                </label>
                <input
                  id="issuing_authority"
                  name="issuing_authority"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Sub-Registrar Office, Gandhipuram"
                  value={formData.issuing_authority}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="document_issue_date">
                  Document Issue Date
                </label>
                <input
                  id="document_issue_date"
                  name="document_issue_date"
                  type="date"
                  className="form-control"
                  value={formData.document_issue_date}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          {/* =========================================================================
              SECTION B: Owner and Ownership Details
             ========================================================================= */}
          <div className="form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <span className="badge badge-primary" style={{ fontWeight: 700 }}>B</span>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Owner and Ownership Details
              </h3>
            </div>

            {/* Passport Photograph Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                padding: '1rem',
                backgroundColor: 'var(--bg-surface-alt)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                marginBottom: '1.25rem',
                flexWrap: 'wrap'
              }}
            >
              {/* Photo Avatar Preview */}
              <div style={{ position: 'relative', width: '84px', height: '100px', flexShrink: 0 }}>
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Owner Passport Photo"
                    style={{
                      width: '84px',
                      height: '100px',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px solid var(--primary)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '84px',
                      height: '100px',
                      borderRadius: 'var(--radius-sm)',
                      border: '2px dashed var(--border)',
                      backgroundColor: 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.7rem',
                      textAlign: 'center',
                      padding: '0.25rem'
                    }}
                  >
                    <Camera size={24} style={{ marginBottom: '0.25rem', opacity: 0.7 }} />
                    <span>Passport Photo</span>
                  </div>
                )}
              </div>

              {/* Photo Upload Controls */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    Passport-Size Photograph
                  </h4>
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>JPG / PNG Max 5MB</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                  Official applicant photograph securely bound with the digital registration deed and verified application.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <label
                    className="btn btn-outline btn-sm"
                    style={{
                      cursor: photoUploading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      opacity: photoUploading ? 0.7 : 1
                    }}
                  >
                    <Upload size={14} />
                    <span>{photoUploading ? 'Uploading...' : (photoPreview ? 'Replace Photo' : 'Upload Passport Photo')}</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      style={{ display: 'none' }}
                      onChange={handlePhotoUpload}
                      disabled={photoUploading}
                    />
                  </label>

                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="btn btn-outline btn-sm"
                      style={{ color: 'var(--error)', borderColor: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {photoError && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertCircle size={13} />
                    <span>{photoError}</span>
                  </div>
                )}

                {photoSuccess && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={13} />
                    <span>{photoSuccess}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="owner_name">
                  Owner Legal Name <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  id="owner_name"
                  name="owner_name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rajesh Kumar"
                  value={formData.owner_name}
                  onChange={handleChange}
                  style={{ borderColor: fieldErrors.owner_name ? 'var(--error)' : undefined }}
                />
                {fieldErrors.owner_name && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.owner_name}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="previous_owner_name">
                  Previous Owner / Vendor Name
                </label>
                <input
                  id="previous_owner_name"
                  name="previous_owner_name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. S. Arumugam"
                  value={formData.previous_owner_name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ownership_type">
                  Ownership Type <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  id="ownership_type"
                  name="ownership_type"
                  className="form-control"
                  value={formData.ownership_type}
                  onChange={handleChange}
                >
                  {OWNERSHIP_TYPES.map((ot) => (
                    <option key={ot} value={ot}>{ot}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="transfer_details">
                  Mode of Acquisition / Transfer
                </label>
                <select
                  id="transfer_details"
                  name="transfer_details"
                  className="form-control"
                  value={formData.transfer_details}
                  onChange={handleChange}
                >
                  {TRANSFER_MODES.map((tm) => (
                    <option key={tm} value={tm}>{tm}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="owner_address">
                  Owner Communication / Permanent Address
                </label>
                <input
                  id="owner_address"
                  name="owner_address"
                  type="text"
                  className="form-control"
                  placeholder="e.g. No. 42, Avinashi Road, Peelamedu, Coimbatore - 641004"
                  value={formData.owner_address}
                  onChange={handleChange}
                />
              </div>

              {/* Aadhaar Number */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" htmlFor="aadhaar_number" style={{ margin: 0 }}>
                    Aadhaar Number <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Lock size={11} /> Masked & Salted
                  </span>
                </div>
                <input
                  id="aadhaar_number"
                  name="aadhaar_number"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 1234 5678 9012"
                  value={formData.aadhaar_number}
                  onChange={handleAadhaarChange}
                  maxLength={14}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.05em',
                    borderColor: aadhaarValidation.message ? (aadhaarValidation.isValid ? 'var(--success)' : 'var(--error)') : undefined
                  }}
                />
                {formData.aadhaar_masked && !formData.aadhaar_number && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Registered: <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{formData.aadhaar_masked}</code>
                  </div>
                )}
                {aadhaarValidation.message && (
                  <div style={{ fontSize: '0.72rem', marginTop: '0.25rem', color: aadhaarValidation.isValid ? 'var(--success)' : 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {aadhaarValidation.isValid ? <Check size={12} /> : <AlertCircle size={12} />}
                    <span>{aadhaarValidation.message}</span>
                  </div>
                )}
              </div>

              {/* PAN Card Number */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" htmlFor="pan_number" style={{ margin: 0 }}>
                    PAN Card Number <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(Optional)</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Lock size={11} /> Format Verified
                  </span>
                </div>
                <input
                  id="pan_number"
                  name="pan_number"
                  type="text"
                  className="form-control"
                  placeholder="e.g. ABCDE1234F"
                  value={formData.pan_number}
                  onChange={handlePanChange}
                  maxLength={10}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderColor: panValidation.message ? (panValidation.isValid ? 'var(--success)' : 'var(--error)') : undefined
                  }}
                />
                {formData.pan_masked && !formData.pan_number && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Registered: <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{formData.pan_masked}</code>
                  </div>
                )}
                {panValidation.message && (
                  <div style={{ fontSize: '0.72rem', marginTop: '0.25rem', color: panValidation.isValid ? 'var(--success)' : 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {panValidation.isValid ? <Check size={12} /> : <AlertCircle size={12} />}
                    <span>{panValidation.message}</span>
                  </div>
                )}
              </div>

              {/* Mobile Number & Two-Factor OTP Verification Card */}
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: '1rem 1.15rem',
                  backgroundColor: 'var(--bg-surface-alt)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  marginTop: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Smartphone size={16} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                      Owner Mobile Number & OTP Verification
                    </h4>
                  </div>

                  {/* Verification Status Badge */}
                  {formData.mobile_verification_status === 'Verified' ? (
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                      <Check size={12} /> Verified Mobile
                    </span>
                  ) : formData.mobile_verification_status === 'OTP Sent' ? (
                    <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                      <Clock size={12} /> OTP Dispatched
                    </span>
                  ) : formData.mobile_verification_status === 'Verification Failed' ? (
                    <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                      <AlertTriangle size={12} /> Verification Failed
                    </span>
                  ) : (
                    <span className="badge badge-neutral" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                      Not Verified
                    </span>
                  )}
                </div>

                {/* Mobile Input & Send OTP Button */}
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.65rem', alignItems: 'center' }}>
                  <select
                    name="mobile_country_code"
                    value={formData.mobile_country_code || '+91'}
                    onChange={handleChange}
                    className="form-control"
                    style={{ width: '90px', padding: '0.45rem 0.5rem' }}
                    disabled={formData.mobile_verification_status === 'Verified'}
                  >
                    <option value="+91">+91 (IN)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+971">+971 (UAE)</option>
                    <option value="+65">+65 (SG)</option>
                    <option value="+60">+60 (MY)</option>
                  </select>

                  <input
                    id="owner_mobile"
                    type="tel"
                    name="owner_mobile"
                    className="form-control"
                    placeholder="Enter 10-digit mobile (e.g. 9876543210)"
                    value={formData.owner_mobile || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData((prev) => ({
                        ...prev,
                        owner_mobile: val,
                        mobile_verification_status: prev.mobile_verification_status === 'Verified' ? 'Not Verified' : prev.mobile_verification_status,
                        owner_mobile_verified: prev.mobile_verification_status === 'Verified' ? 0 : prev.owner_mobile_verified
                      }));
                      if (fieldErrors.owner_mobile) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.owner_mobile;
                          return next;
                        });
                      }
                    }}
                    disabled={formData.mobile_verification_status === 'Verified'}
                    style={{ borderColor: fieldErrors.owner_mobile ? 'var(--error)' : undefined }}
                  />

                  {formData.mobile_verification_status === 'Verified' ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          mobile_verification_status: 'Not Verified',
                          owner_mobile_verified: 0
                        }));
                        setOtpSentOnce(false);
                        setOtpMessage('');
                        setOtpError('');
                      }}
                    >
                      Change Number
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSendOtp}
                      disabled={otpSending || otpCooldown > 0 || !formData.owner_mobile}
                      style={{ minWidth: '110px' }}
                    >
                      {otpSending ? 'Sending...' : (otpCooldown > 0 ? `Resend (${otpCooldown}s)` : (otpSentOnce ? 'Resend OTP' : 'Send OTP'))}
                    </button>
                  )}
                </div>

                {fieldErrors.owner_mobile && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.owner_mobile}</span>
                  </div>
                )}

                {/* OTP Entry & Verification Controls */}
                {otpSentOnce && formData.mobile_verification_status !== 'Verified' && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ flex: '0 0 auto' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                        Enter 6-Digit OTP:
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="••••••"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        style={{
                          width: '130px',
                          textAlign: 'center',
                          fontSize: '1.1rem',
                          letterSpacing: '0.2em',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700
                        }}
                      />
                    </div>

                    <div style={{ alignSelf: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || otpCode.length !== 6}
                        style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Check size={14} />
                        <span>{otpVerifying ? 'Verifying...' : 'Verify OTP'}</span>
                      </button>
                    </div>

                    {devOtpCode && (
                      <div
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.4rem 0.65rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <Info size={14} style={{ color: 'var(--primary)' }} />
                        <span>Dev Mode OTP: <strong style={{ fontFamily: 'var(--font-mono)' }}>{devOtpCode}</strong></span>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem', height: 'auto' }}
                          onClick={() => setOtpCode(devOtpCode)}
                        >
                          Auto-fill
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Messages */}
                {otpMessage && (
                  <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={14} />
                    <span>{otpMessage}</span>
                  </div>
                )}

                {otpError && (
                  <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertCircle size={14} />
                    <span>{otpError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Co-Owners Schedule (For Joint Ownership or Multi-owner) */}
            {formData.ownership_type !== 'Sole Ownership' && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-surface-alt)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Co-Owners Schedule & Share Distribution
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Specify legal co-owners and percentage allocations. Must tally to exactly 100%.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: Math.abs(totalCoOwnerShare - 100.0) < 0.1 ? 'var(--success)' : 'var(--error)'
                      }}
                    >
                      Total Share: {totalCoOwnerShare.toFixed(1)}% {Math.abs(totalCoOwnerShare - 100.0) < 0.1 ? '✓' : '(Must = 100%)'}
                    </span>

                    <button
                      type="button"
                      onClick={handleAddCoOwner}
                      className="btn btn-secondary btn-sm"
                    >
                      <Plus size={14} />
                      <span>Add Co-Owner</span>
                    </button>
                  </div>
                </div>

                {formData.co_owners.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                    No co-owners added yet. Click "+ Add Co-Owner" to define ownership shares.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {formData.co_owners.map((co, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr auto',
                          gap: '0.5rem',
                          alignItems: 'center',
                          backgroundColor: 'var(--bg-surface)',
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Co-Owner Full Legal Name"
                          value={co.name}
                          onChange={(e) => handleCoOwnerChange(idx, 'name', e.target.value)}
                          required
                        />

                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            className="form-control form-control-sm"
                            placeholder="Share %"
                            value={co.share_percentage}
                            onChange={(e) => handleCoOwnerChange(idx, 'share_percentage', e.target.value)}
                            required
                          />
                        </div>

                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Relationship (e.g. Spouse)"
                          value={co.relationship}
                          onChange={(e) => handleCoOwnerChange(idx, 'relationship', e.target.value)}
                        />

                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Masked ID (XXXX-XXXX-4912)"
                          value={co.id_reference}
                          onChange={(e) => handleCoOwnerChange(idx, 'id_reference', e.target.value)}
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveCoOwner(idx)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--error)', padding: '0.4rem' }}
                          title="Remove co-owner"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          {/* =========================================================================
              SECTION C: Land Location & Revenue Details
             ========================================================================= */}
          <div className="form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <span className="badge badge-primary" style={{ fontWeight: 700 }}>C</span>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Land Location & Revenue Details
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="district">
                  Revenue District <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  id="district"
                  name="district"
                  className="form-control"
                  value={formData.district}
                  onChange={handleChange}
                  style={{ borderColor: fieldErrors.district ? 'var(--error)' : undefined }}
                >
                  {TN_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {fieldErrors.district && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.district}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="taluk">
                  Taluk <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  id="taluk"
                  name="taluk"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Coimbatore North"
                  value={formData.taluk}
                  onChange={handleChange}
                  style={{ borderColor: fieldErrors.taluk ? 'var(--error)' : undefined }}
                />
                {fieldErrors.taluk && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.taluk}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="village">
                  Revenue Village <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  id="village"
                  name="village"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Saravanampatti"
                  value={formData.village}
                  onChange={handleChange}
                  style={{ borderColor: fieldErrors.village ? 'var(--error)' : undefined }}
                />
                {fieldErrors.village && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.village}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="panchayat_local_body">
                  Gram Panchayat / Local Body
                </label>
                <input
                  id="panchayat_local_body"
                  name="panchayat_local_body"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Saravanampatti Town Panchayat"
                  value={formData.panchayat_local_body}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="survey_number">
                  Survey Number <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  id="survey_number"
                  name="survey_number"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 142"
                  value={formData.survey_number}
                  onChange={handleChange}
                  style={{ borderColor: fieldErrors.survey_number ? 'var(--error)' : undefined }}
                />
                {fieldErrors.survey_number && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.survey_number}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="subdivision_number">
                  Subdivision Number
                </label>
                <input
                  id="subdivision_number"
                  name="subdivision_number"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 3A"
                  value={formData.subdivision_number}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="plot_number">
                  Plot / Door No. / Street
                </label>
                <input
                  id="plot_number"
                  name="plot_number"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Plot No. 18, 2nd Cross"
                  value={formData.plot_number}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="land_address">
                  Land Address / Landmark
                </label>
                <input
                  id="land_address"
                  name="land_address"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Near Sathy Main Road Junction"
                  value={formData.land_address}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          {/* =========================================================================
              SECTION D: Land Measurement & Classification
             ========================================================================= */}
          <div className="form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <span className="badge badge-primary" style={{ fontWeight: 700 }}>D</span>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Land Measurement & Classification
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="land_area">
                  Land Extent / Area <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  id="land_area"
                  name="land_area"
                  type="number"
                  step="any"
                  min="0.001"
                  className="form-control"
                  placeholder="e.g. 2400"
                  value={formData.land_area}
                  onChange={handleChange}
                  style={{ borderColor: fieldErrors.land_area ? 'var(--error)' : undefined }}
                />
                {fieldErrors.land_area && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} />
                    <span>{fieldErrors.land_area}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="land_unit">
                  Measurement Unit <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <select
                  id="land_unit"
                  name="land_unit"
                  className="form-control"
                  value={formData.land_unit}
                  onChange={handleChange}
                >
                  <option value="sq.ft">Square Feet (sq.ft)</option>
                  <option value="cents">Cents</option>
                  <option value="acres">Acres</option>
                  <option value="sq.m">Square Meters (sq.m)</option>
                  <option value="hectares">Hectares</option>
                  <option value="grounds">Grounds (2400 sq.ft)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="land_classification">
                  Land Classification
                </label>
                <select
                  id="land_classification"
                  name="land_classification"
                  className="form-control"
                  value={formData.land_classification}
                  onChange={handleChange}
                >
                  {LAND_CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="wetland_dryland">
                  Wetland / Dryland Status
                </label>
                <select
                  id="wetland_dryland"
                  name="wetland_dryland"
                  className="form-control"
                  value={formData.wetland_dryland}
                  onChange={handleChange}
                >
                  <option value="Wetland (Nanjai)">Wetland (Nanjai)</option>
                  <option value="Dryland (Punjai)">Dryland (Punjai)</option>
                  <option value="Garden Land / Thottam">Garden Land / Thottam</option>
                  <option value="Non-Agricultural">Non-Agricultural</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="land_use_type">
                  Land Use Type
                </label>
                <select
                  id="land_use_type"
                  name="land_use_type"
                  className="form-control"
                  value={formData.land_use_type}
                  onChange={handleChange}
                >
                  {LAND_USE_TYPES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="possession_status">
                  Possession Status
                </label>
                <select
                  id="possession_status"
                  name="possession_status"
                  className="form-control"
                  value={formData.possession_status}
                  onChange={handleChange}
                >
                  {POSSESSION_STATUSES.map((ps) => (
                    <option key={ps} value={ps}>{ps}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="encumbrance_status">
                  Encumbrance Status
                </label>
                <select
                  id="encumbrance_status"
                  name="encumbrance_status"
                  className="form-control"
                  value={formData.encumbrance_status}
                  onChange={handleChange}
                >
                  {ENCUMBRANCE_STATUSES.map((es) => (
                    <option key={es} value={es}>{es}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="property_tax_reference">
                  Property Tax Receipt / Assessment No
                </label>
                <input
                  id="property_tax_reference"
                  name="property_tax_reference"
                  type="text"
                  className="form-control"
                  placeholder="e.g. TAX-2024-CBE-9821"
                  value={formData.property_tax_reference}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          {/* =========================================================================
              SECTION E: Land Boundary Details
             ========================================================================= */}
          <div className="form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <span className="badge badge-primary" style={{ fontWeight: 700 }}>E</span>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Land Boundary Schedule
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="boundary_north">
                  North Boundary
                </label>
                <input
                  id="boundary_north"
                  name="boundary_north"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Survey No. 141 & 30ft Road"
                  value={formData.boundary_north}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="boundary_south">
                  South Boundary
                </label>
                <input
                  id="boundary_south"
                  name="boundary_south"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Land belonging to S. Perumal"
                  value={formData.boundary_south}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="boundary_east">
                  East Boundary
                </label>
                <input
                  id="boundary_east"
                  name="boundary_east"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Survey No. 143 / Drainage canal"
                  value={formData.boundary_east}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="boundary_west">
                  West Boundary
                </label>
                <input
                  id="boundary_west"
                  name="boundary_west"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Panchayat 20ft pathway"
                  value={formData.boundary_west}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="adjacent_survey_numbers">
                  Adjacent Cadastral Survey Numbers
                </label>
                <input
                  id="adjacent_survey_numbers"
                  name="adjacent_survey_numbers"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 141, 143, 145"
                  value={formData.adjacent_survey_numbers}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="access_road_details">
                  Access Road / Pathway Details
                </label>
                <input
                  id="access_road_details"
                  name="access_road_details"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 30 Feet Tar Road on North Side"
                  value={formData.access_road_details}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          {/* =========================================================================
              SECTION F: Supporting Documents
             ========================================================================= */}
          <div className="form-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-primary" style={{ fontWeight: 700 }}>F</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Supporting Documents Upload & Link
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Max 16MB per file (PDF, PNG, JPG, JPEG)
              </span>
            </div>

            {/* Document Upload Controls */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                backgroundColor: 'var(--bg-surface-alt)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)'
              }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="doc_category_select">
                  Document Category
                </label>
                <select
                  id="doc_category_select"
                  className="form-control"
                  value={selectedDocCategory}
                  onChange={(e) => setSelectedDocCategory(e.target.value)}
                >
                  {DOC_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="doc_upload_input">
                  Upload Scanned Document
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="doc_upload_input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    disabled={uploadingDoc}
                    className="form-control"
                    style={{ padding: '0.35rem 0.5rem' }}
                  />
                  {uploadingDoc && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                      Uploading...
                    </span>
                  )}
                </div>
              </div>

              {availableDocs.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="link_stored_doc">
                    Or Link Stored LandAssist Document
                  </label>
                  <select
                    id="link_stored_doc"
                    className="form-control"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleLinkExistingDoc(e.target.value);
                    }}
                  >
                    <option value="" disabled>-- Select from repository --</option>
                    {availableDocs.map((d) => (
                      <option key={d.id} value={d.id}>
                        #{d.id} - {d.original_filename}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Attached Documents List */}
            {formData.supporting_documents.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Attached Documents ({formData.supporting_documents.length}):
                </span>

                {formData.supporting_documents.map((doc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      gap: '0.75rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={16} color="var(--primary)" />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {doc.filename}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Category: <strong>{doc.category}</strong>
                          {doc.size_bytes ? ` • ${(doc.size_bytes / 1024).toFixed(0)} KB` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {doc.file_id && (
                        <button
                          type="button"
                          onClick={() => setPreviewDocId(doc.file_id)}
                          className="btn btn-secondary btn-sm"
                          title="Preview Document"
                        >
                          <Eye size={13} />
                          <span>Preview</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveSupportingDoc(idx)}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--error)' }}
                        title="Remove Attached Document"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* =========================================================================
              ACTION FOOTER: Save Draft & Validate and Save Land Record
             ========================================================================= */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: 1.4 }}>
              <Info size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.25rem', color: 'var(--primary)' }} />
              <strong>Academic Project Notice:</strong> LandAssist AI is an independent student application. Saving a land record records cadastral data in the local SQLite database for AI validation and does not constitute official registration or submission to the Tamil Nadu Government.
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="btn btn-secondary"
                disabled={submitting || savingDraft}
                title="Save incomplete or partially filled details to SQLite database"
              >
                <Clock size={16} />
                <span>{savingDraft ? 'Saving Draft...' : 'Save as Draft'}</span>
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || savingDraft}
                title="Validate all required fields and save record for review"
              >
                <ShieldCheck size={16} />
                <span>{submitting ? 'Validating & Saving...' : 'Validate and Save Land Record'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* =========================================================================
          VERIFICATION RESULT MODAL
         ========================================================================= */}
      {verificationResult && (
        <Modal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          title={`Parcel Verification Report • ${verificationResult.application_number || 'Application'}`}
          maxWidth="780px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowResultModal(false)}
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate('/records')}
                >
                  View in Land Records
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setShowResultModal(false);
                    navigate('/validation', {
                      state: {
                        parcelApplication: {
                          record_id: verificationResult.record_id,
                          application_number: verificationResult.application_number,
                          registration_status: verificationResult.registration_status,
                          validation: verificationResult.validation,
                          formData: formData
                        }
                      }
                    });
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>Send to Validation Engine</span>
                </button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-surface-alt)',
                borderRadius: 'var(--radius)',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Application Reference</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                  {verificationResult.application_number}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Registration Status</div>
                <StatusBadge status={verificationResult.registration_status} />
              </div>
            </div>

            {/* Statutory Truth Disclaimer Banner */}
            <div
              className="alert alert-warning"
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                borderLeft: '4px solid var(--warning)'
              }}
            >
              <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Official Government Verification Notice:</strong>
                <br />
                Official government verification unavailable — manual verification required.
                Tamil Nadu Land Records portal (eservices.tn.gov.in) does not offer a public automated API.
                LandAssist does not fabricate government certification; cadastral consistency checks have been recorded locally.
              </div>
            </div>

            {/* Check Count Summary Chips */}
            {verificationResult.validation && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                <div style={{ padding: '0.6rem', textAlign: 'center', backgroundColor: 'var(--bg-surface-alt)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Checks</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {verificationResult.validation.total_checks || 12}
                  </div>
                </div>

                <div style={{ padding: '0.6rem', textAlign: 'center', backgroundColor: '#ecfdf5', borderRadius: 'var(--radius-sm)', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#065f46' }}>Passed</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669' }}>
                    {verificationResult.validation.passed_count || 0}
                  </div>
                </div>

                <div style={{ padding: '0.6rem', textAlign: 'center', backgroundColor: '#fffbeb', borderRadius: 'var(--radius-sm)', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Needs Review</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#d97706' }}>
                    {verificationResult.validation.review_count || 0}
                  </div>
                </div>

                <div style={{ padding: '0.6rem', textAlign: 'center', backgroundColor: '#fef2f2', borderRadius: 'var(--radius-sm)', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Failed</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>
                    {verificationResult.validation.failed_count || 0}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed 12 Checks List */}
            {verificationResult.validation?.checks && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Evaluation Breakdown (12 Multi-Factor Checks):
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {verificationResult.validation.checks.map((chk) => {
                    let badgeClass = 'badge-neutral';
                    if (chk.status === 'PASSED') badgeClass = 'badge-success';
                    else if (chk.status === 'NEEDS REVIEW') badgeClass = 'badge-warning';
                    else if (chk.status === 'FAILED') badgeClass = 'badge-danger';
                    else if (chk.status === 'NOT VERIFIED') badgeClass = 'badge-warning';

                    return (
                      <div
                        key={chk.id}
                        style={{
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-surface-alt)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            #{chk.id} {chk.name}
                          </span>
                          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.65rem' }}>
                            {chk.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                          {chk.summary}
                        </div>

                        {chk.explanation && (
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                            {chk.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Document Preview Modal */}
      {previewDocId && (
        <Modal
          isOpen={Boolean(previewDocId)}
          onClose={() => setPreviewDocId(null)}
          title="Attached Document Preview"
          maxWidth="850px"
        >
          <div style={{ minHeight: '450px' }}>
            <iframe
              src={api.documents.getPreviewUrl(previewDocId)}
              title="Attached Document"
              style={{ width: '100%', height: '520px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
