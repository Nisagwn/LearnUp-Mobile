import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Users, AlertTriangle, TrendingUp, BarChart2, Key, Copy, Check, Plus, Search, BookOpen, Activity, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, addDoc } from 'firebase/firestore';
import { safeServerTimestamp } from '../utils/safeTimestamp';
import { useToast } from '../components/ToastProvider';
import './TeacherDashboard.css';

// --- MODALS ---
const CreateTestModal = ({ isOpen, onClose, user }) => {
  const { success } = useToast();
  const [topic, setTopic] = useState('');
  
  if (!isOpen) return null;

  const handleCreate = async () => {
    if(!topic) return;
    await addDoc(collection(db, 'assignments'), {
      teacherId: user.uid,
      topic,
      createdAt: safeServerTimestamp(),
      status: 'active'
    });
    success("Test Atandı!", `${topic} konusu başarıyla öğrencilerinize atandı.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="ds-card max-w-md w-full animate-fade-in relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="text-indigo-400"/> Yeni Ödev/Test Ataması</h2>
        <p className="text-slate-400 text-sm mb-4">Öğrencileriniz için 900+ soruluk havuzdan konu seçin.</p>
        
        <label className="text-xs font-semibold text-slate-300 ml-1">KONU SEÇİN</label>
        <select value={topic} onChange={e=>setTopic(e.target.value)} className="w-full mt-1 mb-6 p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="" className="bg-[#1a1030]">Seçiniz...</option>
          <option value="Biyoloji - Kalıtım" className="bg-[#1a1030]">Biyoloji - Kalıtım</option>
          <option value="Kimya - Mol Kavramı" className="bg-[#1a1030]">Kimya - Mol Kavramı</option>
          <option value="Matematik - Olasılık" className="bg-[#1a1030]">Matematik - Olasılık</option>
          <option value="Matematik - Türev" className="bg-[#1a1030]">Matematik - Türev</option>
          <option value="Fizik - Vektörler" className="bg-[#1a1030]">Fizik - Vektörler</option>
        </select>
        
        <button onClick={handleCreate} className="ds-btn-primary w-full p-3 text-base">Sınıfa Ata</button>
      </div>
    </div>
  );
};

const StudentDetailModal = ({ student, logs, isOpen, onClose }) => {
  if (!isOpen || !student) return null;

  // Bu öğrenciye ait logları filtrele
  const studentLogs = logs.filter(l => l.studentId === student.id);
  const totalSolved = studentLogs.length;
  const correctCount = studentLogs.filter(l => l.isCorrect).length;
  const studentSuccessRate = totalSolved > 0 ? Math.round((correctCount / totalSolved) * 100) : 0;

  // Son 7 günlük başarı trendi — gerçek loglardan hesapla
  const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    last7Days.push(d);
  }

  const chartData = last7Days.map(dayStart => {
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayLabel = dayNames[dayStart.getDay()];

    const dayLogs = studentLogs.filter(l => {
      const ts = l.timestamp?.toDate ? l.timestamp.toDate() : (l.timestamp ? new Date(l.timestamp) : null);
      return ts && ts >= dayStart && ts < dayEnd;
    });

    const dayTotal = dayLogs.length;
    const dayCorrect = dayLogs.filter(l => l.isCorrect).length;
    const score = dayTotal > 0 ? Math.round((dayCorrect / dayTotal) * 100) : null;
    return { day: dayLabel, score, total: dayTotal };
  });

  // Konu bazlı dağılım
  const subjectBreakdown = {};
  studentLogs.forEach(l => {
    if (!subjectBreakdown[l.subject]) subjectBreakdown[l.subject] = { total: 0, correct: 0 };
    subjectBreakdown[l.subject].total += 1;
    if (l.isCorrect) subjectBreakdown[l.subject].correct += 1;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="ds-card max-w-2xl w-full animate-fade-in relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xl font-bold text-indigo-300">
            {(student.name || student.email)?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="text-xl font-bold">{student.name || student.email}</h2>
            <p className="text-slate-400">{student.grade || '?'}. Sınıf Öğrencisi</p>
          </div>
        </div>

        {/* Öğrenci Özet İstatistikleri */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-white/5 rounded-xl text-center border border-white/5">
            <div className="text-xl font-bold text-white">{totalSolved}</div>
            <div className="text-xs text-slate-400">Toplam Çözülen</div>
          </div>
          <div className="p-3 bg-white/5 rounded-xl text-center border border-white/5">
            <div className="text-xl font-bold text-emerald-400">%{studentSuccessRate}</div>
            <div className="text-xs text-slate-400">Başarı Oranı</div>
          </div>
          <div className="p-3 bg-white/5 rounded-xl text-center border border-white/5">
            <div className="text-xl font-bold text-amber-400">{Object.keys(subjectBreakdown).length}</div>
            <div className="text-xs text-slate-400">Çalışılan Konu</div>
          </div>
        </div>

        <h3 className="text-md font-semibold text-slate-300 mb-4">Son 7 Günlük Başarı Trendi</h3>
        {chartData.some(d => d.score !== null) ? (
          <div className="chart-wrapper" style={{ height: 200 }}>
            <ResponsiveContainer width="99%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  formatter={(value, name) => [value !== null ? `%${value}` : 'Veri yok', 'Başarı']}
                />
                <Line type="monotone" dataKey="score" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', strokeWidth: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center p-6 text-slate-500 border border-dashed border-slate-700 rounded-xl mb-4">
            Bu öğrencinin henüz son 7 güne ait verisi bulunmuyor.
          </div>
        )}

        {/* Konu Bazlı Dağılım */}
        {Object.keys(subjectBreakdown).length > 0 && (
          <>
            <h3 className="text-md font-semibold text-slate-300 mt-6 mb-4">Konu Bazlı Performans</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(subjectBreakdown).map(([subj, data]) => {
                const rate = Math.round((data.correct / data.total) * 100);
                return (
                  <div key={subj} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="flex-1 text-sm text-slate-200 font-medium">{subj}</span>
                    <span className="text-xs text-slate-400">{data.total} soru</span>
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-2 rounded-full ${rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                    </div>
                    <span className={`text-sm font-bold min-w-[40px] text-right ${rate >= 70 ? 'text-emerald-400' : rate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>%{rate}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};


// --- TABS ---
const AnalyticsTab = ({ stats, weakTopics, chartData }) => (
  <>
    <div className="stats-grid">
      <div className="ds-card flex items-center gap-4 !p-5">
        <div className="stat-icon bg-success-light"><Users size={24} className="text-success" /></div>
        <div className="stat-info"><span className="stat-value">{stats.totalStudents}</span><span className="stat-label">Toplam Öğrenci</span></div>
      </div>
      <div className="ds-card flex items-center gap-4 !p-5">
        <div className="stat-icon bg-warning-light"><Activity size={24} className="text-warning" /></div>
        <div className="stat-info"><span className="stat-value">{stats.totalQuestions}</span><span className="stat-label">Toplam Çözülen Olay</span></div>
      </div>
      <div className="ds-card flex items-center gap-4 !p-5">
        <div className="stat-icon bg-accent-light"><TrendingUp size={24} className="text-accent" /></div>
        <div className="stat-info"><span className="stat-value">%{stats.successRate}</span><span className="stat-label">Genel Başarı Oranı</span></div>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-6 mt-6">
      <div className="col-span-2 ds-card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="section-title flex items-center gap-2">
            <BarChart2 size={20} className="text-accent" /> Sınıfın Konu Bazlı Performansı
          </h2>
        </div>
        <div className="chart-wrapper" style={{ height: 300 }}>
          <ResponsiveContainer width="99%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="subject" stroke="#94A3B8" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={12} unit="%" axisLine={false} tickLine={false} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
              />
              <Bar dataKey="success" fill="url(#colorSuccess)" radius={[6, 6, 0, 0]} maxBarSize={50} />
              <defs>
                <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.4}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="col-span-1 ds-card h-full flex flex-col">
        <h2 className="section-title mb-6 flex items-center gap-2">
          <AlertTriangle size={20} className="text-danger" /> Sınıfın Zorlandığı Konular
        </h2>
        <p className="text-sm text-slate-400 mb-4">ML analizlerine göre hata oranı %50'den yüksek olan konular aşağıda listelenmiştir.</p>
        <div className="flex flex-col gap-3 overflow-y-auto pr-2">
          {weakTopics.length > 0 ? weakTopics.map((topic, i) => (
            <div key={i} className="p-3 bg-danger-light/20 border border-danger/20 rounded-xl flex justify-between items-center">
              <span className="font-medium text-slate-200 text-sm">{topic.subject}</span>
              <span className="text-danger font-bold text-sm">Hata: %{topic.errorRate}</span>
            </div>
          )) : (
            <div className="text-center p-6 text-slate-500 border border-dashed border-slate-700 rounded-xl">
              Riskli konu tespit edilmedi. 🎉
            </div>
          )}
        </div>
      </div>
    </div>
  </>
);

const StudentsTab = ({ students, openStudentDetail }) => {
  const [filterGrade, setFilterGrade] = useState('all');
  
  const filtered = filterGrade === 'all' ? students : students.filter(s => s.grade === filterGrade);

  return (
    <div className="ds-card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="section-title">Sınıf Listesi</h2>
        <div className="flex items-center gap-3">
          <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm outline-none text-white focus:border-indigo-500">
            <option value="all" className="bg-[#1a1030]">Tüm Sınıflar</option>
            <option value="9" className="bg-[#1a1030]">9. Sınıf</option>
            <option value="10" className="bg-[#1a1030]">10. Sınıf</option>
            <option value="11" className="bg-[#1a1030]">11. Sınıf</option>
            <option value="12" className="bg-[#1a1030]">12. Sınıf</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 text-sm">
              <th className="pb-3 font-semibold">Öğrenci E-posta</th>
              <th className="pb-3 font-semibold">Sınıf</th>
              <th className="pb-3 font-semibold">Son Aktivite</th>
              <th className="pb-3 font-semibold text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(student => (
              <tr key={student.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">{student.email?.[0].toUpperCase()}</div>
                  {student.email}
                </td>
                <td className="py-4 text-slate-300">{student.grade}. Sınıf</td>
                <td className="py-4 text-slate-400 text-sm">
                  {(() => {
                    const sLogs = (student._studentLogs || []);
                    if (sLogs.length === 0) return 'Henüz aktivite yok';
                    const last = sLogs[sLogs.length - 1];
                    const ts = last?.timestamp?.toDate ? last.timestamp.toDate() : (last?.timestamp ? new Date(last.timestamp) : null);
                    if (!ts) return 'Bilinmiyor';
                    const diff = Math.floor((Date.now() - ts.getTime()) / 60000);
                    if (diff < 1) return 'Az önce';
                    if (diff < 60) return `${diff} dk önce`;
                    if (diff < 1440) return `${Math.floor(diff / 60)} saat önce`;
                    return `${Math.floor(diff / 1440)} gün önce`;
                  })()}
                </td>
                <td className="py-4 text-right">
                  <button onClick={() => openStudentDetail(student)} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium bg-indigo-500/10 px-3 py-1.5 rounded-lg">İncele</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="4" className="py-8 text-center text-slate-500">Bu kritere uygun öğrenci bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function TeacherDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast, success } = useToast();

  const [classCode, setClassCode] = useState('Yükleniyor...');
  const [copied, setCopied] = useState(false);
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) { navigate('/login'); return; }
      
      const docRef = doc(db, 'users', user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists() && snap.data().role === 'teacher') {
        setClassCode(snap.data().classCode || 'KOD YOK');
      } else {
        navigate('/');
      }
    };
    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // FIX: Students list uses onSnapshot (needed for live class list updates)
    const qStudents = query(collection(db, 'users'), where('role', '==', 'student'), where('teacherId', '==', user.uid));
    const u1 = onSnapshot(qStudents, (snap) => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // FIX: Logs use ONE-TIME getDocs instead of onSnapshot.
    // The old onSnapshot on user_logs fired on EVERY student answer, causing thousands of reads.
    // Teachers only need logs when they open the dashboard, not in real-time.
    const fetchLogs = async () => {
      try {
        const qLogs = query(collection(db, 'user_logs'), where('teacherId', '==', user.uid));
        const snap = await getDocs(qLogs);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Failed to fetch logs:', e);
      }
    };
    fetchLogs();

    return () => { u1(); };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(classCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- STATS AGGREGATION (sahte 'simulated_student' logları filtrelenir) ---
  const realLogs = logs.filter(l => l.studentId && l.studentId !== 'simulated_student');
  const totalStudents = students.length;
  const totalQuestions = realLogs.length;
  const correctAnswers = realLogs.filter(l => l.isCorrect).length;
  const successRate = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  // Öğrenci bazlı log eşleştirmesi (StudentsTab ve StudentDetailModal için)
  const studentsWithLogs = students.map(s => ({
    ...s,
    _studentLogs: realLogs.filter(l => l.studentId === s.id)
  }));

  // Konu bazlı gruplama
  const subjectMap = {};
  realLogs.forEach(log => {
    if(!subjectMap[log.subject]) subjectMap[log.subject] = { total: 0, correct: 0 };
    subjectMap[log.subject].total += 1;
    if(log.isCorrect) subjectMap[log.subject].correct += 1;
  });

  const chartData = Object.keys(subjectMap).map(sub => {
    const total = subjectMap[sub].total;
    const correct = subjectMap[sub].correct;
    return { subject: sub, success: Math.round((correct/total)*100) };
  });

  const weakTopics = Object.keys(subjectMap).map(sub => {
    const total = subjectMap[sub].total;
    const err = total - subjectMap[sub].correct;
    const errRate = Math.round((err/total)*100);
    return { subject: sub, errorRate: errRate };
  }).filter(t => t.errorRate > 50).sort((a,b) => b.errorRate - a.errorRate);

  // Render Content based on route
  const currentPath = location.pathname;
  let activeTabName = "Analiz Panosu";
  if(currentPath.includes("students")) activeTabName = "Öğrenci Yönetimi";
  if(currentPath.includes("tests")) activeTabName = "Atanan Ödevler & Testler";

  return (
    <div className="dashboard animate-fade-in relative pb-20">
      <div className="dashboard-header mb-6 flex justify-between items-center">
        <div>
          <h1 className="page-title">{activeTabName}</h1>
          <p className="page-subtitle">Sınıfınızın genel durumunu ve bildirimleri buradan kontrol edebilirsiniz.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={()=>setIsTestModalOpen(true)} className="ds-btn-primary text-sm">
            <Plus size={18} /> Yeni Test/Ödev
          </button>

          <div 
            className="ds-card !p-2 !px-4 flex items-center gap-3 !bg-indigo-500/5 !border-indigo-500/20"
          >
            <div className="flex items-center gap-1.5 text-secondary">
              <Key size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="text-sm font-medium">Sınıf Kodu:</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-widest text-[#F8FAFC]">{classCode}</span>
              <button onClick={handleCopy} className="p-1 hover:bg-white/10 rounded-md transition-colors" style={{ color: 'var(--text-secondary)' }} title="Kodu Kopyala">
                {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Routes>
        <Route index element={<AnalyticsTab stats={{totalStudents, totalQuestions, successRate}} weakTopics={weakTopics} chartData={chartData} />} />
        <Route path="students" element={<StudentsTab students={studentsWithLogs} openStudentDetail={(s)=>setSelectedStudent(s)} />} />
        <Route path="tests" element={
          <div className="ds-card text-center text-slate-400">
            <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-white mb-2">Test Atamaları</h3>
            <p>Atanan testler ve ödev detayları burada listelenecektir.</p>
          </div>
        } />
      </Routes>

      <CreateTestModal isOpen={isTestModalOpen} onClose={()=>setIsTestModalOpen(false)} user={auth.currentUser} />
      <StudentDetailModal isOpen={!!selectedStudent} student={selectedStudent} onClose={()=>setSelectedStudent(null)} logs={logs} />
      
    </div>
  );
}
