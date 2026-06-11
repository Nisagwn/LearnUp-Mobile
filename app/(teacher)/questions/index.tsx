import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Trash2, FileQuestion, CheckCircle2, Sparkles, Plus, Pencil, Tag } from 'lucide-react-native';
import { GenerateQuestionsSheet } from '@/components/teacher/GenerateQuestionsSheet';
import { ClassifyQuestionsSheet } from '@/components/teacher/ClassifyQuestionsSheet';
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { latexToPlainText } from '@/utils/latex';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import {
  QuestionDetailSheet,
  type QuestionDetail,
} from '@/components/teacher/QuestionDetailSheet';

type Tab = 'mine' | 'pending' | 'approved';

interface QuestionDoc extends QuestionDetail {
  id: string;
  teacherId?: string | null;
  createdAt?: { toMillis?: () => number } | number;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'mine', label: 'Benim' },
  { id: 'pending', label: 'Onay Bekleyen' },
  { id: 'approved', label: 'Onaylı' },
];

function getCreatedMs(c: QuestionDoc['createdAt']): number {
  if (!c) return 0;
  if (typeof c === 'number') return c;
  return c.toMillis?.() ?? 0;
}

function getQuestionText(d: QuestionDoc): string {
  const raw = d.question ?? d.question_text ?? d.text ?? 'Soru metni yok';
  // Liste önizlemesi düz metin — ham LaTeX yerine okunabilir sembollere çevir.
  return latexToPlainText(raw);
}

export default function QuestionPool() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('mine');
  const [items, setItems] = useState<QuestionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [detail, setDetail] = useState<QuestionDoc | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let q;
    if (tab === 'mine') {
      q = query(collection(db, 'questions'), where('teacherId', '==', uid));
    } else if (tab === 'pending') {
      q = query(
        collection(db, 'questions'),
        where('is_ai_generated', '==', true),
        where('verified', '==', false),
      );
    } else {
      q = query(collection(db, 'questions'), where('verified', '==', true));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: QuestionDoc[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as QuestionDoc));
        arr.sort((a, b) => getCreatedMs(b.createdAt) - getCreatedMs(a.createdAt));
        setItems(arr);
        setLoading(false);
      },
      (err) => {
        console.warn('[questions] query error:', err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [tab]);

  const handleApprove = async (id: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setApprovingId(id);
    try {
      await updateDoc(doc(db, 'questions', id), {
        verified: true,
        approvedBy: uid,
        approvedAt: serverTimestamp(),
      });
    } catch (err) {
      Alert.alert('Onay Hatası', (err as Error).message);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Soruyu Sil', 'Bu soruyu silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'questions', id));
          } catch (err) {
            Alert.alert('Hata', (err as Error).message);
          }
        },
      },
    ]);
  };

  const emptySubtitle = useMemo(() => {
    if (tab === 'mine') return '"Manuel Ekle" veya "AI Üret" ile başla';
    if (tab === 'pending') return 'Onay bekleyen AI soru yok';
    return 'Onaylı soru bulunamadı';
  }, [tab]);

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="px-5 pt-2">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold text-text-primary">Soru Havuzu</Text>
            <Text className="mt-1 text-sm text-text-muted">{items.length} soru</Text>
          </View>
          <Pressable
            onPress={() => setClassifyOpen(true)}
            className="flex-row items-center rounded-full bg-accent-soft px-3 py-1.5 active:opacity-70"
          >
            <Tag color="#4F46E5" size={12} />
            <Text className="ml-1 text-[11px] font-bold text-accent-fg">AI Etiketle</Text>
          </Pressable>
        </View>
        <View className="mt-3 flex-row items-center" style={{ gap: 8 }}>
          <Pressable
            onPress={() => router.push('/(teacher)/questions/create' as never)}
            className="flex-1 flex-row items-center justify-center rounded-full border border-accent bg-bg-base px-3.5 py-2 active:opacity-80"
          >
            <Plus color="#4F46E5" size={14} />
            <Text className="ml-1.5 text-xs font-bold text-accent-fg">Manuel Ekle</Text>
          </Pressable>
          <Pressable
            onPress={() => setGenOpen(true)}
            className="flex-1 flex-row items-center justify-center rounded-full bg-accent px-3.5 py-2 active:opacity-80"
          >
            <Sparkles color="white" size={14} />
            <Text className="ml-1.5 text-xs font-bold text-white">AI Üret</Text>
          </Pressable>
        </View>
      </View>

      {/* Tab bar */}
      <View className="px-5 pt-4">
        <View className="flex-row rounded-xl border border-border-soft bg-bg-surface p-1">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                className={`flex-1 items-center rounded-lg py-2 ${active ? 'bg-accent' : ''}`}
              >
                <Text
                  className={`text-xs font-semibold ${active ? 'text-white' : 'text-text-muted'}`}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 24,
            gap: 8,
          }}
          ListEmptyComponent={
            <EmptyState icon={FileQuestion} title="Henüz soru yok" subtitle={emptySubtitle} />
          }
          renderItem={({ item }) => {
            const subject = item.subject ?? item.category ?? 'Genel';
            const meta = `${subject} · ${item.difficulty ?? '—'}${item.grade ? ` · ${item.grade}. sınıf` : ''}`;
            const isAI = item.is_ai_generated === true;
            const isPending = isAI && item.verified === false;
            const uid = auth.currentUser?.uid;
            const isMine = item.teacherId && item.teacherId === uid;
            return (
              <Card onPress={() => setDetail(item)}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center">
                    <Text className="text-[10px] uppercase tracking-wide text-accent-fg">
                      {meta}
                    </Text>
                    {isAI ? (
                      <View className="ml-2 flex-row items-center rounded-full bg-accent-soft px-2 py-0.5">
                        <Sparkles color="#6366F1" size={10} />
                        <Text className="ml-1 text-[9px] font-semibold text-accent-fg">AI</Text>
                      </View>
                    ) : null}
                  </View>
                  <View className="flex-row items-center gap-2">
                    {isPending ? (
                      <Pressable
                        onPress={() => handleApprove(item.id)}
                        disabled={approvingId === item.id}
                        className="flex-row items-center rounded-lg bg-success px-2.5 py-1 active:opacity-80"
                      >
                        {approvingId === item.id ? (
                          <ActivityIndicator color="white" size="small" />
                        ) : (
                          <>
                            <CheckCircle2 color="white" size={12} />
                            <Text className="ml-1 text-[11px] font-semibold text-white">Onayla</Text>
                          </>
                        )}
                      </Pressable>
                    ) : null}
                    {isMine ? (
                      <Pressable
                        onPress={() =>
                          router.push(`/(teacher)/questions/${item.id}/edit` as never)
                        }
                        className="p-1 active:opacity-60"
                        hitSlop={6}
                      >
                        <Pencil color="#4F46E5" size={16} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => handleDelete(item.id)}
                      className="p-1 active:opacity-60"
                      hitSlop={6}
                    >
                      <Trash2 color="#DC2626" size={16} />
                    </Pressable>
                  </View>
                </View>
                <Text className="mt-2 text-sm leading-5 text-text-primary" numberOfLines={3}>
                  {getQuestionText(item)}
                </Text>
              </Card>
            );
          }}
        />
      )}

      <ClassifyQuestionsSheet
        visible={classifyOpen}
        onClose={() => setClassifyOpen(false)}
        onFinished={(n) => {
          if (n > 0) Alert.alert('Etiketleme tamam', `${n} soru başarıyla etiketlendi.`);
        }}
      />

      <GenerateQuestionsSheet
        visible={genOpen}
        onClose={() => setGenOpen(false)}
        onSaved={(n) => {
          setTab('mine');
          Alert.alert('Eklendi', `${n} soru havuzuna eklendi.`);
        }}
      />

      <QuestionDetailSheet
        visible={detail !== null}
        question={detail}
        onClose={() => setDetail(null)}
      />
    </SafeAreaView>
  );
}
