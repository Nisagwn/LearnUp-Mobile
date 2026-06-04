import React, { createContext, useState, useEffect, useCallback } from 'react';
import { auth, db } from '@/services/firebase';
import { doc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ensureDailyState } from '@/services/gamificationApi';
import { registerForPushNotifications } from '@/services/pushService';
import { subscribeSRSCards } from '@/services/srsApi';
import { categorize as srsCategorize } from '@/utils/srs';

export const UserStatsContext = createContext();

const LEVEL_CONFIG = {
  baseDailyXP: 100,
  xpPerLevel: 500,
  getLevelFromXP: (xp) => Math.floor((xp || 0) / 500) + 1,
};

const getTimestampMs = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatLocalISO = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export function UserStatsProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [stats, setStats] = useState({
    totalSolved: 0, correctAnswers: 0, wrongAnswers: 0,
    skippedAnswers: 0, net: 0, successRate: 0,
    level: 1, totalXP: 0, streakDays: 0, todaySolved: 0,
  });
  const [masteryScores, setMasteryScores] = useState({});
  const [lastSolvedBySubject, setLastSolvedBySubject] = useState({});
  const [subjectTrends, setSubjectTrends] = useState({});
  const [weakSubTopicBySubject, setWeakSubTopicBySubject] = useState({});
  const [avgSecondsPerSubject, setAvgSecondsPerSubject] = useState({});
  const [todayBriefBase, setTodayBriefBase] = useState({
    solvedToday: 0,
    correctToday: 0,
    timeSpentTodayMs: 0,
  });
  const [srsCards, setSrsCards] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [dailyActivity, setDailyActivity] = useState([]);
  const [answersLog, setAnswersLog] = useState([]);
  const [classRanking, setClassRanking] = useState({
    rank: null,
    total: null,
    list: [],
    loading: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const unsubscribeRefs = React.useRef({});

  const calculateStreak = useCallback((userAnswers) => {
    if (!userAnswers || userAnswers.length === 0) return 0;
    const daySet = new Set();
    userAnswers.forEach((answer) => {
      const ts = answer.timestamp;
      let date = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date());
      daySet.add(formatLocalISO(date));
    });
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      if (daySet.has(formatLocalISO(d))) streak++;
      else break;
    }
    return streak;
  }, []);

  const calculateWeeklyAndMonthly = useCallback((userAnswers) => {
    const now = new Date();
    const last7 = [];
    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const iso = formatLocalISO(d);
      last7.push(d);
      dayMap[iso] = { correct: 0, wrong: 0, skipped: 0 };
    }
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    userAnswers.forEach((answer) => {
      const ts = answer.timestamp;
      const date = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date());
      const iso = formatLocalISO(date);
      if (dayMap[iso]) {
        if (answer.isCorrect === true) dayMap[iso].correct++;
        else if (answer.isSkipped === true || answer.skipped === true) dayMap[iso].skipped++;
        else dayMap[iso].wrong++;
      }
    });
    const weeklyArray = last7.map((d) => {
      const iso = formatLocalISO(d);
      const b = dayMap[iso] || { correct: 0, wrong: 0, skipped: 0 };
      return { name: dayNames[d.getDay()], date: iso, Doğru: b.correct, Yanlış: b.wrong, Boş: b.skipped };
    });

    const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
    const monthlyMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap[`${d.getFullYear()}-${d.getMonth()}`] = { correct: 0, total: 0 };
    }
    userAnswers.forEach((answer) => {
      const ts = answer.timestamp;
      const date = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date());
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthlyMap[key]) {
        monthlyMap[key].total++;
        if (answer.isCorrect === true) monthlyMap[key].correct++;
      }
    });
    const monthlyArray = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = monthlyMap[key] || { correct: 0, total: 0 };
      monthlyArray.push({
        name: MONTHS_TR[d.getMonth()],
        value: b.total ? Math.round((b.correct / b.total) * 100) : 0,
        correct: b.correct, total: b.total,
      });
    }
    return { weeklyArray, monthlyArray };
  }, []);

  // Son 84 günün (12 hafta) günlük çözüm sayısı — tutarlılık ısı haritası için.
  // En eski gün başta, bugün sonda. Heatmap bileşeni 7x12 grid'e dağıtır.
  const calculateDailyActivity = useCallback((userAnswers) => {
    const DAYS = 84;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const counts = {};
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      counts[formatLocalISO(d)] = 0;
    }
    (userAnswers || []).forEach((answer) => {
      const ts = answer.timestamp;
      const date = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date(ts));
      const iso = formatLocalISO(date);
      if (iso in counts) counts[iso]++;
    });
    return Object.keys(counts).map((date) => ({ date, count: counts[date] }));
  }, []);

  // Trend (son 7g vs önceki 7g doğru oranı), zayıf alt konu (subject başına),
  // bugünkü brief, ortalama soru süresi — hepsi tek pass'te user_logs üzerinden.
  const calculateEnrichments = useCallback((userAnswers, now) => {
    const trends = {};
    const weakSubTopic = {};
    const avgSecResult = {};
    let solvedToday = 0;
    let correctToday = 0;
    let timeSpentTodayMs = 0;

    if (!userAnswers || userAnswers.length === 0) {
      return { trends, weakSubTopic, avgSecondsPerSubject: avgSecResult, solvedToday, correctToday, timeSpentTodayMs };
    }

    const todayIso = formatLocalISO(new Date(now));
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    const trendBuckets = {};
    const avgSecAcc = {};
    const weakCounter = {};

    userAnswers.forEach((a) => {
      const ts = getTimestampMs(a.timestamp);
      if (!ts) return;
      const subj = (a.subject || a.category || 'Genel').toLowerCase();
      const isCorrect = a.isCorrect === true;
      const isSkipped = a.isSkipped === true || a.skipped === true;
      const iso = formatLocalISO(new Date(ts));
      const timeSec = Number(a.duration ?? a.timeSpent ?? 0);
      const timeMs = timeSec > 0 ? timeSec * 1000 : 0;

      if (iso === todayIso) {
        solvedToday++;
        if (isCorrect) correctToday++;
        timeSpentTodayMs += timeMs;
      }

      if (timeMs > 0) {
        if (!avgSecAcc[subj]) avgSecAcc[subj] = { total: 0, count: 0 };
        avgSecAcc[subj].total += timeMs;
        avgSecAcc[subj].count++;
      }

      if (ts >= fourteenDaysAgo && !isSkipped) {
        if (!trendBuckets[subj]) trendBuckets[subj] = { recent: { total: 0, correct: 0 }, prev: { total: 0, correct: 0 } };
        const bucket = ts >= sevenDaysAgo ? trendBuckets[subj].recent : trendBuckets[subj].prev;
        bucket.total++;
        if (isCorrect) bucket.correct++;
      }

      if (!isCorrect && !isSkipped) {
        const subTopic = a.sub_topic || a.subject || 'Genel';
        if (!weakCounter[subj]) weakCounter[subj] = {};
        weakCounter[subj][subTopic] = (weakCounter[subj][subTopic] ?? 0) + 1;
      }
    });

    Object.entries(trendBuckets).forEach(([subj, b]) => {
      const recentRate = b.recent.total > 0 ? b.recent.correct / b.recent.total : 0;
      const prevRate = b.prev.total > 0 ? b.prev.correct / b.prev.total : 0;
      if (b.recent.total + b.prev.total === 0) return;
      const diff = recentRate - prevRate;
      if (b.prev.total === 0) trends[subj] = b.recent.correct > 0 ? 'up' : 'flat';
      else if (Math.abs(diff) < 0.05) trends[subj] = 'flat';
      else trends[subj] = diff > 0 ? 'up' : 'down';
    });

    Object.entries(weakCounter).forEach(([subj, mapVal]) => {
      let topSubTopic = '';
      let topCount = 0;
      Object.entries(mapVal).forEach(([st, count]) => {
        if (count > topCount) { topSubTopic = st; topCount = count; }
      });
      if (topSubTopic) weakSubTopic[subj] = { subTopic: topSubTopic, wrongCount: topCount };
    });

    Object.entries(avgSecAcc).forEach(([subj, v]) => {
      if (v.count > 0) avgSecResult[subj] = Math.round(v.total / v.count / 1000);
    });

    return { trends, weakSubTopic, avgSecondsPerSubject: avgSecResult, solvedToday, correctToday, timeSpentTodayMs };
  }, []);

  const calculateStatsFromAnswers = useCallback((userAnswers) => {
    if (!userAnswers || userAnswers.length === 0) {
      return {
        totalSolved: 0, correctAnswers: 0, wrongAnswers: 0, skippedAnswers: 0,
        net: 0, successRate: 0, level: 1, totalXP: 0, streakDays: 0, masteryScores: {},
      };
    }
    let correctCount = 0, wrongCount = 0, skippedCount = 0, totalXP = 0;
    const subjectMap = {};
    userAnswers.forEach((answer) => {
      const isCorrect = answer.isCorrect === true;
      const isSkipped = answer.isSkipped === true || answer.skipped === true;
      if (isCorrect) correctCount++;
      else if (isSkipped) skippedCount++;
      else wrongCount++;
      totalXP += answer.xp || (isCorrect ? 10 : 2);
      const subject = answer.subject || answer.category || 'Genel';
      if (!subjectMap[subject]) subjectMap[subject] = { solved_count: 0, score: 0, xp_gained: 0 };
      subjectMap[subject].solved_count++;
      if (isCorrect) subjectMap[subject].score++;
      subjectMap[subject].xp_gained += answer.xp || (isCorrect ? 10 : 2);
    });
    const totalSolved = userAnswers.length;
    const net = correctCount - wrongCount * 0.25;
    const successRate = totalSolved > 0 ? Math.round((correctCount / totalSolved) * 100) : 0;
    const level = LEVEL_CONFIG.getLevelFromXP(totalXP);
    const streak = calculateStreak(userAnswers);
    const todayIso = formatLocalISO(new Date());
    const todaySolved = userAnswers.reduce((acc, answer) => {
      const ts = answer.timestamp;
      const date = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date(ts));
      return formatLocalISO(date) === todayIso ? acc + 1 : acc;
    }, 0);
    return {
      totalSolved, correctAnswers: correctCount, wrongAnswers: wrongCount,
      skippedAnswers: skippedCount, net: Math.round(net * 10) / 10,
      successRate, level, totalXP, streakDays: streak, todaySolved, subjectMap,
    };
  }, [calculateStreak]);

  // ── Sınıf sıralaması: aynı teacherId'ye sahip tüm öğrencilerin net skoruna göre ──
  const loadClassRanking = useCallback(async (uid, teacherId) => {
    if (!teacherId) {
      setClassRanking({ rank: null, total: null, list: [], loading: false });
      return;
    }
    try {
      // Aynı sınıftaki tüm öğrencileri bul
      const studentsSnap = await getDocs(
        query(collection(db, 'users'), where('teacherId', '==', teacherId), where('role', '==', 'student'))
      );

      const students = [];
      studentsSnap.forEach(d => students.push({ uid: d.id, ...d.data() }));

      if (students.length === 0) {
        setClassRanking({ rank: null, total: 0, list: [], loading: false });
        return;
      }

      // Her öğrencinin loglarını çek ve net hesapla
      const rankData = await Promise.all(
        students.map(async (student) => {
          const logsSnap = await getDocs(
            query(collection(db, 'user_logs'), where('studentId', '==', student.uid))
          );
          let correct = 0, wrong = 0, total = 0;
          logsSnap.forEach(d => {
            const a = d.data();
            total++;
            if (a.isCorrect === true) correct++;
            else if (a.isSkipped !== true && a.skipped !== true) wrong++;
          });
          const net = Math.round((correct - wrong * 0.25) * 10) / 10;
          const name = student.name || student.fullName || student.email?.split('@')[0] || 'Öğrenci';
          return { uid: student.uid, name, correct, total, net };
        })
      );

      // Net'e göre sırala (eşitse doğru sayısına bak)
      rankData.sort((a, b) => b.net !== a.net ? b.net - a.net : b.correct - a.correct);

      const rank = rankData.findIndex(s => s.uid === uid) + 1;
      setClassRanking({ rank, total: rankData.length, list: rankData, loading: false });
    } catch (err) {
      console.warn('Sınıf sıralaması yüklenemedi:', err);
      setClassRanking({ rank: null, total: null, list: [], loading: false });
    }
  }, []);

  const setupListeners = useCallback((uid) => {
    if (!uid) return;
    Object.values(unsubscribeRefs.current).forEach(unsub => {
      if (typeof unsub === 'function') { try { unsub(); } catch { /* listener zaten kapanmis olabilir */ } }
    });
    unsubscribeRefs.current = {};

    const userDocRef = doc(db, 'users', uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile(data);
        // teacherId gelince sıralamayı yükle
        if (data.teacherId) loadClassRanking(uid, data.teacherId);
        else setClassRanking({ rank: null, total: null, list: [], loading: false });
      }
    }, (err) => { console.warn('User doc listener error:', err); setError(err.message); });
    unsubscribeRefs.current.user = unsubUser;

    const answersQuery = query(collection(db, 'user_logs'), where('studentId', '==', uid));
    const unsubAnswers = onSnapshot(answersQuery, (snap) => {
      const answers = [];
      snap.forEach(d => answers.push(d.data()));
      answers.sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp));

      const calculated = calculateStatsFromAnswers(answers);
      const { weeklyArray, monthlyArray } = calculateWeeklyAndMonthly(answers);

      setStats({
        totalSolved: calculated.totalSolved,
        correctAnswers: calculated.correctAnswers,
        wrongAnswers: calculated.wrongAnswers,
        skippedAnswers: calculated.skippedAnswers,
        net: calculated.net,
        successRate: calculated.successRate,
        level: calculated.level,
        totalXP: calculated.totalXP,
        streakDays: calculated.streakDays,
        todaySolved: calculated.todaySolved || 0,
      });

      const mastery = {};
      if (calculated.subjectMap) {
        Object.entries(calculated.subjectMap).forEach(([subject, data]) => {
          mastery[subject] = {
            solved_count: data.solved_count,
            score: data.solved_count > 0 ? Math.round((data.score / data.solved_count) * 100) : 0,
            xp_gained: data.xp_gained,
          };
        });
      }
      setMasteryScores(mastery);

      // Son aktivite (en güncel timestamp) per subject — Learn sayfası "lastSolved" rozeti için
      const lastByS = {};
      answers.forEach((a) => {
        const subj = a.subject || a.category;
        if (!subj) return;
        const ts = getTimestampMs(a.timestamp);
        if (!ts) return;
        const cur = lastByS[subj] || 0;
        if (ts > cur) lastByS[subj] = ts;
      });
      setLastSolvedBySubject(lastByS);

      const enrich = calculateEnrichments(answers, Date.now());
      setSubjectTrends(enrich.trends);
      setWeakSubTopicBySubject(enrich.weakSubTopic);
      setAvgSecondsPerSubject(enrich.avgSecondsPerSubject);
      setTodayBriefBase({
        solvedToday: enrich.solvedToday,
        correctToday: enrich.correctToday,
        timeSpentTodayMs: enrich.timeSpentTodayMs,
      });

      setWeeklyData(weeklyArray);
      setMonthlyData(monthlyArray);
      setDailyActivity(calculateDailyActivity(answers));
      setAnswersLog(answers);
      setLoading(false);
    }, (err) => {
      console.warn('Answers listener error:', err);
      setError(err.message);
      setLoading(false);
    });
    unsubscribeRefs.current.answers = unsubAnswers;

    // SRS kartları — yanlışlarım sekmesi ve smart feed "tekrar zamanı" için
    const unsubSrs = subscribeSRSCards((cards) => setSrsCards(cards));
    if (unsubSrs) unsubscribeRefs.current.srs = unsubSrs;
  }, [calculateStatsFromAnswers, calculateWeeklyAndMonthly, calculateDailyActivity, calculateEnrichments, loadClassRanking]);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        setupListeners(user.uid);
        // Günlük görev + lig kaydını sunucuda hazırla (sessizce; emülatör kapalıysa atlanır)
        ensureDailyState().catch(() => {});
        // Push token'ı kayıt et (sessizce; izin yoksa veya simülatörde atlanır)
        registerForPushNotifications().catch(() => {});
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setStats({ totalSolved:0, correctAnswers:0, wrongAnswers:0, skippedAnswers:0, net:0, successRate:0, level:1, totalXP:0, streakDays:0, todaySolved:0 });
        setMasteryScores({});
        setLastSolvedBySubject({});
        setSubjectTrends({});
        setWeakSubTopicBySubject({});
        setAvgSecondsPerSubject({});
        setTodayBriefBase({ solvedToday: 0, correctToday: 0, timeSpentTodayMs: 0 });
        setSrsCards([]);
        setDailyActivity([]);
        setAnswersLog([]);
        setClassRanking({ rank: null, total: null, list: [], loading: false });
      }
    });
    return () => {
      unsubAuth();
      Object.values(unsubscribeRefs.current).forEach(unsub => {
        if (typeof unsub === 'function') { try { unsub(); } catch { /* listener zaten kapanmis olabilir */ } }
      });
      unsubscribeRefs.current = {};
    };
  }, [setupListeners]);

  // Kalıcı oyunlaştırma durumu (recordAnswer'ın yazdığı users/{uid}.gamification).
  const gamification = userProfile?.gamification || null;

  // Seri ve XP: hem kalıcı (gamification — Cloud Functions yazar) hem türetilmiş
  // (user_logs'tan hesaplanan) kaynaklar var. İkisinin maksimumu alınır:
  //  • Functions kapalıyken kalıcı değer bayatlar → türetilmiş kazanır
  //  • Functions açıkken streak freeze devreye girerse kalıcı > türetilmiş → kalıcı kazanır
  // Böylece hangi durum olursa olsun gösterilen değer hep mantıklı kalır.
  const mergedStats = {
    ...stats,
    streakDays: Math.max(
      gamification?.streak?.count || 0,
      stats.streakDays || 0
    ),
    totalXP: Math.max(
      gamification?.xp || 0,
      stats.totalXP || 0
    ),
  };

  // Önerilen ders — Learn sayfasındaki "ÖNERİLEN" pill için:
  // Öncelik: 1) günlük subject_solve görevi 2) en düşük mastery 3) hiç çözülmemiş ders
  const recommendedSubject = React.useMemo(() => {
    const dailySubject = gamification?.dailyQuests?.quests?.find?.(
      (q) => q?.type === 'subject_solve' && q?.subject,
    )?.subject;
    if (dailySubject) return dailySubject;

    const entries = Object.entries(masteryScores);
    if (entries.length === 0) return null;
    const withProgress = entries.filter(([, m]) => (m.solved_count ?? 0) > 0);
    if (withProgress.length === 0) return null;
    withProgress.sort((a, b) => (a[1].score ?? 0) - (b[1].score ?? 0));
    return withProgress[0]?.[0] ?? null;
  }, [gamification, masteryScores]);

  // Bugünkü brief — kalan günlük hedef gamification quest'inden türer.
  const todayBrief = React.useMemo(() => {
    const solveCountQuest = gamification?.dailyQuests?.quests?.find?.(
      (q) => q?.type === 'solve_count',
    );
    const target = solveCountQuest?.target ?? 0;
    const progress = solveCountQuest?.progress ?? 0;
    return {
      ...todayBriefBase,
      remainingTarget: Math.max(0, target - progress),
      dailyTarget: target,
    };
  }, [todayBriefBase, gamification]);

  // SRS due count — kategorisi 'new' veya 'review' olan kartların sayısı
  const srsDueCount = React.useMemo(() => {
    const now = Date.now();
    return srsCards.reduce((acc, c) => {
      const cat = srsCategorize(c, now);
      return cat === 'new' || cat === 'review' ? acc + 1 : acc;
    }, 0);
  }, [srsCards]);

  const value = {
    currentUser, userProfile, stats: mergedStats, gamification, masteryScores,
    lastSolvedBySubject, recommendedSubject,
    subjectTrends, weakSubTopicBySubject, avgSecondsPerSubject, todayBrief,
    srsCards, srsDueCount,
    weeklyData, monthlyData, dailyActivity, answersLog, classRanking, loading, error,
  };

  return <UserStatsContext.Provider value={value}>{children}</UserStatsContext.Provider>;
}

export function useUserStats() {
  const context = React.useContext(UserStatsContext);
  if (!context) throw new Error('useUserStats must be used within UserStatsProvider');
  return context;
}
