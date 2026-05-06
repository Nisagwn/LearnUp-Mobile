import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, BrainCircuit, BookOpen, Target, Zap, ChevronRight,
  Brain, BarChart3, Lightbulb, LogOut, LayoutDashboard
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './LandingPage.css';

const LandingPage = ({ user }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Çıkış hatası:', error);
    }
  };

  const features = [
    {
      icon: Brain,
      title: 'Yapay Zeka Analitiği',
      description: 'Kişiye özel öğrenme önerileri ve gerçek zamanlı geri bildirim al.',
    },
    {
      icon: BarChart3,
      title: 'Detaylı İlerleme İzleme',
      description: 'Başarı grafiklerini gözlemle ve güçlü/zayıf yönlerini anla.',
    },
    {
      icon: Lightbulb,
      title: 'Akıllı İpuçları',
      description: 'Sorunda takılırsan AI asistan her zaman yardımcında.',
    },
  ];

  return (
    <div className="landing-root">
      {/* Background Orbs */}
      <div className="landing-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Navbar */}
      <header className="landing-nav">
        <div className="landing-logo" onClick={() => navigate('/')}>
          <div className="landing-logo-icon">
            <BrainCircuit size={22} className="text-white" />
          </div>
          <span className="landing-logo-text">
            Learn<span className="landing-logo-accent">Up</span>
          </span>
        </div>

        <nav className="landing-nav-actions">
          {user ? (
            <>
              <button
                className="nav-btn nav-btn-ghost"
                onClick={handleLogout}
                title="Çıkış Yap"
              >
                <LogOut size={16} />
                <span>Çıkış</span>
              </button>
              <button
                className="nav-btn nav-btn-primary"
                onClick={() => navigate('/dashboard')}
              >
                <LayoutDashboard size={16} />
                <span>Panele Git</span>
              </button>
            </>
          ) : (
            <>
              <button
                className="nav-btn nav-btn-ghost"
                onClick={() => navigate('/login')}
              >
                Giriş Yap
              </button>
              <button
                className="nav-btn nav-btn-primary"
                onClick={() => navigate('/login')}
              >
                Ücretsiz Başla
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main className="landing-hero">
        <div className="hero-inner">

          {/* Badge */}
          <div className="hero-badge">
            <Sparkles size={14} />
            <span>Yeni Nesil Eğitim Platformu</span>
          </div>

          {/* Title */}
          <h1 className="hero-title">
            Yapay Zeka<br />
            <span className="hero-title-gradient">Destekli Öğrenme</span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle">
            Sana özel sorular, anlık yapay zeka ipuçları ve detaylı başarı analizi tek bir
            platformda. Öğrenmeyi artık bir görev değil, keyifli bir keşif süreci haline getir.
          </p>

          {/* CTA Buttons */}
          <div className="hero-cta">
            {user ? (
              <button
                className="cta-btn cta-btn-primary"
                onClick={() => navigate('/dashboard')}
              >
                Kaldığın Yerden Devam Et
                <ChevronRight size={20} className="cta-icon" />
              </button>
            ) : (
              <>
                <button
                  className="cta-btn cta-btn-primary"
                  onClick={() => navigate('/login')}
                >
                  Ücretsiz Başla
                  <ChevronRight size={20} className="cta-icon" />
                </button>
                <button
                  className="cta-btn cta-btn-secondary"
                  onClick={() => navigate('/login')}
                >
                  Zaten Hesabım Var
                </button>
              </>
            )}
          </div>

          {/* Feature Cards */}
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card" style={{ animationDelay: `${0.5 + i * 0.1}s` }}>
                <div className="feature-icon">
                  <f.icon size={26} />
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-text">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Decorations */}
        <div className="floating-icons">
          <div className="floating-icon" style={{ top: '18%', left: '4%', animationDuration: '4s' }}>
            <BrainCircuit size={52} className="text-indigo-400/50" />
          </div>
          <div className="floating-icon" style={{ bottom: '22%', left: '7%', animationDuration: '5s', animationDelay: '1s' }}>
            <BookOpen size={42} className="text-cyan-400/40" />
          </div>
          <div className="floating-icon" style={{ top: '28%', right: '4%', animationDuration: '6s', animationDelay: '0.5s' }}>
            <Target size={48} className="text-violet-400/50" />
          </div>
          <div className="floating-icon" style={{ bottom: '28%', right: '7%', animationDuration: '4.5s', animationDelay: '1.5s' }}>
            <Zap size={36} className="text-indigo-300/40" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
