import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Flame, Award, Book, PlayCircle, BookOpen, User, Hexagon, Brain, Calculator, Atom, FlaskConical, Dna, Library, Globe, Heart, Lightbulb } from 'lucide-react';
import JoinClass from '../components/JoinClass';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import './StudentDashboard.css';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) { setLoading(false); return; }

      // Auth'dan her zaman alınabilen baseline bilgiler
      const authBaseline = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || null,
      };

      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        const statsRef = doc(db, 'users', user.uid, 'learningStats', 'main');
        let fetchedData = { ...authBaseline };
        
        if (docSnap.exists()) {
          fetchedData = { ...fetchedData, ...docSnap.data() };
          
          // Öğrencinin asıl level/streak bilgilerini learningStats alt koleksiyonundan çek
          const statsSnap = await getDoc(statsRef);
          if (statsSnap.exists()) {
             fetchedData.learningStats = statsSnap.data();
          }
        } else {
          // Yerel emülatörde veya ilk yüklemede veritabanı boşsa otomatik harika taslak verileri kaydedelim
          const mockUser = {
            fullName: user.displayName || "Nisa Güven",
            role: "student",
            grade: "10",
            stats: { totalSolved: 128, correctAnswers: 96 }
          };
          const mockStats = {
            currentLevel: 3,
            correctStreak: 4,
            wrongStreak: 0
          };
          
          try {
            await setDoc(docRef, mockUser);
            await setDoc(statsRef, mockStats);
          } catch (writeErr) {
            console.warn('Otomatik taslak veriler Firestore emülatörüne yazılamadı:', writeErr.message);
          }
          fetchedData = { ...fetchedData, ...mockUser, learningStats: mockStats };
        }

        setUserData(fetchedData);
      } catch (err) {
        console.warn('Firestore kullanıcı verisi okunamadı, Auth bilgileri kullanılıyor:', err.message);
        setUserData(authBaseline);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const handleStartQuiz = (subject) => {
    navigate(`/student/quiz?subject=${encodeURIComponent(subject)}`);
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const name = userData?.name || userData?.fullName || userData?.email?.split('@')[0] || 'Öğrenci';
  const grade = userData?.grade || '?';
  const hasTeacher = !!userData?.teacherId;
  const stats = userData?.stats || { totalSolved: 0, correctAnswers: 0 };
  const successRate = stats.totalSolved > 0 ? Math.round((stats.correctAnswers / stats.totalSolved) * 100) : 0;
  
  // Asıl seviyeyi learningStats içinden al, yoksa soru sayısına göre hesapla
  const currLevel = userData?.learningStats?.currentLevel || (Math.floor(stats.totalSolved / 50) + 1);

  return (
    <div className="dashboard animate-fade-in pb-12">
      {/* ÜST BİLGİ VE HOŞ GELDİN MODÜLÜ */}
      <div className="ds-card mb-8 border-l-4 border-l-indigo-500 relative overflow-hidden bg-gradient-to-r from-indigo-900/20 to-transparent">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-300 shadow-lg shadow-indigo-500/20">
            <User size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              Odaklanma Zamanı, <span className="text-indigo-400 capitalize">{name}</span>! 🚀
            </h1>
            <div className="flex items-center gap-4 text-sm text-indigo-200/70">
              <span className="flex items-center gap-1.5"><Book size={16} className="text-indigo-400"/> {grade}. Sınıf Öğrencisi</span>
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              <span className="flex items-center gap-1.5">
                <Target size={16} className={hasTeacher ? "text-emerald-400" : "text-amber-400"}/>
                {hasTeacher ? "Bir Sınıfa Bağlısın" : "Sınıf Kodun Yok"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* İSTATİSTİK VE GELİŞİM KARTLARI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="ds-card flex items-center gap-4 hover:border-indigo-500/30 transition-colors border-indigo-500/10 p-5">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Hexagon size={24} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{stats.totalSolved}</div>
            <div className="text-sm font-medium text-slate-400">Toplam Çözülen</div>
          </div>
        </div>
        
        <div className="ds-card flex items-center gap-4 hover:border-emerald-500/30 transition-colors border-emerald-500/10 p-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Target size={24} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">%{successRate}</div>
            <div className="text-sm font-medium text-slate-400">Genel Başarı</div>
          </div>
        </div>

        <div className="ds-card flex items-center gap-4 hover:border-amber-500/30 transition-colors border-amber-500/10 p-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Award size={24} className="text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{currLevel}. Seviye</div>
            <div className="text-sm font-medium text-slate-400">Mevcut Seviye</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* AKILLI SORU SEÇİCİ */}
        <div className="col-span-3 md:col-span-2 flex flex-col gap-6">
          <div className="ds-card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><BookOpen size={20} className="text-indigo-400"/> Odaklanılacak Dersler</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: 'Matematik', icon: Calculator, color: 'text-blue-400', bg: 'bg-blue-500/20', hover: 'hover:border-blue-500/50 hover:bg-blue-600/10 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]' },
                { name: 'Fizik', icon: Atom, color: 'text-indigo-400', bg: 'bg-indigo-500/20', hover: 'hover:border-indigo-500/50 hover:bg-indigo-600/10 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)]' },
                { name: 'Kimya', icon: FlaskConical, color: 'text-teal-400', bg: 'bg-teal-500/20', hover: 'hover:border-teal-500/50 hover:bg-teal-600/10 hover:shadow-[0_0_15px_rgba(20,184,166,0.15)]' },
                { name: 'Biyoloji', icon: Dna, color: 'text-emerald-400', bg: 'bg-emerald-500/20', hover: 'hover:border-emerald-500/50 hover:bg-emerald-600/10 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]' },
                { name: 'Edebiyat', icon: Library, color: 'text-amber-400', bg: 'bg-amber-500/20', hover: 'hover:border-amber-500/50 hover:bg-amber-600/10 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]' },
                { name: 'Coğrafya', icon: Globe, color: 'text-cyan-400', bg: 'bg-cyan-500/20', hover: 'hover:border-cyan-500/50 hover:bg-cyan-600/10 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]' },
                { name: 'Din Kültürü', icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/20', hover: 'hover:border-rose-500/50 hover:bg-rose-600/10 hover:shadow-[0_0_15px_rgba(244,63,94,0.15)]' },
                { name: 'Felsefe', icon: Lightbulb, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20', hover: 'hover:border-fuchsia-500/50 hover:bg-fuchsia-600/10 hover:shadow-[0_0_15px_rgba(217,70,239,0.15)]' }
              ].map((subj, idx) => {
                const IconComp = subj.icon;
                return (
                <button 
                  key={idx}
                  onClick={() => handleStartQuiz(subj.name)}
                  className={`group relative overflow-hidden flex flex-col items-start p-5 rounded-2xl border border-white/5 bg-white/5 transition-all duration-300 text-left ${subj.hover}`}
                >
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 group-hover:scale-[1.3] transition-all duration-500 pointer-events-none">
                    <IconComp size={90} className={subj.color} />
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${subj.bg} ${subj.color} flex items-center justify-center mb-3 shadow-[0_4px_10px_rgba(0,0,0,0.2)] transition-transform duration-300 group-hover:-translate-y-1`}>
                    <IconComp size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-white mb-1 relative z-10">{subj.name}</h3>
                  <p className="text-xs text-slate-400 relative z-10">{grade}. Sınıf Havuzu</p>
                </button>
              )})}
            </div>

            {/* AI HAZIRLIĞI / ZAYIF KONULAR */}
            <div className="mt-6 p-5 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-transparent flex items-center justify-between">
              <div>
                <h3 className="text-violet-300 font-bold flex items-center gap-2 mb-1"><Brain size={18}/> ML Eksik Giderme</h3>
                <p className="text-sm text-slate-400">Yapay zeka analizleri sonucunda en çok hata yaptığın konulardan sana özel test hazırlanıyor.</p>
              </div>
              <button disabled className="bg-violet-600/50 text-white/50 px-4 py-2 rounded-lg text-sm font-semibold cursor-not-allowed border border-violet-500/30">
                Çok Yakında
              </button>
            </div>
          </div>
        </div>

        {/* SINIF KATILIM ALANI */}
        <div className="col-span-3 md:col-span-1 border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-6">
           <JoinClass />
        </div>
      </div>
    </div>
  );
}
