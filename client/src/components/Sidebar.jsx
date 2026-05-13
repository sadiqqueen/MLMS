import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MENU = [
  { to: '/admin/dashboard',     icon: '📊', label: 'Dashboard'               },
  { to: '/admin/users',         icon: '👥', label: 'Users'                   },
  { to: '/admin/hospitals',     icon: '🏥', label: 'Hospitals & Universities' },
  { to: '/admin/distributions', icon: '📋', label: 'Distributions'           },
  { to: '/admin/students',      icon: '🎓', label: 'Students'                },
  { to: '/admin/students',      icon: '✅', label: 'Evaluations'             },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate          = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const roleBadge = {
    super_admin: 'Super Admin',
    admin:       'Admin',
    professor:   'Professor',
    doctor:      'Doctor',
    student:     'Student'
  };

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>

      {/* ── LOGO ── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">+</div>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-name">MedLearn LMS</div>
          <div className="sidebar-logo-sub">Clinical Training</div>
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* ── MENU ── */}
      <nav className="sidebar-menu">
        {MENU.map(item => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            title={collapsed ? item.label : ''}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── BOTTOM: profile + logout ── */}
      <div className="sidebar-bottom">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">{user?.initials || '?'}</div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{user?.name}</div>
            <div className="sidebar-profile-role">{roleBadge[user?.role] || user?.role}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <span>🚪</span>
          <span>Log out</span>
        </button>
      </div>

    </aside>
  );
}
