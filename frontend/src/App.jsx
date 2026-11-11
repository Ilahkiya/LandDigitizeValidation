import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import LandRecords from './pages/LandRecords';
import RecordForm from './pages/RecordForm';
import RecordDetail from './pages/RecordDetail';
import Digitization from './pages/Digitization';
import ValidationView from './pages/ValidationView';
import AgreementWizard from './pages/AgreementWizard';
import AgreementEditor from './pages/AgreementEditor';
import SavedAgreements from './pages/SavedAgreements';
import SharedAgreements from './pages/SharedAgreements';
import Documents from './pages/Documents';
import OfficialServices from './pages/OfficialServices';
import Settings from './pages/Settings';
import AdminUsers from './pages/AdminUsers';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Application Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/records" element={<LandRecords />} />
            <Route path="/records/new" element={<RecordForm />} />
            <Route path="/records/:id" element={<RecordDetail />} />
            <Route path="/records/:id/edit" element={<RecordForm />} />
            <Route path="/digitize" element={<Digitization />} />
            <Route path="/validation" element={<ValidationView />} />
            <Route path="/agreements/new" element={<AgreementWizard />} />
            <Route path="/agreements" element={<SavedAgreements />} />
            <Route path="/agreements/:id" element={<AgreementEditor />} />
            <Route path="/agreements/shared" element={<SharedAgreements />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/official-services" element={<OfficialServices />} />
            <Route path="/settings" element={<Settings />} />

            {/* Protected Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
