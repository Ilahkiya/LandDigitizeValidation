import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  MapPin,
  FileText,
  Search,
  AlertTriangle,
  Info
} from 'lucide-react';
import { api } from '../services/api';

export default function OfficialServices() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await api.official.getInfo();
        setData(res);
      } catch (err) {
        console.warn('Official info load error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, []);

  const services = data?.services || [
    {
      title: 'View Patta / Chitta Extract',
      description: 'Access rural and urban land register extracts by District, Taluk, Village, and Survey/Subdivision number.',
      url: 'https://eservices.tn.gov.in/eservicesnew/land/chitta.html?lan=en',
    },
    {
      title: 'Verify Patta / Chitta Copy',
      description: 'Authenticate web-issued Patta/Chitta copies using Reference Number printed on the certificate.',
      url: 'https://eservices.tn.gov.in/eservicesnew/land/verify_chitta.html?lan=en',
    },
    {
      title: 'View A-Register Extract',
      description: 'Inspect village A-Register detailing soil classification, tax assessment, and holding extent.',
      url: 'https://eservices.tn.gov.in/eservicesnew/land/areg.html?lan=en',
    },
    {
      title: 'FMB (Field Measurement Book) Sketch',
      description: 'View official parcel boundary maps and survey measurement sketches.',
      url: 'https://eservices.tn.gov.in/eservicesnew/land/fmb.html?lan=en',
    },
    {
      title: 'Application Status Tracking',
      description: 'Track the status of Patta transfer or subdivision applications online.',
      url: 'https://eservices.tn.gov.in/eservicesnew/land/patta_status.html?lan=en',
    },
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>Official Tamil Nadu Land Records Services</h2>
          <p>
            Direct access to official Government of Tamil Nadu e-Services for title verification and statutory extracts
          </p>
        </div>

        <a
          href="https://eservices.tn.gov.in/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          <ExternalLink size={16} />
          <span>Launch TN e-Services Portal</span>
        </a>
      </div>

      {/* Prominent Legal Disclaimer Banner */}
      <div className="alert alert-warning" style={{ borderLeftWidth: '5px' }}>
        <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
          <strong>IMPORTANT EXTERNAL SERVICE NOTICE & DISTINCTION:</strong>
          <br />
          The links provided on this page direct you to the official Government of Tamil Nadu Land Records e-Services portal (<strong>eservices.tn.gov.in</strong>).
          <br />
          <strong>LandAssist is an independent SaaS productivity tool.</strong> LandAssist does NOT claim direct server integration, official affiliation, or government certification. LandAssist validation scores represent internal document-quality and data-consistency checks. They do NOT substitute for certified copies issued by the Revenue Department or Registration Department.
        </div>
      </div>

      {/* Official Services Directory Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
        {services.map((srv, idx) => (
          <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                  External Government Service
                </span>
                <ExternalLink size={14} color="var(--text-subtle)" />
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                {srv.title}
              </h3>

              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {srv.description}
              </p>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <a
                href={srv.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Open Service in New Window</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Verification Protocol Guide */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} color="var(--primary)" />
            <h3 className="card-title">Recommended Real Estate Due Diligence Procedure</h3>
          </div>
        </div>

        <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
          <li>
            <strong>Digitize Title Deed:</strong> Upload prior sale deed or settlement deed into LandAssist to extract parcel survey coordinates and check internal data formatting.
          </li>
          <li>
            <strong>Extract Web Patta/Chitta:</strong> Visit <em>https://eservices.tn.gov.in</em> and generate the current Patta/Chitta extract using your District, Taluk, Village, and Survey Number.
          </li>
          <li>
            <strong>Inspect Encumbrance Certificate (EC):</strong> Obtain a digital Encumbrance Certificate via Tamil Nadu Inspector General of Registration (TNREGINET) for at least 30 preceding years.
          </li>
          <li>
            <strong>Cross-Verify Boundaries:</strong> Check the FMB (Field Measurement Book) sketch to verify parcel dimensions, road frontage, and neighboring survey numbers.
          </li>
          <li>
            <strong>Draft Agreement:</strong> Use LandAssist Agreement Generator to create a structured draft with complete schedule parameters and have it scrutinized by a qualified advocate.
          </li>
        </ol>
      </div>
    </div>
  );
}
