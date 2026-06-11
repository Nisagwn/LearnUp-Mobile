import { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Send,
  ChevronLeft,
  Lightbulb,
  Sparkles,
  BookOpen,
  Plus,
  MessageSquare,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  createChatSession,
  ChatSession,
  ChatMessage,
  QuizContext,
  generateQuiz,
} from '@/services/aiService';
import { auth } from '@/services/firebase';
import { loadChat, deriveChatTopic } from '@/services/chatHistoryApi';
import { useSafeBack } from '@/hooks/useSafeBack';
import { ChatbotQuickActions, QuickAction } from '@/components/chatbot/ChatbotQuickActions';
import { ChatHistorySheet } from '@/components/chatbot/ChatHistorySheet';
import { parseInlineActions } from '@/utils/parseInlineActions';
import { AIQuizSettingsSheet, Difficulty } from '@/components/common/AIQuizSettingsSheet';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { buildAIQuizPath } from '@/utils/quizRoute';

function tryParseCtx(raw?: string): QuizContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as QuizContext;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function welcomeMessage(isCoach: boolean, subject: string | null): ChatMessage {
  return {
    id: Date.now(),
    sender: 'bot',
    text: isCoach
      ? `Şu an ${subject || 'bu'} sorusunda sana koçluk ediyorum. Soruyu çözebilmen için ipuçları vereceğim — cevabı doğrudan söylemeyeceğim. Ne sormak istersin?`
      : 'Merhaba! Ben LearnUp AI Koç. Sana nasıl yardımcı olabilirim?',
    time: new Date(),
  };
}

export default function Chatbot() {
  const safeBack = useSafeBack('/(student)');
  const router = useRouter();
  const ctxStats = useContext(UserStatsContext);
  const {
    ctx: ctxParam,
    seedPrompt,
    subject: subjectParam,
    chatId: chatIdParam,
  } = useLocalSearchParams<{
    ctx?: string;
    seedPrompt?: string;
    subject?: string;
    chatId?: string;
  }>();

  const quizContext = useMemo(() => tryParseCtx(ctxParam), [ctxParam]);
  const isCoachMode = !!quizContext;
  const coachSubject = quizContext?.subject || subjectParam || null;

  const [messages, setMessages] = useState<ChatMessage[]>([
    welcomeMessage(isCoachMode, coachSubject),
  ]);
  const [activeChatId, setActiveChatId] = useState<string | null>(chatIdParam ?? null);
  const [chatTopic, setChatTopic] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const sessionRef = useRef<ChatSession | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const seedSentRef = useRef(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [aiSheetTopic, setAiSheetTopic] = useState<string | null>(null);
  const [aiSheetLoading, setAiSheetLoading] = useState(false);
  const [duelMode, setDuelMode] = useState(false);

  const buildSession = useCallback(
    (chatId: string | null) => {
      const uid = auth.currentUser?.uid ?? null;
      const session = createChatSession([], uid, chatId);
      session.onChatIdAssigned = (id) => setActiveChatId(id);
      return session;
    },
    [],
  );

  // Mevcut bir sohbet açılıyorsa mesajları yükle, yoksa yeni session başlat
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!chatIdParam || !uid) {
      sessionRef.current = buildSession(null);
      return;
    }
    setLoadingChat(true);
    loadChat(uid, chatIdParam)
      .then((res) => {
        if (!res) {
          sessionRef.current = buildSession(null);
          return;
        }
        setChatTopic(res.topic);
        setMessages(res.messages.length > 0 ? res.messages : [welcomeMessage(false, null)]);
        const history = res.messages.map((m) => ({
          role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        }));
        const session = createChatSession(history, uid, chatIdParam);
        session.topic = res.topic;
        session.onChatIdAssigned = (id) => setActiveChatId(id);
        sessionRef.current = session;
        setActiveChatId(chatIdParam);
      })
      .catch((err) => {
        console.warn('chat load failed:', err);
        sessionRef.current = buildSession(null);
      })
      .finally(() => setLoadingChat(false));
  }, [chatIdParam, buildSession]);

  const startNewChat = useCallback(() => {
    setMessages([welcomeMessage(isCoachMode, coachSubject)]);
    setActiveChatId(null);
    setChatTopic(null);
    setInput('');
    seedSentRef.current = false;
    sessionRef.current = buildSession(null);
  }, [isCoachMode, coachSubject, buildSession]);

  const switchToChat = useCallback(
    async (chatId: string) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      setLoadingChat(true);
      try {
        const res = await loadChat(uid, chatId);
        if (!res) return;
        setChatTopic(res.topic);
        setMessages(res.messages.length > 0 ? res.messages : [welcomeMessage(false, null)]);
        setActiveChatId(chatId);
        const history = res.messages.map((m) => ({
          role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        }));
        const session = createChatSession(history, uid, chatId);
        session.topic = res.topic;
        session.onChatIdAssigned = (id) => setActiveChatId(id);
        sessionRef.current = session;
      } catch (err) {
        Alert.alert('Sohbet yüklenemedi', (err as Error).message);
      } finally {
        setLoadingChat(false);
      }
    },
    [],
  );

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    const userMsg: ChatMessage = {
      id: Date.now(),
      sender: 'user',
      text,
      time: new Date(),
    };

    // Yeni sohbet ise ilk kullanıcı mesajından başlık türet
    if (sessionRef.current && !sessionRef.current.chatId && !sessionRef.current.topic) {
      const derived = isCoachMode
        ? `Quiz Koçu · ${coachSubject ?? 'genel'}`
        : deriveChatTopic(text);
      sessionRef.current.topic = derived;
      setChatTopic(derived);
    }

    setMessages((m) => [...m, userMsg]);
    if (!overrideText) setInput('');
    setSending(true);

    try {
      const reply = await sessionRef.current!.sendMessage(text, quizContext);
      const botMsg: ChatMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: reply,
        time: new Date(),
      };
      setMessages((m) => [...m, botMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: `⚠ Hata: ${(err as Error).message}`,
        time: new Date(),
      };
      setMessages((m) => [...m, errMsg]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // seedPrompt — mount'tan 200ms sonra otomatik gönder, sadece bir kez
  useEffect(() => {
    if (!seedPrompt || seedSentRef.current) return;
    if (chatIdParam) return; // Mevcut sohbet açılıyorsa seed gönderme
    seedSentRef.current = true;
    const t = setTimeout(() => {
      sendMessage(decodeURIComponent(seedPrompt));
    }, 200);
    return () => clearTimeout(t);
  }, [seedPrompt, chatIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const injectBotMessage = (text: string) => {
    setMessages((m) => [
      ...m,
      { id: Date.now() + Math.random(), sender: 'bot', text, time: new Date() },
    ]);
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action === 'duel') {
      setAiSheetTopic(coachSubject || 'genel');
      setDuelMode(true);
      setAiSheetOpen(true);
    } else if (action === 'summary') {
      const topic = coachSubject || 'son çalıştığın konu';
      sendMessage(`Bana ${topic} konusunu kısaca özetle ve 3 anahtar fikrini ver.`);
    } else if (action === 'weak') {
      const wrongs = (ctxStats?.gamification as { dailyQuests?: unknown } | null) ?? null;
      injectBotMessage(
        'Zayıf konularını Öğren sayfasındaki "Önerilen Alt Konular" bölümünden görebilirsin. Birini seçip [QUIZ:konu:5] formatında bana yaz, onun üzerinden çalışalım.',
      );
      void wrongs;
    }
  };

  const handleDuelConfirm = async (
    count: number,
    difficulty: Difficulty,
    customPrompt?: string,
  ) => {
    if (aiSheetLoading || !aiSheetTopic) return;
    setAiSheetLoading(true);
    try {
      const finalTopic = customPrompt?.trim() || aiSheetTopic;
      const questions = await generateQuiz(finalTopic, count, difficulty);
      setAiSheetOpen(false);
      const wasDuel = duelMode;
      setDuelMode(false);
      router.push(
        buildAIQuizPath({
          questions,
          subject: finalTopic,
          count,
          difficulty,
          mode: wasDuel ? 'duel' : undefined,
        }) as never,
      );
    } catch (err) {
      Alert.alert('Düello', `Soru üretilemedi: ${(err as Error).message}`);
    } finally {
      setAiSheetLoading(false);
    }
  };

  const handleInlineQuizPress = async (topic: string, count: number) => {
    try {
      const questions = await generateQuiz(topic, count, 'medium');
      router.push(
        buildAIQuizPath({
          questions,
          subject: topic,
          count,
          difficulty: 'medium',
          mode: 'duel',
        }) as never,
      );
    } catch (err) {
      Alert.alert('Quiz', `Soru üretilemedi: ${(err as Error).message}`);
    }
  };

  const handleInlineTopicPress = (title: string) => {
    sendMessage(`Bana ${title} konusunu özetle ve anahtar noktalarını ver.`);
  };

  const headerSubtitle = useMemo(() => {
    if (isCoachMode) return 'Cevabı vermeyeceğim, yönlendireceğim';
    if (chatTopic) return chatTopic;
    return 'Türk lise müfredatı için kişisel tutor';
  }, [isCoachMode, chatTopic]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center border-b border-border-soft px-3 pb-3 pt-2">
          <Pressable onPress={safeBack} className="p-2 active:opacity-60">
            <ChevronLeft color="#475569" size={22} />
          </Pressable>
          <View className="ml-1 flex-1">
            <View className="flex-row items-center">
              <Text className="text-xl font-bold text-text-primary">AI Koç</Text>
              {isCoachMode ? (
                <View className="ml-2 flex-row items-center rounded-full bg-warning-soft px-2 py-0.5">
                  <Lightbulb color="#D97706" size={10} />
                  <Text className="ml-1 text-[10px] font-bold uppercase text-warning">
                    Quiz Koçu
                    {coachSubject ? ` · ${coachSubject}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="text-xs text-text-muted" numberOfLines={1}>
              {headerSubtitle}
            </Text>
          </View>
          {!isCoachMode ? (
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Pressable
                onPress={startNewChat}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center rounded-full bg-accent active:opacity-80"
              >
                <Plus color="white" size={16} />
              </Pressable>
              <Pressable
                onPress={() => setHistoryOpen(true)}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
              >
                <MessageSquare color="#475569" size={16} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {!isCoachMode && messages.length <= 1 ? (
          <ChatbotQuickActions onAction={handleQuickAction} />
        ) : null}

        {loadingChat ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#6366F1" />
            <Text className="mt-2 text-xs text-text-muted">Sohbet yükleniyor...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => {
              const isUser = item.sender === 'user';
              const segments = isUser ? null : parseInlineActions(item.text);
              return (
                <View
                  className={`mx-4 my-1 max-w-[85%] rounded-2xl px-4 py-3 ${
                    isUser
                      ? 'self-end bg-accent'
                      : 'self-start border border-border-soft bg-bg-surface'
                  }`}
                >
                  {isUser ? (
                    <Text className="text-sm leading-5 text-white">{item.text}</Text>
                  ) : (
                    <View>
                      {segments!.map((seg, i) => {
                        if (seg.kind === 'text') {
                          return (
                            <Text
                              key={i}
                              className="text-sm leading-5 text-text-primary"
                            >
                              {seg.text}
                            </Text>
                          );
                        }
                        if (seg.kind === 'quiz') {
                          return (
                            <Pressable
                              key={i}
                              onPress={() => handleInlineQuizPress(seg.topic, seg.count)}
                              className="mt-2 flex-row items-center self-start rounded-full bg-accent px-3 py-1.5 active:opacity-80"
                            >
                              <Sparkles color="white" size={12} />
                              <Text className="ml-1.5 text-xs font-semibold text-white">
                                {seg.topic} · {seg.count} soru
                              </Text>
                            </Pressable>
                          );
                        }
                        return (
                          <Pressable
                            key={i}
                            onPress={() => handleInlineTopicPress(seg.title)}
                            className="mt-2 flex-row items-center self-start rounded-full border border-accent/40 px-3 py-1.5 active:bg-accent-soft"
                          >
                            <BookOpen color="#6366F1" size={12} />
                            <Text className="ml-1.5 text-xs font-semibold text-accent-fg">
                              {seg.title}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            }}
            className="flex-1"
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        <View className="flex-row items-end border-t border-border-soft px-3 py-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={isCoachMode ? 'Bu soru için ipucu iste...' : 'Bir şey sor...'}
            placeholderTextColor="#94A3B8"
            multiline
            className="flex-1 rounded-2xl border border-border-soft bg-bg-surface px-4 py-3 text-base text-text-primary"
            style={{ maxHeight: 120 }}
          />
          <Pressable
            onPress={() => sendMessage()}
            disabled={!input.trim() || sending}
            className={`ml-2 h-12 w-12 items-center justify-center rounded-full ${
              input.trim() && !sending ? 'bg-accent' : 'bg-bg-elevated'
            }`}
          >
            {sending ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Send color={input.trim() ? 'white' : '#94A3B8'} size={20} />
            )}
          </Pressable>
        </View>

        <AIQuizSettingsSheet
          visible={aiSheetOpen}
          topic={aiSheetTopic ?? undefined}
          loading={aiSheetLoading}
          onClose={() => {
            setAiSheetOpen(false);
            setDuelMode(false);
          }}
          onConfirm={handleDuelConfirm}
        />

        <ChatHistorySheet
          visible={historyOpen}
          currentChatId={activeChatId}
          onClose={() => setHistoryOpen(false)}
          onSelectChat={switchToChat}
          onNewChat={startNewChat}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
