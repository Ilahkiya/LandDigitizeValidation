import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  FileSignature,
  Building2,
  Users,
  BadgeIndianRupee,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  FileText
} from 'lucide-react';
import { api } from '../services/api';

const TN_DISTRICTS = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
  'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram', 'Karur', 'Krishnagiri',
  'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur',
  'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi',
  'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur',
  'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'
];

export default function AgreementWizard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Wizard step: 1 (Property), 2 (Parties), 3 (Terms), 4 (Review & Generate)
  const [currentStep, setCurrentStep] = useState(1);
  const [agreementType, setAgreementType] = useState('sale');

  // Available saved records for quick selection
  const [savedRecords, setSavedRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');

  // Step 1: Property details
  const [property, setProperty] = useState({
    survey_number: '',
    subdivision_number: '',
    patta_number: '',
    district: 'Coimbatore',
    taluk: '',
    village: '',
    land_area: '',
    land_unit: 'sq.ft',
    document_reference: '',
  });

  // Step 2: Party details
  const [firstParty, setFirstParty] = useState({
    name: '',
    relation: '',
    address: '',
    id_proof: '',
    role: 'Vendor / Owner',
  });

  const [secondParty, setSecondParty] = useState({
    name: '',
    relation: '',
    address: '',
    id_proof: '',
    role: 'Purchaser / Buyer',
  });

  // Step 3: Terms & Considerations
  const [terms, setTerms] = useState({
    amount: '',
    advance_deposit: '',
    duration: '',
    possession_date: '',
    special_conditions: '',
  });

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch user records to populate selector
    const fetchRecords = async () => {
      try {
        const res = await api.records.list();
        setSavedRecords(res.records || []);

        // If navigated with state.recordId, select it automatically
        const passedId = location.state?.recordId;
        if (passedId) {
          const rec = (res.records || []).find((r) => r.id === passedId);
          if (rec) {
            setSelectedRecordId(String(rec.id));
            applyRecord(rec);
          }
        }
      } catch (err) {
        console.warn('Could not load user records for picker', err);
      }
    };
    fetchRecords();
  }, [location.state]);

  const applyRecord = (rec) => {
    setProperty({
      survey_number: rec.survey_number || '',
      subdivision_number: rec.subdivision_number || '',
      patta_number: rec.patta_number || '',
      district: rec.district || 'Coimbatore',
      taluk: rec.taluk || '',
      village: rec.village || '',
      land_area: rec.land_area || '',
      land_unit: rec.land_unit || 'sq.ft',
      document_reference: rec.document_reference || '',
    });
    setFirstParty((prev) => ({
      ...prev,
      name: rec.owner_name || prev.name,
    }));
  };

  const handleRecordSelectionChange = (e) => {
    const val = e.target.value;
    setSelectedRecordId(val);
    if (val) {
      const rec = savedRecords.find((r) => String(r.id) === val);
      if (rec) applyRecord(rec);
    }
  };

  // Update roles based on agreement type
  useEffect(() => {
    if (agreementType === 'sale') {
      setFirstParty((p) => ({ ...p, role: 'Vendor / Seller' }));
      setSecondParty((p) => ({ ...p, role: 'Purchaser / Buyer' }));
      setTerms((t) => ({
        ...t,
        duration: t.duration || '90 days from agreement date',
      }));
    } else if (agreementType === 'rental') {
      setFirstParty((p) => ({ ...p, role: 'Lessor / Landlord' }));
      setSecondParty((p) => ({ ...p, role: 'Lessee / Tenant' }));
      setTerms((t) => ({
        ...t,
        duration: t.duration || '11 months',
      }));
    } else if (agreementType === 'lease') {
      setFirstParty((p) => ({ ...p, role: 'Lessor' }));
      setSecondParty((p) => ({ ...p, role: 'Lessee' }));
      setTerms((t) => ({
        ...t,
        duration: t.duration || '5 years',
      }));
    }
  }, [agreementType]);

  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    try {
      const payload = {
        agreement_type: agreementType,
        record_id: selectedRecordId ? parseInt(selectedRecordId, 10) : null,
        property_details: property,
        first_party: firstParty,
        second_party: secondParty,
        terms: terms,
      };

      const res = await api.agreements.generate(payload);
      // Navigate directly into the rich editor for preview, editing, PDF export, and sharing
      navigate(`/agreements/${res.agreement_id}`);
    } catch (err) {
      setError(err.message || 'Agreement generation failed.');
      setGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>AI-Assisted Agreement Drafting Generator</h2>
          <p>Multi-step legal instrument generation for Sale, Rental, and Long-Term Lease agreements</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Stepper Indicator */}
      <div className="wizard-stepper">
        <div className={`wizard-step-node ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
          <div className="wizard-step-circle">{currentStep > 1 ? '✓' : '1'}</div>
          <span className="wizard-step-label">Property Details</span>
        </div>

        <div className={`wizard-step-node ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
          <div className="wizard-step-circle">{currentStep > 2 ? '✓' : '2'}</div>
          <span className="wizard-step-label">Executing Parties</span>
        </div>

        <div className={`wizard-step-node ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}`}>
          <div className="wizard-step-circle">{currentStep > 3 ? '✓' : '3'}</div>
          <span className="wizard-step-label">Financial & Terms</span>
        </div>

        <div className={`wizard-step-node ${currentStep === 4 ? 'active' : ''}`}>
          <div className="wizard-step-circle">4</div>
          <span className="wizard-step-label">Review & Generate</span>
        </div>
      </div>

      {/* STEP 1: Property Details */}
      {currentStep === 1 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Step 1: Select Agreement Type & Property Schedule</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Choose contract type and attach a saved land record or enter cadastre manually
              </p>
            </div>
          </div>

          {/* Agreement Type Picker */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Agreement Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.35rem' }}>
              <label
                style={{
                  border: `1.5px solid ${agreementType === 'sale' ? 'var(--primary)' : 'var(--border)'}`,
                  backgroundColor: agreementType === 'sale' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="agreementType"
                    value="sale"
                    checked={agreementType === 'sale'}
                    onChange={() => setAgreementType('sale')}
                  />
                  <strong style={{ color: 'var(--text-main)' }}>Sale Agreement</strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Immovable landed property conveyance draft
                </span>
              </label>

              <label
                style={{
                  border: `1.5px solid ${agreementType === 'rental' ? 'var(--primary)' : 'var(--border)'}`,
                  backgroundColor: agreementType === 'rental' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="agreementType"
                    value="rental"
                    checked={agreementType === 'rental'}
                    onChange={() => setAgreementType('rental')}
                  />
                  <strong style={{ color: 'var(--text-main)' }}>Rental Agreement</strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Residential or commercial premises tenancy
                </span>
              </label>

              <label
                style={{
                  border: `1.5px solid ${agreementType === 'lease' ? 'var(--primary)' : 'var(--border)'}`,
                  backgroundColor: agreementType === 'lease' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  padding: '1rem',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="agreementType"
                    value="lease"
                    checked={agreementType === 'lease'}
                    onChange={() => setAgreementType('lease')}
                  />
                  <strong style={{ color: 'var(--text-main)' }}>Lease Agreement</strong>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Long-term commercial or agricultural lease deed
                </span>
              </label>
            </div>
          </div>

          {/* Quick Select Saved Record */}
          {savedRecords.length > 0 && (
            <div className="form-group" style={{ backgroundColor: 'var(--bg-surface-alt)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="saved-record-picker">
                Pre-fill from Registered Land Record (Optional)
              </label>
              <select
                id="saved-record-picker"
                className="form-control"
                value={selectedRecordId}
                onChange={handleRecordSelectionChange}
              >
                <option value="">-- Or enter property schedule manually below --</option>
                {savedRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    Record #{r.id}: {r.owner_name} • Survey {r.survey_number}/{r.subdivision_number} ({r.village}, {r.district})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Property Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Survey Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 142"
                value={property.survey_number}
                onChange={(e) => setProperty({ ...property, survey_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subdivision</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 3A"
                value={property.subdivision_number}
                onChange={(e) => setProperty({ ...property, subdivision_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Patta Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. PAT-49120-TN"
                value={property.patta_number}
                onChange={(e) => setProperty({ ...property, patta_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Land Extent & Unit</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 2400"
                  value={property.land_area}
                  onChange={(e) => setProperty({ ...property, land_area: e.target.value })}
                />
                <select
                  className="form-control"
                  style={{ width: '110px' }}
                  value={property.land_unit}
                  onChange={(e) => setProperty({ ...property, land_unit: e.target.value })}
                >
                  <option value="sq.ft">sq.ft</option>
                  <option value="cents">cents</option>
                  <option value="acres">acres</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Revenue Village</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Saravanampatti"
                value={property.village}
                onChange={(e) => setProperty({ ...property, village: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Taluk</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Coimbatore North"
                value={property.taluk}
                onChange={(e) => setProperty({ ...property, taluk: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">District</label>
              <select
                className="form-control"
                value={property.district}
                onChange={(e) => setProperty({ ...property, district: e.target.value })}
              >
                {TN_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Title Deed Reference</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. DOC-SAMPLE-2024-001"
                value={property.document_reference}
                onChange={(e) => setProperty({ ...property, document_reference: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep(2)}
            >
              <span>Continue to Parties</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Executing Parties */}
      {currentStep === 2 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Step 2: Parties to the Agreement</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Provide full legal names, parentage/relation, address, and ID references
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {/* First Party (Vendor / Landlord) */}
            <div style={{ border: '1px solid var(--border)', padding: '1.25rem', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)', fontWeight: 700 }}>
                <Users size={18} />
                <span>FIRST PARTY ({firstParty.role})</span>
              </div>

              <div className="form-group">
                <label className="form-label">Full Legal Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rajesh Kumar"
                  value={firstParty.name}
                  onChange={(e) => setFirstParty({ ...firstParty, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parentage / Relation</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. S/o Late K. Ramasamy"
                  value={firstParty.relation}
                  onChange={(e) => setFirstParty({ ...firstParty, relation: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Residential Address</label>
                <textarea
                  className="form-control"
                  placeholder="Full permanent postal address"
                  value={firstParty.address}
                  onChange={(e) => setFirstParty({ ...firstParty, address: e.target.value })}
                  style={{ minHeight: '70px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">PAN / Aadhaar / Voter ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. ABCDE1234F"
                  value={firstParty.id_proof}
                  onChange={(e) => setFirstParty({ ...firstParty, id_proof: e.target.value })}
                />
              </div>
            </div>

            {/* Second Party (Purchaser / Tenant) */}
            <div style={{ border: '1px solid var(--border)', padding: '1.25rem', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)', fontWeight: 700 }}>
                <Users size={18} />
                <span>SECOND PARTY ({secondParty.role})</span>
              </div>

              <div className="form-group">
                <label className="form-label">Full Legal Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Karthik Narayanan"
                  value={secondParty.name}
                  onChange={(e) => setSecondParty({ ...secondParty, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parentage / Relation</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. S/o N. Narayanan"
                  value={secondParty.relation}
                  onChange={(e) => setSecondParty({ ...secondParty, relation: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Residential Address</label>
                <textarea
                  className="form-control"
                  placeholder="Full permanent postal address"
                  value={secondParty.address}
                  onChange={(e) => setSecondParty({ ...secondParty, address: e.target.value })}
                  style={{ minHeight: '70px' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">PAN / Aadhaar / Voter ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. FGHIJ5678K"
                  value={secondParty.id_proof}
                  onChange={(e) => setSecondParty({ ...secondParty, id_proof: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep(1)}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep(3)}
            >
              <span>Continue to Terms</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Financial Considerations & Covenants */}
      {currentStep === 3 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Step 3: Agreed Financial Terms & Duration</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Specify monetary values, timeline of execution, and specific conditions
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                {agreementType === 'sale' ? 'Total Sale Consideration (INR)' : 'Monthly Rent (INR)'}
              </label>
              <input
                type="text"
                className="form-control"
                placeholder={agreementType === 'sale' ? 'e.g. 45,00,000' : 'e.g. 15,000'}
                value={terms.amount}
                onChange={(e) => setTerms({ ...terms, amount: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {agreementType === 'sale' ? 'Advance Paid (INR)' : 'Security Deposit (INR)'}
              </label>
              <input
                type="text"
                className="form-control"
                placeholder={agreementType === 'sale' ? 'e.g. 5,00,000' : 'e.g. 1,00,000'}
                value={terms.advance_deposit}
                onChange={(e) => setTerms({ ...terms, advance_deposit: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                {agreementType === 'sale' ? 'Time for Final Registration' : 'Agreement Duration'}
              </label>
              <input
                type="text"
                className="form-control"
                placeholder={agreementType === 'sale' ? 'e.g. 90 days from agreement date' : 'e.g. 11 months'}
                value={terms.duration}
                onChange={(e) => setTerms({ ...terms, duration: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Possession / Handover Date</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Upon full payment of consideration"
                value={terms.possession_date}
                onChange={(e) => setTerms({ ...terms, possession_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '0.75rem' }}>
            <label className="form-label">Special Conditions & Custom Clauses (Optional)</label>
            <textarea
              className="form-control"
              placeholder="e.g. All legal stamp duty and registration expenses shall be borne by the Purchaser. Painting and maintenance responsibilities..."
              value={terms.special_conditions}
              onChange={(e) => setTerms({ ...terms, special_conditions: e.target.value })}
              style={{ minHeight: '90px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCurrentStep(2)}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep(4)}
            >
              <span>Review Draft Summary</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Summary Review & Generation */}
      {currentStep === 4 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Step 4: Review Agreement Parameters</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Verify facts before generating AI-assisted or structured template draft
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Summary Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', backgroundColor: 'var(--bg-surface-alt)', padding: '1.25rem', borderRadius: 'var(--radius)' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Instrument Type
                </span>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem', textTransform: 'capitalize' }}>
                  {agreementType} Agreement Draft
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Property Cadastre
                </span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  Survey {property.survey_number || '[Pending]'}/{property.subdivision_number || '[Pending]'}, {property.village || '[Pending]'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Parties
                </span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {firstParty.name || '[First Party]'} → {secondParty.name || '[Second Party]'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Agreed Financial Consideration
                </span>
                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  INR {terms.amount || '[Not entered]'} (Advance: INR {terms.advance_deposit || '[None]'})
                </div>
              </div>
            </div>

            {/* Statutory Disclaimer */}
            <div className="alert alert-warning" style={{ margin: '0.5rem 0' }}>
              <AlertCircle size={20} />
              <div style={{ fontSize: '0.8125rem' }}>
                <strong>Legal Drafting Notice:</strong> Generated documents are preparatory drafts. They do not constitute an officially registered transfer of immovable property under the Registration Act. Formal stamping and execution before the Sub-Registrar must be completed as required by law.
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentStep(3)}
                disabled={generating}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={generating}
                style={{ minWidth: '220px' }}
              >
                <Sparkles size={16} />
                <span>{generating ? 'Drafting Instrument...' : 'Generate Agreement Draft'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
