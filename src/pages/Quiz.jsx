import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, BrainCircuit, Lightbulb, Loader2, Award } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, addDoc, updateDoc, increment, getDocs, query as fsQuery, where, orderBy, limit } from 'firebase/firestore';
import { safeServerTimestamp } from '../utils/safeTimestamp';
import { useToast } from '../components/ToastProvider';
import FloatingAI from '../components/FloatingAI';
import { generateDynamicHint } from '../utils/geminiService';

const IS_DEV = import.meta.env.DEV;
const FIREBASE_PROJECT_ID = "learnup-3cdb7";
const BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE_URL || (IS_DEV ? `http://127.0.0.1:5001/${FIREBASE_PROJECT_ID}/us-central1` : `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net`);
const SUBMIT_ANSWER_URL = `${BACKEND_BASE.replace(/\/$/, '')}/submitAnswer`;

export default function Quiz() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subject = searchParams.get('subject') || 'Genel';
  const { error } = useToast();

  const [loading, setLoading] = useState(true);
  const [isChangingQuestion, setIsChangingQuestion] = useState(false);
  
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionSource, setQuestionSource] = useState(null); // 'db' | 'ai' | null
  const [questionCount, setQuestionCount] = useState(1);
  const [solvedQuestionIds, setSolvedQuestionIds] = useState([]);
  const [learningStats, setLearningStats] = useState({ currentLevel: 2, correctStreak: 0, wrongStreak: 0 });

  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [userData, setUserData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [showSuccess, setShowSuccess] = useState(false);
  const [wrongAnswered, setWrongAnswered] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0); 
  const [firstWrongOption, setFirstWrongOption] = useState(null); 

  // Hint states
  const [showHint, setShowHint] = useState(false);
  const [hintText, setHintText] = useState('');
  const [hintLoading, setHintLoading] = useState(false);

  // AI context & wrong count
  const [quizContext, setQuizContext] = useState(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [autoOpenAI, setAutoOpenAI] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  // DB cooldown/backoff: prevent rapid repeated fetches when DB is empty or transient errors occur
  const [dbCooldownUntil, setDbCooldownUntil] = useState(0);

  // FIX: Refs that mirror volatile state so useCallback can read latest values
  // without needing them in its dependency array (which would cause infinite re-creation).
  const solvedQuestionIdsRef = useRef([]);
  const fetchFailureCountRef = useRef(0);
  const userDataRef = useRef(null);
  const learningStatsRef = useRef({ currentLevel: 2, correctStreak: 0, wrongStreak: 0 });
  const dbCooldownUntilRef = useRef(0);
  const [fetchFailureCount, setFetchFailureCount] = useState(0);
  // Mastery UI state
  const [topicMasteryValue, setTopicMasteryValue] = useState(null);
  const [topicMasteryLevelName, setTopicMasteryLevelName] = useState(null);
  const [showLevelUpBanner, setShowLevelUpBanner] = useState(false);

  // FIX: Keep refs in sync with state on every render (no re-render cost)
  useEffect(() => { solvedQuestionIdsRef.current = solvedQuestionIds; }, [solvedQuestionIds]);
  useEffect(() => { userDataRef.current = userData; }, [userData]);
  useEffect(() => { learningStatsRef.current = learningStats; }, [learningStats]);
  useEffect(() => { dbCooldownUntilRef.current = dbCooldownUntil; }, [dbCooldownUntil]);

  const fetchAdaptiveQuestion = useCallback(async (isCorrect = null) => {
    // Read volatile values from refs — no stale closures, no dependency array issues
    const _solvedIds = solvedQuestionIdsRef.current;
    const _failCount = fetchFailureCountRef.current;
    const _userData = userDataRef.current;
    const _learningStats = learningStatsRef.current;
    const _cooldownUntil = dbCooldownUntilRef.current;
    // If a cooldown is active, skip attempting to fetch to avoid spamming the DB or backend
    if (_cooldownUntil && Date.now() < _cooldownUntil) {
      console.warn('Skipping fetchAdaptiveQuestion due to cooldown until', new Date(_cooldownUntil).toISOString());
      return;
    }

    setIsChangingQuestion(true);
    if (isCorrect === null) setLoading(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/login');
        return;
      }

      const getSubjectMapping = (tr_subject) => {
        switch(tr_subject) {
          case 'Matematik': return 'Mathematics'; 
          case 'Fizik': return 'Physics';
          case 'Kimya': return 'Chemistry';
          case 'Biyoloji': return 'Biology';
          case 'Edebiyat': return 'Turkish Language and Literature';
          case 'Coğrafya': return 'Geography';
          case 'Din Kültürü': return 'Religion and Ethics';
          case 'Felsefe': return 'Philosophy';
          default: return tr_subject;
        }
      };
      const dbCategory = getSubjectMapping(subject);

      // First: try to fetch a ready question from Firestore to avoid calling AI when possible
      try {
        const gradeStr = (_userData && _userData.grade) ? String(_userData.grade) : '10';

        const qCol = collection(db, 'questions');
        // Filter strictly by category and grade as requested
        const q = fsQuery(qCol,
          where('category', '==', dbCategory),
          where('grade', '==', gradeStr),
          limit(10)
        );

        const snap = await getDocs(q);
        let picked = null;
        for (const docSnap of snap.docs) {
          const docData = { id: docSnap.id, ...docSnap.data() };
          if (!_solvedIds.includes(docData.id)) {
            picked = docData;
            break;
          }
        }

        // If not found with grade filter, try without grade filter to keep it offline
        if (!picked) {
          const qAnyGrade = fsQuery(qCol,
            where('category', '==', dbCategory),
            limit(10)
          );
          const snapAny = await getDocs(qAnyGrade);
          for (const docSnap of snapAny.docs) {
            const docData = { id: docSnap.id, ...docSnap.data() };
            if (!_solvedIds.includes(docData.id)) {
              picked = docData;
              break;
            }
          }
        }

        // If still not found and index <= 10, pick any question from category even if solved to avoid calling Gemini
        if (!picked && questionCount <= 10) {
          const qAnySolved = fsQuery(qCol,
            where('category', '==', dbCategory),
            limit(10)
          );
          const snapAnySolved = await getDocs(qAnySolved);
          if (!snapAnySolved.empty) {
            const docSnap = snapAnySolved.docs[Math.floor(Math.random() * snapAnySolved.docs.length)];
            picked = { id: docSnap.id, ...docSnap.data() };
          }
        }

        if (picked) {
          // Found a DB question — use it and skip AI/backend generation
          setCurrentQuestion(picked);
          setQuestionSource('db');
          if (!_solvedIds.includes(picked.id)) setSolvedQuestionIds(prev => [...prev, picked.id]);
          // reset any backoff counters since DB served content
          fetchFailureCountRef.current = 0;
          setFetchFailureCount(0);
          setDbCooldownUntil(0);
          return;
        }
      } catch (dbErr) {
        console.warn('Firestore lookup failed:', dbErr);
      }

      // If we are on first 10 questions and couldn't find anything in DB, do NOT call Gemini!
      if (questionCount <= 10) {
        setCurrentQuestion(null);
        setQuestionSource(null);
        error('Soru Bulunamadı', 'İlk 10 soru havuzdan yükleniyor fakat uygun soru bulunamadı.');
        return;
      }
      // Include the user's ID token in Authorization header so the backend can verify identity
      let idToken = null;
      try {
        idToken = await user.getIdToken();
      } catch (e) {
        console.warn('Failed to get ID token for submitAnswer:', e);
      }
      const headers = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch(SUBMIT_ANSWER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: user.uid,
          topic: dbCategory,
          isCorrect: isCorrect,
          solvedQuestionIds: _solvedIds
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sunucu hatası");
      }

      // If the functions proxy returned a graceful fallback (quota or model error),
      // surface that message to the user and apply a small cooldown so the UI doesn't spam retries.
      if (data && data.fallback) {
        console.warn('Backend returned fallback:', data);
        error('API Kotası', data.message || 'Üzgünüm, API kotası aşıldığı için soru üretilemedi. Lütfen birkaç dakika sonra tekrar deneyin.');
        setCurrentQuestion(null);
        setQuestionSource('ai');

        // lightweight backoff on fallback
        const nextFailCount = _failCount + 1;
        const cooldownSec = Math.min(120, 8 * nextFailCount);
        fetchFailureCountRef.current = nextFailCount;
        setFetchFailureCount(nextFailCount);
        setDbCooldownUntil(Date.now() + cooldownSec * 1000);
        // update mastery UI if available
        if (data.mastery) {
          setTopicMasteryValue(data.mastery.value ?? null);
          setTopicMasteryLevelName(data.mastery.levelName ?? null);
          if (data.mastery.levelUp) {
            confetti({ particleCount: 120, spread: 90 });
            setShowLevelUpBanner(true);
            setTimeout(() => setShowLevelUpBanner(false), 3500);
          }
        }
      } else if (data.nextQuestion) {
        // Success: reset any backoff counters
        setCurrentQuestion(data.nextQuestion);
        setQuestionSource(data.nextQuestion?.isAI ? 'ai' : 'db');
        if (!solvedQuestionIds.includes(data.nextQuestion.id)) {
           setSolvedQuestionIds(prev => [...prev, data.nextQuestion.id]);
        }
        if (data.stats) {
          setLearningStats(data.stats);
        }
        fetchFailureCountRef.current = 0;
        setFetchFailureCount(0);
        setDbCooldownUntil(0);

        // update mastery UI if available
        if (data.mastery) {
          setTopicMasteryValue(data.mastery.value ?? null);
          setTopicMasteryLevelName(data.mastery.levelName ?? null);
          if (data.mastery.levelUp) {
            confetti({ particleCount: 120, spread: 90 });
            setShowLevelUpBanner(true);
            setTimeout(() => setShowLevelUpBanner(false), 3500);
          }
        }

      } else {
        // No question returned from DB and no AI fallback: treat as DB-empty transient and apply cooldown
        setCurrentQuestion(null);
        setQuestionSource(null);
        const nextFailCount = _failCount + 1;
        const cooldownSec = Math.min(120, 8 * nextFailCount);
        fetchFailureCountRef.current = nextFailCount;
        setFetchFailureCount(nextFailCount);
        setDbCooldownUntil(Date.now() + cooldownSec * 1000);
        error('Soru Bulunamadı', `Hazır sorular veritabanında bulunamadı. Yeniden deneme ${cooldownSec} saniye sonra yapılacak.`);
      }
      
    } catch (err) {
      console.error("Adaptive fetch error:", err);
      // Exponential backoff on network/server errors
      const nextFailCount = _failCount + 1;
      const cooldownSec = Math.min(120, Math.pow(2, nextFailCount) * 5);
      fetchFailureCountRef.current = nextFailCount;
      setFetchFailureCount(nextFailCount);
      setDbCooldownUntil(Date.now() + cooldownSec * 1000);
      error("Soru Hatası", `Yeni soru yüklenemedi: ${err.message}. Yeniden deneme ${cooldownSec}s sonra.`);
    } finally {
      setLoading(false);
      setIsChangingQuestion(false);
    }
  // FIX: Only stable values in dep array. Volatile state is read via refs above.
  // This prevents the callback from re-creating on every answer, stopping the read storm.
  }, [subject, navigate, error]);

  useEffect(() => {
    const initData = async () => {
      const user = auth.currentUser;
      if (user && user.uid) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) setUserData(userSnap.data());
        } catch (err) {
          console.error('Failed loading user data in Quiz.initData for uid:', user?.uid, err);
        }
      } else if (user && !user.uid) {
        console.warn('Auth currentUser present but no uid in Quiz.initData', user);
      }
      await fetchAdaptiveQuestion(null);
    };
    initData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentQuestion || !userData) return;
    setQuizContext({
      subject,
      grade: userData?.grade || '10',
      questionNo: questionCount,
      totalQuestions: 10,
      questionText: currentQuestion.text,
      options: currentQuestion.options || [],
      wrongCount,
    });
    setShowHint(false);
    setHintText('');
  }, [currentQuestion, userData, subject, wrongCount, questionCount]);

  useEffect(() => {
    setWrongAttempts(0);
    setFirstWrongOption(null);
    setQuestionStartTime(Date.now()); // Yeni soru geldiğinde zamanlayıcıyı sıfırla
  }, [currentQuestion]);

  useEffect(() => {
    if (loading || isChangingQuestion || isAnswering || !currentQuestion || aiPanelOpen || wrongAnswered) return;

    if (timeLeft <= 0) {
      handleOptionClick(null);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isAnswering, loading, isChangingQuestion, currentQuestion, aiPanelOpen, wrongAnswered]);

  const handleHintRequest = async () => {
    if (hintLoading) return;
    if (hintText) {
      setShowHint(prev => !prev);
      return;
    }

    setHintLoading(true);
    setShowHint(true);
    try {
      const ctx = {
        subject,
        grade: userData?.grade || '10',
        questionText: currentQuestion.text,
        options: currentQuestion.options || [],
      };
      const aiHint = await generateDynamicHint(ctx);
      setHintText(aiHint);
    } catch (_err) {
      setHintText('İpucu üretilemedi. Lütfen daha sonra tekrar dene.');
    } finally {
      setHintLoading(false);
    }
  };

  const handleOptionClick = async (option) => {
    if (isAnswering || !userData || isChangingQuestion) return;

    const isCorrect = option !== null && option === currentQuestion.correctAnswer;
    const newAttempts = wrongAttempts + (isCorrect ? 0 : 1);

    setSelectedOption(option);

    // Harcanan süreyi hesapla (saniye)
    const timeSpentSec = Math.round((Date.now() - questionStartTime) / 1000);

    // Ortak log verisi — her durumda kullanılacak zengin veri yapısı
    const buildLogData = (correct, selected, attemptNo) => ({
      studentId: auth.currentUser?.uid,
      teacherId: userData.teacherId || null,
      subject: subject,
      questionId: currentQuestion.id,
      questionText: currentQuestion.text || '',
      selectedOption: selected,
      correctAnswer: currentQuestion.correctAnswer || null,
      isCorrect: correct,
      difficulty: currentQuestion.difficulty || 'medium',
      grade: userData?.grade || null,
      timeSpent: timeSpentSec,
      attemptNumber: attemptNo,
      timestamp: safeServerTimestamp()
    });

    if (isCorrect) {
      setIsAnswering(true);
      setShowSuccess(true);
      setWrongAnswered(false);
      setWrongAttempts(0);
      setFirstWrongOption(null);
      setWrongCount(prev => Math.max(prev - 1, 0));
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981'],
        zIndex: 100
      });

      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          console.warn('No authenticated uid available when saving success log');
        } else {
          // Zengin log kaydı — doğru cevap
          await addDoc(collection(db, 'user_logs'), buildLogData(true, option, wrongAttempts + 1));
          const userRef = doc(db, 'users', uid);
          await updateDoc(userRef, {
            "stats.totalSolved": increment(1),
            "stats.correctAnswers": increment(1)
          });
        }
      } catch (err) {
        console.error("Veri kaydetme hatası:", err);
      }

      setTimeout(() => {
        fetchAdaptiveQuestion(true).then(() => {
          setQuestionCount(prev => prev + 1);
          resetQuestionState();
        });
      }, 2000);

    } else if (newAttempts === 1) {
      // ── İLK YANLIŞ DENEME — artık log kaydediliyor! ──
      setFirstWrongOption(option);
      setWrongAttempts(1);
      setWrongCount(prev => prev + 1);

      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          await addDoc(collection(db, 'user_logs'), buildLogData(false, option, 1));
        }
      } catch (err) {
        console.error("İlk yanlış log kaydetme hatası:", err);
      }

      setTimeout(() => {
        setSelectedOption(null);
      }, 900);

    } else {
      setIsAnswering(true);
      setWrongAnswered(true);
      setWrongAttempts(2);
      setWrongCount(prev => prev + 1);
      setAutoOpenAI(true);

      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          console.warn('No authenticated uid available when saving failure log');
        } else {
          // Zengin log kaydı — ikinci yanlış
          await addDoc(collection(db, 'user_logs'), buildLogData(false, option, 2));
          const userRef = doc(db, 'users', uid);
          await updateDoc(userRef, {
            "stats.totalSolved": increment(1)
          });
        }
      } catch (err) {
        console.error("Veri kaydetme hatası:", err);
      }
    }
  };

  const resetQuestionState = () => {
    setSelectedOption(null);
    setIsAnswering(false);
    setTimeLeft(60);
    setQuestionStartTime(Date.now());
    setShowSuccess(false);
    setAutoOpenAI(false);
    setWrongAnswered(false);
    setWrongAttempts(0);
    setFirstWrongOption(null);
    setShowHint(false);
    setHintText('');
  };

  const goToNext = () => {
    if (wrongAnswered) {
      fetchAdaptiveQuestion(false).then(() => {
        setQuestionCount(prev => prev + 1);
        resetQuestionState();
      });
    } else {
      // Normal durumda zaten otomatik geçiyor.
    }
  };

  const renderContent = (text) => {
    if (!text) return null;
    const regex = /(\$.*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;
    const parts = String(text).split(regex);
    
    return parts.map((part, index) => {
      if (!part) return null;

      let mathContent = part.trim();
      let isMath = false;
      let isBlock = false;

      if (mathContent.startsWith('$') && mathContent.endsWith('$')) {
        mathContent = mathContent.slice(1, -1).trim();
        isMath = true;
      } else if (mathContent.startsWith('\\(') && mathContent.endsWith('\\)')) {
        mathContent = mathContent.slice(2, -2).trim();
        isMath = true;
      } else if (mathContent.startsWith('\\[') && mathContent.endsWith('\\]')) {
        mathContent = mathContent.slice(2, -2).trim();
        isMath = true;
        isBlock = true;
      }

      if (isMath) {
        if (mathContent.startsWith('\\(') && mathContent.endsWith('\\)')) {
          mathContent = mathContent.slice(2, -2).trim();
        } else if (mathContent.startsWith('\\[') && mathContent.endsWith('\\]')) {
          mathContent = mathContent.slice(2, -2).trim();
        }
        
        mathContent = mathContent.replace(/\\quad/g, ' ').replace(/\\;/g, ' ');

        return isBlock ? (
          <BlockMath key={index} math={mathContent} />
        ) : (
          <InlineMath key={index} math={mathContent} />
        );
      }

      return <span key={index} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0B0F1A] text-blue-50 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-500/15 rounded-full blur-[120px] mix-blend-screen"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-fuchsia-500/15 rounded-full blur-[100px] mix-blend-screen"></div>
        </div>

        {/* Header Skeleton */}
        <div className="w-full px-6 pt-10 pb-4 flex items-center justify-between z-10 relative opacity-50">
          <div className="w-24 h-6 bg-white/10 rounded-md animate-pulse"></div>
          <div className="w-32 h-6 bg-white/10 rounded-md animate-pulse"></div>
          <div className="w-20 h-8 bg-white/10 rounded-xl animate-pulse"></div>
        </div>

        {/* Card Skeleton */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 relative w-full max-w-4xl mx-auto">
          <div className="w-full p-8 md:p-10 ds-card !rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] relative">
            <div className="w-3/4 h-8 bg-white/10 rounded-md animate-pulse mb-6"></div>
            <div className="w-1/2 h-8 bg-white/10 rounded-md animate-pulse mb-10"></div>
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-full h-16 bg-[#1e293b]/40 rounded-2xl animate-pulse"></div>
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <div className="flex items-center gap-2 text-indigo-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Yapay Zeka Soru Hazırlıyor...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F1A] text-blue-100 p-6">
        <div className="w-full max-w-md p-8 text-center border border-blue-500/20 backdrop-blur-md bg-[#0f172a]/80 shadow-[0_0_30px_rgba(59,130,246,0.1)] rounded-2xl">
          <BrainCircuit size={48} className="mx-auto mb-4 text-blue-400 opacity-50" />
          <h2 className="text-2xl font-bold mb-2">Soru Bulunamadı</h2>
          <p className="text-blue-200/60 mb-6 text-sm">
            Görünüşe göre havuzumuzda size uygun soru kalmadı ve yapay zeka şu an üretim yapamıyor.
          </p>
          <button onClick={() => navigate('/student')} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg w-full transition-all">
            Panoya Dön
          </button>
        </div>
      </div>
    );
  }

  const letters = ['A', 'B', 'C', 'D', 'E'];

  const formatTime = (seconds) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };
  
  const getTimerColor = () => {
    if (timeLeft > 30) return "text-emerald-400 border-emerald-500/30";
    if (timeLeft > 10) return "text-yellow-400 border-yellow-500/30 shadow-[0_0_15px_rgba(250,204,21,0.2)]";
    return "text-red-500 border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse font-bold scale-110";
  };

  const levelLabels = { 1: "Temel", 2: "Orta", 3: "İleri" };
  const levelColors = { 
    1: "text-blue-400 bg-blue-500/10 border-blue-500/20", 
    2: "text-amber-400 bg-amber-500/10 border-amber-500/20", 
    3: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" 
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F1A] text-blue-50 relative overflow-hidden">
      
      {/* ── Background Glows ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-500/15 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-fuchsia-500/15 rounded-full blur-[100px] mix-blend-screen"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/8 rounded-full blur-[150px] mix-blend-screen"></div>
      </div>

      {/* ── Header ── */}
      <div className="w-full px-6 pt-10 pb-4 flex items-center justify-between z-10 relative">
        <button onClick={() => navigate('/student')} className="flex items-center gap-2 text-blue-300 hover:text-white transition-colors group">
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> 
          <span className="font-medium text-sm">Panoya Dön</span>
        </button>
        
        <div className="flex flex-col items-center">
          <div className="font-bold tracking-widest text-[#F8FAFC]">
            {subject.toUpperCase()}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {/* Seviye Rozeti */}
            <div className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 ${levelColors[learningStats.currentLevel] || levelColors[2]}`}>
              <Award size={12} /> Seviye {learningStats.currentLevel || 2}: {levelLabels[learningStats.currentLevel] || "Orta"}
            </div>
            {/* Streak Noktaları */}
            <div className="flex gap-1" title={`${learningStats.correctStreak}/3 Seri`}>
              {[1,2,3].map((dot) => (
                 <div key={dot} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${dot <= learningStats.correctStreak ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
          {topicMasteryValue !== null && (
            <div className="mt-2 flex items-center gap-3">
              <div className="text-xs text-slate-300 font-medium">{topicMasteryLevelName || 'Ustalık'}: {topicMasteryValue}%</div>
              <div className="w-40 h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-2 bg-amber-400" style={{ width: `${topicMasteryValue}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Timer */}
        <div className={`px-4 py-1.5 rounded-xl border bg-white/5 font-mono text-xl transition-all duration-300 backdrop-blur-sm flex items-center justify-center min-w-[90px] ${getTimerColor()}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* ── Quiz Card ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 relative w-full max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 50, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.97 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full p-8 md:p-10 ds-card !rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] relative"
          >
            {/* Overlay if changing question */}
            {isChangingQuestion && (
              <div className="absolute inset-0 bg-[#0B0F1A]/50 backdrop-blur-sm rounded-3xl z-40 flex flex-col items-center justify-center">
                <Loader2 size={36} className="text-indigo-400 animate-spin mb-3" />
                <p className="text-sm text-indigo-300 font-medium animate-pulse">Sıradaki Soru Hazırlanıyor...</p>
              </div>
            )}

            {/* Success badge */}
            <div className={`absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-400 to-emerald-600 text-white px-8 py-2 md:py-3 rounded-full font-bold shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-500 text-lg md:text-xl flex items-center gap-2 z-50 ${showSuccess ? 'opacity-100 scale-100 -translate-y-4' : 'opacity-0 scale-50 pointer-events-none'}`}>
              <span>🎉</span> Harika!
            </div>

            {showLevelUpBanner && (
              <div className="absolute top-4 right-4 z-50 p-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg shadow-lg flex items-center gap-2">
                <span className="text-lg">🚀</span>
                <div className="text-sm font-semibold">Seviye Atladın! <span className="font-normal ml-2">{topicMasteryLevelName}</span></div>
              </div>
            )}

            {/* Question Text */}
            <div className="min-h-[100px] flex flex-col justify-center mb-6">
              {questionSource && (
                <div className="mb-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${questionSource === 'ai' ? 'bg-indigo-500/10 text-indigo-200' : 'bg-amber-500/10 text-amber-200'}`}>
                    {questionSource === 'ai' ? '✨ AI tarafından üretildi' : '📚 Hazır soru'}
                  </span>
                </div>
              )}
              <h2 className="text-xl md:text-[1.4rem] font-medium leading-relaxed text-blue-50 tracking-wide">
                {renderContent(currentQuestion.text)}
              </h2>
            </div>

            {/* ── Hint Button ── */}
            <div className="mb-6">
              <button
                onClick={handleHintRequest}
                disabled={isAnswering}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/15 hover:border-amber-400/50 text-amber-300 text-sm font-medium transition-all duration-200 group disabled:opacity-40"
              >
                {hintLoading
                  ? <Loader2 size={15} className="animate-spin" />
                  : <Lightbulb size={15} className="group-hover:text-amber-200 transition-colors" />
                }
                {hintLoading ? 'AI İpucu Üretiyor...' : showHint ? 'İpucunu Gizle' : "AI'dan İpucu Al"}
              </button>

              {/* Hint Box */}
              <AnimatePresence>
                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: '0.75rem' }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/6 backdrop-blur-sm">
                      <div className="flex items-start gap-2.5">
                        <Lightbulb size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-100/90 text-sm leading-relaxed">
                          {hintLoading
                            ? <span className="flex items-center gap-2 text-amber-400/70"><Loader2 size={13} className="animate-spin" /> AI ipucu hazırlıyor...</span>
                            : hintText || '...'
                          }
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Options ── */}
            <div className="flex flex-col gap-3">
              {currentQuestion.options && currentQuestion.options.map((opt, idx) => {
                const letter = letters[idx] || '';
                let btnClass = "bg-[#1e293b]/40 border border-[#334155] hover:border-blue-400/60 hover:bg-blue-500/10 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] text-slate-200";
                let icon = null;
                const isLocked = isAnswering || isChangingQuestion;
                const isFirstWrong = opt === firstWrongOption && !isAnswering; 

                if (isLocked) {
                  if (opt === currentQuestion.correctAnswer) {
                    btnClass = "bg-emerald-500/20 border-emerald-500 text-emerald-100 transform scale-[1.02] shadow-[0_0_25px_rgba(16,185,129,0.3)] !border-2";
                    icon = <CheckCircle2 size={24} className="text-emerald-400 animate-bounce" />;
                  } else if (opt === selectedOption && !showSuccess) {
                    btnClass = "bg-red-500/20 border-red-500 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.3)] !border-2";
                    icon = <XCircle size={24} className="text-red-400" />;
                  } else if (opt === firstWrongOption && !showSuccess) {
                    btnClass = "bg-red-500/8 border-red-500/30 text-red-200/50 opacity-50";
                  } else {
                    btnClass = "opacity-30 border-white/5 bg-transparent";
                  }
                } else if (isFirstWrong) {
                  btnClass = "bg-red-500/15 border-red-500/60 text-red-200 shadow-[0_0_14px_rgba(239,68,68,0.2)] !border";
                  icon = <XCircle size={20} className="text-red-400/80" />;
                }

                return (
                  <motion.button
                    key={idx}
                    disabled={isLocked}
                    onClick={() => handleOptionClick(opt)}
                    whileHover={!isLocked ? { x: 4 } : {}}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`w-full p-4 md:p-5 rounded-2xl text-left flex items-center justify-between transition-all duration-300 group ${btnClass}`}
                  >
                    <div className="flex items-center gap-5 w-full">
                      <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/10 text-sm font-bold font-mono transition-colors ${!isLocked && 'group-hover:bg-blue-500/30 group-hover:text-blue-100'}`}>
                        {letter}
                      </div>
                      <span className="text-base md:text-lg leading-relaxed flex-1">{renderContent(opt)}</span>
                    </div>
                    {icon && <div className="ml-4">{icon}</div>}
                  </motion.button>
                );
              })}
            </div>

            {/* ── Navigation Buttons ── */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
              <div className="text-sm text-slate-400 flex items-center gap-2">
                 <span className="px-2 py-1 bg-white/5 rounded-md text-xs font-mono">#{questionCount}</span>
              </div>

              <div className="flex items-center gap-2">
                {wrongAttempts === 1 && !isAnswering && (
                  <span className="text-xs text-orange-400/90 font-medium animate-pulse">
                    ⚠️ 1 hakkın kaldı!
                  </span>
                )}
                {wrongAnswered && (
                  <span className="text-xs text-amber-400/80 font-medium animate-pulse">
                    💬 AI Koç seni bekliyor!
                  </span>
                )}
                <button
                  onClick={goToNext}
                  disabled={isChangingQuestion || (!wrongAnswered && !showSuccess)}
                  className={`group disabled:opacity-30 disabled:cursor-not-allowed ${
                    wrongAnswered
                      ? 'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border-2 border-amber-500/60 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                      : 'ds-btn-primary'
                  }`}
                >
                  Sonraki Soru
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── FloatingAI — Quiz Koçu ── */}
      <FloatingAI
        quizContext={quizContext}
        autoOpen={autoOpenAI}
        onAutoOpenHandled={() => setAutoOpenAI(false)}
        onPanelToggle={setAiPanelOpen}
      />
    </div>
  );
}
