import { useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LearnBackground } from '@/components/learn/LearnBackground';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  ChevronRight,
  BookOpen,
  FlaskConical,
  Calculator,
  Sigma,
  Atom,
  Globe,
  History,
  BookText,
  XCircle,
  Bookmark as BookmarkIcon,
  RotateCw,
  Clock,
  Award,
  Sparkles,
} from 'lucide-react-native';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import questionsRaw from '@/data/questions.json';
import { ChatFAB } from '@/components/common/ChatFAB';
import { FilterChips } from '@/components/common/FilterChips';
import { EmptyState } from '@/components/common/EmptyState';
import { AIQuizSettingsSheet, Difficulty, AIStyle } from '@/components/common/AIQuizSettingsSheet';
import { generateQuiz } from '@/services/aiService';
import { buildAIQuizPath } from '@/utils/quizRoute';
import { fetchSampleQuestions } from '@/services/questionPoolApi';
import type { GenerateQuizMode } from '@/types/quiz';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { LearningPathHero } from '@/components/learn/LearningPathHero';
import { ContinueLearningCard } from '@/components/learn/ContinueLearningCard';
import { SubjectCard } from '@/components/learn/SubjectCard';
import {
  RecommendedTopicsGrid,
  WeakTopicEntry,
} from '@/components/learn/RecommendedTopicsGrid';
import { XPFlyUp } from '@/components/learn/XPFlyUp';
import { SubjectCardSkeleton } from '@/components/learn/SubjectCardSkeleton';
import { TodayBriefCard } from '@/components/learn/TodayBriefCard';
import { QuickActionRow } from '@/components/learn/QuickActionRow';
import { CreateFolderSheet } from '@/components/learn/CreateFolderSheet';
import { Trash2 } from 'lucide-react-native';
import { FeedCard } from '@/components/learn/FeedCard';
import { SegmentedTabs } from '@/components/common/SegmentedTabs';
import { BulkActionToolbar } from '@/components/common/BulkActionToolbar';
import { WrongTopicGroup } from '@/components/learn/WrongTopicGroup';
import { buildLearnFeed, type FeedItem } from '@/utils/learnFeed';
import { useFeedDismiss } from '@/utils/feedDismiss';
import { groupByCategory, groupBySubTopic, pickTopForRetake } from '@/services/srsApi';
import type { SRSCard, SRSCategory } from '@/utils/srs';
import { SearchBar } from '@/components/common/SearchBar';
import { FolderRow, AddFolderRow } from '@/components/learn/FolderRow';
import { BookmarkItem } from '@/components/learn/BookmarkItem';
import { BookmarkEditSheet } from '@/components/learn/BookmarkEditSheet';
import {
  subscribeBookmarks,
  subscribeBookmarkFolders,
  createFolder,
  deleteFolder,
  updateBookmarkOrganization,
  deleteBookmark,
  bulkDelete as bulkDeleteBookmarks,
  bulkMove as bulkMoveBookmarks,
  searchBookmarks,
  type BookmarkDoc,
  type BookmarkFolder,
} from '@/services/bookmarksApi';

interface Question {
  subject: string;
}
const QUESTIONS = questionsRaw as Question[];

interface SubjectMeta {
  Icon: typeof BookOpen;
  color: string;
  bg: string;
  label: string;
}

const SUBJECT_META: Record<string, SubjectMeta> = {
  biology: { Icon: FlaskConical, color: '#16A34A', bg: '#DCFCE7', label: 'Biyoloji' },
  math: { Icon: Calculator, color: '#6366F1', bg: '#EEF2FF', label: 'Matematik' },
  mathematics: { Icon: Sigma, color: '#6366F1', bg: '#EEF2FF', label: 'Matematik' },
  physics: { Icon: Atom, color: '#2563EB', bg: '#DBEAFE', label: 'Fizik' },
  chemistry: { Icon: FlaskConical, color: '#EA580C', bg: '#FFEDD5', label: 'Kimya' },
  history: { Icon: History, color: '#CA8A04', bg: '#FEF9C3', label: 'Tarih' },
  geography: { Icon: Globe, color: '#0891B2', bg: '#CFFAFE', label: 'Coğrafya' },
  literature: { Icon: BookText, color: '#DB2777', bg: '#FCE7F3', label: 'Edebiyat' },
  edebiyat: { Icon: BookText, color: '#DB2777', bg: '#FCE7F3', label: 'Edebiyat' },
  philosophy: { Icon: BookOpen, color: '#8B5CF6', bg: '#F3E8FF', label: 'Felsefe' },
  felsefe: { Icon: BookOpen, color: '#8B5CF6', bg: '#F3E8FF', label: 'Felsefe' },
  'religion and ethics': {
    Icon: BookOpen,
    color: '#F59E0B',
    bg: '#FEF3C7',
    label: 'Din Kültürü ve Ahlak Bilgisi',
  },
  'turkish language and literature': {
    Icon: BookText,
    color: '#DB2777',
    bg: '#FCE7F3',
    label: 'Türk Dili ve Edebiyatı',
  },
  english: { Icon: Globe, color: '#0891B2', bg: '#CFFAFE', label: 'İngilizce' },
  ingilizce: { Icon: Globe, color: '#0891B2', bg: '#CFFAFE', label: 'İngilizce' },
  ing: { Icon: Globe, color: '#0891B2', bg: '#CFFAFE', label: 'İngilizce' },
};

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function getMeta(subject: string): SubjectMeta {
  return (
    SUBJECT_META[subject.toLowerCase()] ?? {
      Icon: BookOpen,
      color: '#6366F1',
      bg: '#EEF2FF',
      label: capitalize(subject),
    }
  );
}

interface LogEntry {
  id: string;
  questionText?: string;
  subject?: string;
  sub_topic?: string;
  choices?: string[];
  correctIndex?: number;
  timestamp?: { toMillis?: () => number };
}

type FilterId = 'all' | 'wrong' | 'bookmarks' | 'recommended';

export default function Learn() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const ctx = useContext(UserStatsContext);
  const { xpGain, subject: highlightSubject } = useLocalSearchParams<{
    xpGain?: string;
    subject?: string;
  }>();

  const [filter, setFilter] = useState<FilterId>('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSheetTopic, setAiSheetTopic] = useState<string | null>(null);
  const [focusLoadingTopic, setFocusLoadingTopic] = useState<string | null>(null);
  const [flyUpAmount, setFlyUpAmount] = useState(0);
  const [derivationAvailable, setDerivationAvailable] = useState(false);

  // Kullanıcı profili → grade (signup/profile'da yazılır)
  const studentGrade: string =
    (ctx?.userProfile?.grade as string | undefined) ?? '10';

  // Sheet açıldığında ANALYZE_AND_DERIVE chip'inin aktif olması için
  // havuzda örnek var mı kontrol et.
  useEffect(() => {
    if (!aiSheetTopic) {
      setDerivationAvailable(false);
      return;
    }
    let cancelled = false;
    fetchSampleQuestions({ subject: aiSheetTopic, grade: studentGrade, limit: 1 })
      .then((samples) => {
        if (!cancelled) setDerivationAvailable(samples.length > 0);
      })
      .catch(() => {
        if (!cancelled) setDerivationAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aiSheetTopic, studentGrade]);

  // Quiz finish'inden xpGain ile dönüldüyse fly-up tetikle + param temizle.
  useEffect(() => {
    const amt = Number(xpGain ?? 0);
    if (amt > 0) {
      setFlyUpAmount(amt);
      router.setParams({ xpGain: '', subject: '' });
    }
  }, [xpGain, router]);

  const subjects = useMemo(() => {
    const map = new Map<string, number>();
    QUESTIONS.forEach((q) => map.set(q.subject, (map.get(q.subject) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, []);

  const [wrongs, setWrongs] = useState<LogEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkDoc[]>([]);
  const [wrongsLoading, setWrongsLoading] = useState(true);
  const [bookmarksLoading, setBookmarksLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setWrongsLoading(false);
      return;
    }
    const q = query(
      collection(db, 'user_logs'),
      where('studentId', '==', uid),
      where('isCorrect', '==', false),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: LogEntry[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as LogEntry));
        arr.sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
        setWrongs(arr);
        setWrongsLoading(false);
      },
      () => setWrongsLoading(false),
    );
    return unsub;
  }, []);

  // Bookmark listener — subscribeBookmarks normalize'lı doc döner (folderId, tags, note dahil).
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setBookmarksLoading(false);
      return;
    }
    const unsub = subscribeBookmarks((arr) => {
      setBookmarks(arr);
      setBookmarksLoading(false);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Bookmark custom klasörleri
  const [customFolders, setCustomFolders] = useState<BookmarkFolder[]>([]);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeBookmarkFolders(setCustomFolders);
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleAIQuizConfirm = async (
    count: number,
    difficulty: Difficulty,
    customPrompt: string | undefined,
    style: AIStyle,
  ) => {
    if (aiLoading || !aiSheetTopic) return;
    setAiLoading(true);
    try {
      const finalTopic = customPrompt?.trim() || aiSheetTopic;
      const baseArgs = {
        subject: aiSheetTopic,
        topic: finalTopic,
        grade: studentGrade,
        count,
        difficulty,
      };
      let modeArg: GenerateQuizMode;
      if (style === 'ANALYZE_AND_DERIVE') {
        const samples = await fetchSampleQuestions({
          subject: aiSheetTopic,
          grade: studentGrade,
          limit: 5,
        });
        modeArg = {
          kind: 'ANALYZE_AND_DERIVE',
          ...baseArgs,
          sampleQuestions: samples.map((s) => ({
            question: s.question,
            choices: s.choices,
            correctIndex: s.answer,
            explanation: s.explanation,
          })),
        };
      } else if (style === 'CREATIVE_FREE') {
        modeArg = { kind: 'CREATIVE_FREE', ...baseArgs };
      } else {
        modeArg = { kind: 'STRICT_CURRICULUM', ...baseArgs };
      }
      const questions = await generateQuiz(modeArg);
      setAiSheetTopic(null);
      router.push(
        buildAIQuizPath({
          questions,
          subject: finalTopic,
          count,
          difficulty,
          aiMode: style,
          grade: studentGrade,
        }) as never,
      );
    } catch (err) {
      Alert.alert('AI Quiz', `Soru üretilemedi: ${(err as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleFocusTopicQuiz = async (subTopic: string, subjectLabel?: string) => {
    if (focusLoadingTopic) return;
    setFocusLoadingTopic(subTopic);
    try {
      // subject = gerçek ders adı (örn. "Matematik"); topic = zayıf alt-konu (örn. "Türev").
      // Eskiden subject'e alt-konu gönderiliyordu → AI tutarsız/boş üretip 502 veriyordu.
      const subject = subjectLabel?.trim() || subTopic;
      const questions = await generateQuiz({
        kind: 'STRICT_CURRICULUM',
        subject,
        topic: subTopic,
        grade: studentGrade,
        count: 5,
        difficulty: 'medium',
      });
      router.push(
        buildAIQuizPath({
          questions,
          subject,
          count: 5,
          difficulty: 'medium',
          mode: 'focus',
          aiMode: 'STRICT_CURRICULUM',
          grade: studentGrade,
        }) as never,
      );
    } catch (err) {
      Alert.alert('Odak Quiz', `Soru üretilemedi: ${(err as Error).message}`);
    } finally {
      setFocusLoadingTopic(null);
    }
  };

  const handleExplainSubject = (subjectLabel: string) => {
    const prompt = `Bana ${subjectLabel} konusunu özetle ve 3 anahtar fikrini ver.`;
    router.push(
      `/chatbot?seedPrompt=${encodeURIComponent(prompt)}&subject=${encodeURIComponent(
        subjectLabel,
      )}` as never,
    );
  };

  const handleFlashcard = (subjectLabel: string) => {
    Alert.alert(
      'Flashcard',
      `${subjectLabel} için flashcard modu yakında geliyor — şimdilik Quiz veya AI Üret ile pratik yapabilirsin.`,
    );
  };

  const handleMockExam = async (subjectLabel: string) => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const questions = await generateQuiz({
        kind: 'STRICT_CURRICULUM',
        subject: subjectLabel,
        topic: subjectLabel,
        grade: studentGrade,
        count: 10,
        difficulty: 'hard',
      });
      router.push(
        buildAIQuizPath({
          questions,
          subject: subjectLabel,
          count: 10,
          difficulty: 'hard',
          mode: 'mock',
          aiMode: 'STRICT_CURRICULUM',
          grade: studentGrade,
        }) as never,
      );
    } catch (err) {
      Alert.alert('Mock Sınav', `Soru üretilemedi: ${(err as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Yardımcılar — stable referans için useMemo
  const rawMastery = ctx?.masteryScores;
  const masteryScores = useMemo<Record<string, { score?: number; solved_count?: number }>>(
    () => rawMastery ?? {},
    [rawMastery],
  );
  const rawLastSolved = ctx?.lastSolvedBySubject;
  const lastSolvedBySubject = useMemo<Record<string, number>>(
    () => rawLastSolved ?? {},
    [rawLastSolved],
  );
  const unlockedBadges = (ctx?.userProfile?.unlockedBadges ?? {}) as Record<string, unknown>;
  const recommendedSubject: string | null = ctx?.recommendedSubject ?? null;
  const gamification = ctx?.gamification;
  const subjectTrends = (ctx?.subjectTrends ?? {}) as Record<string, 'up' | 'down' | 'flat'>;
  const weakSubTopicBySubject = (ctx?.weakSubTopicBySubject ?? {}) as Record<
    string,
    { subTopic: string; wrongCount: number }
  >;
  const avgSecondsPerSubject = (ctx?.avgSecondsPerSubject ?? {}) as Record<string, number>;
  const todayBrief = ctx?.todayBrief ?? {
    solvedToday: 0,
    correctToday: 0,
    timeSpentTodayMs: 0,
    remainingTarget: 0,
    dailyTarget: 0,
  };
  const srsCards = (ctx?.srsCards ?? []) as SRSCard[];
  const srsDueCount: number = ctx?.srsDueCount ?? 0;

  // LearningPathHero kaynağı
  const heroSource = useMemo(() => {
    const subjectSolveQuest = gamification?.dailyQuests?.quests?.find?.(
      (q: { type?: string; subject?: string }) =>
        q?.type === 'subject_solve' && q?.subject,
    ) as { subject?: string; progress?: number; target?: number } | undefined;
    if (subjectSolveQuest?.subject) {
      return {
        subject: subjectSolveQuest.subject,
        progress: subjectSolveQuest.progress ?? 0,
        target: subjectSolveQuest.target ?? 0,
        source: 'dailyQuest' as const,
      };
    }
    if (recommendedSubject) {
      return {
        subject: getMeta(recommendedSubject).label,
        progress: 0,
        target: 0,
        source: 'weakTopic' as const,
      };
    }
    return { subject: null, progress: 0, target: 0, source: 'general' as const };
  }, [gamification, recommendedSubject]);

  const heroSubjectKey = useMemo(() => {
    const subjectSolveQuest = gamification?.dailyQuests?.quests?.find?.(
      (q: { type?: string; subject?: string }) =>
        q?.type === 'subject_solve' && q?.subject,
    ) as { subject?: string } | undefined;
    return subjectSolveQuest?.subject ?? recommendedSubject ?? null;
  }, [gamification, recommendedSubject]);

  // ContinueLearningCard — son 24 saat
  const continueData = useMemo(() => {
    const entries = Object.entries(lastSolvedBySubject);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    const [subject, ms] = entries[0]!;
    if (Date.now() - ms > 24 * 60 * 60 * 1000) return null;
    return { subject, lastSolvedAtMs: ms };
  }, [lastSolvedBySubject]);

  // Hero için alt konu ve tahmini süre türetimi
  const heroSubTopic = useMemo(() => {
    if (!heroSubjectKey) return null;
    const w = weakSubTopicBySubject[heroSubjectKey.toLowerCase()];
    return w?.subTopic ?? null;
  }, [heroSubjectKey, weakSubTopicBySubject]);

  const heroEstimatedMinutes = useMemo(() => {
    if (!heroSubjectKey || heroSource.target <= 0) return 0;
    const avgSec = avgSecondsPerSubject[heroSubjectKey.toLowerCase()] ?? 30;
    const remaining = Math.max(0, heroSource.target - heroSource.progress);
    return Math.max(1, Math.round((avgSec * remaining) / 60));
  }, [heroSubjectKey, heroSource.target, heroSource.progress, avgSecondsPerSubject]);

  // Continue card — son seansın alt konusu + yanlış sayısı (son 1 saat içinde)
  const continueStats = useMemo(() => {
    if (!continueData) return { wrongCount: 0, subTopic: null as string | null };
    const since = continueData.lastSolvedAtMs - 60 * 60 * 1000;
    let wrongCount = 0;
    let lastSubTopic: string | null = null;
    let lastSubTopicTs = 0;
    wrongs.forEach((w) => {
      const ts = w.timestamp?.toMillis?.() ?? 0;
      if (ts < since) return;
      if (w.subject?.toLowerCase() !== continueData.subject.toLowerCase()) return;
      wrongCount++;
      if (ts > lastSubTopicTs && w.sub_topic) {
        lastSubTopicTs = ts;
        lastSubTopic = w.sub_topic;
      }
    });
    return { wrongCount, subTopic: lastSubTopic };
  }, [continueData, wrongs]);

  // Önerilen alt konular: wrongs içinden sub_topic frekansını çıkar (yoksa subject)
  const weakTopics = useMemo<WeakTopicEntry[]>(() => {
    const counter = new Map<string, { count: number; lastWrongAt: number }>();
    wrongs.forEach((w) => {
      const key = w.sub_topic || w.subject || 'Genel';
      const ts = w.timestamp?.toMillis?.() ?? 0;
      const cur = counter.get(key) ?? { count: 0, lastWrongAt: 0 };
      cur.count += 1;
      if (ts > cur.lastWrongAt) cur.lastWrongAt = ts;
      counter.set(key, cur);
    });
    return Array.from(counter.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([subTopic, v]) => ({
        subTopic,
        wrongCount: v.count,
        lastWrongAt: v.lastWrongAt ? new Date(v.lastWrongAt).toISOString() : undefined,
      }));
  }, [wrongs]);

  // 'all' filtresinde gösterilecek subject listesi (önerilen ise üstte)
  const sortedSubjects = useMemo(() => {
    const arr = [...subjects];
    if (recommendedSubject) {
      const idx = arr.findIndex(
        ([s]) => s.toLowerCase() === recommendedSubject.toLowerCase(),
      );
      if (idx > 0) {
        const [item] = arr.splice(idx, 1);
        arr.unshift(item!);
      }
    }
    return arr;
  }, [subjects, recommendedSubject]);

  // ─── Smart Feed (Önerilenler tab'ı) ─────────────────────────────────────
  const userId = ctx?.currentUser?.uid ?? null;
  const { activeIds: dismissedFeedIds, dismiss: dismissFeedItem, loaded: feedDismissLoaded } =
    useFeedDismiss(userId);

  const subjectsCatalog = useMemo(
    () => subjects.map(([key, count]) => ({ key: key.toLowerCase(), count })),
    [subjects],
  );

  const [feedNow, setFeedNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setFeedNow(Date.now()), 60_000); // her dakika tazele
    return () => clearInterval(t);
  }, []);

  const feedItems = useMemo<FeedItem[]>(() => {
    if (!feedDismissLoaded) return [];
    return buildLearnFeed(
      {
        masteryScores,
        lastSolvedBySubject,
        weakSubTopicBySubject,
        subjectsCatalog,
        gamification: gamification ?? null,
        srsDueCount,
      },
      feedNow,
      dismissedFeedIds,
    );
  }, [
    feedDismissLoaded,
    masteryScores,
    lastSolvedBySubject,
    weakSubTopicBySubject,
    subjectsCatalog,
    gamification,
    srsDueCount,
    feedNow,
    dismissedFeedIds,
  ]);

  // ─── SRS ("Yanlışlarım" tab'ı) ──────────────────────────────────────────
  const [srsCategory, setSrsCategory] = useState<SRSCategory>('new');
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  // ─── Bookmark ("Kaydedilenler" tab'ı) ───────────────────────────────────
  const [bookmarkSearch, setBookmarkSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState<Set<string>>(new Set());
  const [editBookmark, setEditBookmark] = useState<BookmarkDoc | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  const toggleFolderExpand = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBookmarkSelect = (id: string) => {
    setSelectedBookmarkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearBookmarkSelection = () => setSelectedBookmarkIds(new Set());

  const srsBuckets = useMemo(() => groupByCategory(srsCards, feedNow), [srsCards, feedNow]);
  const srsCardsInCategory = srsBuckets[srsCategory] ?? [];
  const srsGroups = useMemo(() => groupBySubTopic(srsCardsInCategory), [srsCardsInCategory]);

  const toggleCardSelected = (id: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedCardIds(new Set());

  // Quick actions için varsayılan subject seçimi (heroSubjectKey ve weakTopics tanımlandıktan sonra)
  const quickActionSubject = useMemo(() => {
    if (heroSubjectKey) return heroSubjectKey;
    if (recommendedSubject) return recommendedSubject;
    if (subjects.length > 0) return subjects[0]![0];
    return null;
  }, [heroSubjectKey, recommendedSubject, subjects]);

  const handleQuickQuiz = () => {
    if (!quickActionSubject) {
      Alert.alert('Hızlı Quiz', 'Henüz ders havuzu yüklenmedi.');
      return;
    }
    router.push(`/(student)/quiz/${quickActionSubject.toLowerCase()}` as never);
  };

  const handleFocusQuickAction = () => {
    if (weakTopics.length === 0) {
      Alert.alert('Odak Quiz', 'Henüz yanlış cevabın yok — bir tur quiz çöz, sonra odak modunda tekrar et.');
      return;
    }
    handleFocusTopicQuiz(weakTopics[0]!.subTopic);
  };

  const handleMockExamQuick = () => {
    if (!quickActionSubject) {
      Alert.alert('Mock Sınav', 'Henüz ders havuzu yüklenmedi.');
      return;
    }
    handleMockExam(getMeta(quickActionSubject).label);
  };

  // SRS retake: kart listesini payload'a çevirip retake quiz'i başlat
  const startRetakeWithCards = (cards: SRSCard[]) => {
    const payload = cards
      .filter((c) => c.snapshot && c.snapshot.question && c.snapshot.choices.length > 0)
      .map((c) => ({
        question: c.snapshot!.question,
        choices: c.snapshot!.choices,
        answer: c.snapshot!.answer,
        subject: c.subject,
      }));
    if (payload.length === 0) {
      Alert.alert(
        'Yetersiz veri',
        'Bu kartların ayrıntısı saklanmadığı için tekrar başlatılamıyor. Yeni quiz çözdükçe kart geçmişi birikecek.',
      );
      return;
    }
    const encoded = encodeURIComponent(JSON.stringify(payload));
    router.push(`/(student)/quiz/retake?payload=${encoded}` as never);
  };

  const handleStartReview = () => {
    const top = pickTopForRetake(srsCards, Date.now(), 10);
    if (top.length === 0) {
      Alert.alert('Tekrar', 'Tekrar bekleyen kart bulunmuyor.');
      return;
    }
    startRetakeWithCards(top);
  };

  const handleSolveGroup = (cards: SRSCard[]) => {
    startRetakeWithCards(cards.slice(0, 10));
  };

  const handleSolveSelection = () => {
    const ids = Array.from(selectedCardIds);
    const cards = srsCards.filter((c) => ids.includes(c.id));
    if (cards.length === 0) return;
    startRetakeWithCards(cards);
    clearSelection();
  };

  // ─── Bookmark handlers ────────────────────────────────────────────────
  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder(name);
    } catch (err) {
      Alert.alert('Klasör', `Oluşturulamadı: ${(err as Error).message}`);
    }
  };

  const handleSaveBookmarkEdit = async (
    bookmark: BookmarkDoc,
    patch: { folderId: string | null; tags: string[]; note: string },
  ) => {
    try {
      await updateBookmarkOrganization(bookmark.id, patch);
    } catch (err) {
      Alert.alert('Bookmark', `Güncellenemedi: ${(err as Error).message}`);
    }
  };

  const handleDeleteBookmark = async (bookmark: BookmarkDoc) => {
    try {
      await deleteBookmark(bookmark.id);
    } catch (err) {
      Alert.alert('Bookmark', `Silinemedi: ${(err as Error).message}`);
    }
  };

  const handleBulkDeleteBookmarks = () => {
    const ids = Array.from(selectedBookmarkIds);
    if (ids.length === 0) return;
    Alert.alert('Seçilenleri sil', `${ids.length} kayıt silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await bulkDeleteBookmarks(ids);
            clearBookmarkSelection();
          } catch (err) {
            Alert.alert('Bookmark', `Silinemedi: ${(err as Error).message}`);
          }
        },
      },
    ]);
  };

  const handleBulkSolveBookmarks = () => {
    const ids = Array.from(selectedBookmarkIds);
    const items = bookmarks.filter((b) => ids.includes(b.id));
    if (items.length === 0) return;
    const payload = items
      .filter((b) => b.questionText && b.choices.length > 0)
      .map((b) => ({
        question: b.questionText,
        choices: b.choices,
        answer: b.answer,
        subject: b.subject,
      }));
    if (payload.length === 0) {
      Alert.alert('Yetersiz veri', 'Seçili kayıtların soru içeriği yok.');
      return;
    }
    const encoded = encodeURIComponent(JSON.stringify(payload));
    router.push(`/(student)/quiz/retake?payload=${encoded}` as never);
    clearBookmarkSelection();
  };

  const handleDeleteCustomFolder = (folder: BookmarkFolder, items: BookmarkDoc[]) => {
    Alert.alert(
      'Klasörü sil',
      `"${folder.name}" silinecek. İçindeki ${items.length} bookmark "Klasörsüz" altına taşınır.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFolder(folder.id, items);
            } catch (err) {
              Alert.alert('Klasör', `Silinemedi: ${(err as Error).message}`);
            }
          },
        },
      ],
    );
  };

  // FeedCard'ların ortak callback'leri
  const feedCallbacks = {
    onStartTodayGoal: (subject: string) =>
      router.push(`/(student)/quiz/${subject.toLowerCase()}` as never),
    onStartReview: handleStartReview,
    onContinue: (subject: string) =>
      router.push(`/(student)/quiz/${subject.toLowerCase()}` as never),
    onProtectStreak: handleQuickQuiz,
    onCelebrateMilestone: handleQuickQuiz,
    onFocusWeakTopic: (subTopic: string, subject?: string) =>
      handleFocusTopicQuiz(subTopic, subject ? getMeta(subject).label : undefined),
    onStartNewSubject: (subject: string) =>
      router.push(`/(student)/quiz/${subject.toLowerCase()}` as never),
    onStartMockExam: (subject: string) => handleMockExam(getMeta(subject).label),
    onDismiss: (id: string) => dismissFeedItem(id),
  };

  const renderSubjectsList = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}>
      <View className="gap-3 px-5">
        {filter === 'all' ? (
          <>
            <Animated.View entering={FadeInUp.duration(280)}>
              <TodayBriefCard
                solvedToday={todayBrief.solvedToday}
                correctToday={todayBrief.correctToday}
                timeSpentTodayMs={todayBrief.timeSpentTodayMs}
                dailyTarget={todayBrief.dailyTarget}
              />
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(30).duration(280)}>
              <QuickActionRow
                onQuickQuiz={handleQuickQuiz}
                onFlashcard={() =>
                  handleFlashcard(
                    quickActionSubject ? getMeta(quickActionSubject).label : 'Genel',
                  )
                }
                onFocusQuiz={handleFocusQuickAction}
                onMockExam={handleMockExamQuick}
              />
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(60).duration(280)}>
              <LearningPathHero
                subject={heroSource.subject ? getMeta(heroSource.subject).label : null}
                progress={heroSource.progress}
                target={heroSource.target}
                source={heroSource.source}
                subTopic={heroSubTopic}
                estimatedMinutes={heroEstimatedMinutes}
                onContinue={
                  heroSubjectKey
                    ? () =>
                        router.push(
                          `/(student)/quiz/${heroSubjectKey.toLowerCase()}` as never,
                        )
                    : undefined
                }
                onShuffle={
                  heroSubjectKey
                    ? () => setAiSheetTopic(getMeta(heroSubjectKey).label)
                    : undefined
                }
              />
            </Animated.View>
            {continueData ? (
              <Animated.View entering={FadeInUp.delay(90).duration(280)}>
                <ContinueLearningCard
                  subject={getMeta(continueData.subject).label}
                  lastSolvedAtMs={continueData.lastSolvedAtMs}
                  subTopic={continueStats.subTopic}
                  wrongCount={continueStats.wrongCount}
                  onPress={() =>
                    router.push(
                      `/(student)/quiz/${continueData.subject.toLowerCase()}` as never,
                    )
                  }
                />
              </Animated.View>
            ) : null}
          </>
        ) : null}

        {ctx?.loading && sortedSubjects.length === 0 ? (
          <SubjectCardSkeleton count={3} />
        ) : sortedSubjects.length === 0 ? (
          <EmptyState icon={BookOpen} title="Henüz konu yok" subtitle="Sorular yükleniyor" />
        ) : (
          sortedSubjects.map(([subject, count], i) => {
            const meta = getMeta(subject);
            const subjectKey = subject.toLowerCase();
            const mastery = masteryScores[subject] ?? { score: 0, solved_count: 0 };
            const lastMs = lastSolvedBySubject[subject];
            const todayActive =
              !!lastMs &&
              new Date(lastMs).toDateString() === new Date().toDateString();
            const isHighlighted =
              !!highlightSubject &&
              subject.toLowerCase() === highlightSubject.toLowerCase();
            const trend = subjectTrends[subjectKey];
            const weak = weakSubTopicBySubject[subjectKey]?.subTopic;
            const avgSec = avgSecondsPerSubject[subjectKey] ?? 30;
            const remaining = Math.max(0, count - (mastery.solved_count ?? 0));
            const estimatedMinutes = remaining > 0 ? Math.max(1, Math.round((avgSec * remaining) / 60)) : 0;
            return (
              <Animated.View
                key={subject}
                entering={FadeInUp.delay(i * 30).duration(280)}
              >
                <View className={isHighlighted ? 'rounded-2xl border-2 border-accent' : ''}>
                  <SubjectCard
                    subject={meta.label}
                    icon={meta.Icon}
                    iconColor={meta.color}
                    questionCount={count}
                    masteryScore={mastery.score ?? 0}
                    masterySolvedCount={mastery.solved_count ?? 0}
                    lastSolvedAtMs={lastMs}
                    todayActive={todayActive}
                    unlockedBadges={unlockedBadges}
                    isRecommended={
                      !!recommendedSubject &&
                      subject.toLowerCase() === recommendedSubject.toLowerCase()
                    }
                    trend={trend}
                    weakSubTopic={weak}
                    estimatedMinutes={estimatedMinutes}
                    onQuiz={() =>
                      router.push(`/(student)/quiz/${subject.toLowerCase()}` as never)
                    }
                    onAIGenerate={() => setAiSheetTopic(meta.label)}
                    onExplain={() => handleExplainSubject(meta.label)}
                    onFlashcard={() => handleFlashcard(meta.label)}
                    onMockExam={() => handleMockExam(meta.label)}
                  />
                </View>
              </Animated.View>
            );
          })
        )}

        {filter === 'all' && weakTopics.length > 0 ? (
          <Animated.View entering={FadeInUp.delay(180).duration(280)} className="mt-2">
            <RecommendedTopicsGrid
              topics={weakTopics}
              loadingId={focusLoadingTopic}
              onTopicPress={handleFocusTopicQuiz}
            />
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
  );

  const renderRecommendedFeed = () => {
    if (!feedDismissLoaded) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      );
    }
    if (feedItems.length === 0) {
      return (
        <View className="px-5 pt-8">
          <EmptyState
            icon={Sparkles}
            title="Bugün için özel öneri yok"
            subtitle="Bir tur quiz çöz, akıllı öneri akışı devreye girsin."
          />
        </View>
      );
    }
    return (
      <FlatList
        data={feedItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 120,
          gap: 10,
        }}
        renderItem={({ item }) => (
          <FeedCard
            item={item}
            subjectLabel={(k) => getMeta(k).label}
            callbacks={feedCallbacks}
          />
        )}
      />
    );
  };

  const renderWrongSRSTab = () => {
    const top10 = pickTopForRetake(srsCards, Date.now(), 10);
    const segmentedTabs = [
      { id: 'new' as const, label: 'Yeni', count: srsBuckets.new.length },
      { id: 'review' as const, label: 'Tekrar', count: srsBuckets.review.length },
      { id: 'learned' as const, label: 'Öğrenildi', count: srsBuckets.learned.length },
    ];
    const emptyTitle =
      srsCategory === 'new'
        ? 'Yeni yanlış yok'
        : srsCategory === 'review'
          ? 'Tekrar bekleyen kart yok'
          : 'Öğrenilen kart yok';
    const emptySubtitle =
      srsCategory === 'new'
        ? 'Quiz çözmeye başla — yanlışların burada toplanır'
        : srsCategory === 'review'
          ? 'Tekrar zamanı gelen kart yok. Doğru çözüp ilerlettiğin kartlar burada görünecek.'
          : "Doğru çözüp box 4'e ulaşan kartların burada görünür";
    return (
      <View className="flex-1">
        <View className="mt-3 px-5">
          <SegmentedTabs
            tabs={segmentedTabs}
            active={srsCategory}
            onChange={(id) => {
              setSrsCategory(id);
              clearSelection();
            }}
          />
        </View>
        {srsCategory !== 'learned' && top10.length >= 3 ? (
          <View className="mx-5 mt-3">
            <Pressable
              onPress={() => startRetakeWithCards(top10)}
              className="flex-row items-center rounded-2xl border border-accent bg-accent-soft p-3 active:opacity-80"
            >
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent">
                <RotateCw color="white" size={16} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-text-primary">
                  {`En kritik ${top10.length}'u çöz`}
                </Text>
                <Text className="text-[11px] text-text-muted">
                  Box ve due zamanına göre öncelikli
                </Text>
              </View>
              <ChevronRight color="#4F46E5" size={18} />
            </Pressable>
          </View>
        ) : null}
        {srsGroups.length === 0 ? (
          <View className="flex-1 items-center justify-center px-5">
            <EmptyState
              icon={srsCategory === 'learned' ? Award : XCircle}
              title={emptyTitle}
              subtitle={emptySubtitle}
            />
          </View>
        ) : (
          <FlatList
            data={srsGroups}
            keyExtractor={(g) => `${g.subject}::${g.subTopic}`}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: selectedCardIds.size > 0 ? 140 : 120,
              gap: 10,
            }}
            renderItem={({ item }) => (
              <WrongTopicGroup
                subTopic={item.subTopic}
                subjectLabel={getMeta(item.subject).label}
                cards={item.cards}
                selectedIds={selectedCardIds}
                onToggleSelect={toggleCardSelected}
                onSolveGroup={() => handleSolveGroup(item.cards)}
                onLongPressCard={toggleCardSelected}
              />
            )}
          />
        )}
        <BulkActionToolbar
          visible={selectedCardIds.size > 0}
          selectedCount={selectedCardIds.size}
          actions={[{ id: 'solve', label: 'Seçilenleri Çöz', icon: RotateCw }]}
          onActionPress={(id) => {
            if (id === 'solve') handleSolveSelection();
          }}
          onCancel={clearSelection}
        />
      </View>
    );
  };

  const renderBookmarksTab = () => {
    if (bookmarksLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      );
    }

    const filtered = searchBookmarks(bookmarks, bookmarkSearch);
    const customFolderIds = new Set(customFolders.map((f) => f.id));

    // Otomatik klasörler: filtered içindeki 'auto:*' folderId'leri
    const autoMap = new Map<string, BookmarkDoc[]>();
    const customMap = new Map<string, BookmarkDoc[]>();
    const rootItems: BookmarkDoc[] = [];
    filtered.forEach((b) => {
      const fid = b.folderId;
      if (fid && fid.startsWith('auto:')) {
        if (!autoMap.has(fid)) autoMap.set(fid, []);
        autoMap.get(fid)!.push(b);
      } else if (fid && customFolderIds.has(fid)) {
        if (!customMap.has(fid)) customMap.set(fid, []);
        customMap.get(fid)!.push(b);
      } else {
        rootItems.push(b);
      }
    });

    const autoFolders = Array.from(autoMap.entries())
      .map(([id, items]) => {
        const subjectKey = id.replace('auto:', '');
        const meta = getMeta(subjectKey);
        return { id, label: meta.label, icon: meta.Icon, color: meta.color, bg: meta.bg, items };
      })
      .sort((a, b) => b.items.length - a.items.length);

    if (bookmarks.length === 0) {
      return (
        <View className="flex-1 px-5 pt-3">
          <SearchBar
            value={bookmarkSearch}
            onChange={setBookmarkSearch}
            placeholder="Soru, etiket veya not ara"
          />
          <View className="flex-1 items-center justify-center">
            <EmptyState
              icon={BookmarkIcon}
              title="Kaydedilen yok"
              subtitle="Quiz sırasında soruları kaydederek burada görüntüle"
            />
          </View>
        </View>
      );
    }

    const renderItem = (b: BookmarkDoc) => (
      <View key={b.id} className="mt-2">
        <BookmarkItem
          bookmark={b}
          subjectLabel={getMeta(b.subject).label}
          selectionMode={selectedBookmarkIds.size > 0}
          selected={selectedBookmarkIds.has(b.id)}
          onPress={() => {
            if (selectedBookmarkIds.size > 0) toggleBookmarkSelect(b.id);
          }}
          onLongPress={() => toggleBookmarkSelect(b.id)}
          onMenuPress={() => setEditBookmark(b)}
        />
      </View>
    );

    return (
      <View className="flex-1">
        <View className="px-5 pt-3">
          <SearchBar
            value={bookmarkSearch}
            onChange={setBookmarkSearch}
            placeholder="Soru, etiket veya not ara"
          />
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: selectedBookmarkIds.size > 0 ? 140 : 120,
            gap: 8,
          }}
        >
          {filtered.length === 0 ? (
            <View className="mt-10">
              <EmptyState
                icon={Sparkles}
                title="Eşleşme bulunamadı"
                subtitle={`"${bookmarkSearch}" için sonuç yok`}
              />
            </View>
          ) : (
            <>
              {autoFolders.map((af) => {
                const expanded = expandedFolders.has(af.id);
                return (
                  <View key={af.id} style={{ gap: 6 }}>
                    <FolderRow
                      label={af.label}
                      count={af.items.length}
                      expanded={expanded}
                      onToggle={() => toggleFolderExpand(af.id)}
                      icon={af.icon}
                      iconColor={af.color}
                      iconBg={af.bg}
                    />
                    {expanded ? af.items.map(renderItem) : null}
                  </View>
                );
              })}

              {customFolders.map((cf) => {
                const items = customMap.get(cf.id) ?? [];
                if (bookmarkSearch && items.length === 0) return null;
                const expanded = expandedFolders.has(cf.id);
                return (
                  <View key={cf.id} style={{ gap: 6 }}>
                    <FolderRow
                      label={cf.name}
                      count={items.length}
                      expanded={expanded}
                      onToggle={() => toggleFolderExpand(cf.id)}
                      trailingAction={{
                        label: 'Sil',
                        onPress: () => handleDeleteCustomFolder(cf, bookmarks),
                      }}
                    />
                    {expanded ? items.map(renderItem) : null}
                  </View>
                );
              })}

              {rootItems.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <FolderRow
                    label="Klasörsüz"
                    count={rootItems.length}
                    expanded={expandedFolders.has('__root__')}
                    onToggle={() => toggleFolderExpand('__root__')}
                  />
                  {expandedFolders.has('__root__') ? rootItems.map(renderItem) : null}
                </View>
              ) : null}

              <View className="mt-2">
                <AddFolderRow onPress={() => setCreateFolderOpen(true)} />
              </View>
            </>
          )}
        </ScrollView>

        <BulkActionToolbar
          visible={selectedBookmarkIds.size > 0}
          selectedCount={selectedBookmarkIds.size}
          actions={[
            { id: 'solve', label: 'Çöz', icon: RotateCw },
            { id: 'delete', label: 'Sil', icon: Trash2, destructive: true },
          ]}
          onActionPress={(id) => {
            if (id === 'solve') handleBulkSolveBookmarks();
            else if (id === 'delete') handleBulkDeleteBookmarks();
          }}
          onCancel={clearBookmarkSelection}
        />
      </View>
    );
  };

  const chipsWithCount = useMemo<{ id: FilterId; label: string; count?: number }[]>(
    () => [
      { id: 'all', label: 'Tüm Dersler' },
      { id: 'recommended', label: 'Önerilenler', count: feedItems.length },
      { id: 'wrong', label: 'Yanlışlarım', count: srsDueCount },
      { id: 'bookmarks', label: 'Kaydedilenler', count: bookmarks.length },
    ],
    [feedItems.length, srsDueCount, bookmarks.length],
  );

  const todayMinutes = Math.round(todayBrief.timeSpentTodayMs / 60000);

  return (
    <SafeAreaView className="flex-1 bg-bg-surface" edges={['top']}>
      <LearnBackground width={width} height={height} />
      <View className="flex-row items-start px-5 pt-2">
        <View className="flex-1">
          <Text className="text-3xl font-bold text-text-primary">Öğren</Text>
          <Text className="mt-1 text-sm text-text-muted">
            {heroSource.subject
              ? `Bugün ${getMeta(heroSource.subject).label} ile devam edelim`
              : 'Bir konu seç, quiz başlat'}
          </Text>
        </View>
        {todayBrief.solvedToday > 0 ? (
          <View className="ml-2 mt-1 flex-row items-center rounded-full bg-accent-soft px-2.5 py-1">
            <Clock color="#4F46E5" size={11} />
            <Text className="ml-1 text-[11px] font-semibold text-accent-fg">
              {todayMinutes > 0 ? `${todayMinutes} dk · ` : ''}
              {todayBrief.solvedToday} soru
            </Text>
          </View>
        ) : null}
      </View>

      <View className="mt-5 pl-5">
        <FilterChips
          chips={chipsWithCount}
          active={filter}
          onChange={(v) => setFilter(v as FilterId)}
        />
      </View>

      {filter === 'all' ? (
        renderSubjectsList()
      ) : filter === 'recommended' ? (
        renderRecommendedFeed()
      ) : filter === 'wrong' ? (
        renderWrongSRSTab()
      ) : (
        renderBookmarksTab()
      )}
      {flyUpAmount > 0 ? (
        <XPFlyUp
          amount={flyUpAmount}
          topOffset={140}
          onComplete={() => setFlyUpAmount(0)}
        />
      ) : null}
      <ChatFAB />
      <AIQuizSettingsSheet
        visible={aiSheetTopic !== null}
        topic={aiSheetTopic ?? undefined}
        loading={aiLoading}
        derivationAvailable={derivationAvailable}
        onClose={() => setAiSheetTopic(null)}
        onConfirm={handleAIQuizConfirm}
      />
      <BookmarkEditSheet
        visible={editBookmark !== null}
        bookmark={editBookmark}
        customFolders={customFolders}
        autoFolderOptions={Array.from(
          new Set(bookmarks.map((b) => b.folderId).filter((id): id is string => !!id && id.startsWith('auto:'))),
        ).map((id) => ({ id, label: getMeta(id.replace('auto:', '')).label }))}
        onClose={() => setEditBookmark(null)}
        onSave={(patch) => {
          if (!editBookmark) return;
          return handleSaveBookmarkEdit(editBookmark, patch);
        }}
        onDelete={async () => {
          if (!editBookmark) return;
          await handleDeleteBookmark(editBookmark);
          setEditBookmark(null);
        }}
      />
      <CreateFolderSheet
        visible={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
      />
    </SafeAreaView>
  );
}
