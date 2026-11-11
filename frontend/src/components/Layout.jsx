import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  ScanText,
  ShieldCheck,
  FileSignature,
  Files,
  Share2,
  ExternalLink,
  Settings,
  ShieldAlert,
  LogOut,
  Landmark
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'Executive Dashboard';
    if (path.startsWith('/records/new')) return 'Register Land Parcel';
    if (path.startsWith('/records/') && path.includes('/edit')) return 'Update Land Record';
    if (path.startsWith('/records/')) return 'Parcel Title & Cadastral Details';
    if (path === '/records') return 'Land Records Registry';
    if (path === '/digitize') return 'Document Digitization & OCR Engine';
    if (path === '/validation') return 'Cadastral & Title Validation Engine';
    if (path === '/agreements/new') return 'AI-Assisted Agreement Drafting';
    if (path === '/agreements/shared') return 'Shared Agreement Reviews';
    if (path.startsWith('/agreements/')) return 'Agreement Draft Editor & PDF Export';
    if (path === '/agreements') return 'Saved Agreement Drafts';
    if (path === '/documents') return 'Private Document Storage';
    if (path === '/official-services') return 'Official Tamil Nadu Land Records Services';
    if (path === '/settings') return 'Security & Account Settings';
    if (path.startsWith('/admin')) return 'Administrator Console';
    return 'LandAssist Workspace';
  };

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand-icon">
            <Landmark size={20} />
          </div>
          <div className="sidebar-brand-text">
            <h1>LandAssist</h1>
            <p>Land Records & Legal Drafting</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-category">Overview & Records</div>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} className="icon" />
            <span>Overview</span>
          </NavLink>

          <NavLink
            to="/records"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <FileSpreadsheet size={18} className="icon" />
            <span>Land Records</span>
          </NavLink>

          <NavLink
            to="/digitize"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <ScanText size={18} className="icon" />
            <span>Digitization</span>
          </NavLink>

          <NavLink
            to="/validation"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <ShieldCheck size={18} className="icon" />
            <span>Validation</span>
          </NavLink>

          <div className="sidebar-category">Agreement Drafting</div>
          <NavLink
            to="/agreements/new"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <FileSignature size={18} className="icon" />
            <span>Agreement Generator</span>
          </NavLink>

          <NavLink
            to="/agreements"
            end
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Files size={18} className="icon" />
            <span>Saved Drafts</span>
          </NavLink>

          <NavLink
            to="/agreements/shared"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Share2 size={18} className="icon" />
            <span>Shared Agreements</span>
          </NavLink>

          <div className="sidebar-category">Library & External</div>
          <NavLink
            to="/documents"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Files size={18} className="icon" />
            <span>Documents</span>
          </NavLink>

          <NavLink
            to="/official-services"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <ExternalLink size={18} className="icon" />
            <span>Official Services</span>
          </NavLink>

          <div className="sidebar-category">System</div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Settings size={18} className="icon" />
            <span>Settings</span>
          </NavLink>

          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <ShieldAlert size={18} className="icon" />
              <span>Admin Console</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-snippet">
            <div className="user-avatar">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-meta">
              <div className="user-name">{user?.full_name || 'User'}</div>
              <div className="user-role-tag">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              title="Sign Out"
              style={{ padding: '0.35rem', color: '#94a3b8' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="app-main">
        {/* Top Navigation */}
        <header className="app-topbar">
          <div className="topbar-left">
            <h2 className="topbar-title">{getPageTitle()}</h2>
            <div className="topbar-breadcrumbs">
              <span>LandAssist</span>
              <span>/</span>
              <span>{getPageTitle()}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <a
              href="https://eservices.tn.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#475569' }}
              title="Tamil Nadu Government Land Records Portal (External)"
            >
              <ExternalLink size={14} />
              <span>TN e-Services</span>
            </a>

            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
