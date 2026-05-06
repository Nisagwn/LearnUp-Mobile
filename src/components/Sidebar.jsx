import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BookOpen, User, MessageSquare, BarChart, LogOut } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './Sidebar.css';

export default function Sidebar({ userData }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (_) {
      // ignore logout errors
    }
  };

  const role = userData?.role || 'student';

  return (
    <aside className="sidebar ds-card">
      <div className="sidebar-header">
        <div className="logo-icon bg-gradient">
          <BookOpen size={24} color="white" />
        </div>
        <h2 className="logo-text">Learn<span className="text-accent">Up</span></h2>
      </div>

      <nav className="sidebar-nav">
        {role === 'student' && (
          <>
            <p className="nav-label">Öğrenci Menüsü</p>
            <NavLink to="/student" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <User size={20} />
              <span>Öğrenci Panosu</span>
            </NavLink>
            <NavLink to="/chatbot" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <MessageSquare size={20} />
              <span>AI Asistanı</span>
            </NavLink>
          </>
        )}

        {role === 'teacher' && (
          <>
            <p className="nav-label mt-2">Öğretmen Menüsü</p>
            <NavLink to="/teacher" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <BarChart size={20} />
              <span>Analiz Panosu</span>
            </NavLink>
            <NavLink to="/teacher/students" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <User size={20} />
              <span>Öğrenciler</span>
            </NavLink>
            <NavLink to="/teacher/tests" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <BookOpen size={20} />
              <span>Ödevler / Testler</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="nav-item btn-transparent w-full flex items-center gap-3">
          <LogOut size={20} />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </aside>
  );
}
