import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, BookOpen, GraduationCap, Shield, LogOut, Camera, Pencil, CalendarDays, Link2, Sparkles } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './ProfileDrawer.css';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const drawerVariants = {
  hidden:  { x: '100%', opacity: 0 },
  visible: { x: 0,      opacity: 1, transition: { type: 'spring', damping: 28, stiffness: 260 } },
  exit:    { x: '100%', opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } },
};

export default function ProfileDrawer({ isOpen, onClose }) {
  const navigate   = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) { setLoading(false); return; }

      // Always set a baseline from Auth so email/uid are never empty
      const baseline = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || null,
      };

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const profileData = snap.data();
          let teacherName = '';
          let fetchedClassCode = '';

          if (profileData.role === 'student' && profileData.teacherId) {
            try {
              const teacherSnap = await getDoc(doc(db, 'users', profileData.teacherId));
              if (teacherSnap.exists()) {
                const teacherData = teacherSnap.data();
                teacherName = teacherData.name || teacherData.fullName || 'Bilinmeyen Öğretmen';
                fetchedClassCode = teacherData.classCode || '';
              }
            } catch (tErr) {
              console.warn('Öğretmen bilgisi çekilemedi:', tErr.message);
            }
          }

          setProfile({
            ...baseline,
            ...profileData,
            teacherName,
            classCode: fetchedClassCode || profileData.classCode
          });
        } else {
          // Firestore doc doesn't exist yet — still show auth data
          setProfile(baseline);
        }
      } catch (err) {
        console.warn('Profil Firestore verisi okunamadı, Auth bilgileri kullanılıyor:', err.message);
        setProfile(baseline);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isOpen]);

  const handleLogout = async () => {
    await signOut(auth);
    onClose();
    navigate('/');
  };

  const name      = profile?.name || profile?.fullName || profile?.email?.split('@')[0] || 'Kullanıcı';
  const initials  = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'KU';
  const roleLabel = profile?.role === 'teacher' ? 'Öğretmen' : 'Öğrenci';
  const createdAt = profile?.createdAt
    ? (typeof profile.createdAt === 'string'
        ? new Date(profile.createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
        : profile.createdAt?.toDate
          ? profile.createdAt.toDate().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
          : null)
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="pd-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.aside
            className="pd-panel glass-panel-strong"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Close Button */}
            <button className="pd-close" onClick={onClose}>
              <X size={18} />
            </button>

            {/* Avatar Hero */}
            <div className="pd-hero">
              <div className="pd-avatar-ring">
                <div className="pd-avatar-inner">
                  <span className="pd-initials">{initials}</span>
                </div>
                <div className="pd-avatar-badge">
                  {profile?.role === 'teacher'
                    ? <Shield size={12} />
                    : <GraduationCap size={12} />}
                </div>
              </div>
              <h2 className="pd-name capitalize">{name}</h2>
              <span className="pd-role-badge">{roleLabel}</span>
            </div>

            {/* Info Section */}
            {loading ? (
              <div className="pd-loading">
                <div className="pd-skeleton" />
                <div className="pd-skeleton" style={{ width: '70%' }} />
                <div className="pd-skeleton" style={{ width: '85%' }} />
              </div>
            ) : (
              <div className="pd-info-list">
                {/* Ad Soyad */}
                <div className="pd-info-item">
                  <div className="pd-info-icon"><User size={16} /></div>
                  <div className="pd-info-content">
                    <span className="pd-info-label">Ad Soyad</span>
                    <span className="pd-info-value capitalize">{name}</span>
                  </div>
                </div>

                {/* E-posta */}
                <div className="pd-info-item">
                  <div className="pd-info-icon"><Mail size={16} /></div>
                  <div className="pd-info-content">
                    <span className="pd-info-label">E-posta</span>
                    <span className="pd-info-value">{profile?.email || '—'}</span>
                  </div>
                </div>

                {/* Sınıf */}
                {profile?.grade && (
                  <div className="pd-info-item">
                    <div className="pd-info-icon"><BookOpen size={16} /></div>
                    <div className="pd-info-content">
                      <span className="pd-info-label">Sınıf / Şube</span>
                      <span className="pd-info-value">{profile.studentClass ? profile.studentClass : `${profile.grade}. Sınıf`}</span>
                    </div>
                  </div>
                )}

                {/* Rol */}
                <div className="pd-info-item">
                  <div className="pd-info-icon"><GraduationCap size={16} /></div>
                  <div className="pd-info-content">
                    <span className="pd-info-label">Rol</span>
                    <span className="pd-info-value">{roleLabel}</span>
                  </div>
                </div>

                {/* Okul */}
                {profile?.school && (
                  <div className="pd-info-item">
                    <div className="pd-info-icon"><GraduationCap size={16} /></div>
                    <div className="pd-info-content">
                      <span className="pd-info-label">Okul</span>
                      <span className="pd-info-value">{profile.school}</span>
                    </div>
                  </div>
                )}

                {/* Öğretmene Bağlılık ve Öğretmen/Sınıf Detayları */}
                {profile?.role === 'student' && (
                  <>
                    <div className="pd-info-item">
                      <div className="pd-info-icon"><Link2 size={16} /></div>
                      <div className="pd-info-content">
                        <span className="pd-info-label">Sınıf Bağlantısı</span>
                        <span className={`pd-info-value ${profile?.teacherId ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {profile?.teacherId ? '✅ Sınıfa Bağlı' : '⚠️ Sınıfa Bağlı Değil'}
                        </span>
                      </div>
                    </div>

                    {profile?.teacherId && (
                      <>
                        <div className="pd-info-item">
                          <div className="pd-info-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}><User size={16} /></div>
                          <div className="pd-info-content">
                            <span className="pd-info-label">Sınıf Öğretmeni</span>
                            <span className="pd-info-value text-indigo-300 capitalize">{profile.teacherName || 'Yükleniyor...'}</span>
                          </div>
                        </div>

                        <div className="pd-info-item">
                          <div className="pd-info-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa' }}><Shield size={16} /></div>
                          <div className="pd-info-content">
                            <span className="pd-info-label">Sınıf Kodu (ID)</span>
                            <span className="pd-info-value pd-mono" style={{ color: '#c084fc', fontFamily: 'monospace', letterSpacing: '0.5px' }}>{profile.classCode}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Yapay Zeka Destekli Öğrenme Kartı */}
                {profile?.role === 'student' && (
                  <div className="pd-info-item ai-learning-card" style={{ border: '1px solid rgba(139, 92, 246, 0.2)', background: 'rgba(139, 92, 246, 0.05)' }}>
                    <div className="pd-info-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}><Sparkles size={16} /></div>
                    <div className="pd-info-content">
                      <span className="pd-info-label" style={{ color: '#c084fc', fontWeight: 'semibold' }}>Yapay Zeka Destekli Öğrenme</span>
                      <span className="pd-info-value" style={{ color: '#e2e8f0', fontWeight: 'bold' }}>
                        {profile.stats?.totalChatMessages ?? 0} Etkileşim
                      </span>
                    </div>
                  </div>
                )}

                {/* Sınıf Kodu (Öğretmen) */}
                {profile?.classCode && (
                  <div className="pd-info-item">
                    <div className="pd-info-icon"><Shield size={16} /></div>
                    <div className="pd-info-content">
                      <span className="pd-info-label">Sınıf Kodu</span>
                      <span className="pd-info-value pd-mono">{profile.classCode}</span>
                    </div>
                  </div>
                )}

                {/* Kayıt Tarihi */}
                {createdAt && (
                  <div className="pd-info-item">
                    <div className="pd-info-icon"><CalendarDays size={16} /></div>
                    <div className="pd-info-content">
                      <span className="pd-info-label">Kayıt Tarihi</span>
                      <span className="pd-info-value">{createdAt}</span>
                    </div>
                  </div>
                )}

                {/* İstatistikler */}
                {profile?.stats && (
                  <div className="pd-stats-row">
                    <div className="pd-stat-pill">
                      <span className="pd-stat-num">{profile.stats.totalSolved ?? 0}</span>
                      <span className="pd-stat-lbl">Çözülen</span>
                    </div>
                    <div className="pd-stat-pill">
                      <span className="pd-stat-num">
                        {profile.stats.totalSolved > 0
                          ? Math.round((profile.stats.correctAnswers / profile.stats.totalSolved) * 100)
                          : 0}%
                      </span>
                      <span className="pd-stat-lbl">Başarı</span>
                    </div>
                    <div className="pd-stat-pill">
                      <span className="pd-stat-num">
                        {Math.floor((profile.stats.totalSolved ?? 0) / 50) + 1}
                      </span>
                      <span className="pd-stat-lbl">Seviye</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="pd-footer">
              <button className="pd-logout-btn" onClick={handleLogout}>
                <LogOut size={16} />
                Çıkış Yap
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
