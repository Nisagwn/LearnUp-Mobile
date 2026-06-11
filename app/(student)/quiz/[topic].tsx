import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  X,
  ChevronRight,
  Lightbulb,
  Bookmark,
  BookmarkCheck,
  Flag,
} from 'lucide-react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Haptics from 'expo-haptics';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { recordAnswer } from '@/services/gamificationApi';
import { generateDynamicHint, generateQuiz } from '@/services/aiService';
import { fetchSampleQuestions } from '@/services/questionPoolApi';
import { subjectLabelTR } from '@/utils/subjects';
import { MathRenderer } from '@/components/quiz/MathRenderer';
import {
  QuestionQueue,
  QueueQuestion,
  QuizMode,
  Difficulty,
  GenerateQuizModeKind,
} from '@/utils/questionQueue';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { RoundSummaryScreen, SolvedItem } from '@/components/quiz/RoundSummaryScreen';
import { QuizCoachFAB } from '@/components/quiz/QuizCoachFAB';
import { QuizForestScene } from '@/components/quiz/QuizForestScene';
import { WrongAnswerCoachSheet } from '@/components/quiz/WrongAnswerCoachSheet';
import { LevelUpModal } from '@/components/common/LevelUpModal';
import { AppLottie } from '@/components/common/AppLottie';
import { lottie } from '@/constants/lottie';

type RecordResponse = {
  xpGained?: number;
  level?: number;
  newBadges?: string[];
  streak?: { count?: number };
  pedagogicalHint?: string;
} & Record<string, unknown>;

function resolveMode(topic: string | undefined): QuizMode {
  if (!topic) return 'random';
  if (topic === 'ai') return 'ai';
  if (topic === 'retake') return 'retake';
  if (topic === 'random') return 'random';
  return 'subject';
}

/**
 * Route wrapper — quiz ekranını route param fingerprint'iyle key'liyor.
 * Aynı route'a YENİ paramla (yeni tur, farklı ders, farklı stil) girildiğinde
 * iç bileşen unmount → remount edilir; eski `finished` ve RoundSummary state'i
 * sızmaz, bir önceki turun özeti görünmez.
 */
export default function QuizScreen() {
  const params = useLocalSearchParams<{
    topic: string;
    payload?: string;
    mode?: string;
    difficulty?: Difficulty;
    subject?: string;
    count?: string;
    aiMode?: string;
    grade?: string;
  }>();
  // payload'un tamamı çok uzun olabilir → kısaltılmış parmak izi yeter
  const payloadFp = params.payload ? `${params.payload.length}:${params.payload.slice(0, 24)}` : '';
  const key = [
    params.topic,
    params.mode,
    params.difficulty,
    params.subject,
    params.count,
    params.aiMode,
    params.grade,
    payloadFp,
  ].join('|');
  return <QuizScreenInner key={key} />;
}

function QuizScreenInner() {
  const router = useRouter();
  // NOT: useSafeBack KULLANILMIYOR — quiz'den çıkışta her zaman router.replace
  // ile /learn'e gidiyoruz. router.back() stack'te eski quiz varsa onu açar
  // (kullanıcı şikayeti: "geri gittiğimde eski quiz çıkıyor"). Replace ile
  // stack temizlenir, eski quiz görünmez.
  const { width, height } = useWindowDimensions();
  const {
    topic,
    payload,
    mode,
    difficulty,
    subject,
    count,
    aiMode,
    grade: gradeParam,
  } = useLocalSearchParams<{
    topic: string;
    payload?: string;
    mode?: string;
    difficulty?: Difficulty;
    subject?: string;
    count?: string;
    aiMode?: string;
    grade?: string;
  }>();

  const ctx = useContext(UserStatsContext);
  const profileGrade = (ctx?.userProfile?.grade as string | undefined) ?? null;
  // Öncelik: route param > profil > default '10'
  const studentGrade: string = gradeParam || profileGrade || '10';

  const quizMode = useMemo(() => resolveMode(topic), [topic]);
  const isDuel = mode === 'duel';
  const aiTopicSubject = subject || (quizMode === 'ai' ? 'genel' : '');
  const aiCount = useMemo(() => {
    const n = parseInt(count ?? '5', 10);
    if (Number.isNaN(n)) return 5;
    return Math.max(1, Math.min(20, n));
  }, [count]);

  const resolvedAIMode: GenerateQuizModeKind =
    aiMode === 'ANALYZE_AND_DERIVE' || aiMode === 'CREATIVE_FREE'
      ? aiMode
      : 'STRICT_CURRICULUM';
  // Tüm modlarda recordAnswer çağrılır — böylece günlük görev/XP/streak akışı
  // (AI üretimli serbest pratik dahil) anında güncellenir. Mode bilgisi `source` ile geçer.
  const shouldRecord = true;

  const queueRef = useRef<QuestionQueue | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const questionStartRef = useRef<number>(Date.now());

  const [current, setCurrent] = useState<QueueQuestion | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [solvedHistory, setSolvedHistory] = useState<SolvedItem[]>([]);
  const [xpEarnedTotal, setXpEarnedTotal] = useState(0);
  const [unlockedBadgesThisRound, setUnlockedBadgesThisRound] = useState<string[]>([]);
  const [levelUpDuringRound, setLevelUpDuringRound] = useState(false);
  const [finished, setFinished] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [emptyState, setEmptyState] = useState(false);

  const [hintOpen, setHintOpen] = useState(false);
  const [hintText, setHintText] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const hintCacheRef = useRef<Record<string, string>>({});
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [savingBookmark, setSavingBookmark] = useState(false);
  const confettiRef = useRef<ConfettiCannon>(null);
  const [coachSheetOpen, setCoachSheetOpen] = useState(false);
  const [coachHint, setCoachHint] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; title?: string } | null>(null);
  // Quiz'den çıkış onay modal'ı — cevaplanmış soru varsa kayıp uyarısı.
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const lastLevelRef = useRef<number | null>(null);

  const initQueue = useCallback(() => {
    queueRef.current = new QuestionQueue({
      mode: quizMode,
      topic: topic ?? 'genel',
      initialPayload: payload,
      difficulty: difficulty,
      subject: aiTopicSubject || undefined,
      grade: studentGrade,
      aiMode: resolvedAIMode,
    });
    sessionStartRef.current = Date.now();
    setSolvedHistory([]);
    setXpEarnedTotal(0);
    setUnlockedBadgesThisRound([]);
    setLevelUpDuringRound(false);
    setFinished(false);
    setQuestionNumber(0);
    setEmptyState(false);
    setShowResult(false);
    setSelected(null);
    lastLevelRef.current = null;
    hintCacheRef.current = {};
  }, [quizMode, topic, payload, difficulty, aiTopicSubject, studentGrade, resolvedAIMode]);

  const loadNextQuestion = useCallback(async () => {
    if (!queueRef.current) return;
    setLoadingNext(true);
    try {
      const q = await queueRef.current.next();
      if (!q) {
        setCurrent(null);
        // AI/retake gibi sabit uzunluklu modlarda doğal son → doğrudan tur özetine git
        if (quizMode === 'ai' || quizMode === 'retake') {
          setFinished(true);
        } else {
          setEmptyState(true);
        }
        return;
      }
      setCurrent(q);
      setSelected(null);
      setShowResult(false);
      setQuestionNumber((n) => n + 1);
      questionStartRef.current = Date.now();
    } finally {
      setLoadingNext(false);
    }
  }, [quizMode]);

  useEffect(() => {
    initQueue();
  }, [initQueue]);

  useEffect(() => {
    if (queueRef.current && !current && !finished && !emptyState) {
      loadNextQuestion();
    }
  }, [current, finished, emptyState, loadNextQuestion]);

  const correctCount = solvedHistory.filter((h) => h.isCorrect).length;

  const handleSubmit = async () => {
    if (selected === null || !current) return;
    const isCorrect = selected === current.answer;
    const timeSpentMs = Date.now() - questionStartRef.current;
    setShowResult(true);

    if (isCorrect) {
      confettiRef.current?.start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setCoachHint(null);
      setCoachSheetOpen(true);
    }

    let recordResp: RecordResponse | null = null;
    if (shouldRecord) {
      try {
        recordResp = (await recordAnswer({
          questionId: current.id,
          subject: current.subject,
          isCorrect,
          selectedIndex: selected,
          timeSpentMs,
          difficulty: current.difficulty,
          grade: current.grade,
          questionText: current.question,
          choices: current.choices,
          correctIndex: current.answer,
          // SRS kartına saklanır — Yanlışlarım sekmesindeki retake için.
          snapshot: {
            question: current.question,
            choices: current.choices,
            answer: current.answer,
          },
          source: isDuel
            ? 'duel'
            : quizMode === 'ai'
              ? 'ai_free'
              : quizMode === 'retake'
                ? 'retake'
                : quizMode === 'random'
                  ? 'random'
                  : 'quiz',
        })) as RecordResponse;
      } catch (err) {
        console.warn('recordAnswer failed:', (err as Error).message);
      }
    }

    const xpDelta = Number(recordResp?.xpGained ?? 0);
    if (xpDelta > 0) setXpEarnedTotal((prev) => prev + xpDelta);

    if (!isCorrect && typeof recordResp?.pedagogicalHint === 'string') {
      setCoachHint(recordResp.pedagogicalHint);
    }

    const newBadges = recordResp?.newBadges;
    if (Array.isArray(newBadges) && newBadges.length > 0) {
      setUnlockedBadgesThisRound((prev) => Array.from(new Set([...prev, ...newBadges])));
    }

    const lvl = recordResp?.level;
    if (typeof lvl === 'number') {
      if (lastLevelRef.current !== null && lvl > lastLevelRef.current) {
        setLevelUpDuringRound(true);
        const masteryName = (recordResp as { mastery?: { levelName?: string } })?.mastery
          ?.levelName;
        setLevelUp({ level: lvl, title: masteryName });
      }
      lastLevelRef.current = lvl;
    }

    setSolvedHistory((prev) => [
      ...prev,
      {
        id: current.id,
        subject: current.subject,
        isCorrect,
        timeSpentMs,
        xpGained: xpDelta,
      },
    ]);
  };

  const handleNext = () => {
    loadNextQuestion();
  };

  const handleFinishRound = () => {
    setFinished(true);
  };

  // Quiz'den çıkışı yönet — stack temizliği + cevap kayıp uyarısı.
  // Kullanım: X butonu, Android hardware back, dış navigasyon istekleri.
  const requestExit = useCallback(() => {
    // Cevap girilmediyse (veya zaten finished/empty state) → direkt /learn
    if (finished || emptyState || solvedHistory.length === 0) {
      router.replace('/(student)/learn');
      return;
    }
    // Cevap var → onay iste
    setExitConfirmOpen(true);
  }, [finished, emptyState, solvedHistory.length, router]);

  // Android hardware back tuşu — onay modal'ını aç (veya çıkışı tetikle).
  // Modal açıkken hardware back: önce modal kapanır.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitConfirmOpen) {
        setExitConfirmOpen(false);
        return true;
      }
      requestExit();
      return true;
    });
    return () => sub.remove();
  }, [requestExit, exitConfirmOpen]);

  const handleRestart = async () => {
    // AI mode → aynı konu/sayı/zorluk/stil ile yeni payload üret, URL'i replace et
    if (quizMode === 'ai') {
      setLoadingNext(true);
      try {
        const topicForAI = aiTopicSubject || 'genel';
        const difficultyForAI: Difficulty = (difficulty ?? 'medium') as Difficulty;
        const baseArgs = {
          subject: topicForAI,
          topic: topicForAI,
          grade: studentGrade,
          count: aiCount,
          difficulty: difficultyForAI,
        };
        let modeArg;
        if (resolvedAIMode === 'ANALYZE_AND_DERIVE') {
          const samples = await fetchSampleQuestions({
            subject: topicForAI,
            grade: studentGrade,
            limit: 5,
          });
          // Örnek yoksa türetilecek bir şey yok → STRICT'e düş
          modeArg =
            samples.length > 0
              ? {
                  kind: 'ANALYZE_AND_DERIVE' as const,
                  ...baseArgs,
                  sampleQuestions: samples.map((s) => ({
                    question: s.question,
                    choices: s.choices,
                    correctIndex: s.answer,
                    explanation: s.explanation,
                  })),
                }
              : { kind: 'STRICT_CURRICULUM' as const, ...baseArgs };
        } else if (resolvedAIMode === 'CREATIVE_FREE') {
          modeArg = { kind: 'CREATIVE_FREE' as const, ...baseArgs };
        } else {
          modeArg = { kind: 'STRICT_CURRICULUM' as const, ...baseArgs };
        }
        const fresh = await generateQuiz(modeArg);
        const newPayload = encodeURIComponent(JSON.stringify(fresh));
        const params = new URLSearchParams();
        params.set('payload', newPayload);
        if (aiTopicSubject) params.set('subject', aiTopicSubject);
        params.set('count', String(aiCount));
        params.set('difficulty', difficultyForAI);
        if (mode) params.set('mode', mode);
        params.set('aiMode', resolvedAIMode);
        params.set('grade', studentGrade);
        router.replace(`/(student)/quiz/ai?${params.toString()}` as never);
      } catch (err) {
        console.warn('AI yeniden üretim başarısız:', (err as Error).message);
        initQueue(); // fallback: aynı payload ile başlat (boş tur)
      } finally {
        setLoadingNext(false);
      }
      return;
    }
    initQueue();
  };

  const handleGoHome = () => {
    const subjectCount = new Map<string, number>();
    solvedHistory.forEach((h) => subjectCount.set(h.subject, (subjectCount.get(h.subject) ?? 0) + 1));
    const topSubject = Array.from(subjectCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const params = new URLSearchParams();
    if (xpEarnedTotal > 0) params.set('xpGain', String(xpEarnedTotal));
    if (topSubject) params.set('subject', topSubject);
    const qs = params.toString();
    router.replace(`/(student)/learn${qs ? `?${qs}` : ''}` as never);
  };

  const handleSaveBookmark = async () => {
    if (!current || savedSet.has(current.id) || savingBookmark) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSavingBookmark(true);
    try {
      await addDoc(collection(db, 'bookmarks'), {
        studentId: uid,
        questionText: current.question,
        subject: current.subject,
        choices: current.choices,
        answer: current.answer,
        // Otomatik ders klasörü — Kaydedilenler sekmesinde "auto:biology" gibi
        // sahte klasörlere doğal olarak gruplanır.
        folderId: `auto:${(current.subject || 'genel').toLowerCase()}`,
        tags: [],
        createdAt: serverTimestamp(),
      });
      setSavedSet((s) => new Set(s).add(current.id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      console.warn('bookmark save failed:', (err as Error).message);
    } finally {
      setSavingBookmark(false);
    }
  };

  const handleHint = async () => {
    if (!current) return;
    setHintOpen(true);
    const cached = hintCacheRef.current[current.id];
    if (cached) {
      setHintText(cached);
      return;
    }
    setHintLoading(true);
    setHintText('');
    try {
      const hint = await generateDynamicHint({
        subject: current.subject,
        grade: current.grade,
        questionText: current.question,
        options: current.choices,
      });
      hintCacheRef.current[current.id] = hint;
      setHintText(hint);
    } catch (err) {
      setHintText(`⚠ İpucu alınamadı: ${(err as Error).message}`);
    } finally {
      setHintLoading(false);
    }
  };

  if (finished) {
    return (
      <RoundSummaryScreen
        history={solvedHistory}
        durationMs={Date.now() - sessionStartRef.current}
        xpEarnedTotal={xpEarnedTotal}
        levelUpDuringRound={levelUpDuringRound}
        unlockedBadgesThisRound={unlockedBadgesThisRound}
        onRestart={handleRestart}
        onHome={handleGoHome}
      />
    );
  }

  if (emptyState) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg font-semibold text-text-primary">
            {quizMode === 'retake' ? 'Tüm yanlışlar tamamlandı 🎉' : 'Yeni soru getirilemedi'}
          </Text>
          <Text className="mt-2 text-center text-sm text-text-muted">
            {solvedHistory.length > 0
              ? `Bu turda ${solvedHistory.length} soru çözdün — tur özetini görmek için bitir.`
              : 'Bağlantını kontrol et veya farklı bir konu dene.'}
          </Text>
          <View className="mt-6 w-full gap-3">
            {solvedHistory.length > 0 ? (
              <Pressable
                onPress={handleFinishRound}
                className="items-center rounded-xl bg-accent py-4 active:opacity-80"
              >
                <Text className="font-semibold text-white">Turu Bitir</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={requestExit}
              className="items-center rounded-xl border border-border-soft py-4 active:bg-bg-elevated"
            >
              <Text className="font-semibold text-text-primary">Geri Dön</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingNext && !current) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" size="large" />
          <Text className="mt-3 text-sm text-text-muted">Soru hazırlanıyor…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!current) return null;

  const isLastChoice = current.choices.length;

  return (
    <SafeAreaView className="flex-1 bg-bg-surface" edges={['top']}>
      <QuizForestScene width={width} height={height} />
      <View className="flex-row items-center justify-between px-4 pt-2">
        <Pressable onPress={requestExit} className="p-2 active:opacity-60" hitSlop={6}>
          <X color="#475569" size={22} />
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-sm font-semibold text-text-secondary">
            Soru #{questionNumber} · {correctCount} doğru
          </Text>
        </View>
        <View className="flex-row">
          {quizMode !== 'ai' ? (
            <Pressable
              onPress={handleSaveBookmark}
              disabled={savedSet.has(current.id) || savingBookmark}
              className="p-2 active:opacity-60"
              hitSlop={6}
            >
              {savedSet.has(current.id) ? (
                <BookmarkCheck color="#6366F1" size={22} />
              ) : (
                <Bookmark color="#94A3B8" size={22} />
              )}
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleHint}
            disabled={showResult}
            className={`p-2 active:opacity-60 ${showResult ? 'opacity-30' : ''}`}
            hitSlop={6}
          >
            <Lightbulb color="#D97706" size={22} />
          </Pressable>
        </View>
      </View>

      <View className="mx-4 mt-3">
        <Pressable
          onPress={handleFinishRound}
          disabled={solvedHistory.length === 0 && !showResult}
          className={`flex-row items-center justify-center rounded-full border px-3 py-1.5 active:opacity-60 ${
            solvedHistory.length === 0 && !showResult
              ? 'border-border-soft'
              : 'border-danger/40 bg-danger-soft/40'
          }`}
          hitSlop={4}
        >
          <Flag color={solvedHistory.length === 0 && !showResult ? '#94A3B8' : '#DC2626'} size={12} />
          <Text
            className={`ml-1.5 text-xs font-semibold ${
              solvedHistory.length === 0 && !showResult ? 'text-text-muted' : 'text-danger'
            }`}
          >
            Turu Bitir
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-6 pt-6">
          <Text className="text-xs uppercase tracking-wide text-accent-fg">
            {subjectLabelTR(current.subject)}
          </Text>
          <View className="mt-3">
            <MathRenderer content={current.question} fontSize={16} color="#0F172A" />
          </View>

          <View className="mt-6 gap-3">
            {current.choices.map((choice, i) => {
              const isSelected = selected === i;
              const isCorrectAnswer = i === current.answer;
              let cardClass = 'border-border-soft bg-bg-surface';
              if (showResult) {
                if (isCorrectAnswer) cardClass = 'border-success bg-success-soft';
                else if (isSelected) cardClass = 'border-danger bg-danger-soft';
              } else if (isSelected) {
                cardClass = 'border-accent bg-accent-soft';
              }
              return (
                <Pressable
                  key={i}
                  onPress={() => !showResult && setSelected(i)}
                  disabled={showResult}
                  className={`flex-row items-center rounded-2xl border p-4 ${cardClass}`}
                >
                  <View
                    className={`mr-3 h-8 w-8 items-center justify-center rounded-full border ${
                      isSelected ? 'border-accent bg-accent' : 'border-border-soft bg-bg-base'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-text-muted'}`}
                    >
                      {String.fromCharCode(65 + i)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <MathRenderer content={choice} fontSize={14} color="#0F172A" />
                  </View>
                  {showResult && isCorrectAnswer ? (
                    <AppLottie
                      source={lottie.correct}
                      autoPlay
                      loop={false}
                      style={{ width: 30, height: 30 }}
                    />
                  ) : null}
                  {showResult && isSelected && !isCorrectAnswer ? (
                    <AppLottie
                      source={lottie.wrong}
                      autoPlay
                      loop={false}
                      style={{ width: 30, height: 30 }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
            <View style={{ height: isLastChoice ? 0 : 0 }} />
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4"
        style={{ backgroundColor: 'transparent' }}
      >
        {!showResult ? (
          <Pressable
            onPress={handleSubmit}
            disabled={selected === null}
            className={`items-center rounded-xl py-4 active:opacity-80 ${
              selected === null ? 'bg-bg-elevated' : 'bg-accent'
            }`}
          >
            <Text
              className={`text-base font-semibold ${selected === null ? 'text-text-muted' : 'text-white'}`}
            >
              Cevapla
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleNext}
            disabled={loadingNext}
            className="flex-row items-center justify-center rounded-xl bg-accent py-4 active:opacity-80"
          >
            {loadingNext ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text className="mr-2 text-base font-semibold text-white">Sonraki Soru</Text>
                <ChevronRight color="white" size={20} />
              </>
            )}
          </Pressable>
        )}
      </View>

      <ConfettiCannon
        ref={confettiRef}
        count={80}
        origin={{ x: width / 2, y: -10 }}
        autoStart={false}
        fadeOut
        explosionSpeed={350}
        fallSpeed={2500}
      />

      <QuizCoachFAB
        subject={current.subject}
        questionText={current.question}
        options={current.choices}
        grade={current.grade}
      />

      <LevelUpModal
        visible={!!levelUp}
        level={levelUp?.level ?? 0}
        title={levelUp?.title}
        onClose={() => setLevelUp(null)}
      />

      <WrongAnswerCoachSheet
        visible={coachSheetOpen}
        subject={current.subject}
        questionText={current.question}
        options={current.choices}
        correctIndex={current.answer}
        initialHint={coachHint}
        grade={current.grade}
        onClose={() => setCoachSheetOpen(false)}
        onContinue={handleNext}
        onFinishRound={solvedHistory.length > 0 ? handleFinishRound : undefined}
      />

      <Modal
        visible={hintOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHintOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-2xl border border-warning/30 bg-bg-base p-5">
            <View className="flex-row items-center">
              <Lightbulb color="#D97706" size={22} />
              <Text className="ml-2 text-base font-bold text-text-primary">İpucu</Text>
            </View>
            <View className="mt-4 min-h-[60px]">
              {hintLoading ? (
                <ActivityIndicator color="#D97706" />
              ) : (
                <Text className="text-sm leading-5 text-text-secondary">{hintText}</Text>
              )}
            </View>
            <Pressable
              onPress={() => setHintOpen(false)}
              className="mt-5 items-center rounded-xl bg-accent py-3 active:opacity-80"
            >
              <Text className="font-semibold text-white">Anladım</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Çıkış onay modal'ı — cevap girilmiş tur ortasında çıkışta gösterilir.
          3 seçenek: Devam et (modal kapanır), Turu bitir (özete git, XP korunur),
          Kaydetmeden çık (router.replace ile /learn'e, ilerleme kaybolur). */}
      <Modal
        visible={exitConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExitConfirmOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/55 px-6">
          <View className="w-full rounded-2xl bg-bg-base p-5">
            <View className="flex-row items-center">
              <Flag color="#DC2626" size={20} />
              <Text className="ml-2 text-base font-bold text-text-primary">
                Turdan çıkmak istiyor musun?
              </Text>
            </View>
            <Text className="mt-2 text-sm leading-5 text-text-secondary">
              Bu turda {solvedHistory.length} soru cevapladın.
              {'\n'}Turu bitirirsen özet + XP korunur. Kaydetmeden çıkarsan ilerleme silinir.
            </Text>
            <View className="mt-5 gap-2">
              <Pressable
                onPress={() => setExitConfirmOpen(false)}
                className="items-center rounded-xl bg-accent py-3 active:opacity-80"
              >
                <Text className="font-semibold text-white">Devam et</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setExitConfirmOpen(false);
                  setFinished(true);
                }}
                className="items-center rounded-xl border border-success bg-success-soft py-3 active:opacity-80"
              >
                <Text className="font-semibold text-success">Turu bitir (özet göster)</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setExitConfirmOpen(false);
                  router.replace('/(student)/learn');
                }}
                className="items-center rounded-xl border border-border-soft py-3 active:bg-bg-elevated"
              >
                <Text className="font-semibold text-text-secondary">Kaydetmeden çık</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
