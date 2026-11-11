import io
import json
import pytest
import tempfile
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import Config
from app import create_app
from db import get_db_connection, init_db
from validation_engine import validate_parcel_registration

@pytest.fixture
def test_app():
    temp_dir = tempfile.mkdtemp()
    test_db = os.path.join(temp_dir, 'test_parcel.db')
    test_uploads = os.path.join(temp_dir, 'test_uploads')

    class TestConfig(Config):
        TESTING = True
        DATABASE_PATH = test_db
        UPLOAD_FOLDER = test_uploads
        SECRET_KEY = 'test-secret-key'

    app = create_app(TestConfig)

    with app.app_context():
        init_db()

    yield app

    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except Exception:
            pass

@pytest.fixture
def client(test_app):
    return test_app.test_client()

@pytest.fixture
def owner_client(client):
    client.post('/api/auth/login', json={
        'email': 'owner@landassist.local',
        'password': 'OwnerPass123!'
    })
    return client

def test_parcel_validation_checks_completeness():
    data = {
        'owner_name': '',
        'document_type': 'Sale Deed',
        'district': 'UnknownState',
        'land_area': -10,
        'ownership_type': 'Joint Ownership',
        'co_owners': [
            {'name': 'Co-owner A', 'share_percentage': '60'},
            {'name': 'Co-owner B', 'share_percentage': '30'}
        ]
    }
    res = validate_parcel_registration(data)
    assert res['registration_status'] == 'FLAGGED FOR REVIEW'
    assert res['failed_count'] >= 1

    chk2 = next(c for c in res['checks'] if c['id'] == 2)
    assert chk2['status'] == 'FAILED'
    assert '100%' in chk2['summary']

    chk5 = next(c for c in res['checks'] if c['id'] == 5)
    assert chk5['status'] == 'NEEDS REVIEW'

    chk6 = next(c for c in res['checks'] if c['id'] == 6)
    assert chk6['status'] == 'FAILED'

    chk11 = next(c for c in res['checks'] if c['id'] == 11)
    assert chk11['status'] == 'NOT VERIFIED'
    assert 'Official government verification unavailable' in chk11['summary']

def test_parcel_validation_joint_ownership_balanced():
    data = {
        'owner_name': 'R. Selvam',
        'document_type': 'Patta',
        'document_reference': 'DOC-2024-CBE-9912',
        'patta_number': 'PAT-9912',
        'district': 'Coimbatore',
        'taluk': 'North',
        'village': 'Saravanampatti',
        'survey_number': '142',
        'subdivision_number': '3B',
        'land_area': 2400.0,
        'land_unit': 'sq.ft',
        'ownership_type': 'Joint Ownership',
        'number_of_owners': 2,
        'co_owners': [
            {'name': 'S. Kavitha', 'share_percentage': '50.0'},
            {'name': 'S. Prakash', 'share_percentage': '50.0'}
        ],
        'boundary_north': 'Road',
        'boundary_south': 'Canal',
        'boundary_east': 'Plot 2',
        'boundary_west': 'Plot 4',
        'supporting_documents': [
            {'filename': 'patta_copy.pdf', 'category': 'Patta Extract'}
        ]
    }
    res = validate_parcel_registration(data)
    chk2 = next(c for c in res['checks'] if c['id'] == 2)
    assert chk2['status'] == 'PASSED'
    assert res['registration_status'] == 'PENDING VERIFICATION'

def test_create_parcel_draft_and_submit_api(owner_client, test_app):
    with test_app.app_context():
        draft_payload = {
            'is_draft': True,
            'owner_name': 'Draft Holder',
            'document_type': 'Sale Deed',
            'district': 'Coimbatore',
            'village': 'Kurichi',
            'survey_number': '78',
            'land_area': 1500
        }
        draft_res = owner_client.post('/api/records', json=draft_payload)
        assert draft_res.status_code == 201
        draft_data = draft_res.get_json()
        assert draft_data['registration_status'] == 'DRAFT'
        assert draft_data['application_number'].startswith('APP-')
        record_id = draft_data['record_id']

        get_res = owner_client.get(f'/api/records/{record_id}')
        assert get_res.status_code == 200
        rec = get_res.get_json()['record']
        assert rec['registration_status'] == 'DRAFT'
        assert rec['application_number'] == draft_data['application_number']

        submit_payload = {
            'owner_name': 'M. Senthil Kumar',
            'document_type': 'Sale Deed',
            'document_reference': 'DEED-2024-CBE-8877',
            'issuing_authority': 'Sub-Registrar Office, Coimbatore South',
            'district': 'Coimbatore',
            'taluk': 'Coimbatore South',
            'village': 'Kurichi',
            'survey_number': '78',
            'subdivision_number': '2A',
            'land_area': 1500.0,
            'land_unit': 'sq.ft',
            'boundary_north': '30ft Main Road',
            'boundary_south': 'Property of Murugan',
            'boundary_east': 'Survey No 79',
            'boundary_west': 'Common Pathway',
            'ownership_type': 'Sole Ownership',
            'supporting_documents': [
                {'filename': 'deed_certified.pdf', 'category': 'Sale Deed'}
            ]
        }
        update_res = owner_client.put(f'/api/records/{record_id}', json=submit_payload)
        assert update_res.status_code == 200
        up_data = update_res.get_json()
        assert up_data['registration_status'] == 'PENDING VERIFICATION'
        assert up_data['validation']['registration_status'] == 'PENDING VERIFICATION'

def test_parcel_conflict_detection(owner_client, test_app):
    with test_app.app_context():
        p1 = {
            'owner_name': 'Original Owner A',
            'document_type': 'Sale Deed',
            'document_reference': 'DEED-CONFLICT-001',
            'district': 'Salem',
            'taluk': 'Salem West',
            'village': 'Attur',
            'survey_number': '301',
            'subdivision_number': '1B',
            'land_area': 3000.0,
            'boundary_north': 'North',
            'boundary_south': 'South',
            'boundary_east': 'East',
            'boundary_west': 'West'
        }
        res1 = owner_client.post('/api/records', json=p1)
        assert res1.status_code == 201

        p2 = {
            'owner_name': 'Conflicting Claimant B',
            'document_type': 'Sale Deed',
            'document_reference': 'DEED-NEW-002',
            'district': 'Salem',
            'taluk': 'Salem West',
            'village': 'Attur',
            'survey_number': '301',
            'subdivision_number': '1B',
            'land_area': 3000.0,
            'boundary_north': 'North',
            'boundary_south': 'South',
            'boundary_east': 'East',
            'boundary_west': 'West'
        }
        res2 = owner_client.post('/api/records', json=p2)
        assert res2.status_code == 201
        data2 = res2.get_json()
        assert data2['registration_status'] == 'FLAGGED FOR REVIEW'
        chk12 = next(c for c in data2['validation']['checks'] if c['id'] == 12)
        assert chk12['status'] == 'FAILED'
