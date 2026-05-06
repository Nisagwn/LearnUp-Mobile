import React, { useState } from 'react';
import { Bell, Search, ChevronDown } from 'lucide-react';
import ProfileDrawer from './ProfileDrawer';
import './Header.css';

export default function Header({ userData }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const name      = userData?.name || userData?.fullName || userData?.email?.split('@')[0] || 'Kullanıcı';
  const roleText  = userData?.role === 'teacher'
    ? 'Öğretmen'
    : (userData?.grade ? `${userData.grade}. Sınıf` : 'Öğrenci');
  const initials  = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'KU';

  return (
    <>
      <header className="header glass-panel animate-fade-in">
        {/* Search */}
        <div className="header-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Konu, ders veya soru ara..."
            className="search-input"
          />
        </div>

        {/* Actions */}
        <div className="header-actions">
          <button className="icon-btn" aria-label="Bildirimler">
            <Bell size={18} />
            <span className="badge">3</span>
          </button>

          {/* Profile trigger — opens ProfileDrawer */}
          <button
            className="header-profile-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Profili Aç"
          >
            <div className="header-avatar">{initials}</div>
            <div className="header-user-info">
              <span className="header-user-name capitalize">{name}</span>
              <span className="header-user-role">{roleText}</span>
            </div>
            <ChevronDown size={14} className="header-chevron" />
          </button>
        </div>
      </header>

      <ProfileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
